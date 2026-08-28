import { getProject, getUserState, setUserState, clearUserState, saveProject, logSystemAction } from '../../lib/firebase';
import { sendMessage, answerCallbackQuery } from '../../lib/telegram';
import { listGitHubRepositoryFiles, getGitHubFileContent, updateGitHubFileContent } from '../../lib/github';
import { redeployVercelProject, pollVercelDeployment } from '../../lib/vercel';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';
import { getProjectActionKeyboard } from '../keyboards';

function fileListKeyboard(projectId: string, files: { path: string }[]) {
  const rows = files.slice(0, 80).map((f, i) => [{ text: `📄 ${f.path.slice(0, 48)}`, callback_data: `code:file:${projectId}:${i}` }]);
  rows.push([{ text: '❌ Cancel', callback_data: 'action:cancel_code' }]);
  return { inline_keyboard: rows };
}

export async function handleCodeEditorCallback(cb: TelegramCallbackQuery, projectId: string) {
  const project = await getProject(projectId);
  if (!project || project.user_id !== cb.from.id) {
    await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return;
  }
  await answerCallbackQuery(cb.id);
  try {
    const files = await listGitHubRepositoryFiles(project.github_repository.split('/').pop() || project.project_name);
    if (!files.length) throw new Error('No source files found.');
    await sendMessage(cb.message?.chat.id || cb.from.id, `📁 *${project.project_name} — Files*\n\nSelect a file to edit:`, {
      parse_mode: 'Markdown', reply_markup: fileListKeyboard(projectId, files)
    });
  } catch (e: any) {
    await sendMessage(cb.message?.chat.id || cb.from.id, `❌ Could not load repository files.\n\n${e.message || 'Unknown error'}`);
  }
}

export async function handleCodeFileCallback(cb: TelegramCallbackQuery, projectId: string, encodedPath: string) {
  const project = await getProject(projectId);
  if (!project || project.user_id !== cb.from.id) { await answerCallbackQuery(cb.id, { text: 'Access denied.', show_alert: true }); return; }
  await answerCallbackQuery(cb.id);
  try {
    const repo = project.github_repository.split('/').pop() || project.project_name;
    const files = await listGitHubRepositoryFiles(repo);
    const index = Number(encodedPath);
    const path = Number.isInteger(index) && index >= 0 && index < files.length ? files[index].path : '';
    if (!path) throw new Error('Selected file is no longer available. Please open the file list again.');
    const result = await getGitHubFileContent(repo, path);
    if (result.content.length > 10000) {
      await sendMessage(cb.from.id, `📄 *${path}* is ${result.content.length} characters.\n\nIt is too large to display in Telegram. You can still replace it by sending the complete new content in one message (max 1 MB).`, { parse_mode: 'Markdown' });
    } else {
      const shown = result.content || '(empty file)';
      const preview = shown.length > 3600 ? shown.slice(0, 3600) + '\n…(truncated)' : shown;
      await sendMessage(cb.from.id, `📄 *${path}*\n\n\`\`\`text\n${preview}\n\`\`\``, { parse_mode: 'Markdown' });
    }
    await setUserState(cb.from.id, 'WAITING_CODE_CONTENT', { project_id: projectId, project_name: project.project_name, file_path: path, file_sha: result.sha });
    await sendMessage(cb.from.id, `✏️ Send the *complete new content* for \`${path}\`.\n\nThe next message will replace the actual GitHub file.`, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await sendMessage(cb.from.id, `❌ Could not read file.\n\n${e.message || 'Unknown error'}`);
  }
}

export async function handleCodeContentInput(message: TelegramMessage, content: string) {
  const from = message.from; if (!from) return;
  const state = await getUserState(from.id);
  const d = state.temp_data || {};
  if (state.state !== 'WAITING_CODE_CONTENT' || !d.project_id || !d.file_path || !d.file_sha) return;
  const project = await getProject(d.project_id);
  if (!project || project.user_id !== from.id) { await clearUserState(from.id); await sendMessage(message.chat.id, '❌ Access denied.'); return; }
  try {
    const repo = project.github_repository.split('/').pop() || project.project_name;
    await updateGitHubFileContent(repo, d.file_path, content, d.file_sha);
    await clearUserState(from.id);
    await sendMessage(message.chat.id, `✅ *GitHub file updated:* \`${d.file_path}\`\n\n🚀 Starting the existing Vercel redeploy...`, { parse_mode: 'Markdown' });
    const deployment = await redeployVercelProject(project.vercel_project, project.github_repository, 'main', project.deployment_id);
    const poll = await pollVercelDeployment(deployment.deploymentId, project.project_name);
    if (poll.status === 'ERROR' || poll.status === 'CANCELED') throw new Error(poll.error || 'Redeploy failed.');
    project.deployment_id = deployment.deploymentId;
    project.vercel_url = poll.liveUrl || deployment.url;
    project.status = 'ONLINE'; project.updated_at = Date.now();
    await saveProject(project);
    await logSystemAction(from.id, 'PROJECT_CODE_EDITED', 'SUCCESS', project.project_id, d.file_path);
    await sendMessage(message.chat.id, `🎉 *Updated & Redeployed*\n\n📄 \`${d.file_path}\`\n🟢 Vercel: Online\n🌐 ${project.vercel_url}`, { parse_mode: 'Markdown', reply_markup: getProjectActionKeyboard(project.project_id, project.vercel_url) });
  } catch (e: any) {
    await logSystemAction(from.id, 'PROJECT_CODE_EDITED', 'FAILED', project.project_id, e.message);
    await sendMessage(message.chat.id, `❌ File update/redeploy failed.\n\n${e.message || 'Unknown error'}`);
  }
}
