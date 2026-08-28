import React from 'react';
import { Send, ShieldCheck, Zap, Activity } from 'lucide-react';

interface StatusHeaderProps {
  status: string;
  botUsername: string;
  totalDeployments: number;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  status,
  botUsername,
  totalDeployments,
}) => {
  return (
    <div className="bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SYSTEM STATUS: {status}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧</span>
            </h1>

            <p className="text-slate-400 text-sm sm:text-base max-w-xl">
              Serverless Telegram bot for deploying compatible web projects directly to Vercel with GitHub repository generation & Firebase tracking.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://t.me/${botUsername.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/20 text-sm"
              id="btn-open-telegram"
            >
              <Send className="w-4 h-4" />
              <span>Open on Telegram</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zip Slip Protection</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>5 Free Builds / Day</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span>Webhook Serverless</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Bot:</span>
            <span className="font-mono text-white">{botUsername}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
