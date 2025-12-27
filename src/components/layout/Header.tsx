import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, Settings, Clock, ChevronDown, Sun, Moon, 
  Languages, Check, Bell, Search, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Theme, Language } from '@/types';
import { translations } from '@/lib/translations';

interface WorldClockProps {
  theme: Theme;
}

const WorldClock: React.FC<WorldClockProps> = ({ theme }) => {
  const [time, setTime] = useState(new Date());
  const [showZones, setShowZones] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (tz?: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz
      }).format(time);
    } catch (e) {
      return "00:00:00";
    }
  };

  const zones = [
    { name: 'Local', tz: undefined, flag: '🏠' },
    { name: 'New York', tz: 'America/New_York', flag: '🇺🇸' },
    { name: 'London', tz: 'Europe/London', flag: '🇬🇧' },
    { name: 'Tokyo', tz: 'Asia/Tokyo', flag: '🇯🇵' },
    { name: 'Vietnam', tz: 'Asia/Ho_Chi_Minh', flag: '🇻🇳' }
  ];

  return (
    <div className="relative">
      <motion.button 
        onClick={() => setShowZones(!showZones)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2.5 px-4 py-2 rounded-xl glass border border-border/50 transition-all hover:border-primary/30"
      >
        <Clock size={14} className="text-primary" />
        <span className="font-mono text-xs font-semibold tracking-wider text-foreground">{formatTime()}</span>
        <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", showZones && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {showZones && (
          <motion.div 
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 w-64 rounded-2xl glass-strong border border-border p-2 shadow-2xl z-50"
          >
            {zones.map((z, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-base">{z.flag}</span>
                  <span className="text-xs font-medium text-muted-foreground">{z.name}</span>
                </div>
                <span className="font-mono text-xs font-semibold text-primary">{formatTime(z.tz)}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  pageTitle: string;
}

const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  theme,
  setTheme,
  lang,
  setLang,
  pageTitle
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const t = translations[lang];

  return (
    <header className="h-16 border-b border-border glass-strong px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <motion.button 
            onClick={onToggleSidebar}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={20} />
          </motion.button>
        )}
        
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-semibold text-foreground">{pageTitle}</h1>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-[11px] font-semibold text-success">{t.market_live}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <motion.button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search size={18} />
        </motion.button>

        {/* World Clock */}
        <div className="hidden md:block">
          <WorldClock theme={theme} />
        </div>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
        </motion.button>

        {/* Settings */}
        <div className="relative">
          <motion.button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2 rounded-xl transition-colors",
              isSettingsOpen 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings size={18} />
          </motion.button>

          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-72 rounded-2xl glass-strong border border-border p-4 shadow-2xl z-50"
              >
                <div className="space-y-6">
                  {/* Theme Toggle */}
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t.theme}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button 
                        onClick={() => setTheme('light')} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all",
                          theme === 'light' 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Sun size={16} /> {t.light}
                      </motion.button>
                      <motion.button 
                        onClick={() => setTheme('dark')} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all",
                          theme === 'dark' 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Moon size={16} /> {t.dark}
                      </motion.button>
                    </div>
                  </div>

                  {/* Language Toggle */}
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t.language}</h3>
                    <div className="space-y-1">
                      {[
                        { code: 'en' as Language, label: t.english, flag: '🇺🇸' },
                        { code: 'vi' as Language, label: t.vietnamese, flag: '🇻🇳' }
                      ].map((langOption) => (
                        <motion.button 
                          key={langOption.code}
                          onClick={() => setLang(langOption.code)} 
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                            lang === langOption.code 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span>{langOption.flag}</span>
                            <Languages size={14} /> 
                            {langOption.label}
                          </div>
                          {lang === langOption.code && <Check size={14} />}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl mx-4"
            >
              <div className="glass-strong rounded-2xl border border-border shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                  <Search size={20} className="text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t.search_placeholder}
                    autoFocus
                    className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button onClick={() => setIsSearchOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground text-center py-8">Start typing to search...</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
