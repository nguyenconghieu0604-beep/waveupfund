import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Zap, Building2, Factory, Search, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { useMarketIndices, useSymbols } from '@/hooks/useVNStockData';
import { Input } from '@/components/ui/input';
interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  delay?: number;
}

const MarketCard: React.FC<MarketCardProps> = ({ symbol, name, price, change, changePercent, delay = 0 }) => {
  const isPositive = change >= 0;
  
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
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          isPositive ? "bg-success/10 group-hover:bg-success/20" : "bg-destructive/10 group-hover:bg-destructive/20"
        )}>
          {isPositive ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-destructive" />}
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="font-mono text-2xl font-bold text-foreground">{price}</p>
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

      {/* Mini chart placeholder */}
      <div className="mt-4 h-12 flex items-end gap-0.5">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t transition-all",
              isPositive ? "bg-success/30" : "bg-destructive/30"
            )}
            style={{ 
              height: `${Math.random() * 80 + 20}%`,
              opacity: 0.3 + (i / 20) * 0.7
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

interface MarketOverviewProps {
  lang: Language;
}

const MarketOverview: React.FC<MarketOverviewProps> = ({ lang }) => {
  const t = translations[lang];
  const isVi = lang === 'vi';
  const [selectedSymbol, setSelectedSymbol] = useState('VCB');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch real-time market indices
  const { indices, loading: indicesLoading } = useMarketIndices();
  
  // Fetch all symbols for search
  const { symbols: allSymbols } = useSymbols();

  // Filter symbols based on search query
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toUpperCase();
    return allSymbols
      .filter(s => 
        s.symbol.toUpperCase().includes(query) || 
        s.name.toUpperCase().includes(query)
      )
      .slice(0, 10);
  }, [searchQuery, allSymbols]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map indices from API or use fallback
  const marketData = useMemo(() => {
    const indexNameMap: Record<string, { name_vi: string; name_en: string }> = {
      'VNINDEX': { name_vi: 'Sàn HOSE', name_en: 'HOSE Exchange' },
      'VN30': { name_vi: '30 CP hàng đầu', name_en: 'Top 30 Stocks' },
      'HNX': { name_vi: 'Sàn HNX', name_en: 'HNX Exchange' },
      'UPCOM': { name_vi: 'Sàn UPCOM', name_en: 'UPCOM Exchange' },
    };

    if (indices.length > 0) {
      return indices.slice(0, 4).map(idx => ({
        symbol: idx.symbol === 'VNINDEX' ? 'VN-INDEX' : idx.symbol === 'HNX' ? 'HNX-INDEX' : idx.symbol,
        name: isVi 
          ? (indexNameMap[idx.symbol]?.name_vi || idx.symbol) 
          : (indexNameMap[idx.symbol]?.name_en || idx.symbol),
        price: idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: idx.change,
        changePercent: parseFloat(idx.changePercent),
      }));
    }

    // Fallback data
    return [
      { symbol: 'VN-INDEX', name: isVi ? 'Sàn HOSE' : 'HOSE Exchange', price: '1,265.43', change: 8.72, changePercent: 0.69 },
      { symbol: 'HNX-INDEX', name: isVi ? 'Sàn HNX' : 'HNX Exchange', price: '228.56', change: -1.24, changePercent: -0.54 },
      { symbol: 'VN30', name: isVi ? '30 CP hàng đầu' : 'Top 30 Stocks', price: '1,312.87', change: 12.45, changePercent: 0.96 },
      { symbol: 'UPCOM', name: isVi ? 'Sàn UPCOM' : 'UPCOM Exchange', price: '92.34', change: 0.67, changePercent: 0.73 },
    ];
  }, [indices, isVi]);

  // Top Vietnamese stocks watchlist
  const watchlistData = [
    { symbol: 'VCB', name: isVi ? 'Ngân hàng Vietcombank' : 'Vietcombank', price: '92,500', change: 1.87 },
    { symbol: 'VHM', name: isVi ? 'Vinhomes' : 'Vinhomes JSC', price: '41,200', change: -0.72 },
    { symbol: 'VIC', name: isVi ? 'Tập đoàn Vingroup' : 'Vingroup JSC', price: '43,850', change: 2.34 },
    { symbol: 'HPG', name: isVi ? 'Hòa Phát Group' : 'Hoa Phat Group', price: '26,150', change: 1.15 },
    { symbol: 'FPT', name: isVi ? 'Tập đoàn FPT' : 'FPT Corporation', price: '142,800', change: 3.21 },
    { symbol: 'MBB', name: isVi ? 'Ngân hàng MB' : 'MB Bank', price: '27,400', change: -0.36 },
    { symbol: 'MSN', name: isVi ? 'Tập đoàn Masan' : 'Masan Group', price: '78,500', change: 0.89 },
    { symbol: 'VNM', name: isVi ? 'Vinamilk' : 'Vinamilk JSC', price: '72,300', change: -1.23 },
  ];

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSearchQuery('');
    setShowSearchResults(false);
  };

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

      {/* Market Cards Grid - Vietnamese Indices with Realtime */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-xl font-semibold text-foreground">
              {isVi ? 'Chỉ số thị trường' : 'Market Indices'}
            </h3>
            {indicesLoading && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {!indicesLoading && indices.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-success">LIVE</span>
              </div>
            )}
          </div>
          <button className="text-sm text-primary hover:underline font-medium">
            {isVi ? 'Xem tất cả' : 'View All'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketData.map((market, index) => (
            <MarketCard
              key={market.symbol}
              {...market}
              delay={0.1 * index}
            />
          ))}
        </div>
      </div>

      {/* Advanced Candlestick Chart with Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="font-display text-xl font-semibold text-foreground">
            {isVi ? 'Biểu đồ kỹ thuật' : 'Advanced Chart'}
          </h3>
          
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={isVi ? 'Tìm mã CK...' : 'Search symbol...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="pl-9 pr-8 w-40 sm:w-48 h-9 bg-background border-border/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchResults && filteredSymbols.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  >
                    {filteredSymbols.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => handleSelectSymbol(s.symbol)}
                        className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-foreground">{s.symbol}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{s.exchange}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Quick Select Buttons */}
            <div className="flex gap-2">
              {['VCB', 'FPT', 'VHM', 'HPG'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSelectSymbol(sym)}
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
        </div>
        <CandlestickChart 
          symbol={selectedSymbol} 
          lang={lang} 
          height={450}
          autoRefresh={true}
          refreshInterval={30}
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
