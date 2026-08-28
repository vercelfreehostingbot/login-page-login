import React from 'react';
import { UploadCloud, Layers, Globe, Shield, RefreshCw, Smartphone, Key } from 'lucide-react';

export const FeaturesGuide: React.FC = () => {
  const steps = [
    {
      icon: Smartphone,
      title: '1. Start & Force Join',
      desc: 'User opens @Vercel_Free_Hosting_Bot, joins required Channel & Group, then clicks ✅ Verify.',
    },
    {
      icon: UploadCloud,
      title: '2. Upload ZIP Archive',
      desc: 'Send any web project ZIP archive. The bot performs Zip Slip protection & framework detection.',
    },
    {
      icon: Layers,
      title: '3. GitHub Repository',
      desc: 'Automated repository creation & Git commit tree uploads without exposing tokens to clients.',
    },
    {
      icon: Globe,
      title: '4. Vercel Build & Live URL',
      desc: 'Vercel serverless deployment triggers and live build logs return an instant production HTTPS link.',
    },
  ];

  const frameworks = [
    'Next.js (App / Pages Router)',
    'Vite + React / Vue / Svelte',
    'Astro / Remix / Nuxt.js',
    'Static HTML5, Tailwind, JS',
    'SvelteKit & Angular',
    'Node.js Serverless Functions',
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          <span>Telegram Serverless Workflow</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-xs text-slate-900 dark:text-white">{step.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <span>Supported Frameworks & Stacks</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automatically detected during ZIP inspection:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {frameworks.map((f, i) => (
              <div
                key={i}
                className="text-xs font-medium px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800 flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-500" />
            <span>Bot Main Menu & Admin Controls</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive controls via Telegram ReplyKeyboardMarkup:
          </p>
          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>🚀 Deploy Website / 📂 My Projects</span>
              <span className="text-[10px] text-slate-400 font-sans">User Menu</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>🌐 Add Domain / 🔄 Redeploy</span>
              <span className="text-[10px] text-slate-400 font-sans">User Menu</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>/admin — Super Admin: 6919025708</span>
              <span className="text-[10px] text-amber-500 font-sans font-bold">Admin Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
