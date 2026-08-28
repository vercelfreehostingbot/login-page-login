// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — MAIN BOT UPDATE ROUTER
// =================================================================

import { TelegramUpdate } from '../types';
import { getUserState, getUser, clearUserState } from '../lib/firebase';
import { sendMessage, answerCallbackQuery } from '../lib/telegram';
import { handleStartCommand, handleVerifyCallback } from './handlers/start';
import { handleDeployPrompt, handleZipUpload, handleProjectNameInput } from './handlers/deploy';
import { handleMyProjects, handleProjectDetailsCallback } from './handlers/projects';
import { handleRedeployPrompt, handleRedeployCallback } from './handlers/redeploy';
import {
  handleAddDomainPrompt,
  handleDomainCallback,
  handleDomainInput,
} from './handlers/domain';
import {
  handleDeletePrompt,
  handleDeleteCallback,
  handleConfirmDelete,
} from './handlers/delete';
import { handleMyUsage, handleMyAccount, handleHelp } from './handlers/usage';
import {
  handleAdminCommand,
  handleAdminStats,
  handleAdminUsers,
  handleAdminAllProjects,
  handleAdminSearchPrompt,
  handleAdminBanPrompt,
  handleAdminUnbanPrompt,
  handleAdminResetLimitPrompt,
  handleAdminBroadcastPrompt,
  handleAdminLogs,
  handleAdminAddPrompt,
  handleAdminRemovePrompt,
  handleAdminSettings,
  handleAdminStateInput,
} from './handlers/admin';
import { getMainMenuKeyboard } from './keyboards';
import { handleCodeEditorCallback, handleCodeFileCallback, handleCodeContentInput } from './handlers/codeEditor';
import { handleEnvInitialMore, handleEnvInitialDone } from './handlers/envManager';
import { handleEnvManagerCallback, handleEnvAddCallback, handleEnvEditCallback, handleEnvDeleteCallback, handleEnvNameInput, handleEnvValueInput, handleEnvEditValueInput } from './handlers/envManager';

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  try {
    // -------------------------------------------------------------
    // 0. IGNORE NON-MESSAGE / CHANNEL BROADCAST UPDATES
    // -------------------------------------------------------------
    // Ignore channel posts, edited messages, member updates, etc.
    if (
      (update as any).channel_post ||
      (update as any).edited_channel_post ||
      (update as any).edited_message ||
      (update as any).my_chat_member ||
      (update as any).chat_member ||
      (update as any).chat_join_request
    ) {
      return;
    }

    // -------------------------------------------------------------
    // 1. HANDLE INLINE CALLBACK QUERIES
    // -------------------------------------------------------------
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';

      // If callback originates from a group/channel, do not execute or modify chat
      if (cb.message?.chat?.type && cb.message.chat.type !== 'private') {
        await answerCallbackQuery(cb.id, {
          text: 'This bot only operates in private direct chats.',
          show_alert: true,
        });
        return;
      }

      if (data === 'action:verify_membership') {
        await handleVerifyCallback(cb);
        return;
      }

      if (data.startsWith('proj:details:')) {
        const projectId = data.replace('proj:details:', '');
        await handleProjectDetailsCallback(cb, projectId);
        return;
      }

      if (data.startsWith('proj:code:')) {
        await handleCodeEditorCallback(cb, data.replace('proj:code:', ''));
        return;
      }

      if (data.startsWith('code:file:')) {
        const parts = data.split(':');
        await handleCodeFileCallback(cb, parts[2], parts.slice(3).join(':'));
        return;
      }

      if (data.startsWith('proj:env:')) {
        await handleEnvManagerCallback(cb, data.replace('proj:env:', ''));
        return;
      }
      if (data.startsWith('env:add:')) { await handleEnvAddCallback(cb, data.replace('env:add:', '')); return; }
      if (data.startsWith('env:edit:')) { const parts=data.split(':'); await handleEnvEditCallback(cb, parts[2], parts[3]); return; }
      if (data.startsWith('env:delete:')) { const parts=data.split(':'); await handleEnvDeleteCallback(cb, parts[2], parts[3]); return; }
      if (data.startsWith('env:manage:')) { await handleEnvManagerCallback(cb, data.replace('env:manage:', '')); return; }
      if (data === 'env:initial_more') { await handleEnvInitialMore(cb); return; }
      if (data === 'env:initial_done') { await handleEnvInitialDone(cb); return; }

      if (data.startsWith('proj:redeploy:')) {
        const projectId = data.replace('proj:redeploy:', '');
        await handleRedeployCallback(cb, projectId);
        return;
      }

      if (data.startsWith('proj:domain:')) {
        const projectId = data.replace('proj:domain:', '');
        await handleDomainCallback(cb, projectId);
        return;
      }

      if (data.startsWith('proj:delete:')) {
        const projectId = data.replace('proj:delete:', '');
        await handleDeleteCallback(cb, projectId);
        return;
      }

      if (data.startsWith('proj:confirm_delete:')) {
        const projectId = data.replace('proj:confirm_delete:', '');
        await handleConfirmDelete(cb, projectId);
        return;
      }

      if (data === 'proj:cancel_delete' || data.startsWith('action:cancel')) {
        await clearUserState(cb.from.id);
        await answerCallbackQuery(cb.id, { text: 'Action cancelled.' });
        if (cb.message) {
          await sendMessage(cb.message.chat.id, 'Action cancelled.', {
            reply_markup: getMainMenuKeyboard(),
          });
        }
        return;
      }

      await answerCallbackQuery(cb.id);
      return;
    }

    // -------------------------------------------------------------
    // 2. HANDLE TELEGRAM MESSAGES
    // -------------------------------------------------------------
    if (update.message) {
      const msg = update.message;
      const from = msg.from;
      if (!from) return;

      // STRICT PRIVATE-CHAT ONLY RULE:
      // If the message comes from a group, supergroup, or channel, IGNORE COMPLETELY.
      // Do not reply, do not send keyboard, do not interact.
      if (msg.chat?.type && msg.chat.type !== 'private') {
        return;
      }

      const text = (msg.text || '').trim();

      // Check if user is banned
      const user = await getUser(from.id);
      if (user?.banned && !text.startsWith('/start')) {
        await sendMessage(
          msg.chat.id,
          `🚫 *ACCOUNT SUSPENDED*\n\nYour account has been suspended by the administrator.`
        );
        return;
      }

      // Command: /start
      if (text.startsWith('/start')) {
        await clearUserState(from.id);
        await handleStartCommand(msg);
        return;
      }

      // Command: /admin or Admin Panel
      if (text === '/admin' || text === '👑 Admin Panel') {
        await clearUserState(from.id);
        await handleAdminCommand(msg);
        return;
      }

      // Universal text-based cancellation
      if (
        text === '❌ Cancel' ||
        text.toLowerCase() === 'cancel' ||
        text === '/cancel' ||
        text === '⬅️ Back'
      ) {
        await clearUserState(from.id);
        await sendMessage(msg.chat.id, 'Action cancelled.', {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      // List of top-level navigation buttons
      const isNavMenuAction = [
        '🚀 Deploy Website',
        '📂 My Projects',
        '🌐 Add Domain',
        '🔄 Redeploy',
        '🗑 Delete Project',
        '📊 My Usage',
        '👤 My Account',
        'ℹ️ Help',
        '📊 Statistics',
        '👥 Users',
        '🌍 All Projects',
        '🔎 Search User',
        '🚫 Ban User',
        '✅ Unban User',
        '🔄 Reset Limit',
        '📢 Broadcast',
        '📜 System Logs',
        '➕ Add Admin',
        '❌ Remove Admin',
        '⚙️ Settings',
      ].includes(text);

      // Check durable user workflow state
      const stateRecord = await getUserState(from.id);
      const state = stateRecord.state;

      if (isNavMenuAction) {
        // Clear any previous waiting state so menu commands always work immediately
        await clearUserState(from.id);
      } else {
        // Only if NOT a navigation button, check durable user workflow state for inputs
        if (state === 'WAITING_PROJECT_NAME' && text) {
          await handleProjectNameInput(msg, text);
          return;
        }

        if (state === 'WAITING_DOMAIN' && text) {
          await handleDomainInput(msg, text);
          return;
        }
        if (state === 'WAITING_CODE_CONTENT' && text) { await handleCodeContentInput(msg, text); return; }
        if (state === 'WAITING_ENV_NAME' && text) { await handleEnvNameInput(msg, text); return; }
        if (state === 'WAITING_ENV_VALUE' && text) { await handleEnvValueInput(msg, text); return; }
        if (state === 'WAITING_ENV_EDIT_VALUE' && text) { await handleEnvEditValueInput(msg, text); return; }

        if (state.startsWith('WAITING_ADMIN_') || state === 'WAITING_BROADCAST_MESSAGE') {
          if (text) {
            await handleAdminStateInput(msg, state, text);
            return;
          }
        }
      }

      // Handle File/Document Upload
      if (msg.document) {
        await handleZipUpload(msg);
        return;
      }

      // Handle Main Menu Reply Keyboard Buttons
      switch (text) {
        case '🚀 Deploy Website':
          await handleDeployPrompt(msg);
          break;

        case '📂 My Projects':
          await handleMyProjects(msg);
          break;

        case '🌐 Add Domain':
          await handleAddDomainPrompt(msg);
          break;

        case '🔄 Redeploy':
          await handleRedeployPrompt(msg);
          break;

        case '🗑 Delete Project':
          await handleDeletePrompt(msg);
          break;

        case '📊 My Usage':
          await handleMyUsage(msg);
          break;

        case '👤 My Account':
          await handleMyAccount(msg);
          break;

        case 'ℹ️ Help':
          await handleHelp(msg);
          break;

        // Admin Menu Buttons
        case '📊 Statistics':
          await handleAdminStats(msg);
          break;

        case '👥 Users':
          await handleAdminUsers(msg);
          break;

        case '🌍 All Projects':
          await handleAdminAllProjects(msg);
          break;

        case '🔎 Search User':
          await handleAdminSearchPrompt(msg);
          break;

        case '🚫 Ban User':
          await handleAdminBanPrompt(msg);
          break;

        case '✅ Unban User':
          await handleAdminUnbanPrompt(msg);
          break;

        case '🔄 Reset Limit':
          await handleAdminResetLimitPrompt(msg);
          break;

        case '📢 Broadcast':
          await handleAdminBroadcastPrompt(msg);
          break;

        case '📜 System Logs':
          await handleAdminLogs(msg);
          break;

        case '➕ Add Admin':
          await handleAdminAddPrompt(msg);
          break;

        case '❌ Remove Admin':
          await handleAdminRemovePrompt(msg);
          break;

        case '⚙️ Settings':
          await handleAdminSettings(msg);
          break;

        case '⬅️ Back':
          await sendMessage(msg.chat.id, 'Returned to Main Menu:', {
            reply_markup: getMainMenuKeyboard(),
          });
          break;

        default:
          // If in WAITING_ZIP state and user sends text instead of zip
          if (state === 'WAITING_ZIP') {
            await sendMessage(
              msg.chat.id,
              `📦 Please upload your project as a *.zip* file attachment.`,
              { reply_markup: getMainMenuKeyboard() }
            );
          }
          break;
      }
    }
  } catch (error: any) {
    console.error('Telegram Update processing error:', error);
    if (update.message && update.message.chat?.type === 'private') {
      await sendMessage(
        update.message.chat.id,
        `❌ *Something went wrong.* Please try again later.`,
        { reply_markup: getMainMenuKeyboard() }
      );
    }
  }
}
