// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — TELEGRAM KEYBOARDS
// =================================================================

import { CONFIG } from '../lib/config';
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from '../types';

/**
 * Force Join Verification Keyboard
 */
export function getVerificationKeyboard(): InlineKeyboardMarkup {
  const channelUrl = CONFIG.CHANNEL_USERNAME
    ? `https://t.me/${CONFIG.CHANNEL_USERNAME}`
    : 'https://t.me';
  const groupUrl = CONFIG.GROUP_USERNAME
    ? `https://t.me/${CONFIG.GROUP_USERNAME}`
    : 'https://t.me';

  return {
    inline_keyboard: [
      [
        { text: '📢 Join Channel', url: channelUrl },
        { text: '👥 Join Group', url: groupUrl },
      ],
      [{ text: '✅ Verify', callback_data: 'action:verify_membership' }],
    ],
  };
}

/**
 * User Main Menu Reply Keyboard
 */
export function getMainMenuKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: '🚀 Deploy Website' }, { text: '📂 My Projects' }],
      [{ text: '🌐 Add Domain' }, { text: '🔄 Redeploy' }],
      [{ text: '🗑 Delete Project' }, { text: '📊 My Usage' }],
      [{ text: '👤 My Account' }, { text: 'ℹ️ Help' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Project Actions Inline Keyboard
 */
export function getProjectActionKeyboard(
  projectId: string,
  liveUrl: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🌐 Open Website', url: liveUrl }],
      [
        { text: '📊 Details', callback_data: `proj:details:${projectId}` },
        { text: '✏️ Edit Code', callback_data: `proj:code:${projectId}` },
        { text: '🔄 Redeploy', callback_data: `proj:redeploy:${projectId}` },
      ],
      [
        { text: '🌐 Add Domain', callback_data: `proj:domain:${projectId}` },
        { text: '⚙️ Environment Variables', callback_data: `proj:env:${projectId}` },
        { text: '🗑 Delete', callback_data: `proj:delete:${projectId}` },
      ],
    ],
  };
}

/**
 * Delete Confirmation Inline Keyboard
 */
export function getDeleteConfirmKeyboard(projectId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes, Delete', callback_data: `proj:confirm_delete:${projectId}` },
        { text: '❌ Cancel', callback_data: 'proj:cancel_delete' },
      ],
    ],
  };
}

/**
 * Admin Panel Reply Keyboard
 */
export function getAdminPanelKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: '📊 Statistics' }, { text: '👥 Users' }],
      [{ text: '🌍 All Projects' }, { text: '🔎 Search User' }],
      [{ text: '🚫 Ban User' }, { text: '✅ Unban User' }],
      [{ text: '🔄 Reset Limit' }, { text: '🗑 Delete Project' }],
      [{ text: '📢 Broadcast' }, { text: '📜 System Logs' }],
      [{ text: '➕ Add Admin' }, { text: '❌ Remove Admin' }],
      [{ text: '⚙️ Settings' }, { text: '⬅️ Back' }],
    ],
    resize_keyboard: true,
  };
}

/**
 * Cancel Inline Keyboard
 */
export function getCancelKeyboard(callbackData = 'action:cancel'): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: '❌ Cancel', callback_data: callbackData }]],
  };
}
