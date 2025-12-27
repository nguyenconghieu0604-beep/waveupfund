import React from 'react';
import { motion } from 'framer-motion';
import { usePriceBoard } from '@/hooks/useVNStockData';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import type { Language } from '@/types';

interface PriceBoardProps {
  symbols: string[];
  className?: string;
  lang?: Language;
}

const PriceBoard: React.FC<PriceBoardProps> = ({ symbols, className, lang = 'vi' }) => {
  const { prices, loading, error } = usePriceBoard(symbols);
  const isVi = lang === 'vi';

  const getPriceColor = (price: number, ref: number, ceiling: number, floor: number) => {
    if (price >= ceiling) return 'text-purple-500 bg-purple-500/10'; // Trần
    if (price <= floor) return 'text-cyan-400 bg-cyan-400/10'; // Sàn
    if (price > ref) return 'text-success bg-success/10'; // Tăng
    if (price < ref) return 'text-destructive bg-destructive/10'; // Giảm
    return 'text-warning bg-warning/10'; // Tham chiếu
  };

  if (loading && prices.length === 0) {
    return (
      <div className={cn("glass rounded-2xl p-6 border border-border/50", className)}>
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("glass rounded-2xl p-6 border border-border/50", className)}>
        <p className="text-destructive text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("glass rounded-2xl p-4 border border-border/50 overflow-x-auto", className)}>
      <h3 className="font-display text-xl font-semibold text-foreground mb-4">
        {isVi ? 'Bảng giá' : 'Price Board'}
      </h3>
      
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="text-xs text-muted-foreground uppercase border-b border-border/30">
            <th className="text-left py-3 px-2">{isVi ? 'Mã' : 'Symbol'}</th>
            <th className="text-right py-3 px-2">{isVi ? 'Trần' : 'Ceil'}</th>
            <th className="text-right py-3 px-2">{isVi ? 'TC' : 'Ref'}</th>
            <th className="text-right py-3 px-2">{isVi ? 'Sàn' : 'Floor'}</th>
            <th className="text-right py-3 px-2">{isVi ? 'Giá' : 'Price'}</th>
            <th className="text-right py-3 px-2">{isVi ? '+/-' : 'Chg'}</th>
            <th className="text-right py-3 px-2">%</th>
            <th className="text-right py-3 px-2">{isVi ? 'KL' : 'Vol'}</th>
            <th className="text-center py-3 px-2 border-l border-border/30" colSpan={3}>{isVi ? 'Dư mua' : 'Bid'}</th>
            <th className="text-center py-3 px-2 border-l border-border/30" colSpan={3}>{isVi ? 'Dư bán' : 'Ask'}</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((stock, index) => (
            <motion.tr
              key={stock.symbol}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className="border-b border-border/10 hover:bg-muted/30 transition-colors"
            >
              <td className="py-3 px-2">
                <span className="font-semibold text-foreground">{stock.symbol}</span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-purple-500 font-mono text-sm">
                  {stock.ceiling.toLocaleString('vi-VN')}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-warning font-mono text-sm">
                  {stock.ref.toLocaleString('vi-VN')}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-cyan-400 font-mono text-sm">
                  {stock.floor.toLocaleString('vi-VN')}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className={cn(
                  "font-mono font-bold text-sm px-2 py-1 rounded",
                  getPriceColor(stock.price, stock.ref, stock.ceiling, stock.floor)
                )}>
                  {stock.price.toLocaleString('vi-VN')}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className={cn(
                  "font-mono text-sm flex items-center justify-end gap-1",
                  stock.change >= 0 ? "text-success" : "text-destructive"
                )}>
                  {stock.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className={cn(
                  "font-mono text-sm",
                  stock.changePercent >= 0 ? "text-success" : "text-destructive"
                )}>
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="font-mono text-sm text-muted-foreground">
                  {(stock.volume / 1000).toFixed(0)}K
                </span>
              </td>
              
              {/* Bid columns */}
              {stock.bid.slice(0, 3).map((bid, i) => (
                <td key={`bid-${i}`} className={cn("py-3 px-1 text-right", i === 0 && "border-l border-border/30")}>
                  <div className="text-xs">
                    <div className="text-success font-mono">{bid.price.toLocaleString('vi-VN')}</div>
                    <div className="text-muted-foreground">{(bid.volume / 1000).toFixed(0)}K</div>
                  </div>
                </td>
              ))}
              
              {/* Ask columns */}
              {stock.ask.slice(0, 3).map((ask, i) => (
                <td key={`ask-${i}`} className={cn("py-3 px-1 text-right", i === 0 && "border-l border-border/30")}>
                  <div className="text-xs">
                    <div className="text-destructive font-mono">{ask.price.toLocaleString('vi-VN')}</div>
                    <div className="text-muted-foreground">{(ask.volume / 1000).toFixed(0)}K</div>
                  </div>
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PriceBoard;
