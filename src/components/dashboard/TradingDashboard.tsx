import React from 'react';
import { motion } from 'framer-motion';
import MarketOverview from './MarketOverview';
import heroPattern from '@/assets/hero-pattern.png';
import type { Theme, Language } from '@/types';

interface TradingDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: Theme;
  lang: Language;
  globalTicker: string;
  setGlobalTicker: (ticker: string) => void;
}

const ComingSoonPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative flex flex-col items-center justify-center min-h-[500px] glass rounded-3xl border border-border/50 overflow-hidden"
  >
    {/* Background Pattern */}
    <div 
      className="absolute inset-0 opacity-20 bg-cover bg-center"
      style={{ backgroundImage: `url(${heroPattern})` }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
    
    <div className="relative text-center space-y-6 px-6">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 flex items-center justify-center mx-auto shadow-glow"
      >
        <span className="text-4xl">🚀</span>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-display text-3xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground max-w-md mt-3">
          This powerful feature is coming soon. Stay tuned for updates!
        </p>
      </motion.div>
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-4"
      >
        <span className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-secondary/20 via-accent/20 to-primary/20 text-foreground text-sm font-bold border border-secondary/30">
          Coming Soon
        </span>
      </motion.div>
    </div>
  </motion.div>
);

const TradingDashboard: React.FC<TradingDashboardProps> = ({
  activeTab,
  setActiveTab,
  theme,
  lang,
  globalTicker,
  setGlobalTicker
}) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <MarketOverview lang={lang} />;
      case 'global':
        return <ComingSoonPlaceholder title="Global Intelligence" />;
      case 'chart':
        return <ComingSoonPlaceholder title="Advanced Chart" />;
      case 'deep-research':
        return <ComingSoonPlaceholder title="Deep Intelligence" />;
      case 'options':
        return <ComingSoonPlaceholder title="Options & Ratings" />;
      case 'sentiment':
        return <ComingSoonPlaceholder title="AI Sentiment Pulse" />;
      case 'market-sentiment':
        return <ComingSoonPlaceholder title="FX Market Sentiment" />;
      case 'rrg':
        return <ComingSoonPlaceholder title="Sector Rotation (RRG)" />;
      case 'voice':
        return <ComingSoonPlaceholder title="Voice Terminal" />;
      case 'ideas':
        return <ComingSoonPlaceholder title="Technical Ideas" />;
      case 'visual-analysis':
        return <ComingSoonPlaceholder title="AI Visual Analysis" />;
      case 'outlook':
        return <ComingSoonPlaceholder title="AI Market Outlook" />;
      case 'filings':
        return <ComingSoonPlaceholder title="SEC Filings" />;
      case 'headlines':
        return <ComingSoonPlaceholder title="Live Headlines" />;
      case 'correlation':
        return <ComingSoonPlaceholder title="Macro Correlation" />;
      case 'strategy':
        return <ComingSoonPlaceholder title="Strategy Lab" />;
      case 'portfolio':
        return <ComingSoonPlaceholder title="Portfolio Hub" />;
      case 'screener':
        return <ComingSoonPlaceholder title="Market Screener" />;
      case 'heatmap':
        return <ComingSoonPlaceholder title="Stock Heatmap" />;
      case 'earnings':
        return <ComingSoonPlaceholder title="Earnings Calendar" />;
      case 'calendar':
        return <ComingSoonPlaceholder title="Economic Events" />;
      case 'planning':
        return <ComingSoonPlaceholder title="Planning Suite" />;
      case 'research':
        return <ComingSoonPlaceholder title="Stock Research" />;
      case 'learning-hub':
        return <ComingSoonPlaceholder title="Learning Hub" />;
      default:
        return <MarketOverview lang={lang} />;
    }
  };

  return (
    <div className="w-full">
      {renderContent()}
    </div>
  );
};

export default TradingDashboard;
