import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useStockHistory } from '@/hooks/useVNStockData';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Language } from '@/types';

interface CandlestickChartProps {
  symbol: string;
  interval?: string;
  className?: string;
  lang?: Language;
  height?: number;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  interval = '1D',
  className,
  lang = 'vi',
  height = 400
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<typeof CandlestickSeries.prototype.api> | null>(null);
  const volumeSeriesRef = useRef<ReturnType<typeof HistogramSeries.prototype.api> | null>(null);
  
  const [selectedInterval, setSelectedInterval] = useState(interval);
  
  const getStartDate = () => {
    const now = new Date();
    switch (selectedInterval) {
      case '1m':
      case '5m':
      case '15m':
      case '30m':
        now.setDate(now.getDate() - 5);
        break;
      case '1H':
        now.setDate(now.getDate() - 30);
        break;
      case '1W':
        now.setFullYear(now.getFullYear() - 3);
        break;
      case '1M':
        now.setFullYear(now.getFullYear() - 10);
        break;
      default:
        now.setFullYear(now.getFullYear() - 1);
    }
    return now.toISOString().split('T')[0];
  };

  const { data, loading, error, refetch } = useStockHistory(
    symbol,
    getStartDate(),
    undefined,
    selectedInterval
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (data.length === 0 || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = data.map((d) => ({
      time: d.time as number,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map((d) => ({
      time: d.time as number,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const intervals = [
    { value: '1D', label: '1N' },
    { value: '1W', label: '1T' },
    { value: '1M', label: '1TH' },
  ];

  return (
    <div className={cn("glass rounded-2xl p-4 border border-border/50", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-xl font-bold text-foreground">{symbol}</h3>
          {data.length > 0 && (
            <span className="font-mono text-lg font-semibold text-foreground">
              {data[data.length - 1]?.close.toLocaleString('vi-VN')}
            </span>
          )}
        </div>
        <button onClick={() => refetch()} disabled={loading} className="p-2 rounded-lg hover:bg-muted/50">
          <RefreshCw size={16} className={cn("text-muted-foreground", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4">
        {intervals.map((int) => (
          <button
            key={int.value}
            onClick={() => setSelectedInterval(int.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              selectedInterval === int.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {int.label}
          </button>
        ))}
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-xl">
            <Loader2 size={32} className="text-primary animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-xl">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" style={{ height }} />
      </div>
    </div>
  );
};

export default CandlestickChart;
