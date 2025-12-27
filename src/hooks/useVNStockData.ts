import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

type ApiResult<T> = { data?: T; symbol?: string; group?: string; error?: string; unavailable?: boolean };

export function useStockHistory(symbol: string, start: string, end?: string, interval: string = '1D') {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      const endDate = end || new Date().toISOString().split('T')[0];

      const { data: result, error: fnError } = await supabase.functions.invoke<ApiResult<OHLCVData[]>>('vn-stock-data', {
        body: { action: 'history', symbol, start, end: endDate, interval },
      });

      if (fnError) throw fnError;
      if (!result) throw new Error('Empty response');
      if (result.error) throw new Error(result.error);

      console.log('[useStockHistory] Got data:', result.data?.length, 'candles');
      setData(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock history';
      setError(errorMessage);
      console.error('[useStockHistory] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbol, start, end, interval]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { data, loading, error, refetch: fetchHistory };
}

export function useSymbols(group?: string) {
  const [symbols, setSymbols] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      setLoading(true);
      setError(null);

      try {
        const action = group ? 'symbols-by-group' : 'symbols';

        const { data: result, error: fnError } = await supabase.functions.invoke<ApiResult<StockSymbol[]>>('vn-stock-data', {
          body: { action, group },
        });

        if (fnError) throw fnError;
        if (!result) throw new Error('Empty response');

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

export function usePriceBoard(symbols: string[]) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke<ApiResult<PriceData[]>>('vn-stock-data', {
        body: { action: 'price-board', symbols },
      });

      if (fnError) throw fnError;
      if (!result) throw new Error('Empty response');

      setPrices(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(errorMessage);
      console.error('[usePriceBoard] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchPrices();

    // Auto refresh every 10 seconds during market hours
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { prices, loading, error, refetch: fetchPrices };
}

export function useMarketIndices() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIndices = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke<ApiResult<IndexData[]>>('vn-stock-data', {
          body: { action: 'indices' },
        });

        if (fnError) throw fnError;
        if (!result) throw new Error('Empty response');

        setIndices(result.data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch indices';
        setError(errorMessage);
        console.error('[useMarketIndices] Error:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();

    // Auto refresh every 30 seconds
    const interval = setInterval(fetchIndices, 30000);
    return () => clearInterval(interval);
  }, []);

  return { indices, loading, error };
}
