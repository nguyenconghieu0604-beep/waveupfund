// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VCI Trading API - Based on vnstock library
const VCI_TRADING_URL = 'https://trading.vietcap.com.vn/api/';

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

const vciHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Origin': 'https://trading.vietcap.com.vn',
  'Referer': 'https://trading.vietcap.com.vn/'
};

// Helper function to fetch with retry
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[VN-Stock] Fetch attempt ${attempt}/${maxRetries}: ${url}`);
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // If server error (5xx), retry
      if (response.status >= 500 && attempt < maxRetries) {
        console.log(`[VN-Stock] Server error ${response.status}, retrying in ${attempt * 500}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
        continue;
      }
      
      throw new Error(`VCI API error: ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[VN-Stock] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
  }
  
  throw lastError || new Error('Failed after all retries');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Support both querystring (?action=...) and JSON body { action: ... }
    let body: any = null;
    try {
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        body = await req.clone().json();
      }
    } catch {
      body = null;
    }

    const action = url.searchParams.get('action') ?? body?.action;

    console.log(`[VN-Stock] Action: ${action}`);

    switch (action) {
      case 'history':
        return await getStockHistory(url, body);
      case 'symbols':
        return await getAllSymbols();
      case 'symbols-by-group':
        return await getSymbolsByGroup(url, body);
      case 'price-board':
        return await getPriceBoard(body?.symbols);
      case 'indices':
        return await getMarketIndices();
      default:
        console.log(`[VN-Stock] Invalid action received: ${action}, body:`, body);
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: history, symbols, symbols-by-group, price-board, indices' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VN-Stock] Error:', errorMessage);

    // Return empty data with error flag instead of 500 for graceful degradation
    return new Response(
      JSON.stringify({ data: [], error: errorMessage, unavailable: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get stock OHLCV history - Based on vnstock quote.history()
async function getStockHistory(url: URL, body?: any) {
  const symbol = url.searchParams.get('symbol') || body?.symbol || 'VCB';
  const start = url.searchParams.get('start') || body?.start || '2024-01-01';
  const end = url.searchParams.get('end') || body?.end || new Date().toISOString().split('T')[0];
  const interval = url.searchParams.get('interval') || body?.interval || '1D';

  console.log(`[VN-Stock] Getting history for ${symbol} from ${start} to ${end}, interval: ${interval}`);

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

  console.log(`[VN-Stock] Request payload:`, JSON.stringify(payload));

  const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload)
  });

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

  console.log(`[VN-Stock] Processed ${ohlcv.length} candles`);

  return new Response(
    JSON.stringify({ symbol, data: ohlcv }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get all symbols
async function getAllSymbols() {
  console.log('[VN-Stock] Getting all symbols');

  const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getAll`, {
    method: 'GET',
    headers: vciHeaders
  });

  const data = await response.json();
  console.log(`[VN-Stock] Got ${data.length} symbols`);

  const symbols = data.map((item: any) => ({
    symbol: item.symbol,
    name: item.organName || item.enOrganName,
    shortName: item.organShortName || item.enOrganShortName,
    exchange: item.board,
    type: item.type
  }));

  return new Response(
    JSON.stringify({ data: symbols }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get symbols by group (VN30, HOSE, HNX, etc.)
async function getSymbolsByGroup(url: URL, body?: any) {
  const group = url.searchParams.get('group') || body?.group || 'VN30';
  console.log(`[VN-Stock] Getting symbols for group: ${group}`);

  const response = await fetchWithRetry(`${VCI_TRADING_URL}price/symbols/getByGroup?group=${group}`, {
    method: 'GET',
    headers: vciHeaders
  });

  const data = await response.json();
  console.log(`[VN-Stock] Got ${data.length} symbols for ${group}`);

  const symbols = data.map((item: any) => ({
    symbol: item.symbol,
    name: item.organName || item.enOrganName,
    shortName: item.organShortName || item.enOrganShortName,
    exchange: item.board,
    type: item.type
  }));

  return new Response(
    JSON.stringify({ group, data: symbols }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get real-time price board using OHLC API (same as indices but for stocks)
async function getPriceBoard(symbolsInput?: string[]) {
  const symbols = (Array.isArray(symbolsInput) && symbolsInput.length > 0)
    ? symbolsInput
    : ['VCB', 'VHM', 'VIC', 'HPG', 'FPT', 'MBB', 'MSN', 'VNM'];

  console.log(`[VN-Stock] Getting price board for: ${symbols.join(', ')}`);

  // Use OHLC API to get latest prices - more reliable than GraphQL
  const payload = {
    timeFrame: 'ONE_DAY',
    symbols: symbols.map(s => s.toUpperCase()),
    to: Math.floor(Date.now() / 1000),
    countBack: 2
  };

  const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log(`[VN-Stock] Got OHLC data for ${data.length} stocks`);

  const transformed = data.map((item: any, index: number) => {
    const len = item.c?.length || 0;
    const currentPrice = len > 0 ? item.c[len - 1] / 1000 : 0;
    const prevPrice = len > 1 ? item.c[len - 2] / 1000 : currentPrice;
    const openPrice = len > 0 ? item.o[len - 1] / 1000 : 0;
    const highPrice = len > 0 ? item.h[len - 1] / 1000 : 0;
    const lowPrice = len > 0 ? item.l[len - 1] / 1000 : 0;
    const volume = len > 0 ? item.v[len - 1] : 0;
    const change = currentPrice - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    return {
      symbol: symbols[index],
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      volume: volume,
      ref: prevPrice,
      ceiling: prevPrice * 1.07, // Vietnam stock ceiling is +7%
      floor: prevPrice * 0.93,   // Vietnam stock floor is -7%
      value: currentPrice * volume * 1000,
      foreignBuy: 0,
      foreignSell: 0,
      bid: [],
      ask: []
    };
  });

  return new Response(
    JSON.stringify({ data: transformed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get market indices (VN-INDEX, HNX-INDEX, VN30, etc.)
async function getMarketIndices() {
  console.log('[VN-Stock] Getting market indices');

  // Based on vnstock - supported indices: VNINDEX, HNXINDEX, UPCOMINDEX, VN30, HNX30
  const indexSymbols = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOMINDEX'];

  const payload = {
    timeFrame: 'ONE_DAY',
    symbols: indexSymbols,
    to: Math.floor(Date.now() / 1000),
    countBack: 2
  };

  const response = await fetchWithRetry(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log(`[VN-Stock] Raw index data:`, JSON.stringify(data[0]?.c?.slice(-2)));

  const indices = data.map((item: any, index: number) => {
    const len = item.c?.length || 0;

    // NOTE: With vnstock/VCI, index values are already in points (e.g. 1729.80),
    // unlike stock prices which are scaled. So we DO NOT divide by 1000 here.
    const currentPrice = len > 0 ? Number(item.c[len - 1]) : 0;
    const prevPrice = len > 1 ? Number(item.c[len - 2]) : currentPrice;
    const change = currentPrice - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    return {
      symbol: indexSymbols[index],
      price: currentPrice,
      change: change,
      changePercent: changePercent.toFixed(2),
      volume: len > 0 ? item.v[len - 1] : 0,
      open: len > 0 ? Number(item.o[len - 1]) : 0,
      high: len > 0 ? Number(item.h[len - 1]) : 0,
      low: len > 0 ? Number(item.l[len - 1]) : 0
    };
  });

  console.log(`[VN-Stock] Processed indices:`, JSON.stringify(indices.map((i: any) => ({ s: i.symbol, p: i.price }))));

  return new Response(
    JSON.stringify({ data: indices }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
