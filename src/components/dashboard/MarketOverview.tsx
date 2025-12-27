import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight,
  Zap, Globe, BarChart3, DollarSign, Bitcoin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';

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

const MarketOverview: React.FC<MarketOverviewProps> = ({ lang }) => {
  const t = translations[lang];

  const marketData = [
    { symbol: 'S&P 500', name: 'US Large Cap', price: '5,998.74', change: 73.26, changePercent: 1.24 },
    { symbol: 'NASDAQ', name: 'Tech Index', price: '19,572.60', change: -23.45, changePercent: -0.12 },
    { symbol: 'DJI', name: 'Dow Jones', price: '43,729.93', change: 461.88, changePercent: 1.07 },
    { symbol: 'BTC', name: 'Bitcoin', price: '$98,432', change: 2341.50, changePercent: 2.44 },
  ];

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
          <p className="text-muted-foreground mt-1">Here's what's happening in the markets today</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Activity size={18} className="text-primary" />}
          label="Market Cap"
          value="$48.2T"
          subValue="+2.4%"
          trend="up"
          delay={0.1}
        />
        <StatCard 
          icon={<DollarSign size={18} className="text-success" />}
          label="24h Volume"
          value="$312B"
          subValue="+18.2%"
          trend="up"
          delay={0.15}
        />
        <StatCard 
          icon={<Globe size={18} className="text-accent" />}
          label="Fear & Greed"
          value="72"
          subValue="Greed"
          delay={0.2}
        />
        <StatCard 
          icon={<BarChart3 size={18} className="text-secondary" />}
          label="VIX"
          value="13.89"
          subValue="-5.2%"
          trend="down"
          delay={0.25}
        />
      </div>

      {/* Market Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-foreground">{t.trending}</h3>
          <button className="text-sm text-primary hover:underline font-medium">View All</button>
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

      {/* Watchlist Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-3xl p-6 border border-border/50"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-foreground">{t.watchlist}</h3>
          <button className="text-sm text-primary hover:underline font-medium">Edit</button>
        </div>

        <div className="space-y-3">
          {[
            { symbol: 'AAPL', name: 'Apple Inc.', price: '$198.45', change: 2.34 },
            { symbol: 'NVDA', name: 'NVIDIA Corp.', price: '$875.32', change: -1.23 },
            { symbol: 'TSLA', name: 'Tesla Inc.', price: '$248.50', change: 4.56 },
            { symbol: 'MSFT', name: 'Microsoft Corp.', price: '$378.91', change: 1.12 },
            { symbol: 'AMZN', name: 'Amazon.com', price: '$186.23', change: -0.45 },
          ].map((stock, index) => (
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
                <p className="font-mono font-semibold text-foreground">{stock.price}</p>
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
    </div>
  );
};

export default MarketOverview;
