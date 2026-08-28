import { CONFIG } from './config';

const VERCEL_API = 'https://api.vercel.com';
function headers() {
  if (!CONFIG.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN environment variable is missing.');
  return { Authorization: `Bearer ${CONFIG.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
}
function query() { return CONFIG.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(CONFIG.VERCEL_TEAM_ID)}` : ''; }

export interface VercelEnvRecord { id: string; key: string; type?: string; target?: string[]; value?: string; }

export async function listVercelEnv(projectName: string): Promise<VercelEnvRecord[]> {
  const res = await fetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectName)}/env${query()}`, { headers: headers() });
  if (!res.ok) throw new Error(`Could not list environment variables: ${res.statusText}`);
  const data = await res.json();
  return data.envs || [];
}

export async function addVercelEnv(projectName: string, key: string, value: string, target: string[] = ['production']): Promise<void> {
  const cleanKey = key.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanKey)) throw new Error('Invalid variable name. Use letters, numbers and underscores only.');
  if (!value) throw new Error('Variable value cannot be empty.');
  const res = await fetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectName)}/env${query()}`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ key: cleanKey, value, type: 'sensitive', target })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Could not add ${cleanKey}.`); }
}

export async function updateVercelEnv(projectName: string, envId: string, value: string): Promise<void> {
  if (!value) throw new Error('Variable value cannot be empty.');
  const res = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectName)}/env/${encodeURIComponent(envId)}${query()}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ value })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'Could not update environment variable.'); }
}

export async function deleteVercelEnv(projectName: string, envId: string): Promise<void> {
  const res = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectName)}/env/${encodeURIComponent(envId)}${query()}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'Could not delete environment variable.'); }
}
