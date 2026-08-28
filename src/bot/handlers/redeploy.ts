// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — REDEPLOY HANDLER
// =================================================================

import { getUserProjects, getProject, saveProject, logSystemAction } from '../../lib/firebase';
import { sendMessage, editMessageText, answerCallbackQuery } from '../../lib/telegram';
import { redeployVercelProject, pollVercelDeployment } from '../../lib/vercel';
import { getProjectActionKeyboard } from '../keyboards';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';

/**
 * Handles "🔄 Redeploy" from Main Menu
 */
export async function handleRedeployPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const projects = await getUserProjects(from.id);

  if (projects.length === 0) {
    await sendMessage(
      message.chat.id,
      `🔄 *REDEPLOY*\n\nYou have no active projects to redeploy.\n\nUpload a project first using *🚀 Deploy Website*.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const text = `🔄 *SELECT A PROJECT TO REDEPLOY*\n\nChoose the project you would like to trigger a fresh Vercel build for:`;

  const keyboard = projects.map((p) => [
    { text: `🔄 Redeploy ${p.project_name}`, callback_data: `proj:redeploy:${p.project_id}` },
  ]);
  keyboard.push([{ text: '❌ Cancel', callback_data: 'action:cancel_redeploy' }]);

  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Handles redeploy action callback
 */
export async function handleRedeployCallback(
  callbackQuery: TelegramCallbackQuery,
  projectId: string
) {
  const from = callbackQuery.from;
  const chatId = callbackQuery.message?.chat.id || from.id;

  const project = await getProject(projectId);

  if (!project) {
    await answerCallbackQuery(callbackQuery.id, { text: 'Project not found.', show_alert: true });
    return;
  }

  if (project.user_id !== from.id) {
    await answerCallbackQuery(callbackQuery.id, {
      text: 'Access Denied: You do not own this project.',
      show_alert: true,
    });
    return;
  }

  await answerCallbackQuery(callbackQuery.id, {
    text: '🔄 Triggering redeployment...',
    show_alert: false,
  });

  const progressMsg = await sendMessage(
    chatId,
    `🔄 *Redeploying \`${project.project_name}\`...*\n\n▲ Vercel: Initializing fresh build...`,
    { parse_mode: 'Markdown' }
  );

  const progressMsgId = progressMsg.result?.message_id;

  try {
    const deployment = await redeployVercelProject(
      project.vercel_project,
      project.project_name,
      'main',
      project.deployment_id
    );

    const pollResult = await pollVercelDeployment(
      deployment.deploymentId,
      project.project_name,
      async (state) => {
        if (progressMsgId) {
          await editMessageText(
            chatId,
            progressMsgId,
            `🔄 *Redeploying \`${project.project_name}\`...*\n\n▲ Vercel: ${state}...`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    );

    if (pollResult.status === 'ERROR' || pollResult.status === 'CANCELED') {
      throw new Error(pollResult.error || 'Redeployment failed on Vercel.');
    }

    const liveUrl = project.custom_domain
      ? `https://${project.custom_domain}`
      : pollResult.liveUrl || `https://${project.project_name}.vercel.app`;

    // Update project record
    project.updated_at = Date.now();
    project.deployment_id = deployment.deploymentId;
    project.vercel_url = liveUrl;
    project.status = 'ONLINE';
    await saveProject(project);

    await logSystemAction(from.id, 'PROJECT_REDEPLOYED', 'SUCCESS', projectId);

    const successText = `✅ *Redeployment Successful!*

📦 *Project:* \`${project.project_name}\`
🟢 *Status:* Online
🌐 *Live Website:*
${liveUrl}`;

    if (progressMsgId) {
      await editMessageText(chatId, progressMsgId, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(project.project_id, liveUrl),
      });
    } else {
      await sendMessage(chatId, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(project.project_id, liveUrl),
      });
    }
  } catch (error: any) {
    console.error('Redeploy failed:', error);
    await logSystemAction(from.id, 'PROJECT_REDEPLOYED', 'FAILED', projectId, error?.message);

    const errText = `❌ *Redeployment Failed*\n\n${error?.message || 'Could not redeploy project.'}`;
    if (progressMsgId) {
      await editMessageText(chatId, progressMsgId, errText, { parse_mode: 'Markdown' });
    } else {
      await sendMessage(chatId, errText, { parse_mode: 'Markdown' });
    }
  }
}
