import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IndexData {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  volume: number;
  open: number;
  high: number;
  low: number;
}

export interface PriceBoardData {
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

type FnResult<T> = { data?: T; error?: string; unavailable?: boolean };

// Hook for market indices with auto-refresh
export function useMarketIndices(refreshInterval = 30000) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchIndices = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke<FnResult<IndexData[]>>('vn-stock-data', {
        body: { action: 'indices' },
      });

      if (fnError) throw fnError;
      if (!data) throw new Error('Empty response');

      setIndices(data.data || []);
      setLastUpdate(new Date());
      setError(data.unavailable ? (data.error || 'Data unavailable') : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIndices();
    const interval = setInterval(fetchIndices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchIndices, refreshInterval]);

  return { indices, loading, error, lastUpdate, refetch: fetchIndices };
}

// Hook for price board with auto-refresh
export function usePriceBoardRealtime(symbols: string[], refreshInterval = 10000) {
  const [prices, setPrices] = useState<PriceBoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke<FnResult<PriceBoardData[]>>('vn-stock-data', {
        body: { action: 'price-board', symbols },
      });

      if (fnError) throw fnError;
      if (!data) throw new Error('Empty response');

      setPrices(data.data || []);
      setLastUpdate(new Date());
      setError(data.unavailable ? (data.error || 'Data unavailable') : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return { prices, loading, error, lastUpdate, refetch: fetchPrices };
}

// Check if market is open (Vietnam market hours: 9:00-11:30 and 13:00-15:00)
export function isMarketOpen(): boolean {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnTime.getHours();
  const minutes = vnTime.getMinutes();
  const day = vnTime.getDay();

  // Weekend
  if (day === 0 || day === 6) return false;

  const timeInMinutes = hours * 60 + minutes;

  // Morning session: 9:00-11:30 (540-690)
  // Afternoon session: 13:00-15:00 (780-900)
  return (timeInMinutes >= 540 && timeInMinutes <= 690) ||
    (timeInMinutes >= 780 && timeInMinutes <= 900);
}
