// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — MY PROJECTS HANDLER
// =================================================================

import { getUserProjects, getProject } from '../../lib/firebase';
import { sendMessage, editMessageText, answerCallbackQuery } from '../../lib/telegram';
import { getProjectActionKeyboard } from '../keyboards';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';

/**
 * Handles "📂 My Projects" button
 */
export async function handleMyProjects(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const projects = await getUserProjects(from.id);

  if (projects.length === 0) {
    await sendMessage(
      message.chat.id,
      `📂 *MY PROJECTS*\n\nYou haven't deployed any projects yet.\n\nClick *🚀 Deploy Website* to launch your first project!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let text = `📂 *MY PROJECTS* (${projects.length})\n\n`;

  projects.forEach((p, idx) => {
    text += `*${idx + 1}. ${p.project_name}*\n`;
    text += `🟢 *Status:* ${p.status}\n`;
    text += `🔧 *Framework:* ${p.framework}\n`;
    text += `🌐 *URL:* ${p.vercel_url}\n\n`;
  });

  text += `_Select a project below to manage:_`;

  // Create inline buttons for each project
  const keyboard = projects.map((p) => [
    { text: `📦 ${p.project_name}`, callback_data: `proj:details:${p.project_id}` },
    { text: '🌐 Live', url: p.vercel_url },
  ]);

  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Handles project details inline callback
 */
export async function handleProjectDetailsCallback(
  callbackQuery: TelegramCallbackQuery,
  projectId: string
) {
  const from = callbackQuery.from;
  const chatId = callbackQuery.message?.chat.id || from.id;

  const project = await getProject(projectId);

  if (!project) {
    await answerCallbackQuery(callbackQuery.id, {
      text: 'Project not found.',
      show_alert: true,
    });
    return;
  }

  // Ownership verification
  if (project.user_id !== from.id) {
    await answerCallbackQuery(callbackQuery.id, {
      text: 'Access Denied: You do not own this project.',
      show_alert: true,
    });
    return;
  }

  const createdDate = new Date(project.created_at).toLocaleString();
  const updatedDate = new Date(project.updated_at).toLocaleString();

  const detailsText = `📦 *PROJECT DETAILS*

*Project:* \`${project.project_name}\`
*Framework:* ${project.framework}
*Status:* 🟢 ${project.status}

🐙 *GitHub:* \`${project.github_repository}\`
▲ *Vercel:* \`${project.vercel_project}\`
🌐 *Live URL:* ${project.vercel_url}
${project.custom_domain ? `🔗 *Custom Domain:* https://${project.custom_domain}\n` : ''}
📅 *Created:* ${createdDate}
🔄 *Last Updated:* ${updatedDate}`;

  await answerCallbackQuery(callbackQuery.id);

  if (callbackQuery.message) {
    await editMessageText(chatId, callbackQuery.message.message_id, detailsText, {
      parse_mode: 'Markdown',
      reply_markup: getProjectActionKeyboard(project.project_id, project.vercel_url),
    });
  } else {
    await sendMessage(chatId, detailsText, {
      parse_mode: 'Markdown',
      reply_markup: getProjectActionKeyboard(project.project_id, project.vercel_url),
    });
  }
}
