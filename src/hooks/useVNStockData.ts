import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

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
  timestamp: number;
}

// Check if Vietnam stock market is open (client-side)
export function useMarketStatus() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMarket = () => {
      const now = new Date();
      const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const hours = vnTime.getHours();
      const minutes = vnTime.getMinutes();
      const day = vnTime.getDay();
      
      if (day === 0 || day === 6) {
        setIsOpen(false);
        return;
      }
      
      const time = hours * 60 + minutes;
      // Morning: 9:00-11:30, Afternoon: 13:00-15:00
      setIsOpen((time >= 540 && time <= 690) || (time >= 780 && time <= 900));
    };

    checkMarket();
    const interval = setInterval(checkMarket, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return isOpen;
}

// Stock history hook with smart caching
export function useStockHistory(symbol: string, start: string, end?: string, interval: string = '1D') {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!symbol) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const endDate = end || new Date().toISOString().split('T')[0];
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const res = await fetch(
        `${projectUrl}/functions/v1/vn-stock-data?action=history&symbol=${symbol}&start=${start}&end=${endDate}&interval=${interval}`,
        {
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal
        }
      );

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      console.log('[useStockHistory] Got data:', result.count, 'candles');
      setData(result.data || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock history';
      setError(errorMessage);
      console.error('[useStockHistory] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbol, start, end, interval]);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchHistory]);

  return { data, loading, error, refetch: fetchHistory };
}

// Intraday data hook for real-time chart updates
export function useIntradayData(symbol: string, interval: string = '1m', autoRefresh: boolean = true) {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const isMarketOpen = useMarketStatus();

  const fetchIntraday = useCallback(async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${projectUrl}/functions/v1/vn-stock-data?action=intraday&symbol=${symbol}&interval=${interval}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setData(result.data || []);
      setLastUpdate(result.timestamp || Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch intraday data';
      setError(errorMessage);
      console.error('[useIntradayData] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    fetchIntraday();
    
    if (!autoRefresh) return;

    // Refresh every 3s during market hours, 30s otherwise
    const refreshMs = isMarketOpen ? 3000 : 30000;
    const timer = setInterval(() => {
      if (isMarketOpen || !['1m', '5m', '15m', '30m'].includes(interval)) {
        fetchIntraday();
      }
    }, refreshMs);

    return () => clearInterval(timer);
  }, [fetchIntraday, autoRefresh, isMarketOpen, interval]);

  return { data, loading, error, lastUpdate, refetch: fetchIntraday, isMarketOpen };
}

// Symbols hook with caching
export function useSymbols(group?: string) {
  const [symbols, setSymbols] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      setLoading(true);
      setError(null);

      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
        const action = group ? 'symbols-by-group' : 'symbols';
        const url = group 
          ? `${projectUrl}/functions/v1/vn-stock-data?action=${action}&group=${group}`
          : `${projectUrl}/functions/v1/vn-stock-data?action=${action}`;

        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const result = await res.json();
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

// Price board hook with aggressive polling during market hours
export function usePriceBoard(symbols: string[], autoRefresh: boolean = true) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const isMarketOpen = useMarketStatus();

  const inFlightRef = useRef(false);

  const normalizedSymbols = useMemo(() => {
    return [...symbols].map((s) => s.toUpperCase()).sort();
  }, [symbols.join(',')]);

  const symbolsKey = normalizedSymbols.join(',');

  const fetchPrices = useCallback(async () => {
    if (normalizedSymbols.length === 0) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${projectUrl}/functions/v1/vn-stock-data?action=price-board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: normalizedSymbols })
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setPrices(result.data || []);
      setLastUpdate(result.timestamp || Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(errorMessage);
      console.error('[usePriceBoard] Error:', errorMessage);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [symbolsKey]);

  useEffect(() => {
    fetchPrices();

    if (!autoRefresh) return;

    // Aggressive polling: 3s during market hours, 30s otherwise
    const refreshMs = isMarketOpen ? 3000 : 30000;
    const timer = setInterval(fetchPrices, refreshMs);
    return () => clearInterval(timer);
  }, [fetchPrices, autoRefresh, isMarketOpen, symbolsKey]);

  return { prices, loading, error, lastUpdate, refetch: fetchPrices, isMarketOpen };
}

// Fast price depth hook (minimal data for speed)
export function usePriceDepth(symbols: string[], autoRefresh: boolean = true) {
  const [depth, setDepth] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isMarketOpen = useMarketStatus();

  const fetchDepth = useCallback(async () => {
    if (symbols.length === 0) return;

    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${projectUrl}/functions/v1/vn-stock-data?action=price-depth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });

      if (!res.ok) return;
      const result = await res.json();
      setDepth(result.data || []);
    } catch {
      // Silent fail for depth
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchDepth();
    
    if (!autoRefresh) return;
    
    // Ultra-fast polling: 2s during market hours
    const refreshMs = isMarketOpen ? 2000 : 60000;
    const timer = setInterval(fetchDepth, refreshMs);
    return () => clearInterval(timer);
  }, [fetchDepth, autoRefresh, isMarketOpen]);

  return { depth, loading, refetch: fetchDepth, isMarketOpen };
}

// Market indices hook
export function useMarketIndices(autoRefresh: boolean = true) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const isMarketOpen = useMarketStatus();

  useEffect(() => {
    const fetchIndices = async () => {
      setLoading(true);
      setError(null);

      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${projectUrl}/functions/v1/vn-stock-data?action=indices`, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const result = await res.json();
        setIndices(result.data || []);
        setLastUpdate(result.timestamp || Date.now());
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch indices';
        setError(errorMessage);
        console.error('[useMarketIndices] Error:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    
    if (!autoRefresh) return;
    
    // 5s during market hours, 60s otherwise
    const refreshMs = isMarketOpen ? 5000 : 60000;
    const timer = setInterval(fetchIndices, refreshMs);
    return () => clearInterval(timer);
  }, [autoRefresh, isMarketOpen]);

  return { indices, loading, error, lastUpdate, isMarketOpen };
}
