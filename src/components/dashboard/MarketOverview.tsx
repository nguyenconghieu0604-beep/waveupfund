import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { useMarketIndices, usePriceBoardRealtime, isMarketOpen } from '@/hooks/useMarketData';

interface MarketCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  loading?: boolean;
}

const MarketCard: React.FC<MarketCardProps> = ({ symbol, name, price, change, changePercent, loading }) => {
  const isPositive = change >= 0;
  
  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 border border-border/50 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-24 mb-2" />
        <div className="h-4 bg-muted/50 rounded w-16 mb-4" />
        <div className="h-8 bg-muted/50 rounded w-32" />
      </div>
    );
  }
  
  return (
    <div className="glass rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">{symbol}</h3>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
        <div className={cn(
          "p-2 rounded-xl",
          isPositive ? "bg-success/10" : "bg-destructive/10"
        )}>
          {isPositive ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-destructive" />}
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="font-mono text-2xl font-bold text-foreground">
          {price.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="flex items-center gap-2">
          <span className={cn(
            "flex items-center gap-1 text-sm font-semibold",
            isPositive ? "text-success" : "text-destructive"
          )}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {isPositive ? '+' : ''}{change.toFixed(2)}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded-md text-xs font-bold",
            isPositive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
          )}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

interface MarketOverviewProps {
  lang: Language;
}

const MarketOverview: React.FC<MarketOverviewProps> = ({ lang }) => {
  const t = translations[lang];
  const isVi = lang === 'vi';
  const [selectedSymbol, setSelectedSymbol] = useState('VCB');
  
  // Real-time data hooks
  const { indices, loading: indicesLoading, lastUpdate: indicesUpdate, refetch: refetchIndices } = useMarketIndices(30000);
  const vn30Symbols = ['VCB', 'VHM', 'VIC', 'HPG', 'FPT', 'MBB', 'MSN', 'VNM'];
  const { prices, loading: pricesLoading, lastUpdate: pricesUpdate, refetch: refetchPrices } = usePriceBoardRealtime(vn30Symbols, 10000);
  
  const marketOpen = isMarketOpen();

  // Map indices to display names
  const indexNames: Record<string, { vi: string; en: string }> = {
    'VNINDEX': { vi: 'Chỉ số VNINDEX', en: 'VN-INDEX' },
    'VN30': { vi: 'Chỉ số VN30', en: 'VN30 Index' },
    'HNXINDEX': { vi: 'Chỉ số HNXINDEX', en: 'HNX-INDEX' },
    'UPCOMINDEX': { vi: 'Chỉ số UPINDEX', en: 'UPCOM-INDEX' },
    'VN30F1M': { vi: 'Hợp đồng tương lai VN30F1M', en: 'VN30 Futures' },
  };

  // Map stock symbols to names
  const stockNames: Record<string, { vi: string; en: string }> = {
    'VCB': { vi: 'Ngân hàng Vietcombank', en: 'Vietcombank' },
    'VHM': { vi: 'Vinhomes', en: 'Vinhomes JSC' },
    'VIC': { vi: 'Tập đoàn Vingroup', en: 'Vingroup JSC' },
    'HPG': { vi: 'Hòa Phát Group', en: 'Hoa Phat Group' },
    'FPT': { vi: 'Tập đoàn FPT', en: 'FPT Corporation' },
    'MBB': { vi: 'Ngân hàng MB', en: 'MB Bank' },
    'MSN': { vi: 'Tập đoàn Masan', en: 'Masan Group' },
    'VNM': { vi: 'Vinamilk', en: 'Vinamilk JSC' },
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.welcome}</h2>
          <p className="text-muted-foreground mt-1">
            {isVi ? 'Dữ liệu realtime từ VCI Trading API' : 'Real-time data from VCI Trading API'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border",
            marketOpen 
              ? "bg-success/10 border-success/20" 
              : "bg-muted/50 border-border"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              marketOpen ? "bg-success animate-pulse" : "bg-muted-foreground"
            )} />
            <span className={cn(
              "text-sm font-medium",
              marketOpen ? "text-success" : "text-muted-foreground"
            )}>
              {marketOpen 
                ? (isVi ? 'Phiên giao dịch' : 'Market Open')
                : (isVi ? 'Ngoài giờ giao dịch' : 'Market Closed')
              }
            </span>
          </div>
          <button
            onClick={() => { refetchIndices(); refetchPrices(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={16} />
            {isVi ? 'Làm mới' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Last Update Time */}
      {(indicesUpdate || pricesUpdate) && (
        <div className="text-xs text-muted-foreground">
          {isVi ? 'Cập nhật lần cuối: ' : 'Last updated: '}
          {(indicesUpdate || pricesUpdate)?.toLocaleTimeString('vi-VN')}
        </div>
      )}

      {/* Market Indices - Real-time from API - NO ANIMATIONS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Chỉ số thị trường' : 'Market Indices'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {isVi ? 'Tự động cập nhật mỗi 30s' : 'Auto-refresh every 30s'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {indicesLoading ? (
            [...Array(5)].map((_, i) => (
              <MarketCard
                key={i}
                symbol=""
                name=""
                price={0}
                change={0}
                changePercent={0}
                loading={true}
              />
            ))
          ) : (
            indices.map((index) => (
              <MarketCard
                key={index.symbol}
                symbol={index.symbol}
                name={indexNames[index.symbol]?.[isVi ? 'vi' : 'en'] || index.symbol}
                price={index.price}
                change={index.change}
                changePercent={parseFloat(index.changePercent)}
              />
            ))
          )}
        </div>
      </div>

      {/* Advanced Candlestick Chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Biểu đồ kỹ thuật' : 'Advanced Chart'}
          </h3>
          <div className="flex gap-2">
            {['VCB', 'FPT', 'VHM', 'HPG'].map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={cn(
                  "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                  selectedSymbol === sym 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
        <CandlestickChart 
          symbol={selectedSymbol} 
          lang={lang} 
          height={450}
          autoRefresh={marketOpen}
          refreshInterval={30}
        />
      </div>

      {/* VN30 Stocks - Real-time Price Board - NO ANIMATIONS */}
      <div className="glass rounded-3xl p-6 border border-border/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Bảng giá VN30 Realtime' : 'VN30 Real-time Prices'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {isVi ? 'Tự động cập nhật mỗi 10s' : 'Auto-refresh every 10s'}
          </span>
        </div>

        <div className="space-y-3">
          {pricesLoading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50" />
                  <div>
                    <div className="h-4 bg-muted/50 rounded w-16 mb-1" />
                    <div className="h-3 bg-muted/50 rounded w-24" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-muted/50 rounded w-20 mb-1" />
                  <div className="h-3 bg-muted/50 rounded w-12" />
                </div>
              </div>
            ))
          ) : (
            prices.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-display font-bold text-sm text-foreground">
                    {stock.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {stockNames[stock.symbol]?.[isVi ? 'vi' : 'en'] || stock.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-foreground">
                    {(stock.price * 1000).toLocaleString('vi-VN')}đ
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      stock.change >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(stock.volume / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;
