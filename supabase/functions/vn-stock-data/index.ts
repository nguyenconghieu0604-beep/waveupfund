// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

// In-memory cache for reducing API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = {
  'price-board': 2000,      // 2s for price board (near real-time)
  'intraday': 3000,         // 3s for intraday data
  'history': 60000,         // 1min for historical data
  'indices': 3000,          // 3s for indices
  'symbols': 300000,        // 5min for symbol lists
};

function getCached(key: string, ttl: number): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    console.log(`[VN-Stock] Cache HIT: ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

const vciHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Origin': 'https://trading.vietcap.com.vn',
  'Referer': 'https://trading.vietcap.com.vn/',
  'Connection': 'keep-alive',
};

// Retry fetch with exponential backoff for handling 502/503 errors
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3, 
  baseDelay = 500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 502/503/504, retry with backoff
      if (response.status >= 502 && response.status <= 504 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[VN-Stock] Retry ${attempt + 1}/${maxRetries} after ${response.status}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[VN-Stock] Retry ${attempt + 1}/${maxRetries} after error: ${lastError.message}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// Check if Vietnam stock market is open
function isMarketOpen(): boolean {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const day = vnTime.getDay();
  
  if (day === 0 || day === 6) return false;
  
  const time = hours * 60 + minutes;
  // Morning: 9:00-11:30, Afternoon: 13:00-14:45 (ATC until 15:00)
  return (time >= 540 && time <= 690) || (time >= 780 && time <= 900);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    console.log(`[VN-Stock] Action: ${action} | Market: ${isMarketOpen() ? 'OPEN' : 'CLOSED'}`);

    let response: Response;
    switch (action) {
      case 'history':
        response = await getStockHistory(url);
        break;
      case 'intraday':
        response = await getIntradayData(url);
        break;
      case 'symbols':
        response = await getAllSymbols();
        break;
      case 'symbols-by-group':
        response = await getSymbolsByGroup(url);
        break;
      case 'price-board':
        response = await getPriceBoard(req, url);
        break;
      case 'price-depth':
        response = await getPriceDepth(req, url);
        break;
      case 'indices':
        response = await getMarketIndices();
        break;
      case 'market-status':
        response = new Response(
          JSON.stringify({ isOpen: isMarketOpen(), timestamp: Date.now() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        break;
      default:
        response = new Response(
          JSON.stringify({ error: 'Invalid action. Use: history, intraday, symbols, symbols-by-group, price-board, price-depth, indices, market-status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[VN-Stock] Completed in ${Date.now() - startTime}ms`);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VN-Stock] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get stock OHLCV history (daily/weekly/monthly)
async function getStockHistory(url: URL) {
  const symbol = url.searchParams.get('symbol') || 'VCB';
  const start = url.searchParams.get('start') || '2024-01-01';
  const end = url.searchParams.get('end') || new Date().toISOString().split('T')[0];
  const interval = url.searchParams.get('interval') || '1D';

  const cacheKey = `history:${symbol}:${start}:${end}:${interval}`;
  const cached = getCached(cacheKey, CACHE_TTL['history']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] History: ${symbol} | ${start} -> ${end} | ${interval}`);

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
  });

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

  const result = { symbol, data: ohlcv, count: ohlcv.length };
  setCache(cacheKey, result);

  console.log(`[VN-Stock] History: ${ohlcv.length} candles`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Get intraday real-time data (1m, 5m, 15m, 30m, 1H)
async function getIntradayData(url: URL) {
  const symbol = url.searchParams.get('symbol') || 'VCB';
  const interval = url.searchParams.get('interval') || '1m';

  const cacheKey = `intraday:${symbol}:${interval}`;
  const cached = getCached(cacheKey, CACHE_TTL['intraday']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Intraday: ${symbol} | ${interval}`);

  // For intraday, get last 3 days of minute data
  const now = new Date();
  const endStamp = Math.floor(now.getTime() / 1000);
  
  let countBack = 500; // ~8 hours of 1m data
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
  });

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

  const result = { 
    symbol, 
    interval,
    data: ohlcv, 
    count: ohlcv.length,
    marketOpen: isMarketOpen(),
    timestamp: Date.now()
  };
  setCache(cacheKey, result);

  console.log(`[VN-Stock] Intraday: ${ohlcv.length} candles`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Get all symbols (cached heavily)
async function getAllSymbols() {
  const cacheKey = 'symbols:all';
  const cached = getCached(cacheKey, CACHE_TTL['symbols']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('[VN-Stock] Fetching all symbols');

  const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getAll`, {
    method: 'GET',
    headers: vciHeaders
  });

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

  const result = { data: symbols, count: symbols.length };
  setCache(cacheKey, result);

  console.log(`[VN-Stock] Symbols: ${symbols.length}`);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Get symbols by group
async function getSymbolsByGroup(url: URL) {
  const group = url.searchParams.get('group') || 'VN30';
  
  const cacheKey = `symbols:${group}`;
  const cached = getCached(cacheKey, CACHE_TTL['symbols']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Symbols by group: ${group}`);

  const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getByGroup?group=${group}`, {
    method: 'GET',
    headers: vciHeaders
  });

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

  const result = { group, data: symbols, count: symbols.length };
  setCache(cacheKey, result);

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Get real-time price board using OHLC API (stable fallback)
async function getPriceBoard(req: Request, url: URL) {
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

  const cacheKey = `priceboard:${symbols.sort().join(',')}`;
  const cached = getCached(cacheKey, CACHE_TTL['price-board']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[VN-Stock] Price board (OHLC): ${symbols.join(', ')}`);

  // Use OHLC API which is more stable than GraphQL
  const now = new Date();
  const endStamp = Math.floor(now.getTime() / 1000);
  
  const payload = {
    timeFrame: 'ONE_DAY',
    symbols: symbols.map(s => s.toUpperCase()),
    to: endStamp,
    countBack: 2 // Get last 2 days to calculate change
  };

  try {
    const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
      method: 'POST',
      headers: vciHeaders,
      body: JSON.stringify(payload)
    });

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
            ceiling: 0, // Not available from OHLC
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

    const finalResult = { 
      data: transformed, 
      count: transformed.length,
      marketOpen: isMarketOpen(),
      timestamp: Date.now(),
      source: 'ohlc'
    };
    setCache(cacheKey, finalResult);

    return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    // Return empty result instead of error to not break UI
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VN-Stock] Price board error:', msg);
    
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

// Get price depth (bid/ask only - ultra fast)
async function getPriceDepth(req: Request, url: URL) {
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
  const cached = getCached(cacheKey, CACHE_TTL['price-board']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Minimal query for speed
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
  });

  if (!response.ok) {
    throw new Error(`VCI GraphQL error: ${response.status}`);
  }

  const result = await response.json();
  const priceData = result.data?.MarketPriceBoard || [];

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

  const finalResult = { data: transformed, timestamp: Date.now() };
  setCache(cacheKey, finalResult);

  return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Get market indices - fetching from dedicated index endpoint
async function getMarketIndices() {
  const cacheKey = 'indices';
  const cached = getCached(cacheKey, CACHE_TTL['indices']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('[VN-Stock] Indices: fetching via OHLC (stable)');

  try {
    const indices = await fetchIndicesViaOHLC();

    const result = {
      data: indices,
      count: indices.length,
      marketOpen: isMarketOpen(),
      timestamp: Date.now(),
      source: 'ohlc-scaled',
    };

    setCache(cacheKey, result);

    console.log(
      '[VN-Stock] Indices:',
      indices.map((i: any) => `${i.symbol}: ${Number(i.price).toFixed(2)}`).join(', '),
    );

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    // Never hard-fail the UI: return empty payload with error info
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VN-Stock] Indices error:', msg);

    const result = {
      data: [],
      count: 0,
      marketOpen: isMarketOpen(),
      timestamp: Date.now(),
      source: 'ohlc-scaled',
      error: msg,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// Fetch indices via OHLC with proper scaling (no /1000 for index points)
async function fetchIndicesViaOHLC() {
  // Try multiple symbol variations for each index
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
    });

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
    
    // For indices, values are typically NOT divided by 1000
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


