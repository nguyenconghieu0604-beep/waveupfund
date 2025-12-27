// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const vciHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Origin': 'https://trading.vietcap.com.vn',
  'Referer': 'https://trading.vietcap.com.vn/'
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    // Fallback: check body for action if not in query params
    if (!action && req.method === 'POST') {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        action = body.action || null;
      } catch {
        // Body parsing failed, action stays null
      }
    }

    console.log(`[VN-Stock] Action: ${action}`);

    switch (action) {
      case 'history':
        return await getStockHistory(url);
      case 'symbols':
        return await getAllSymbols();
      case 'symbols-by-group':
        return await getSymbolsByGroup(url);
      case 'price-board':
        return await getPriceBoard(req, url);
      case 'indices':
        return await getMarketIndices();
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: history, symbols, symbols-by-group, price-board, indices' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VN-Stock] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get stock OHLCV history
async function getStockHistory(url: URL) {
  const symbol = url.searchParams.get('symbol') || 'VCB';
  const start = url.searchParams.get('start') || '2024-01-01';
  const end = url.searchParams.get('end') || new Date().toISOString().split('T')[0];
  const interval = url.searchParams.get('interval') || '1D';

  console.log(`[VN-Stock] Getting history for ${symbol} from ${start} to ${end}, interval: ${interval}`);

  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() + 1);

  const endStamp = Math.floor(endDate.getTime() / 1000);
  const intervalValue = INTERVAL_MAP[interval] || 'ONE_DAY';

  // Calculate count_back based on business days
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let countBack = Math.ceil(diffDays * 1.5); // Approximate with buffer

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

  const response = await fetch(`${VCI_TRADING_URL}chart/OHLCChart/gap-chart`, {
    method: 'POST',
    headers: vciHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`VCI API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[VN-Stock] Raw response type:`, typeof data);

  // Transform VCI format to standard OHLCV
  const ohlcv: any[] = [];
  
  if (Array.isArray(data) && data.length > 0) {
    const symbolData = data[0];
    if (symbolData && symbolData.o && Array.isArray(symbolData.o)) {
      // VCI returns arrays for each field
      for (let i = 0; i < symbolData.t.length; i++) {
        const timestamp = symbolData.t[i] * 1000; // Convert to milliseconds
        if (timestamp >= startDate.getTime() && timestamp <= endDate.getTime()) {
          ohlcv.push({
            time: symbolData.t[i], // Keep as seconds for lightweight-charts
            open: symbolData.o[i] / 1000, // VCI returns in VND * 1000
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

  const response = await fetch(`${VCI_TRADING_URL}price/symbols/getAll`, {
    method: 'GET',
    headers: vciHeaders
  });

  if (!response.ok) {
    throw new Error(`VCI API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[VN-Stock] Got ${data.length} symbols`);

  // Transform to simpler format
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
async function getSymbolsByGroup(url: URL) {
  const group = url.searchParams.get('group') || 'VN30';
  console.log(`[VN-Stock] Getting symbols for group: ${group}`);

  const response = await fetch(`${VCI_TRADING_URL}price/symbols/getByGroup?group=${group}`, {
    method: 'GET',
    headers: vciHeaders
  });

  if (!response.ok) {
    throw new Error(`VCI API error: ${response.status}`);
  }

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

// Get real-time price board
async function getPriceBoard(req: Request, url: URL) {
  // Try to get symbols from query params first, then from body
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
  console.log(`[VN-Stock] Getting price board for: ${symbols.join(', ')}`);

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

  console.log(`[VN-Stock] Got price data for ${priceData.length} stocks`);

  // Transform to cleaner format
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

  return new Response(
    JSON.stringify({ data: transformed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get market indices (VN-INDEX, HNX-INDEX, etc.)
async function getMarketIndices() {
  console.log('[VN-Stock] Getting market indices');

  // VCI uses special symbols for indices
  const indexSymbols = ['VNINDEX', 'VN30', 'HNX', 'HNXINDEX', 'UPCOM'];

  const payload = {
    timeFrame: 'ONE_DAY',
    symbols: indexSymbols,
    to: Math.floor(Date.now() / 1000),
    countBack: 2
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

  const indices = data.map((item: any, index: number) => {
    const len = item.c?.length || 0;
    const currentPrice = len > 0 ? item.c[len - 1] / 1000 : 0;
    const prevPrice = len > 1 ? item.c[len - 2] / 1000 : currentPrice;
    const change = currentPrice - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    return {
      symbol: indexSymbols[index],
      price: currentPrice,
      change: change,
      changePercent: changePercent.toFixed(2),
      volume: len > 0 ? item.v[len - 1] : 0
    };
  });

  console.log(`[VN-Stock] Got ${indices.length} indices`);

  return new Response(
    JSON.stringify({ data: indices }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}