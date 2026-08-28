import React, { useState } from 'react';
import { Terminal, RefreshCw, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';

interface WebhookHelperProps {
  webhookInfo?: any;
  onRefresh?: () => void;
}

export const WebhookHelper: React.FC<WebhookHelperProps> = ({ webhookInfo, onRefresh }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusResult(null);

    try {
      const autoUrl = webhookUrl || `${window.location.origin}/api/telegram/webhook`;
      const res = await fetch('/api/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: autoUrl }),
      });
      const data = await res.json();
      setStatusResult(data);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const defaultUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '/api/telegram/webhook';

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Telegram Webhook Configuration
          </h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Telegram forwards all events to your server via the Webhook endpoint below. Once configured with your <code className="font-mono text-blue-600 dark:text-blue-400">BOT_TOKEN</code> in environment variables, verify or sync the webhook with one click.
      </p>

      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all flex items-center justify-between gap-2">
        <span className="truncate">{defaultUrl}</span>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          HTTPS
        </span>
      </div>

      <form onSubmit={handleRegisterWebhook} className="flex flex-col sm:flex-row gap-2 pt-2">
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={defaultUrl}
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
          id="btn-register-webhook"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
          <span>{loading ? 'Registering...' : 'Sync Webhook'}</span>
        </button>
      </form>

      {statusResult && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            statusResult.ok
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {statusResult.ok ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold">
              {statusResult.ok ? 'Webhook Registered Successfully' : 'Registration Alert'}
            </div>
            <div className="mt-0.5 text-xs opacity-90">
              {statusResult.description || statusResult.error || JSON.stringify(statusResult)}
            </div>
          </div>
        </div>
      )}

      {webhookInfo?.url && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Active URL: <code className="text-slate-600 dark:text-slate-300">{webhookInfo.url}</code></span>
          {webhookInfo.pending_update_count !== undefined && (
            <span>Pending: <code className="text-slate-600 dark:text-slate-300">{webhookInfo.pending_update_count}</code></span>
          )}
        </div>
      )}
    </div>
  );
};
