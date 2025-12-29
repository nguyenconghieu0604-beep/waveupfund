import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, ISeriesApi } from 'lightweight-charts';
import { useStockHistory, useSymbols } from '@/hooks/useVNStockData';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, Radio, Search } from 'lucide-react';
import waveupLogo from '@/assets/waveup-logo.png';
import type { Language } from '@/types';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CandlestickChartProps {
  symbol: string;
  interval?: string;
  className?: string;
  lang?: Language;
  height?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  onSymbolChange?: (symbol: string) => void;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol: initialSymbol,
  interval = '1D',
  className,
  lang = 'vi',
  height = 400,
  autoRefresh = true,
  refreshInterval = 30,
  onSymbolChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [selectedInterval, setSelectedInterval] = useState(interval);
  const [isAutoRefresh, setIsAutoRefresh] = useState(autoRefresh);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Symbol search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch symbols for search
  const { symbols: allSymbols, loading: symbolsLoading } = useSymbols();
  
  // Filter symbols based on search query
  const filteredSymbols = useMemo(() => {
    if (!allSymbols || allSymbols.length === 0) return [];
    
    if (!searchQuery.trim()) {
      // Show popular symbols when no query
      const popular = ['VCB', 'FPT', 'VHM', 'HPG', 'VIC', 'MBB', 'MSN', 'VNM', 'TCB', 'ACB', 'BID', 'CTG', 'VPB', 'STB'];
      return allSymbols.filter(s => popular.includes(s.symbol)).slice(0, 10);
    }
    const q = searchQuery.toUpperCase();
    return allSymbols
      .filter(s => s.symbol.includes(q) || s.name?.toUpperCase().includes(q))
      .slice(0, 15);
  }, [allSymbols, searchQuery]);

  const handleSymbolSelect = (newSymbol: string) => {
    setSymbol(newSymbol);
    setSearchOpen(false);
    setSearchQuery('');
    onSymbolChange?.(newSymbol);
  };

  // Check if market is open (9:00 - 15:00 Vietnam time, Mon-Fri)
  const isMarketOpen = useCallback(() => {
    const now = new Date();
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const hours = vnTime.getHours();
    const minutes = vnTime.getMinutes();
    const day = vnTime.getDay();
    
    // Market closed on weekends
    if (day === 0 || day === 6) return false;
    
    // Market hours: 9:00 - 11:30 and 13:00 - 15:00
    const time = hours * 60 + minutes;
    return (time >= 540 && time <= 690) || (time >= 780 && time <= 900);
  }, []);

  const getStartDate = useCallback(() => {
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
  }, [selectedInterval]);

  const { data, loading, error, refetch } = useStockHistory(
    symbol,
    getStartDate(),
    undefined,
    selectedInterval
  );

  // Auto-refresh logic
  useEffect(() => {
    if (!isAutoRefresh) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    const doRefresh = () => {
      // Only refresh during market hours for intraday intervals
      if (['1m', '5m', '15m', '30m', '1H'].includes(selectedInterval)) {
        if (isMarketOpen()) {
          refetch();
          setLastUpdate(new Date());
        }
      } else {
        // For daily+ intervals, refresh anyway
        refetch();
        setLastUpdate(new Date());
      }
    };

    refreshTimerRef.current = setInterval(doRefresh, refreshInterval * 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [isAutoRefresh, refreshInterval, selectedInterval, refetch, isMarketOpen]);

  // Update lastUpdate when data changes
  useEffect(() => {
    if (data.length > 0) {
      setLastUpdate(new Date());
    }
  }, [data]);

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
        visible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
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

    // Convert Unix timestamp to yyyy-mm-dd format for lightweight-charts
    const formatTime = (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const candleData = data.map((d) => ({
      time: formatTime(d.time) as import('lightweight-charts').Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map((d) => ({
      time: formatTime(d.time) as import('lightweight-charts').Time,
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

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    return lastUpdate.toLocaleTimeString('vi-VN');
  };

  return (
    <div className={cn("glass rounded-2xl p-4 border border-border/50", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Symbol + search (next to symbol) */}
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-foreground">{symbol}</span>

            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  aria-label={lang === 'vi' ? 'Tìm kiếm mã cổ phiếu' : 'Search stock symbol'}
                  title={lang === 'vi' ? 'Tìm kiếm mã cổ phiếu' : 'Search stock symbol'}
                >
                  <Search size={16} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={lang === 'vi' ? 'Tìm mã cổ phiếu...' : 'Search symbol...'}
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    autoFocus
                  />
                  <CommandList>
                    <CommandGroup
                      heading={searchQuery ? (lang === 'vi' ? 'Kết quả' : 'Results') : (lang === 'vi' ? 'Phổ biến' : 'Popular')}
                    >
                      {symbolsLoading ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          {lang === 'vi' ? 'Đang tải...' : 'Loading...'}
                        </div>
                      ) : filteredSymbols.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          {lang === 'vi' ? 'Không tìm thấy mã cổ phiếu' : 'No symbol found'}
                        </div>
                      ) : (
                        filteredSymbols.map((s) => (
                          <CommandItem
                            key={s.symbol}
                            value={s.symbol}
                            onSelect={() => handleSymbolSelect(s.symbol)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {s.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{s.symbol}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{s.name}</p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">{s.exchange}</span>
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {data.length > 0 && (
            <span className="font-mono text-lg font-semibold text-foreground">
              {data[data.length - 1]?.close.toLocaleString('vi-VN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
              isAutoRefresh
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            title={isAutoRefresh ? 'Tắt tự động cập nhật' : 'Bật tự động cập nhật'}
          >
            <Radio size={12} className={cn(isAutoRefresh && "animate-pulse")} />
            {isAutoRefresh ? 'LIVE' : 'OFF'}
          </button>

          {/* Last update time */}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">{formatLastUpdate()}</span>
          )}

          {/* Manual refresh */}
          <button
            onClick={() => {
              refetch();
              setLastUpdate(new Date());
            }}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted/50"
            title="Cập nhật ngay"
          >
            <RefreshCw size={16} className={cn("text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
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
        
        {/* Refresh interval indicator */}
        {isAutoRefresh && (
          <span className="ml-auto text-xs text-muted-foreground">
            Cập nhật mỗi {refreshInterval}s
          </span>
        )}
      </div>

      <div className="relative">
        {/* Subtle Wave Up logo watermark behind chart */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <img 
            src={waveupLogo} 
            alt="" 
            className="w-32 h-32 opacity-[0.04] grayscale"
          />
        </div>
        
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
        <div ref={chartContainerRef} className="w-full relative z-[1]" style={{ height }} />
      </div>
    </div>
  );
};

export default CandlestickChart;
