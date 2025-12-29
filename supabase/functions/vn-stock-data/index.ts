// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ============================================================================
// CONFIGURATION - Trading Platform Grade
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const VCI_TRADING_URL = 'https://trading.vietcap.com.vn/api/';
const VCI_GRAPHQL_URL = 'https://trading.vietcap.com.vn/data-mt/graphql';

const INTERVAL_MAP: Record<string, string> = {
  '1m': 'ONE_MINUTE',
  '5m': 'ONE_MINUTE',
  '15m': 'ONE_MINUTE',
  '30m': 'ONE_MINUTE',
  '1H': 'ONE_HOUR',
  '1D': 'ONE_DAY',
  '1W': 'ONE_DAY',
  '1M': 'ONE_DAY'
};

// ============================================================================
// ADVANCED CACHING SYSTEM - Multi-tier with TTL management
// ============================================================================

interface CacheEntry {
  data: any;
  timestamp: number;
  hitCount: number;
  lastAccess: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_TTL: Record<string, number> = {
  'price-board': 2000,      // 2s for price board (near real-time)
  'price-depth': 1500,      // 1.5s for order book depth
  'intraday': 3000,         // 3s for intraday data
  'history': 300000,        // 5min for historical data (increased for stability)
  'indices': 3000,          // 3s for indices
  'symbols': 600000,        // 10min for symbol lists (rarely changes)
};

// Cache statistics for monitoring
const cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
};

const MAX_CACHE_SIZE = 500; // Maximum cache entries

function getCached(key: string, ttl: number): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    cached.hitCount++;
    cached.lastAccess = Date.now();
    cacheStats.hits++;
    return cached.data;
  }
  cacheStats.misses++;
  return null;
}

function setCache(key: string, data: any): void {
  // LRU eviction if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey = '';
    let oldestAccess = Infinity;
    for (const [k, v] of cache) {
      if (v.lastAccess < oldestAccess) {
        oldestAccess = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
      cacheStats.evictions++;
    }
  }
  
  cache.set(key, { 
    data, 
    timestamp: Date.now(),
    hitCount: 0,
    lastAccess: Date.now()
  });
}

// ============================================================================
// CIRCUIT BREAKER - Prevent cascade failures
// ============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuits: Record<string, CircuitState> = {};

const CIRCUIT_CONFIG = {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,      // Try again after 30s
  halfOpenSuccesses: 2,     // Close after 2 successes in half-open
};

function getCircuit(name: string): CircuitState {
  if (!circuits[name]) {
    circuits[name] = { failures: 0, lastFailure: 0, state: 'CLOSED' };
  }
  return circuits[name];
}

function recordSuccess(name: string): void {
  const circuit = getCircuit(name);
  if (circuit.state === 'HALF_OPEN') {
    circuit.failures--;
    if (circuit.failures <= 0) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      console.log(`[Circuit] ${name}: CLOSED (recovered)`);
    }
  } else {
    circuit.failures = 0;
  }
}

function recordFailure(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures++;
  circuit.lastFailure = Date.now();
  
  if (circuit.failures >= CIRCUIT_CONFIG.failureThreshold) {
    circuit.state = 'OPEN';
    console.log(`[Circuit] ${name}: OPEN (threshold reached)`);
  }
}

function canRequest(name: string): boolean {
  const circuit = getCircuit(name);
  
  if (circuit.state === 'CLOSED') return true;
  
  if (circuit.state === 'OPEN') {
    if (Date.now() - circuit.lastFailure >= CIRCUIT_CONFIG.resetTimeout) {
      circuit.state = 'HALF_OPEN';
      console.log(`[Circuit] ${name}: HALF_OPEN (testing)`);
      return true;
    }
    return false;
  }
  
  return true; // HALF_OPEN
}

// ============================================================================
// RATE LIMITER - Protect upstream API
// ============================================================================

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

const rateLimits: Record<string, RateLimitState> = {};

const RATE_LIMIT_CONFIG = {
  maxTokens: 30,           // Max requests per window
  refillRate: 10,          // Tokens per second
  refillInterval: 1000,    // Refill every second
};

function checkRateLimit(bucket: string): boolean {
  const now = Date.now();
  
  if (!rateLimits[bucket]) {
    rateLimits[bucket] = { tokens: RATE_LIMIT_CONFIG.maxTokens, lastRefill: now };
  }
  
  const state = rateLimits[bucket];
  
  // Refill tokens
  const timePassed = now - state.lastRefill;
  const tokensToAdd = Math.floor(timePassed / RATE_LIMIT_CONFIG.refillInterval) * RATE_LIMIT_CONFIG.refillRate;
  
  if (tokensToAdd > 0) {
    state.tokens = Math.min(RATE_LIMIT_CONFIG.maxTokens, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }
  
  // Check if we have tokens
  if (state.tokens > 0) {
    state.tokens--;
    return true;
  }
  
  console.log(`[RateLimit] ${bucket}: throttled`);
  return false;
}

// ============================================================================
// REQUEST DEDUPLICATION - Prevent duplicate in-flight requests
// ============================================================================

const pendingRequests = new Map<string, Promise<any>>();

async function deduplicatedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Check if there's already a pending request for this key
  const pending = pendingRequests.get(key);
  if (pending) {
    console.log(`[Dedup] Reusing pending request: ${key.substring(0, 50)}...`);
    return pending as Promise<T>;
  }
  
  // Create new request and store it
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

// ============================================================================
// HTTP CLIENT - With retry, timeout, compression
// ============================================================================

const vciHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Encoding': 'gzip, deflate',
  'Origin': 'https://trading.vietcap.com.vn',
  'Referer': 'https://trading.vietcap.com.vn/',
  'Connection': 'keep-alive',
};

const FETCH_CONFIG = {
  timeout: 8000,           // 8s timeout
  maxRetries: 3,
  baseDelay: 300,          // Start with 300ms
  maxDelay: 2000,          // Cap at 2s
};

async function fetchWithRetry(
  url: string, 
  options: RequestInit,
  circuitName?: string
): Promise<Response> {
  const circuit = circuitName || 'default';
  
  // Circuit breaker check
  if (!canRequest(circuit)) {
    throw new Error(`Circuit ${circuit} is OPEN - request blocked`);
  }
  
  // Rate limit check
  if (!checkRateLimit(circuit)) {
    throw new Error(`Rate limit exceeded for ${circuit}`);
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < FETCH_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_CONFIG.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle retryable errors
      if (response.status >= 502 && response.status <= 504 && attempt < FETCH_CONFIG.maxRetries - 1) {
        const delay = Math.min(
          FETCH_CONFIG.baseDelay * Math.pow(2, attempt) + Math.random() * 100,
          FETCH_CONFIG.maxDelay
        );
        console.log(`[Fetch] Retry ${attempt + 1}/${FETCH_CONFIG.maxRetries} after ${response.status}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (response.ok) {
        recordSuccess(circuit);
      }
      
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Don't retry on abort
      if (lastError.name === 'AbortError') {
        console.log(`[Fetch] Request timed out after ${FETCH_CONFIG.timeout}ms`);
        recordFailure(circuit);
        throw new Error(`Request timeout after ${FETCH_CONFIG.timeout}ms`);
      }
      
      if (attempt < FETCH_CONFIG.maxRetries - 1) {
        const delay = Math.min(
          FETCH_CONFIG.baseDelay * Math.pow(2, attempt) + Math.random() * 100,
          FETCH_CONFIG.maxDelay
        );
        console.log(`[Fetch] Retry ${attempt + 1}/${FETCH_CONFIG.maxRetries}: ${lastError.message}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  recordFailure(circuit);
  throw lastError || new Error('Fetch failed after retries');
}

// ============================================================================
// BATCH PROCESSING - Combine multiple symbol requests
// ============================================================================

interface BatchRequest {
  symbols: string[];
  resolve: (data: any) => void;
  reject: (error: Error) => void;
}

let batchQueue: BatchRequest[] = [];
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

const BATCH_CONFIG = {
  maxBatchSize: 50,        // Max symbols per batch
  batchDelay: 50,          // Wait 50ms to collect requests
};

async function batchedPriceRequest(symbols: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    batchQueue.push({ symbols, resolve, reject });
    
    if (batchTimeout === null) {
      batchTimeout = setTimeout(processBatch, BATCH_CONFIG.batchDelay);
    }
    
    // Force process if batch is full
    const totalSymbols = batchQueue.reduce((sum, req) => sum + req.symbols.length, 0);
    if (totalSymbols >= BATCH_CONFIG.maxBatchSize) {
      if (batchTimeout) clearTimeout(batchTimeout);
      processBatch();
    }
  });
}

async function processBatch(): Promise<void> {
  batchTimeout = null;
  
  if (batchQueue.length === 0) return;
  
  const requests = [...batchQueue];
  batchQueue = [];
  
  // Combine all symbols
  const allSymbols = [...new Set(requests.flatMap(r => r.symbols))];
  
  console.log(`[Batch] Processing ${requests.length} requests, ${allSymbols.length} unique symbols`);
  
  try {
    const data = await fetchPriceBoardData(allSymbols);
    
    // Distribute results to each request
    for (const req of requests) {
      const filtered = data.filter((d: any) => req.symbols.includes(d.symbol));
      req.resolve(filtered);
    }
  } catch (error) {
    for (const req of requests) {
      req.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// ============================================================================
// VIETNAM STOCK MARKET TRADING HOURS
// Trading hours: 9:00 - 15:00, Monday - Friday (UTC+7)
// Morning session: 9:00 - 11:30
// Lunch break: 11:30 - 13:00  
// Afternoon session: 13:00 - 14:45
// ATC (Closing auction): 14:45 - 15:00
// ============================================================================

interface MarketStatus {
  isOpen: boolean;
  session: 'PRE_MARKET' | 'MORNING' | 'LUNCH_BREAK' | 'AFTERNOON' | 'ATC' | 'CLOSED' | 'WEEKEND';
  nextOpen?: string;
  vnTime: string;
}

function getVietnamTime(): Date {
  const now = new Date();
  // Convert to Vietnam timezone (UTC+7)
  const vnOffset = 7 * 60; // Vietnam is UTC+7
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + vnOffset * 60 * 1000);
}

function getMarketStatus(): MarketStatus {
  const vnTime = getVietnamTime();
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const day = vnTime.getDay(); // 0 = Sunday, 6 = Saturday
  const time = hours * 60 + minutes;
  
  const vnTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  // Weekend check (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return { 
      isOpen: false, 
      session: 'WEEKEND', 
      nextOpen: 'Monday 9:00 AM',
      vnTime: vnTimeStr
    };
  }
  
  // Pre-market: before 9:00
  if (time < 540) {
    return { 
      isOpen: false, 
      session: 'PRE_MARKET', 
      nextOpen: '9:00 AM today',
      vnTime: vnTimeStr
    };
  }
  
  // Morning session: 9:00 - 11:30
  if (time >= 540 && time < 690) {
    return { isOpen: true, session: 'MORNING', vnTime: vnTimeStr };
  }
  
  // Lunch break: 11:30 - 13:00
  if (time >= 690 && time < 780) {
    return { 
      isOpen: false, 
      session: 'LUNCH_BREAK', 
      nextOpen: '1:00 PM today',
      vnTime: vnTimeStr
    };
  }
  
  // Afternoon session: 13:00 - 14:45
  if (time >= 780 && time < 885) {
    return { isOpen: true, session: 'AFTERNOON', vnTime: vnTimeStr };
  }
  
  // ATC (Closing auction): 14:45 - 15:00
  if (time >= 885 && time < 900) {
    return { isOpen: true, session: 'ATC', vnTime: vnTimeStr };
  }
  
  // After market: 15:00+
  return { 
    isOpen: false, 
    session: 'CLOSED', 
    nextOpen: 'Tomorrow 9:00 AM',
    vnTime: vnTimeStr
  };
}

// Simple check for backward compatibility
function isMarketOpen(): boolean {
  return getMarketStatus().isOpen;
}

// Check if we should sync realtime data (only during trading hours + buffer)
function shouldSyncRealtimeData(): boolean {
  const vnTime = getVietnamTime();
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const day = vnTime.getDay();
  const time = hours * 60 + minutes;
  
  // No sync on weekends
  if (day === 0 || day === 6) return false;
  
  // Sync from 8:45 (pre-market buffer) to 15:15 (post-market buffer)
  // This gives 15 min buffer before/after market hours
  return time >= 525 && time <= 915;
}

// Get appropriate cache TTL based on market status
function getDynamicCacheTTL(action: string): number {
  const status = getMarketStatus();
  const baseTTL = CACHE_TTL[action] || 5000;
  
  // During market hours: use normal TTL
  if (status.isOpen) {
    return baseTTL;
  }
  
  // Lunch break: slightly longer TTL
  if (status.session === 'LUNCH_BREAK') {
    return baseTTL * 5; // 5x longer
  }
  
  // Outside trading hours: much longer TTL (data won't change)
  // Weekend: 1 hour, After hours: 10 minutes
  if (status.session === 'WEEKEND') {
    return 3600000; // 1 hour
  }
  
  if (status.session === 'CLOSED' || status.session === 'PRE_MARKET') {
    return 600000; // 10 minutes
  }
  
  return baseTTL;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

interface RequestMetrics {
  action: string;
  startTime: number;
  endTime?: number;
  cacheHit: boolean;
  success: boolean;
  error?: string;
}

const metrics: RequestMetrics[] = [];
const MAX_METRICS = 100;

function recordMetric(metric: RequestMetrics): void {
  metric.endTime = Date.now();
  metrics.push(metric);
  
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

function getMetricsSummary(): any {
  if (metrics.length === 0) return null;
  
  const recentMetrics = metrics.slice(-50);
  const avgLatency = recentMetrics.reduce((sum, m) => sum + ((m.endTime || 0) - m.startTime), 0) / recentMetrics.length;
  const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length * 100;
  const cacheHitRate = recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length * 100;
  
  return {
    avgLatency: Math.round(avgLatency),
    successRate: successRate.toFixed(1),
    cacheHitRate: cacheHitRate.toFixed(1),
    totalRequests: metrics.length,
    cacheStats,
  };
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const metric: RequestMetrics = { action: '', startTime, cacheHit: false, success: false };

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    if (!action && req.method === 'POST') {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        action = body.action || null;
      } catch {
        // Body parsing failed
      }
    }

    metric.action = action || 'unknown';
    const status = getMarketStatus();
    const shouldSync = shouldSyncRealtimeData();
    console.log(`[VN-Stock] Action: ${action} | Session: ${status.session} | VN Time: ${status.vnTime} | Sync: ${shouldSync}`);

    let response: Response;
    switch (action) {
      case 'history':
        response = await getStockHistory(url, metric);
        break;
      case 'intraday':
        // For intraday, only fetch fresh data during trading hours
        if (!shouldSync && action === 'intraday') {
          console.log(`[VN-Stock] Intraday data requested outside trading hours - returning cached/stale data`);
        }
        response = await getIntradayData(url, metric);
        break;
      case 'symbols':
        response = await getAllSymbols(metric);
        break;
      case 'symbols-by-group':
        response = await getSymbolsByGroup(url, metric);
        break;
      case 'price-board':
        response = await getPriceBoard(req, url, metric);
        break;
      case 'price-depth':
        response = await getPriceDepth(req, url, metric);
        break;
      case 'indices':
        response = await getMarketIndices(metric);
        break;
      case 'market-status':
        metric.success = true;
        response = new Response(
          JSON.stringify({ 
            ...status,
            shouldSync,
            timestamp: Date.now(),
            metrics: getMetricsSummary()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        break;
      case 'health':
        response = new Response(
          JSON.stringify({ 
            status: 'healthy',
            uptime: Date.now(),
            metrics: getMetricsSummary(),
            circuits: Object.entries(circuits).map(([name, state]) => ({ name, ...state })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        metric.success = true;
        break;
      default:
        response = new Response(
          JSON.stringify({ error: 'Invalid action. Use: history, intraday, symbols, symbols-by-group, price-board, price-depth, indices, market-status, health' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const duration = Date.now() - startTime;
    console.log(`[VN-Stock] ${action} completed in ${duration}ms`);
    
    recordMetric(metric);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    metric.success = false;
    metric.error = errorMessage;
    recordMetric(metric);
    
    console.error('[VN-Stock] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// API HANDLERS
// ============================================================================

async function getStockHistory(url: URL, metric: RequestMetrics) {
  const symbol = url.searchParams.get('symbol') || 'VCB';
  const start = url.searchParams.get('start') || '2024-01-01';
  const end = url.searchParams.get('end') || new Date().toISOString().split('T')[0];
  const interval = url.searchParams.get('interval') || '1D';

  const cacheKey = `history:${symbol}:${start}:${end}:${interval}`;
  const cached = getCached(cacheKey, CACHE_TTL['history']);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] History: ${symbol} | ${start} -> ${end} | ${interval}`);

  // Use deduplicated fetch
  const result = await deduplicatedFetch(cacheKey, async () => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1);

    const endStamp = Math.floor(endDate.getTime() / 1000);
    const intervalValue = INTERVAL_MAP[interval] || 'ONE_DAY';

    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let countBack = Math.ceil(diffDays * 1.5);

    if (intervalValue === 'ONE_HOUR') {
      countBack = Math.ceil(diffDays * 7);
    } else if (intervalValue === 'ONE_MINUTE') {
      countBack = Math.ceil(diffDays * 400);
    }

    const payload = {
      timeFrame: intervalValue,
      symbols: [symbol.toUpperCase()],
      to: endStamp,
      countBack: Math.min(countBack, 5000)
    };

    const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
      method: 'POST',
      headers: vciHeaders,
      body: JSON.stringify(payload)
    }, 'ohlc');

    if (!response.ok) {
      throw new Error(`VCI API error: ${response.status}`);
    }

    const data = await response.json();
    const ohlcv: any[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      const symbolData = data[0];
      if (symbolData && symbolData.o && Array.isArray(symbolData.o)) {
        for (let i = 0; i < symbolData.t.length; i++) {
          const timestamp = symbolData.t[i] * 1000;
          if (timestamp >= startDate.getTime() && timestamp <= endDate.getTime()) {
            ohlcv.push({
              time: symbolData.t[i],
              open: symbolData.o[i] / 1000,
              high: symbolData.h[i] / 1000,
              low: symbolData.l[i] / 1000,
              close: symbolData.c[i] / 1000,
              volume: symbolData.v[i]
            });
          }
        }
      }
    }

    return { symbol, data: ohlcv, count: ohlcv.length };
  });

  setCache(cacheKey, result);
  metric.success = true;

  console.log(`[VN-Stock] History: ${result.count} candles`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getIntradayData(url: URL, metric: RequestMetrics) {
  const symbol = url.searchParams.get('symbol') || 'VCB';
  const interval = url.searchParams.get('interval') || '1m';

  const cacheKey = `intraday:${symbol}:${interval}`;
  const dynamicTTL = getDynamicCacheTTL('intraday');
  const cached = getCached(cacheKey, dynamicTTL);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Intraday: ${symbol} | ${interval}`);

  const result = await deduplicatedFetch(cacheKey, async () => {
    const now = new Date();
    const endStamp = Math.floor(now.getTime() / 1000);
    
    let countBack = 500;
    if (interval === '5m') countBack = 200;
    if (interval === '15m') countBack = 100;
    if (interval === '30m') countBack = 50;
    if (interval === '1H') countBack = 30;

    const payload = {
      timeFrame: INTERVAL_MAP[interval] || 'ONE_MINUTE',
      symbols: [symbol.toUpperCase()],
      to: endStamp,
      countBack
    };

    const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
      method: 'POST',
      headers: vciHeaders,
      body: JSON.stringify(payload)
    }, 'ohlc');

    if (!response.ok) {
      throw new Error(`VCI API error: ${response.status}`);
    }

    const data = await response.json();
    const ohlcv: any[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      const symbolData = data[0];
      if (symbolData && symbolData.o && Array.isArray(symbolData.o)) {
        for (let i = 0; i < symbolData.t.length; i++) {
          ohlcv.push({
            time: symbolData.t[i],
            open: symbolData.o[i] / 1000,
            high: symbolData.h[i] / 1000,
            low: symbolData.l[i] / 1000,
            close: symbolData.c[i] / 1000,
            volume: symbolData.v[i]
          });
        }
      }
    }

    const status = getMarketStatus();
    return { 
      symbol, 
      interval,
      data: ohlcv, 
      count: ohlcv.length,
      marketOpen: status.isOpen,
      session: status.session,
      vnTime: status.vnTime,
      timestamp: Date.now()
    };
  });

  setCache(cacheKey, result);
  metric.success = true;

  console.log(`[VN-Stock] Intraday: ${result.count} candles`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getAllSymbols(metric: RequestMetrics) {
  const cacheKey = 'symbols:all';
  const cached = getCached(cacheKey, CACHE_TTL['symbols']);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('[VN-Stock] Fetching all symbols');

  const result = await deduplicatedFetch(cacheKey, async () => {
    const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getAll`, {
      method: 'GET',
      headers: vciHeaders
    }, 'symbols');

    if (!response.ok) {
      throw new Error(`VCI API error: ${response.status}`);
    }

    const data = await response.json();
    const symbols = data.map((item: any) => ({
      symbol: item.symbol,
      name: item.organName || item.enOrganName,
      shortName: item.organShortName || item.enOrganShortName,
      exchange: item.board,
      type: item.type
    }));

    return { data: symbols, count: symbols.length };
  });

  setCache(cacheKey, result);
  metric.success = true;

  console.log(`[VN-Stock] Symbols: ${result.count}`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getSymbolsByGroup(url: URL, metric: RequestMetrics) {
  const group = url.searchParams.get('group') || 'VN30';
  
  const cacheKey = `symbols:${group}`;
  const cached = getCached(cacheKey, CACHE_TTL['symbols']);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Symbols by group: ${group}`);

  const result = await deduplicatedFetch(cacheKey, async () => {
    const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getByGroup?group=${group}`, {
      method: 'GET',
      headers: vciHeaders
    }, 'symbols');

    if (!response.ok) {
      throw new Error(`VCI API error: ${response.status}`);
    }

    const data = await response.json();
    const symbols = data.map((item: any) => ({
      symbol: item.symbol,
      name: item.organName || item.enOrganName,
      shortName: item.organShortName || item.enOrganShortName,
      exchange: item.board,
      type: item.type
    }));

    return { group, data: symbols, count: symbols.length };
  });

  setCache(cacheKey, result);
  metric.success = true;

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Core price board fetcher (used by batch processor)
async function fetchPriceBoardData(symbols: string[]): Promise<any[]> {
  const now = new Date();
  const endStamp = Math.floor(now.getTime() / 1000);
  
  const payload = {
    timeFrame: 'ONE_DAY',
    symbols: symbols.map(s => s.toUpperCase()),
    to: endStamp,
    countBack: 2
  };

  const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload)
  }, 'priceboard');

  if (!response.ok) {
    throw new Error(`VCI OHLC API error: ${response.status}`);
  }

  const data = await response.json();
  const transformed: any[] = [];

  if (Array.isArray(data)) {
    for (const symbolData of data) {
      if (symbolData && symbolData.t && symbolData.t.length > 0) {
        const lastIdx = symbolData.t.length - 1;
        const prevIdx = lastIdx > 0 ? lastIdx - 1 : lastIdx;
        
        const currentClose = symbolData.c[lastIdx] / 1000;
        const prevClose = symbolData.c[prevIdx] / 1000;
        const change = currentClose - prevClose;
        const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;

        transformed.push({
          symbol: symbolData.symbol || symbols[data.indexOf(symbolData)],
          price: currentClose,
          change: change,
          changePercent: changePercent,
          ceiling: 0,
          floor: 0,
          ref: prevClose,
          open: symbolData.o[lastIdx] / 1000,
          high: symbolData.h[lastIdx] / 1000,
          low: symbolData.l[lastIdx] / 1000,
          volume: symbolData.v[lastIdx],
          value: 0,
          foreignBuy: 0,
          foreignSell: 0,
          room: 0,
          matchedVolume: symbolData.v[lastIdx],
          matchedBy: '',
          bid: [],
          ask: []
        });
      }
    }
  }

  return transformed;
}

async function getPriceBoard(req: Request, url: URL, metric: RequestMetrics) {
  let symbols: string[] = [];
  
  const symbolsParam = url.searchParams.get('symbols');
  if (symbolsParam) {
    symbols = symbolsParam.split(',');
  } else {
    try {
      const body = await req.json();
      symbols = body.symbols || ['VCB', 'VHM', 'VIC', 'HPG', 'FPT'];
    } catch {
      symbols = ['VCB', 'VHM', 'VIC', 'HPG', 'FPT'];
    }
  }

  const sortedSymbols = [...symbols].sort();
  const cacheKey = `priceboard:${sortedSymbols.join(',')}`;
  const dynamicTTL = getDynamicCacheTTL('price-board');
  const cached = getCached(cacheKey, dynamicTTL);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Price board: ${symbols.join(', ')}`);

  try {
    // Use batched request for efficiency
    const transformed = await batchedPriceRequest(symbols);

    const status = getMarketStatus();
    const finalResult = { 
      data: transformed, 
      count: transformed.length,
      marketOpen: status.isOpen,
      session: status.session,
      vnTime: status.vnTime,
      timestamp: Date.now(),
      source: 'ohlc-batched'
    };
    
    setCache(cacheKey, finalResult);
    metric.success = true;

    return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VN-Stock] Price board error:', msg);
    metric.error = msg;
    
    const emptyResult = {
      data: symbols.map(s => ({
        symbol: s,
        price: 0,
        change: 0,
        changePercent: 0,
        ceiling: 0,
        floor: 0,
        ref: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        value: 0,
        foreignBuy: 0,
        foreignSell: 0,
        room: 0,
        matchedVolume: 0,
        matchedBy: '',
        bid: [],
        ask: []
      })),
      count: symbols.length,
      marketOpen: isMarketOpen(),
      timestamp: Date.now(),
      source: 'fallback',
      error: msg
    };
    
    return new Response(JSON.stringify(emptyResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function getPriceDepth(req: Request, url: URL, metric: RequestMetrics) {
  let symbols: string[] = [];
  
  const symbolsParam = url.searchParams.get('symbols');
  if (symbolsParam) {
    symbols = symbolsParam.split(',');
  } else {
    try {
      const body = await req.json();
      symbols = body.symbols || ['VCB'];
    } catch {
      symbols = ['VCB'];
    }
  }

  const cacheKey = `depth:${symbols.sort().join(',')}`;
  const dynamicTTL = getDynamicCacheTTL('price-depth');
  const cached = getCached(cacheKey, dynamicTTL);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const result = await deduplicatedFetch(cacheKey, async () => {
    const payload = {
      query: `{
        MarketPriceBoard(codes: ${JSON.stringify(symbols)}) {
          stockSymbol
          matchedPrice
          matchedVolume
          matchedBy
          priceChange
          buyPrice1 buyVolume1 buyPrice2 buyVolume2 buyPrice3 buyVolume3
          sellPrice1 sellVolume1 sellPrice2 sellVolume2 sellPrice3 sellVolume3
        }
      }`,
      variables: {}
    };

    const response = await fetchWithRetry(VCI_GRAPHQL_URL, {
      method: 'POST',
      headers: vciHeaders,
      body: JSON.stringify(payload)
    }, 'graphql');

    if (!response.ok) {
      throw new Error(`VCI GraphQL error: ${response.status}`);
    }

    const gqlResult = await response.json();
    const priceData = gqlResult.data?.MarketPriceBoard || [];

    const transformed = priceData.map((item: any) => ({
      symbol: item.stockSymbol,
      price: item.matchedPrice / 1000,
      change: item.priceChange / 1000,
      lastVolume: item.matchedVolume,
      side: item.matchedBy,
      bid: [
        { price: item.buyPrice1 / 1000, volume: item.buyVolume1 },
        { price: item.buyPrice2 / 1000, volume: item.buyVolume2 },
        { price: item.buyPrice3 / 1000, volume: item.buyVolume3 }
      ],
      ask: [
        { price: item.sellPrice1 / 1000, volume: item.sellVolume1 },
        { price: item.sellPrice2 / 1000, volume: item.sellVolume2 },
        { price: item.sellPrice3 / 1000, volume: item.sellVolume3 }
      ]
    }));

    return { data: transformed, timestamp: Date.now() };
  });

  setCache(cacheKey, result);
  metric.success = true;

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getMarketIndices(metric: RequestMetrics) {
  const cacheKey = 'indices';
  const dynamicTTL = getDynamicCacheTTL('indices');
  const cached = getCached(cacheKey, dynamicTTL);
  if (cached) {
    metric.cacheHit = true;
    metric.success = true;
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('[VN-Stock] Indices: fetching via OHLC (stable)');

  try {
    const indices = await fetchIndicesViaOHLC();
    const status = getMarketStatus();

    const result = {
      data: indices,
      count: indices.length,
      marketOpen: status.isOpen,
      session: status.session,
      vnTime: status.vnTime,
      timestamp: Date.now(),
      source: 'ohlc-scaled',
    };

    setCache(cacheKey, result);
    metric.success = true;

    console.log(
      '[VN-Stock] Indices:',
      indices.map((i: any) => `${i.symbol}: ${Number(i.price).toFixed(2)}`).join(', '),
    );

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VN-Stock] Indices error:', msg);
    metric.error = msg;

    const status = getMarketStatus();
    const result = {
      data: [],
      count: 0,
      marketOpen: status.isOpen,
      session: status.session,
      vnTime: status.vnTime,
      timestamp: Date.now(),
      source: 'ohlc-scaled',
      error: msg,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function fetchIndicesViaOHLC() {
  const indexConfigs = [
    { outputSymbol: 'VNINDEX', trySymbols: ['VNINDEX'] },
    { outputSymbol: 'HNXINDEX', trySymbols: ['HNX-INDEX', 'HNXINDEX', 'HNX'] },
    { outputSymbol: 'VN30', trySymbols: ['VN30', 'VN30-INDEX'] },
    { outputSymbol: 'UPCOM', trySymbols: ['UPCOM-INDEX', 'UPCOM', 'UPCoM'] },
  ];
  
  const to = Math.floor(Date.now() / 1000);

  const fetchIndex = async (symbol: string): Promise<any> => {
    const payload = {
      timeFrame: 'ONE_DAY',
      symbols: [symbol],
      to,
      countBack: 5,
    };

    const res = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
      method: 'POST',
      headers: vciHeaders,
      body: JSON.stringify(payload),
    }, 'indices');

    if (!res.ok) {
      console.log(`[VN-Stock] OHLC ${symbol}: status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const s = Array.isArray(data) && data.length > 0 ? data[0] : null;
    
    if (!s || !Array.isArray(s?.c) || s.c.length === 0) {
      console.log(`[VN-Stock] OHLC ${symbol}: no candle data`);
      return null;
    }

    const len = s.c.length;
    
    const rawClose = Number(s.c[len - 1]);
    const isIndex = rawClose > 50;
    const scale = isIndex ? 1 : 1000;
    
    const lastClose = rawClose / scale;
    const prevClose = len >= 2 ? Number(s.c[len - 2]) / scale : lastClose;

    console.log(`[VN-Stock] OHLC ${symbol}: raw=${rawClose}, scaled=${lastClose}, isIndex=${isIndex}`);

    return {
      price: lastClose,
      change: lastClose - prevClose,
      changePercent: prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0,
      volume: Number(s.v?.[len - 1]) || 0,
      ref: prevClose,
      open: Number(s.o?.[len - 1]) / scale,
      high: Number(s.h?.[len - 1]) / scale,
      low: Number(s.l?.[len - 1]) / scale,
    };
  };

  const results = await Promise.all(
    indexConfigs.map(async ({ outputSymbol, trySymbols }) => {
      for (const sym of trySymbols) {
        try {
          const data = await fetchIndex(sym);
          if (data) {
            return {
              symbol: outputSymbol,
              ...data,
              changePercent: data.changePercent.toFixed(2),
            };
          }
        } catch (e) {
          console.error(`[VN-Stock] Index ${sym} error:`, e instanceof Error ? e.message : String(e));
        }
      }
      return null;
    }),
  );

  return results.filter(Boolean);
}
