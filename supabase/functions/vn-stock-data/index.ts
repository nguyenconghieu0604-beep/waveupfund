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

  const response = await fetch(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
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

  const response = await fetch(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
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

  const response = await fetch(`${VCI_TRADING_URL}price/symbols/getAll`, {
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

  const response = await fetch(`${VCI_TRADING_URL}price/symbols/getByGroup?group=${group}`, {
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

// Get real-time price board (optimized for speed)
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

  console.log(`[VN-Stock] Price board: ${symbols.join(', ')}`);

  const payload = {
    query: `{
      MarketPriceBoard(codes: ${JSON.stringify(symbols)}) {
        stockNo
        ceiling
        floor
        refPrice
        stockSymbol
        matchedPrice
        matchedVolume
        matchedBy
        priceChange
        priceChangePercent
        highPrice
        lowPrice
        foreignBuyVolume
        foreignSellVolume
        totalRoom
        currentRoom
        openPrice
        accumulatedVolume
        accumulatedValue
        buyForeignQuantity
        sellForeignQuantity
        matchedValue
        buyPrice1
        buyVolume1
        buyPrice2
        buyVolume2
        buyPrice3
        buyVolume3
        sellPrice1
        sellVolume1
        sellPrice2
        sellVolume2
        sellPrice3
        sellVolume3
        __typename
      }
    }`,
    variables: {}
  };

  const response = await fetch(VCI_GRAPHQL_URL, {
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
    changePercent: item.priceChangePercent,
    ceiling: item.ceiling / 1000,
    floor: item.floor / 1000,
    ref: item.refPrice / 1000,
    open: item.openPrice / 1000,
    high: item.highPrice / 1000,
    low: item.lowPrice / 1000,
    volume: item.accumulatedVolume,
    value: item.accumulatedValue,
    foreignBuy: item.foreignBuyVolume,
    foreignSell: item.foreignSellVolume,
    room: item.currentRoom,
    matchedVolume: item.matchedVolume,
    matchedBy: item.matchedBy, // 'B' = Buy, 'S' = Sell
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

  const finalResult = { 
    data: transformed, 
    count: transformed.length,
    marketOpen: isMarketOpen(),
    timestamp: Date.now()
  };
  setCache(cacheKey, finalResult);

  return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

  const response = await fetch(VCI_GRAPHQL_URL, {
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

// Get market indices - REAL-TIME from GraphQL
async function getMarketIndices() {
  const cacheKey = 'indices';
  const cached = getCached(cacheKey, CACHE_TTL['indices']);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('[VN-Stock] Fetching real-time indices via GraphQL');

  // In practice, index codes can vary by provider/version.
  // We query a superset and then map to canonical symbols.
  const requestedCodes = ['VNINDEX', 'VN30', 'HNXINDEX', 'HNX', 'UPINDEX', 'UPCOM'];

  const payload = {
    query: `{
      MarketPriceBoard(codes: ${JSON.stringify(requestedCodes)}) {
        stockSymbol
        matchedPrice
        priceChange
        priceChangePercent
        accumulatedVolume
        accumulatedValue
        refPrice
        highPrice
        lowPrice
        openPrice
        ceiling
        floor
      }
    }`,
    variables: {},
  };

  const response = await fetch(VCI_GRAPHQL_URL, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`[VN-Stock] GraphQL error: ${response.status}`);
    throw new Error(`VCI GraphQL error: ${response.status}`);
  }

  const responseData = await response.json();
  const rows = responseData?.data?.MarketPriceBoard || [];

  // Normalize numbers: some codes return values already in "index points" (e.g., 1,250)
  // while equities are often encoded x1000 (e.g., 61,500). We correct using a simple heuristic.
  const norm = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return n > 100000 ? n / 1000 : n;
  };

  const bySymbol = new Map<string, any>();
  for (const r of rows) {
    if (r?.stockSymbol) bySymbol.set(String(r.stockSymbol).toUpperCase(), r);
  }

  const pick = (codes: string[]) => {
    for (const c of codes) {
      const row = bySymbol.get(c.toUpperCase());
      if (row) return row;
    }
    return null;
  };

  const canonical = [
    { symbol: 'VNINDEX', aliases: ['VNINDEX'] },
    { symbol: 'VN30', aliases: ['VN30'] },
    { symbol: 'HNXINDEX', aliases: ['HNXINDEX', 'HNX'] },
    { symbol: 'UPCOM', aliases: ['UPINDEX', 'UPCOM'] },
  ];

  const indices = canonical
    .map(({ symbol, aliases }) => {
      const item = pick(aliases);
      if (!item) return null;

      return {
        symbol,
        price: norm(item.matchedPrice),
        change: norm(item.priceChange),
        changePercent: (Number(item.priceChangePercent) || 0).toFixed(2),
        volume: Number(item.accumulatedVolume) || 0,
        value: Number(item.accumulatedValue) || 0,
        ref: norm(item.refPrice),
        open: norm(item.openPrice),
        high: norm(item.highPrice),
        low: norm(item.lowPrice),
      };
    })
    .filter(Boolean);

  const result = {
    data: indices,
    count: indices.length,
    marketOpen: isMarketOpen(),
    timestamp: Date.now(),
  };

  setCache(cacheKey, result);

  console.log(
    `[VN-Stock] Real-time Indices:`,
    indices.map((i: any) => `${i.symbol}: ${i.price}`).join(', '),
  );

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}