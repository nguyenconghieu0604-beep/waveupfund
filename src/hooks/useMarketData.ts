import { useState, useEffect, useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/vn-stock-data`;

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

// Hook for market indices with auto-refresh
export function useMarketIndices(refreshInterval = 30000) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchIndices = useCallback(async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}?action=indices`);
      if (!response.ok) throw new Error('Failed to fetch indices');
      
      const result = await response.json();
      setIndices(result.data || []);
      setLastUpdate(new Date());
      setError(null);
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
      const response = await fetch(`${EDGE_FUNCTION_URL}?action=price-board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });
      
      if (!response.ok) throw new Error('Failed to fetch prices');
      
      const result = await response.json();
      setPrices(result.data || []);
      setLastUpdate(new Date());
      setError(null);
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
