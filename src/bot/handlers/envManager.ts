import { getProject, getUserState, setUserState, clearUserState, saveProject, logSystemAction } from '../../lib/firebase';
import { sendMessage, answerCallbackQuery } from '../../lib/telegram';
import { listVercelEnv, addVercelEnv, updateVercelEnv, deleteVercelEnv } from '../../lib/vercelEnv';
import { redeployVercelProject, pollVercelDeployment } from '../../lib/vercel';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';
import { getProjectActionKeyboard } from '../keyboards';
import { handleProjectNameInput } from './deploy';

function envKeyboard(projectId: string, envs: any[]) {
  const rows = envs.map(e => [{ text: `🔐 ${e.key}`, callback_data: `env:edit:${projectId}:${e.id}` }, { text: '🗑', callback_data: `env:delete:${projectId}:${e.id}` }]);
  rows.push([{ text: '➕ Add Variable', callback_data: `env:add:${projectId}` }]);
  rows.push([{ text: '🔄 Refresh', callback_data: `env:manage:${projectId}` }, { text: '❌ Cancel', callback_data: 'action:cancel_env' }]);
  return { inline_keyboard: rows };
}

async function redeployAfterEnv(message: TelegramMessage, project: any) {
  const deployment = await redeployVercelProject(project.vercel_project, project.github_repository, 'main', project.deployment_id);
  const poll = await pollVercelDeployment(deployment.deploymentId, project.project_name);
  if (poll.status === 'ERROR' || poll.status === 'CANCELED') throw new Error(poll.error || 'Redeploy failed.');
  project.deployment_id = deployment.deploymentId; project.vercel_url = poll.liveUrl || deployment.url; project.status = 'ONLINE'; project.updated_at = Date.now();
  await saveProject(project);
}

export async function handleEnvManagerCallback(cb: TelegramCallbackQuery, projectId: string) {
  const p = await getProject(projectId);
  if (!p || p.user_id !== cb.from.id) { await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return; }
  await answerCallbackQuery(cb.id);
  try {
    const envs = await listVercelEnv(p.vercel_project);
    const text = `⚙️ *Environment Variables — ${p.project_name}*\n\nValues are masked and never shown in plain text.\n\n${envs.length ? envs.map((e: any) => `🔐 *${e.key}* = ••••••••••\n   ${Array.isArray(e.target) ? e.target.join(', ') : 'Vercel environment'}`).join('\n\n') : 'No variables configured.'}`;
    await sendMessage(cb.from.id, text, { parse_mode: 'Markdown', reply_markup: envKeyboard(projectId, envs) });
  } catch (e: any) { await sendMessage(cb.from.id, `❌ ${e.message || 'Could not load environment variables.'}`); }
}

export async function handleEnvAddCallback(cb: TelegramCallbackQuery, projectId: string) {
  const p = await getProject(projectId);
  if (!p || p.user_id !== cb.from.id) { await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return; }
  await answerCallbackQuery(cb.id);
  await setUserState(cb.from.id, 'WAITING_ENV_NAME', { project_id: projectId, env_action: 'add' });
  await sendMessage(cb.from.id, '➕ *Add Environment Variable*\n\nSend the variable name, for example:\n`DATABASE_URL`', { parse_mode: 'Markdown' });
}

export async function handleEnvEditCallback(cb: TelegramCallbackQuery, projectId: string, envId: string) {
  const p = await getProject(projectId);
  if (!p || p.user_id !== cb.from.id) { await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return; }
  await answerCallbackQuery(cb.id);
  await setUserState(cb.from.id, 'WAITING_ENV_EDIT_VALUE', { project_id: projectId, env_id: envId });
  await sendMessage(cb.from.id, '✏️ Send the *new value*.\n\nThe value will be written directly to Vercel and will remain masked.', { parse_mode: 'Markdown' });
}

export async function handleEnvDeleteCallback(cb: TelegramCallbackQuery, projectId: string, envId: string) {
  const p = await getProject(projectId);
  if (!p || p.user_id !== cb.from.id) { await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return; }
  try { await deleteVercelEnv(p.vercel_project, envId); await answerCallbackQuery(cb.id, { text: 'Deleted.' }); await sendMessage(cb.from.id, '🗑 Environment variable deleted from Vercel.\n\n🔄 Redeploying...'); await redeployAfterEnv({ ...cb.message, chat: cb.message?.chat || { id: cb.from.id, type: 'private' } } as any, p); await sendMessage(cb.from.id, '✅ Deleted and redeployed successfully.', { reply_markup: getProjectActionKeyboard(p.project_id, p.vercel_url) }); await logSystemAction(cb.from.id, 'ENV_DELETED', 'SUCCESS', p.project_id, envId); }
  catch (e: any) { await answerCallbackQuery(cb.id, { text: 'Delete failed.', show_alert: true }); await sendMessage(cb.from.id, `❌ ${e.message || 'Delete failed.'}`); }
}

export async function handleEnvInitialMore(cb: TelegramCallbackQuery) {
  const st = await getUserState(cb.from.id);
  if (st.state !== 'WAITING_ENV_NAME' || !st.temp_data?.initial_deploy) return;
  await answerCallbackQuery(cb.id);
  await sendMessage(cb.from.id, '➕ Send another variable name, for example `DATABASE_URL`.', { parse_mode: 'Markdown' });
}

export async function handleEnvInitialDone(cb: TelegramCallbackQuery) {
  const st = await getUserState(cb.from.id); const d = st.temp_data || {};
  if (!d.initial_deploy || !d.project_name) return;
  await answerCallbackQuery(cb.id, { text: 'Starting deployment...' });
  await setUserState(cb.from.id, 'WAITING_PROJECT_NAME', { ...d, initial_deploy: true, deploy_ready: true, envs: Array.isArray(d.envs) ? d.envs : [] });
  await handleProjectNameInput({ message_id: 0, from: cb.from, chat: { id: cb.from.id, type: 'private' }, date: Math.floor(Date.now()/1000) } as any, d.project_name);
}

export async function handleEnvNameInput(message: TelegramMessage, name: string) {
  const from = message.from; if (!from) return; const st = await getUserState(from.id); const d = st.temp_data || {};
  if (st.state !== 'WAITING_ENV_NAME') return;
  if (d.initial_deploy) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name.trim())) { await sendMessage(message.chat.id, '❌ Invalid variable name. Try again, e.g. `DATABASE_URL`.', { parse_mode: 'Markdown' }); return; }
    await setUserState(from.id, 'WAITING_ENV_VALUE', { ...d, env_name: name.trim() });
    await sendMessage(message.chat.id, `🔑 Name: \`${name.trim()}\`\n\nSend the variable value now.`, { parse_mode: 'Markdown' });
    return;
  }
  if (!d.project_id) return;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name.trim())) { await sendMessage(message.chat.id, '❌ Invalid variable name. Try again, e.g. `DATABASE_URL`.', { parse_mode: 'Markdown' }); return; }
  await setUserState(from.id, 'WAITING_ENV_VALUE', { project_id: d.project_id, env_name: name.trim() });
  await sendMessage(message.chat.id, `🔑 Name: \`${name.trim()}\`\n\nSend the variable value now.`, { parse_mode: 'Markdown' });
}

export async function handleEnvValueInput(message: TelegramMessage, value: string) {
  const from = message.from; if (!from) return; const st = await getUserState(from.id); const d = st.temp_data || {};
  if (st.state !== 'WAITING_ENV_VALUE' || !d.env_name) return;
  if (d.initial_deploy) {
    const envs = Array.isArray(d.envs) ? d.envs : [];
    envs.push({ key: d.env_name, value });
    await setUserState(from.id, 'WAITING_ENV_NAME', { ...d, envs, env_name: undefined });
    await sendMessage(message.chat.id, `✅ \`${d.env_name}\` saved for this deployment.\n\nAdd another variable or press *Done*.`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '➕ Add Another', callback_data: 'env:initial_more' }, { text: '🚀 Done & Deploy', callback_data: 'env:initial_done' }], [{ text: '❌ Cancel', callback_data: 'action:cancel_env' }]] } });
    return;
  }
  const p = await getProject(d.project_id); if (!p || p.user_id !== from.id) { await clearUserState(from.id); await sendMessage(message.chat.id, '❌ Access denied.'); return; }
  try { await addVercelEnv(p.vercel_project, d.env_name, value, ['production']); await clearUserState(from.id); await sendMessage(message.chat.id, `✅ \`${d.env_name}\` added to Vercel Production.\n\n🔄 Redeploying...`, { parse_mode: 'Markdown' }); await redeployAfterEnv(message, p); await sendMessage(message.chat.id, '🎉 Environment variable added and project redeployed.', { reply_markup: getProjectActionKeyboard(p.project_id, p.vercel_url) }); await logSystemAction(from.id, 'ENV_ADDED', 'SUCCESS', p.project_id, d.env_name); }
  catch (e: any) { await sendMessage(message.chat.id, `❌ ${e.message || 'Could not add variable.'}`); }
}

export async function handleEnvEditValueInput(message: TelegramMessage, value: string) {
  const from = message.from; if (!from) return; const st = await getUserState(from.id); const d = st.temp_data || {};
  if (st.state !== 'WAITING_ENV_EDIT_VALUE' || !d.project_id || !d.env_id) return;
  const p = await getProject(d.project_id); if (!p || p.user_id !== from.id) { await clearUserState(from.id); await sendMessage(message.chat.id, '❌ Access denied.'); return; }
  try { await updateVercelEnv(p.vercel_project, d.env_id, value); await clearUserState(from.id); await sendMessage(message.chat.id, '✅ Environment variable updated on Vercel.\n\n🔄 Redeploying...'); await redeployAfterEnv(message, p); await sendMessage(message.chat.id, '🎉 Updated and redeployed successfully.', { reply_markup: getProjectActionKeyboard(p.project_id, p.vercel_url) }); await logSystemAction(from.id, 'ENV_UPDATED', 'SUCCESS', p.project_id, d.env_id); }
  catch (e: any) { await sendMessage(message.chat.id, `❌ ${e.message || 'Could not update variable.'}`); }
}
