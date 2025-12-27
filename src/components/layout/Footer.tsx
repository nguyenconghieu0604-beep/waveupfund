import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, HelpCircle, AlertTriangle } from 'lucide-react';
import type { Theme, Language } from '@/types';
import { translations } from '@/lib/translations';

interface FooterProps {
  theme: Theme;
  lang: Language;
  onOpenAbout: () => void;
  onOpenLegal: (type: 'tos' | 'privacy') => void;
}

const Footer: React.FC<FooterProps> = ({ theme, lang, onOpenAbout, onOpenLegal }) => {
  const t = translations[lang];

  return (
    <motion.footer 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mt-12 glass rounded-3xl border border-border/50 p-8"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-destructive/20 text-destructive rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={12} />
              {t.risk_disclosure}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.version_lite}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.risk_text}
          </p>
          <div className="flex flex-wrap gap-4 items-center pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Regulatory: SEC EDGAR | CFTC | FINRA
            </span>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Protocol: Gemini 3 & Wave Up v1.0
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              System Health: Optimal
            </span>
          </div>
          
          <motion.a 
            href="https://discord.gg/NkWFwVWHYz" 
            target="_blank" 
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-[#5865F2]/20"
          >
            <MessageSquare size={12} fill="currentColor" /> 
            Join Discord
          </motion.a>

          <motion.button 
            onClick={onOpenAbout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border text-muted-foreground hover:text-foreground"
          >
            <HelpCircle size={12} /> 
            About Us
          </motion.button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          © {new Date().getFullYear()} Wave Up Terminal. All Rights Reserved.
        </span>
        <div className="flex gap-6">
          <button 
            onClick={() => onOpenLegal('tos')} 
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            Terms of Service
          </button>
          <button 
            onClick={() => onOpenLegal('privacy')} 
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            Privacy Policy
          </button>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
