import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight,
  Zap, BarChart3, Building2, Banknote, Factory
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { useMarketIndices, usePriceBoard } from '@/hooks/useVNStockData';
interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume?: number;
  delay?: number;
}

const MarketCard: React.FC<MarketCardProps> = ({ symbol, name, price, change, changePercent, volume, delay = 0 }) => {
  const isPositive = change >= 0;

  const bars = useMemo(() => {
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    return Array.from({ length: 20 }, (_, i) => {
      const h = 0.2 + rand() * 0.8;
      const opacity = 0.35 + (i / 20) * 0.55;
      return { h, opacity };
    });
  }, [symbol]);

  const formatVolume = (vol: number) => {
    if (!vol) return '';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    return vol.toLocaleString('vi-VN');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass rounded-2xl p-5 border border-border/50 card-hover cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">{symbol}</h3>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
        <div
          className={cn(
            "p-2 rounded-xl transition-colors",
            isPositive ? "bg-success/10 group-hover:bg-success/20" : "bg-destructive/10 group-hover:bg-destructive/20"
          )}
        >
          {isPositive ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-destructive" />}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-2xl font-bold text-foreground">{price}</p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              isPositive ? "text-success" : "text-destructive"
            )}
          >
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {isPositive ? '+' : ''}{change.toFixed(2)}
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-bold",
              isPositive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            )}
          >
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
        {/* Volume */}
        {volume !== undefined && volume > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            KL: <span className="font-mono text-foreground">{formatVolume(volume)}</span>
          </p>
        )}
      </div>

      {/* Mini chart (stable, no motion) */}
      <div className="mt-4 h-12 flex items-end gap-0.5" aria-hidden>
        {bars.map((b, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t",
              isPositive ? "bg-success/30" : "bg-destructive/30"
            )}
            style={{
              height: `${Math.round(b.h * 100)}%`,
              opacity: b.opacity,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down';
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, trend, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className="glass rounded-2xl p-5 border border-border/50"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-xl bg-primary/10">
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-2xl font-bold text-foreground">{value}</p>
          {subValue && (
            <p className={cn(
              "text-sm font-medium mt-1",
              trend === 'up' ? "text-success" : trend === 'down' ? "text-destructive" : "text-muted-foreground"
            )}>
              {subValue}
            </p>
          )}
        </div>
        {trend && (
          <div className={cn(
            "p-1.5 rounded-lg",
            trend === 'up' ? "bg-success/10" : "bg-destructive/10"
          )}>
            {trend === 'up' ? (
              <ArrowUpRight size={16} className="text-success" />
            ) : (
              <ArrowDownRight size={16} className="text-destructive" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface MarketOverviewProps {
  lang: Language;
}

const formatIndexSymbol = (symbol: string) => {
  if (symbol === 'VNINDEX') return 'VN-INDEX';
  if (symbol === 'HNXINDEX') return 'HNX-INDEX';
  return symbol;
};

const MarketOverview: React.FC<MarketOverviewProps> = ({ lang }) => {
  const t = translations[lang];
  const isVi = lang === 'vi';
  const [selectedSymbol, setSelectedSymbol] = useState('VCB');

  const { indices, loading: indicesLoading } = useMarketIndices(true);

  const marketData = useMemo(() => {
    const nameBySymbol: Record<string, string> = {
      VNINDEX: isVi ? 'Sàn HOSE' : 'HOSE Exchange',
      HNXINDEX: isVi ? 'Sàn HNX' : 'HNX Exchange',
      VN30: isVi ? '30 CP hàng đầu' : 'Top 30 Stocks',
      UPCOM: isVi ? 'Sàn UPCOM' : 'UPCOM Exchange',
    };

    // Get both indices (VNINDEX, VN30) and volumes
    const vnIndex = (indices || []).find((i) => i.symbol === 'VNINDEX');
    const vn30 = (indices || []).find((i) => i.symbol === 'VN30');

    // 4 cards: VNINDEX, VNINDEX Volume, VN30, VN30 Volume
    const cards: MarketCardProps[] = [];

    if (vnIndex) {
      cards.push({
        symbol: 'VN-INDEX',
        name: nameBySymbol.VNINDEX,
        price: (vnIndex.price ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
        change: Number(vnIndex.change ?? 0),
        changePercent: Number(vnIndex.changePercent ?? 0),
        volume: vnIndex.volume ?? 0,
      });
    }

    if (vn30) {
      cards.push({
        symbol: 'VN30',
        name: nameBySymbol.VN30,
        price: (vn30.price ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
        change: Number(vn30.change ?? 0),
        changePercent: Number(vn30.changePercent ?? 0),
        volume: vn30.volume ?? 0,
      });
    }

    return cards;
  }, [indices, isVi]);

  // VN30 stocks - load every 20 minutes
  const vn30Symbols = useMemo(() => ['VCB', 'VHM', 'VIC', 'HPG', 'FPT', 'MBB', 'MSN', 'VNM'], []);
  const { prices: vn30Prices, loading: vn30Loading, isMarketOpen: priceMarketOpen } = usePriceBoard(vn30Symbols, true, 20 * 60 * 1000);

  const stockNames: Record<string, { vi: string; en: string }> = {
    VCB: { vi: 'Ngân hàng Vietcombank', en: 'Vietcombank' },
    VHM: { vi: 'Vinhomes', en: 'Vinhomes JSC' },
    VIC: { vi: 'Tập đoàn Vingroup', en: 'Vingroup JSC' },
    HPG: { vi: 'Hòa Phát Group', en: 'Hoa Phat Group' },
    FPT: { vi: 'Tập đoàn FPT', en: 'FPT Corporation' },
    MBB: { vi: 'Ngân hàng MB', en: 'MB Bank' },
    MSN: { vi: 'Tập đoàn Masan', en: 'Masan Group' },
    VNM: { vi: 'Vinamilk', en: 'Vinamilk JSC' },
  };

  // Format price with proper Vietnamese format (e.g., 57.100đ)
  const formatStockPrice = (price: number): string => {
    if (!price) return '—';
    return price.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, '.');
  };

  const watchlistData = useMemo(() => {
    return vn30Symbols.map((sym) => {
      const priceData = vn30Prices.find((p) => p.symbol === sym);
      const names = stockNames[sym] || { vi: sym, en: sym };
      return {
        symbol: sym,
        name: isVi ? names.vi : names.en,
        price: priceData ? formatStockPrice(priceData.price) : '—',
        change: priceData ? priceData.changePercent : 0,
      };
    });
  }, [vn30Prices, isVi]);


  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.welcome}</h2>
          <p className="text-muted-foreground mt-1">
            {isVi ? 'Cập nhật thị trường chứng khoán Việt Nam hôm nay' : "Here's what's happening in Vietnamese stock markets today"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-success">
              {isVi ? 'Phiên giao dịch' : 'Market Open'}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-glow"
          >
            <Zap size={16} />
            {t.quick_actions}
          </motion.button>
        </div>
      </motion.div>


      {/* Market Cards Grid - Vietnamese Indices */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Chỉ số thị trường' : 'Market Indices'}
          </h3>
          <button className="text-sm text-primary hover:underline font-medium">
            {isVi ? 'Xem tất cả' : 'View All'}
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {marketData.map((market, index) => (
            <MarketCard
              key={market.symbol}
              {...market}
              delay={0.1 * index}
            />
          ))}
          {/* Fill to 4 cards if needed - empty placeholders */}
          {marketData.length < 4 && Array.from({ length: 4 - marketData.length }).map((_, i) => (
            <div key={`placeholder-${i}`} className="glass rounded-2xl p-5 border border-border/30 opacity-50">
              <p className="text-muted-foreground text-sm">{isVi ? 'Đang tải...' : 'Loading...'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Candlestick Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
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
          key={`${selectedSymbol}-${lang}`}
          symbol={selectedSymbol} 
          lang={lang} 
          height={450}
          autoRefresh={true}
          refreshInterval={30}
          onSymbolChange={(sym) => setSelectedSymbol(sym)}
        />
      </motion.div>

      {/* Sector Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-3xl p-6 border border-border/50"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Nhóm ngành hôm nay' : 'Sector Performance'}
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: isVi ? 'Ngân hàng' : 'Banking', change: 1.24, icon: Building2 },
            { name: isVi ? 'Bất động sản' : 'Real Estate', change: -0.56, icon: Building2 },
            { name: isVi ? 'Công nghệ' : 'Technology', change: 2.15, icon: Factory },
            { name: isVi ? 'Thép' : 'Steel', change: 0.89, icon: Factory },
          ].map((sector, index) => (
            <motion.div
              key={sector.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              className={cn(
                "p-4 rounded-xl border transition-colors cursor-pointer",
                sector.change >= 0 
                  ? "bg-success/5 border-success/20 hover:bg-success/10" 
                  : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <sector.icon size={16} className={sector.change >= 0 ? "text-success" : "text-destructive"} />
                <span className="text-sm font-medium text-foreground">{sector.name}</span>
              </div>
              <span className={cn(
                "text-lg font-bold",
                sector.change >= 0 ? "text-success" : "text-destructive"
              )}>
                {sector.change >= 0 ? '+' : ''}{sector.change}%
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Watchlist Section - Vietnamese Stocks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-3xl p-6 border border-border/50"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Cổ phiếu VN30' : 'VN30 Stocks'}
          </h3>
          <button className="text-sm text-primary hover:underline font-medium">
            {isVi ? 'Chỉnh sửa' : 'Edit'}
          </button>
        </div>

        <div className="space-y-3">
          {watchlistData.map((stock, index) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.05 }}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-display font-bold text-sm text-foreground">
                  {stock.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground">{stock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold text-foreground">{stock.price}đ</p>
                <p className={cn(
                  "text-sm font-medium",
                  stock.change >= 0 ? "text-success" : "text-destructive"
                )}>
                  {stock.change >= 0 ? '+' : ''}{stock.change}%
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Market News Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass rounded-3xl p-6 border border-border/50"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Tin tức thị trường' : 'Market News'}
          </h3>
          <button className="text-sm text-primary hover:underline font-medium">
            {isVi ? 'Xem thêm' : 'View More'}
          </button>
        </div>
        <div className="space-y-4">
          {[
            { 
              title: isVi ? 'VN-Index vượt mốc 1,265 điểm, thanh khoản tăng mạnh' : 'VN-Index surpasses 1,265 points with strong liquidity',
              time: '10:30',
              source: 'CafeF'
            },
            { 
              title: isVi ? 'Khối ngoại bán ròng 125 tỷ đồng trong phiên sáng' : 'Foreign investors net sell 125B VND in morning session',
              time: '11:15',
              source: 'VnEconomy'
            },
            { 
              title: isVi ? 'FPT lập đỉnh lịch sử, vốn hóa vượt 200,000 tỷ đồng' : 'FPT reaches all-time high, market cap exceeds 200T VND',
              time: '09:45',
              source: 'VnExpress'
            },
          ].map((news, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex-shrink-0 w-16 text-center">
                <span className="text-xs font-medium text-muted-foreground">{news.time}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground line-clamp-2">{news.title}</p>
                <span className="text-xs text-muted-foreground mt-1">{news.source}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default MarketOverview;
