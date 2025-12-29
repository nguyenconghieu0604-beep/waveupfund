import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSymbol {
  symbol: string;
  name: string;
  shortName?: string;
  exchange: string;
  type: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  ceiling: number;
  floor: number;
  ref: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  value: number;
  foreignBuy: number;
  foreignSell: number;
  room?: number;
  matchedVolume?: number;
  matchedBy?: string;
  bid: { price: number; volume: number }[];
  ask: { price: number; volume: number }[];
}

export interface IndexData {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  volume: number;
}

export interface MarketStatus {
  isOpen: boolean;
  session: 'PRE_MARKET' | 'MORNING' | 'LUNCH_BREAK' | 'AFTERNOON' | 'ATC' | 'CLOSED' | 'WEEKEND';
  nextOpen?: string;
  vnTime: string;
  shouldSync: boolean;
  timestamp: number;
}

// ============================================================================
// CLIENT-SIDE CACHE - Stale-While-Revalidate Pattern
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleAt: number;
  expireAt: number;
}

const clientCache = new Map<string, CacheEntry<any>>();

const CACHE_CONFIG = {
  // Fresh duration (won't refetch)
  fresh: {
    'history': 60000,       // 1 min
    'intraday': 2000,       // 2s
    'symbols': 300000,      // 5 min
    'price-board': 2000,    // 2s
    'indices': 3000,        // 3s
  },
  // Stale duration (can use but refetch in background)
  stale: {
    'history': 300000,      // 5 min
    'intraday': 10000,      // 10s
    'symbols': 600000,      // 10 min
    'price-board': 10000,   // 10s
    'indices': 15000,       // 15s
  }
};

function getFromCache<T>(key: string): { data: T | null; isStale: boolean } {
  const entry = clientCache.get(key);
  if (!entry) return { data: null, isStale: false };
  
  const now = Date.now();
  
  // Expired - don't use
  if (now > entry.expireAt) {
    clientCache.delete(key);
    return { data: null, isStale: false };
  }
  
  // Fresh - use directly
  if (now < entry.staleAt) {
    return { data: entry.data, isStale: false };
  }
  
  // Stale - use but trigger background refresh
  return { data: entry.data, isStale: true };
}

function setToCache<T>(key: string, data: T, type: keyof typeof CACHE_CONFIG.fresh): void {
  const now = Date.now();
  clientCache.set(key, {
    data,
    timestamp: now,
    staleAt: now + CACHE_CONFIG.fresh[type],
    expireAt: now + CACHE_CONFIG.stale[type],
  });
}

// ============================================================================
// REQUEST DEDUPLICATION - Prevent duplicate in-flight requests
// ============================================================================

const pendingRequests = new Map<string, Promise<any>>();

async function deduplicatedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const pending = pendingRequests.get(key);
  if (pending) {
    console.log(`[Dedup] Reusing request: ${key.substring(0, 40)}...`);
    return pending as Promise<T>;
  }
  
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

// ============================================================================
// SMART FETCH - With timeout and abort
// ============================================================================

const FETCH_TIMEOUT = 10000; // 10s

async function smartFetch(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  // Combine signals if provided
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// VIETNAM STOCK MARKET TRADING HOURS UTILITIES
// Trading hours: 9:00 - 15:00, Monday - Friday (UTC+7)
// ============================================================================

function getVietnamTime(): Date {
  const now = new Date();
  // Convert to Vietnam timezone (UTC+7)
  const vnOffset = 7 * 60; // Vietnam is UTC+7
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + vnOffset * 60 * 1000);
}

type SessionType = 'PRE_MARKET' | 'MORNING' | 'LUNCH_BREAK' | 'AFTERNOON' | 'ATC' | 'CLOSED' | 'WEEKEND';

interface LocalMarketStatus {
  isOpen: boolean;
  session: SessionType;
  shouldSync: boolean;
  vnTime: string;
}

function getLocalMarketStatus(): LocalMarketStatus {
  const vnTime = getVietnamTime();
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const day = vnTime.getDay();
  const time = hours * 60 + minutes;
  
  const vnTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  // Weekend (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return { isOpen: false, session: 'WEEKEND', shouldSync: false, vnTime: vnTimeStr };
  }
  
  // Pre-market: before 9:00
  if (time < 540) {
    return { isOpen: false, session: 'PRE_MARKET', shouldSync: time >= 525, vnTime: vnTimeStr };
  }
  
  // Morning session: 9:00 - 11:30
  if (time >= 540 && time < 690) {
    return { isOpen: true, session: 'MORNING', shouldSync: true, vnTime: vnTimeStr };
  }
  
  // Lunch break: 11:30 - 13:00
  if (time >= 690 && time < 780) {
    return { isOpen: false, session: 'LUNCH_BREAK', shouldSync: true, vnTime: vnTimeStr };
  }
  
  // Afternoon session: 13:00 - 14:45
  if (time >= 780 && time < 885) {
    return { isOpen: true, session: 'AFTERNOON', shouldSync: true, vnTime: vnTimeStr };
  }
  
  // ATC (Closing auction): 14:45 - 15:00
  if (time >= 885 && time < 900) {
    return { isOpen: true, session: 'ATC', shouldSync: true, vnTime: vnTimeStr };
  }
  
  // After market: 15:00+
  return { isOpen: false, session: 'CLOSED', shouldSync: time <= 915, vnTime: vnTimeStr };
}

// Get adaptive polling interval based on market session
function getAdaptivePollingInterval(session: SessionType, baseInterval: number = 3000): number {
  switch (session) {
    case 'MORNING':
    case 'AFTERNOON':
    case 'ATC':
      return baseInterval; // Fast polling during trading hours
    case 'LUNCH_BREAK':
      return 30000; // 30s during lunch break
    case 'PRE_MARKET':
      return 60000; // 1 min before market
    case 'CLOSED':
    case 'WEEKEND':
      return 300000; // 5 min outside trading hours (data won't change)
    default:
      return baseInterval;
  }
}

// ============================================================================
// MARKET STATUS HOOK - Enhanced with Vietnam trading hours
// ============================================================================

export function useMarketStatus() {
  const [status, setStatus] = useState<LocalMarketStatus>(() => getLocalMarketStatus());

  useEffect(() => {
    const checkMarket = () => {
      setStatus(getLocalMarketStatus());
    };

    checkMarket();
    // Check every 30 seconds during trading hours, every minute otherwise
    const intervalMs = status.isOpen ? 30000 : 60000;
    const interval = setInterval(checkMarket, intervalMs);
    return () => clearInterval(interval);
  }, [status.isOpen]);

  return status.isOpen;
}

// Extended hook with full market status
export function useMarketStatusExtended() {
  const [status, setStatus] = useState<LocalMarketStatus>(() => getLocalMarketStatus());

  useEffect(() => {
    const checkMarket = () => {
      setStatus(getLocalMarketStatus());
    };

    checkMarket();
    const interval = setInterval(checkMarket, 30000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// ============================================================================
// STOCK HISTORY HOOK - Optimized with SWR pattern
// ============================================================================

export function useStockHistory(symbol: string, start: string, end?: string, interval: string = '1D') {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchHistory = useCallback(async (background = false) => {
    if (!symbol) return;
    
    const endDate = end || new Date().toISOString().split('T')[0];
    const cacheKey = `history:${symbol}:${start}:${endDate}:${interval}`;
    
    // Check cache first
    const cached = getFromCache<{ data: OHLCVData[] }>(cacheKey);
    if (cached.data) {
      setData(cached.data.data);
      if (!cached.isStale) return; // Fresh data, no need to fetch
      if (background) return; // Already have stale data for display
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    if (!background) setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${projectUrl}/functions/v1/vn-stock-data?action=history&symbol=${symbol}&start=${start}&end=${endDate}&interval=${interval}`;
      
      const result = await deduplicatedFetch(cacheKey, async () => {
        const res = await smartFetch(
          url,
          { headers: { 'Content-Type': 'application/json' } },
          abortControllerRef.current?.signal
        );

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      });

      if (result.error) throw new Error(result.error);
      if (!isMountedRef.current) return;

      setToCache(cacheKey, result, 'history');
      setData(result.data || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock history';
      setError(errorMessage);
      console.error('[useStockHistory] Error:', errorMessage);
    } finally {
      if (isMountedRef.current && !background) {
        setLoading(false);
      }
    }
  }, [symbol, start, end, interval]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchHistory();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchHistory]);

  return { data, loading, error, refetch: fetchHistory };
}

// ============================================================================
// INTRADAY DATA HOOK - Smart polling
// ============================================================================

export function useIntradayData(symbol: string, interval: string = '1m', autoRefresh: boolean = true) {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const marketStatus = useMarketStatusExtended();
  const isMountedRef = useRef(true);

  const fetchIntraday = useCallback(async (background = false) => {
    if (!symbol) return;
    
    // Skip fetching intraday data outside trading hours (data won't change)
    if (!marketStatus.shouldSync && ['1m', '5m', '15m', '30m'].includes(interval)) {
      console.log(`[useIntradayData] Skipping fetch - market ${marketStatus.session}`);
      return;
    }

    const cacheKey = `intraday:${symbol}:${interval}`;
    
    // Check cache
    const cached = getFromCache<{ data: OHLCVData[]; timestamp: number }>(cacheKey);
    if (cached.data) {
      setData(cached.data.data);
      setLastUpdate(cached.data.timestamp);
      if (!cached.isStale) return;
    }

    if (!background) setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${projectUrl}/functions/v1/vn-stock-data?action=intraday&symbol=${symbol}&interval=${interval}`;
      
      const result = await deduplicatedFetch(cacheKey, async () => {
        const res = await smartFetch(url, { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      });

      if (result.error) throw new Error(result.error);
      if (!isMountedRef.current) return;

      setToCache(cacheKey, result, 'intraday');
      setData(result.data || []);
      setLastUpdate(result.timestamp || Date.now());
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch intraday data';
      setError(errorMessage);
      console.error('[useIntradayData] Error:', errorMessage);
    } finally {
      if (isMountedRef.current && !background) {
        setLoading(false);
      }
    }
  }, [symbol, interval, marketStatus.shouldSync, marketStatus.session]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchIntraday();
    
    if (!autoRefresh) return;

    // Adaptive polling based on market session
    const refreshMs = getAdaptivePollingInterval(marketStatus.session, 3000);
    const timer = setInterval(() => {
      if (marketStatus.shouldSync || !['1m', '5m', '15m', '30m'].includes(interval)) {
        fetchIntraday(true); // Background refresh
      }
    }, refreshMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchIntraday, autoRefresh, marketStatus.session, marketStatus.shouldSync, interval]);

  return { data, loading, error, lastUpdate, refetch: fetchIntraday, isMarketOpen: marketStatus.isOpen, session: marketStatus.session };
}

// ============================================================================
// SYMBOLS HOOK - Heavy caching
// ============================================================================

export function useSymbols(group?: string) {
  const [symbols, setSymbols] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      const cacheKey = group ? `symbols:${group}` : 'symbols:all';
      
      // Check cache
      const cached = getFromCache<{ data: StockSymbol[] }>(cacheKey);
      if (cached.data) {
        setSymbols(cached.data.data);
        if (!cached.isStale) return;
      }

      setLoading(true);
      setError(null);

      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
        const action = group ? 'symbols-by-group' : 'symbols';
        const url = group 
          ? `${projectUrl}/functions/v1/vn-stock-data?action=${action}&group=${group}`
          : `${projectUrl}/functions/v1/vn-stock-data?action=${action}`;

        const result = await deduplicatedFetch(cacheKey, async () => {
          const res = await smartFetch(url, { headers: { 'Content-Type': 'application/json' } });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        });

        setToCache(cacheKey, result, 'symbols');
        setSymbols(result.data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch symbols';
        setError(errorMessage);
        console.error('[useSymbols] Error:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, [group]);

  return { symbols, loading, error };
}

// ============================================================================
// PRICE BOARD HOOK - Optimized with batching
// ============================================================================

export function usePriceBoard(
  symbols: string[],
  autoRefresh: boolean = true,
  refreshMs?: number
) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const marketStatus = useMarketStatusExtended();
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  // Stable symbols key - memoize based on JSON string to detect actual changes
  const symbolsString = JSON.stringify(symbols);
  const normalizedSymbols = useMemo(() => {
    return [...symbols].map((s) => s.toUpperCase()).sort();
  }, [symbolsString]);

  const symbolsKey = normalizedSymbols.join(',');

  const fetchPrices = useCallback(async (background = false) => {
    if (normalizedSymbols.length === 0) return;
    if (inFlightRef.current && !background) return;

    const cacheKey = `priceboard:${symbolsKey}`;
    
    // Check cache
    const cached = getFromCache<{ data: PriceData[]; timestamp: number }>(cacheKey);
    if (cached.data) {
      setPrices(cached.data.data);
      setLastUpdate(cached.data.timestamp);
      if (!cached.isStale) return;
    }

    inFlightRef.current = true;
    if (!background) setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const result = await deduplicatedFetch(cacheKey, async () => {
        const res = await smartFetch(`${projectUrl}/functions/v1/vn-stock-data?action=price-board`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: normalizedSymbols })
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      });

      if (result.error && !result.data) throw new Error(result.error);
      if (!isMountedRef.current) return;

      setToCache(cacheKey, result, 'price-board');
      setPrices(result.data || []);
      setLastUpdate(result.timestamp || Date.now());
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(errorMessage);
      console.error('[usePriceBoard] Error:', errorMessage);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current && !background) {
        setLoading(false);
      }
    }
  }, [symbolsKey, normalizedSymbols]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPrices();

    if (!autoRefresh) return;

    // Adaptive polling based on market session
    const intervalMs = refreshMs ?? getAdaptivePollingInterval(marketStatus.session, 3000);
    const timer = setInterval(() => {
      if (marketStatus.shouldSync) {
        fetchPrices(true);
      }
    }, intervalMs);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchPrices, autoRefresh, marketStatus.session, marketStatus.shouldSync, symbolsKey, refreshMs]);

  return { prices, loading, error, lastUpdate, refetch: fetchPrices, isMarketOpen: marketStatus.isOpen, session: marketStatus.session };
}

// ============================================================================
// PRICE DEPTH HOOK - Ultra-fast for order book
// ============================================================================

export function usePriceDepth(symbols: string[], autoRefresh: boolean = true) {
  const [depth, setDepth] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const marketStatus = useMarketStatusExtended();
  const isMountedRef = useRef(true);

  const symbolsKey = [...symbols].sort().join(',');

  const fetchDepth = useCallback(async () => {
    if (symbols.length === 0) return;
    
    // Skip fetching outside sync hours
    if (!marketStatus.shouldSync) return;

    const cacheKey = `depth:${symbolsKey}`;
    
    // Quick cache check
    const cached = getFromCache<{ data: any[] }>(cacheKey);
    if (cached.data && !cached.isStale) {
      setDepth(cached.data.data);
      return;
    }

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const result = await deduplicatedFetch(cacheKey, async () => {
        const res = await smartFetch(`${projectUrl}/functions/v1/vn-stock-data?action=price-depth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols })
        });

        if (!res.ok) return { data: [] };
        return res.json();
      });

      if (!isMountedRef.current) return;
      setDepth(result.data || []);
    } catch {
      // Silent fail for depth
    } finally {
      setLoading(false);
    }
  }, [symbolsKey, symbols, marketStatus.shouldSync]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDepth();
    
    if (!autoRefresh) return;
    
    // Adaptive polling based on market session
    const refreshMs = getAdaptivePollingInterval(marketStatus.session, 2000);
    const timer = setInterval(() => {
      if (marketStatus.shouldSync) {
        fetchDepth();
      }
    }, refreshMs);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchDepth, autoRefresh, marketStatus.session, marketStatus.shouldSync]);

  return { depth, loading, refetch: fetchDepth, isMarketOpen: marketStatus.isOpen, session: marketStatus.session };
}

// ============================================================================
// MARKET INDICES HOOK - With background refresh
// ============================================================================

export function useMarketIndices(autoRefresh: boolean = true) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const marketStatus = useMarketStatusExtended();
  const isMountedRef = useRef(true);

  const fetchIndices = useCallback(async (background = false) => {
    const cacheKey = 'indices';
    
    // Check cache
    const cached = getFromCache<{ data: IndexData[]; timestamp: number }>(cacheKey);
    if (cached.data) {
      setIndices(cached.data.data);
      setLastUpdate(cached.data.timestamp);
      if (!cached.isStale) return;
    }

    if (!background) setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const result = await deduplicatedFetch(cacheKey, async () => {
        const res = await smartFetch(`${projectUrl}/functions/v1/vn-stock-data?action=indices`, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      });

      if (!isMountedRef.current) return;

      setToCache(cacheKey, result, 'indices');
      setIndices(result.data || []);
      setLastUpdate(result.timestamp || Date.now());
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch indices';
      setError(errorMessage);
      console.error('[useMarketIndices] Error:', errorMessage);
    } finally {
      if (isMountedRef.current && !background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchIndices();
    
    if (!autoRefresh) return;
    
    // Adaptive polling based on market session
    const refreshMs = getAdaptivePollingInterval(marketStatus.session, 5000);
    const timer = setInterval(() => {
      if (marketStatus.shouldSync) {
        fetchIndices(true);
      }
    }, refreshMs);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchIndices, autoRefresh, marketStatus.session, marketStatus.shouldSync]);

  return { indices, loading, error, lastUpdate, isMarketOpen: marketStatus.isOpen, session: marketStatus.session };
}

// ============================================================================
// UTILITY: Clear all caches (for debugging)
// ============================================================================

export function clearAllCaches(): void {
  clientCache.clear();
  pendingRequests.clear();
  console.log('[Cache] All caches cleared');
}
