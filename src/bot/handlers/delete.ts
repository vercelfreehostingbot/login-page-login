// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — PROJECT DELETION HANDLER
// =================================================================

import { getUserProjects, getProject, deleteProjectRecord, logSystemAction } from '../../lib/firebase';
import { sendMessage, editMessageText, answerCallbackQuery } from '../../lib/telegram';
import { deleteVercelProject } from '../../lib/vercel';
import { deleteGitHubRepository } from '../../lib/github';
import { getDeleteConfirmKeyboard } from '../keyboards';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';

/**
 * Handles "🗑 Delete Project" from Main Menu
 */
export async function handleDeletePrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const projects = await getUserProjects(from.id);

  if (projects.length === 0) {
    await sendMessage(
      message.chat.id,
      `🗑 *DELETE PROJECT*\n\nYou have no active projects to delete.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const text = `🗑 *DELETE PROJECT*\n\nSelect the project you wish to permanently remove:`;

  const keyboard = projects.map((p) => [
    { text: `🗑 Delete ${p.project_name}`, callback_data: `proj:delete:${p.project_id}` },
  ]);
  keyboard.push([{ text: '❌ Cancel', callback_data: 'action:cancel_delete' }]);

  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Shows confirmation prompt before deletion
 */
export async function handleDeleteCallback(
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

  await answerCallbackQuery(callbackQuery.id);

  const confirmText = `⚠️ *DELETE PROJECT?*

*Project:* \`${project.project_name}\`

This action is irreversible. It will delete:
• The Vercel hosting deployment
• The GitHub source repository
• All project records

Are you sure you want to proceed?`;

  if (callbackQuery.message) {
    await editMessageText(chatId, callbackQuery.message.message_id, confirmText, {
      parse_mode: 'Markdown',
      reply_markup: getDeleteConfirmKeyboard(projectId),
    });
  } else {
    await sendMessage(chatId, confirmText, {
      parse_mode: 'Markdown',
      reply_markup: getDeleteConfirmKeyboard(projectId),
    });
  }
}

/**
 * Executes deletion on Vercel, GitHub, and Firebase
 */
export async function handleConfirmDelete(
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

  await answerCallbackQuery(callbackQuery.id, { text: '🗑 Deleting project...', show_alert: false });

  if (callbackQuery.message) {
    await editMessageText(
      chatId,
      callbackQuery.message.message_id,
      `⏳ *Deleting \`${project.project_name}\` from Vercel & GitHub...*`,
      { parse_mode: 'Markdown' }
    );
  }

  // 1. Delete Vercel Project
  await deleteVercelProject(project.vercel_project);

  // 2. Delete GitHub Repository
  await deleteGitHubRepository(project.project_name);

  // 3. Delete Firebase Record
  await deleteProjectRecord(projectId);

  await logSystemAction(from.id, 'PROJECT_DELETED', 'SUCCESS', projectId, project.project_name);

  const doneText = `✅ *Project Deleted Successfully*

\`${project.project_name}\` and all associated hosting resources have been permanently removed.`;

  if (callbackQuery.message) {
    await editMessageText(chatId, callbackQuery.message.message_id, doneText, {
      parse_mode: 'Markdown',
    });
  } else {
    await sendMessage(chatId, doneText, { parse_mode: 'Markdown' });
  }
}
