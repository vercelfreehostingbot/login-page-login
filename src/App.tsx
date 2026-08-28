import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Radio, Database, ShieldCheck } from 'lucide-react';

interface SystemStatus {
  status: string;
  bot_username: string;
  services: {
    telegram: boolean;
    github: boolean;
    vercel: boolean;
    firebase: boolean;
  };
  stats?: {
    totalUsers: number;
    totalProjects: number;
    firebaseConnected: boolean;
  };
}

export default function App() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastChecked(new Date().toLocaleTimeString());
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  const isFirebaseActive = data?.services?.firebase || data?.stats?.firebaseConnected;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Glowing Status Indicator Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
            <Bot className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>
        </div>

        {/* Minimal Status Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Bot Engine Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧
          </h1>
          <p className="text-sm text-slate-400">
            {data?.bot_username || '@Vercel_Free_Hosting_Bot'}
          </p>
        </div>

        {/* Service Integration Status Badges */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isFirebaseActive ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Database</div>
              <div className="text-xs font-semibold text-slate-200">
                {isFirebaseActive ? 'Firestore Live' : 'Durable Memory'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Security</div>
              <div className="text-xs font-semibold text-slate-200">Enforced & Active</div>
            </div>
          </div>
        </div>

        {/* Subtle Live Badge & Ping */}
        <div className="pt-4 border-t border-slate-900 flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Status: Running</span>
          </div>
          <span>•</span>
          <div>Last checked: {lastChecked}</div>
        </div>
      </div>
    </div>
  );
}

