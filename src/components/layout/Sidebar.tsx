import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Globe, LineChart, Activity, Newspaper, 
  LayoutGrid, Calendar, Mic2, Lightbulb, Eye, FileText,
  Code2, PieChart, Compass, Users, Search, BookOpen, Wallet,
  Layers, Microscope, Grid3X3, Coins, Map, X, Zap, Crown, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  isNew?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, badge, isNew }) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
        active 
          ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary border-l-2 border-primary" 
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <span className={cn(
        "flex-shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
      )}>
        {icon}
      </span>
      <span className="text-sm font-medium truncate">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-secondary/20 text-secondary">
          {badge}
        </span>
      )}
      {isNew && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/20 text-success animate-pulse">
          NEW
        </span>
      )}
    </motion.button>
  );
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: Language;
  onOpenComparison: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  activeTab, 
  setActiveTab, 
  lang,
  onOpenComparison 
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'overview', icon: <Globe size={18} />, label: t.market_overview },
    { id: 'global', icon: <Map size={18} />, label: t.global_market },
    { id: 'chart', icon: <LineChart size={18} />, label: t.advanced_chart },
    { id: 'deep-research', icon: <Microscope size={18} />, label: t.deep_research, isNew: true },
    { id: 'options', icon: <Layers size={18} />, label: t.options_lab },
    { id: 'sentiment', icon: <Activity size={18} />, label: t.sentiment_analysis },
    { id: 'market-sentiment', icon: <Users size={18} />, label: t.market_sentiment },
    { id: 'rrg', icon: <Compass size={18} />, label: t.sector_rotation },
    { id: 'voice', icon: <Mic2 size={18} />, label: t.voice_lab, badge: 'AI' },
    { id: 'ideas', icon: <Lightbulb size={18} />, label: t.trade_ideas },
    { id: 'visual-analysis', icon: <Eye size={18} />, label: t.ai_visual_analysis, badge: 'AI' },
    { id: 'outlook', icon: <Newspaper size={18} />, label: t.ai_market_outlook },
    { id: 'filings', icon: <FileText size={18} />, label: t.sec_filings },
    { id: 'headlines', icon: <Newspaper size={18} />, label: t.live_headlines },
    { id: 'correlation', icon: <Grid3X3 size={18} />, label: t.correlation_lab },
    { id: 'strategy', icon: <Code2 size={18} />, label: t.strategy_lab },
    { id: 'portfolio', icon: <PieChart size={18} />, label: t.portfolio_tracker },
  ];

  const toolsItems = [
    { id: 'screener', icon: <TrendingUp size={18} />, label: t.market_screener },
    { id: 'heatmap', icon: <LayoutGrid size={18} />, label: t.stock_heatmap },
    { id: 'earnings', icon: <Coins size={18} />, label: t.earnings_calendar },
    { id: 'calendar', icon: <Calendar size={18} />, label: t.economic_events },
    { id: 'planning', icon: <Wallet size={18} />, label: t.planning_suite },
    { id: 'research', icon: <Search size={18} />, label: t.stock_research },
    { id: 'learning-hub', icon: <BookOpen size={18} />, label: t.learning_hub },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden z-40"
        >
          {/* Logo Header */}
          <div className="p-6 flex items-center justify-between border-b border-sidebar-border">
            <motion.button 
              onClick={onOpenComparison}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 group"
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
                <Zap className="text-primary-foreground" size={22} fill="currentColor" />
                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary opacity-50 blur-sm -z-10" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg tracking-tight text-foreground">{t.terminal_title}</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{t.lite_tag} Version</span>
              </div>
            </motion.button>
            <button 
              onClick={onClose} 
              className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
                badge={item.badge}
                isNew={item.isNew}
              />
            ))}

            <div className="pt-6 pb-3 px-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.trading_tools}
              </span>
            </div>

            {toolsItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </nav>

          {/* Pro Upgrade CTA */}
          <div className="p-4 border-t border-sidebar-border space-y-4">
            <motion.button 
              onClick={onOpenComparison}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-secondary/20 via-accent/10 to-primary/20 border border-secondary/30 flex items-center justify-between group transition-all hover:border-secondary/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                  <Crown size={16} className="text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-foreground">Unlock Pro</span>
                  <p className="text-[10px] text-muted-foreground">Advanced features</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <div className="text-center">
              <p className="text-[10px] font-medium text-muted-foreground">
                © {new Date().getFullYear()} Wave Up Terminal
              </p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
