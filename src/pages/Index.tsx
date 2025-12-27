import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TradingDashboard from '@/components/dashboard/TradingDashboard';
import type { Theme, Language } from '@/types';
import { translations } from '@/lib/translations';

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('en');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [globalTicker, setGlobalTicker] = useState('');
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [legalType, setLegalType] = useState<'tos' | 'privacy'>('tos');

  const t = translations[lang];

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      'overview': t.market_overview,
      'global': t.global_market,
      'chart': t.advanced_chart,
      'deep-research': t.deep_research,
      'options': t.options_lab,
      'rrg': t.sector_rotation,
      'market-sentiment': t.market_sentiment,
      'visual-analysis': t.ai_visual_analysis,
      'outlook': t.ai_market_outlook,
      'headlines': t.live_headlines,
      'screener': t.market_screener,
      'heatmap': t.stock_heatmap,
      'sentiment': t.sentiment_analysis,
      'correlation': t.correlation_lab,
      'strategy': t.strategy_lab,
      'filings': t.sec_filings,
      'voice': t.voice_lab,
      'ideas': t.trade_ideas,
      'portfolio': t.portfolio_tracker,
      'earnings': t.earnings_calendar,
      'calendar': t.economic_events,
      'planning': t.planning_suite,
      'research': t.stock_research,
      'learning-hub': t.learning_hub,
    };
    return titles[activeTab] || t.market_overview;
  };

  const openLegal = (type: 'tos' | 'privacy') => {
    setLegalType(type);
    setIsLegalOpen(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        onOpenComparison={() => setIsComparisonOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          theme={theme}
          setTheme={setTheme}
          lang={lang}
          setLang={setLang}
          pageTitle={getPageTitle()}
        />

        {/* Content Area */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            <TradingDashboard
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              theme={theme}
              lang={lang}
              globalTicker={globalTicker}
              setGlobalTicker={setGlobalTicker}
            />
          </motion.div>

          {/* Footer */}
          <Footer
            theme={theme}
            lang={lang}
            onOpenAbout={() => setIsAboutOpen(true)}
            onOpenLegal={openLegal}
          />
        </section>
      </main>

      {/* Pro Comparison Modal */}
      <AnimatePresence>
        {isComparisonOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsComparisonOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl glass-strong rounded-3xl border border-border p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <h2 className="font-display text-3xl font-bold text-foreground mb-2">Upgrade to Pro</h2>
                <p className="text-muted-foreground">Unlock advanced features and take your trading to the next level</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Lite Plan */}
                <div className="glass rounded-2xl p-6 border border-border">
                  <div className="mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Plan</span>
                    <h3 className="font-display text-2xl font-bold text-foreground mt-2">Lite</h3>
                    <p className="text-3xl font-bold text-foreground mt-4">Free</p>
                  </div>
                  <ul className="space-y-3">
                    {['Basic market overview', 'Limited AI analysis', 'Standard charts', 'Community support'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pro Plan */}
                <div className="relative glass rounded-2xl p-6 border border-secondary/50 bg-gradient-to-br from-secondary/10 to-transparent">
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-secondary to-accent text-white text-xs font-bold uppercase">
                      Recommended
                    </span>
                  </div>
                  <div className="mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Upgrade</span>
                    <h3 className="font-display text-2xl font-bold text-foreground mt-2">Pro</h3>
                    <p className="text-3xl font-bold text-foreground mt-4">$29<span className="text-lg text-muted-foreground">/mo</span></p>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {['All Lite features', 'Advanced AI analysis', 'Real-time alerts', 'Voice terminal', 'Priority support', 'Custom strategies'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full py-3 rounded-xl bg-gradient-to-r from-secondary to-accent text-white font-semibold hover:opacity-90 transition-opacity">
                    Upgrade Now
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsComparisonOpen(false)}
                className="mt-6 w-full py-3 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors font-medium"
              >
                Maybe Later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Modal */}
      <AnimatePresence>
        {isLegalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsLegalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl glass-strong rounded-3xl border border-border p-8 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                {legalType === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <div className="prose prose-sm text-muted-foreground">
                <p>
                  {legalType === 'tos' 
                    ? 'By using Wave Up Terminal, you agree to these terms. This platform provides financial data and AI-powered analysis for informational purposes only...'
                    : 'We respect your privacy. This policy describes how we collect, use, and protect your personal information...'}
                </p>
              </div>
              <button 
                onClick={() => setIsLegalOpen(false)}
                className="mt-6 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                I Understand
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsAboutOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl glass-strong rounded-3xl border border-border p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mx-auto mb-4 shadow-glow-lg">
                  <span className="text-4xl">⚡</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">Wave Up Terminal</h2>
                <p className="text-muted-foreground mt-2">AI-Powered Financial Intelligence</p>
              </div>
              
              <p className="text-center text-muted-foreground mb-6">
                Wave Up is a next-generation trading terminal that combines real-time market data with advanced AI analysis to help traders make informed decisions.
              </p>

              <button 
                onClick={() => setIsAboutOpen(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
