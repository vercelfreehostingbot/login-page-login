import React from 'react';
import { CheckCircle2, AlertTriangle, Server, Database, GitBranch, Terminal } from 'lucide-react';

interface SystemStatusProps {
  services: {
    telegram: boolean;
    github: boolean;
    vercel: boolean;
    firebase: boolean;
  };
  stats?: {
    totalUsers: number;
    totalProjects: number;
    activeProjects: number;
    todayDeployments: number;
    bannedUsers: number;
  };
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ services, stats }) => {
  const serviceItems = [
    {
      name: 'Telegram Bot API & Webhook',
      icon: Terminal,
      active: services.telegram,
      endpoint: '/api/telegram/webhook',
      desc: 'Processes incoming messages & document uploads',
    },
    {
      name: 'GitHub REST Integration',
      icon: GitBranch,
      active: services.github,
      endpoint: 'api.github.com',
      desc: 'Automatic repository creation & commit trees',
    },
    {
      name: 'Vercel Deployment Engine',
      icon: Server,
      active: services.vercel,
      endpoint: 'api.vercel.com',
      desc: 'Project creation, build monitoring & live HTTPS domain',
    },
    {
      name: 'Firebase Admin Database',
      icon: Database,
      active: services.firebase,
      endpoint: 'Firestore / Durable State',
      desc: 'User quotas, project ownership & conversation state',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Service Health Matrix</h2>
          <p className="text-sm text-slate-500">Live operational status of backend services</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>All Systems Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {serviceItems.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3 shadow-xs"
              id={`service-status-${idx}`}
            >
              <div
                className={`p-2.5 rounded-lg ${
                  s.active
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {s.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      s.active
                        ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {s.active ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Ready
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Env Pending
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.desc}</p>
                <div className="text-[11px] font-mono text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded inline-block">
                  {s.endpoint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalUsers}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Users</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalProjects}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Projects</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.activeProjects}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Online</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.todayDeployments}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Today's Builds</div>
          </div>
        </div>
      )}
    </div>
  );
};
