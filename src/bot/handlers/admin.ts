// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — ADMIN PANEL HANDLER
// =================================================================

import { CONFIG, getTodayDateString } from '../../lib/config';
import {
  isAdmin,
  isSuperAdmin,
  getSystemStats,
  getAllUsers,
  getAllProjects,
  getUser,
  setUserBanStatus,
  resetUserDailyLimit,
  getUserProjects,
  deleteProjectRecord,
  addAdmin,
  removeAdmin,
  getAllAdmins,
  getRecentLogs,
  getUserState,
  setUserState,
  clearUserState,
  logSystemAction,
} from '../../lib/firebase';
import { sendMessage, editMessageText } from '../../lib/telegram';
import { deleteVercelProject } from '../../lib/vercel';
import { deleteGitHubRepository } from '../../lib/github';
import { getAdminPanelKeyboard, getMainMenuKeyboard, getCancelKeyboard } from '../keyboards';
import { TelegramMessage } from '../../types';

/**
 * Handles /admin command or Admin Menu button
 */
export async function handleAdminCommand(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const adminAuth = await isAdmin(from.id);
  if (!adminAuth) {
    await sendMessage(
      message.chat.id,
      `🚫 *ACCESS DENIED*\n\nYou do not have administrative privileges.`
    );
    return;
  }

  const superAdminFlag = await isSuperAdmin(from.id);

  const text = `👑 *ADMIN CONTROL PANEL*

Welcome ${from.first_name || 'Admin'}!
*Role:* ${superAdminFlag ? '🌟 Super Admin' : '🛡 Admin'}

Select an administrative task from the menu below:`;

  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminPanelKeyboard(),
  });
}

/**
 * Handles Admin 📊 Statistics
 */
export async function handleAdminStats(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const stats = await getSystemStats();

  const text = `📊 *SYSTEM STATISTICS*

👥 *Total Users:* ${stats.totalUsers}
🌐 *Total Projects:* ${stats.totalProjects}
🟢 *Active Projects:* ${stats.activeProjects}
🚀 *Today's Deployments:* ${stats.todayDeployments}
🚫 *Banned Users:* ${stats.bannedUsers}
💾 *Database:* ${stats.firebaseConnected ? '🟢 Firebase Firestore Connected' : '🟡 In-Memory Storage'}`;

  await sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
}

/**
 * Handles Admin 👥 Users list
 */
export async function handleAdminUsers(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const users = await getAllUsers();

  if (users.length === 0) {
    await sendMessage(message.chat.id, `👥 No users registered yet.`);
    return;
  }

  let text = `👥 *REGISTERED USERS* (${users.length})\n\n`;
  users.slice(0, 15).forEach((u, i) => {
    const status = u.banned ? '🚫' : '🟢';
    const tag = u.username ? `@${u.username}` : u.first_name;
    text += `${i + 1}. ${status} \`${u.telegram_id}\` — ${tag} (${u.daily_usage || 0}/5 today)\n`;
  });

  if (users.length > 15) {
    text += `\n_...and ${users.length - 15} more users._`;
  }

  await sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
}

/**
 * Handles Admin 🌍 All Projects
 */
export async function handleAdminAllProjects(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const projects = await getAllProjects();

  if (projects.length === 0) {
    await sendMessage(message.chat.id, `🌍 No projects deployed yet.`);
    return;
  }

  let text = `🌍 *ALL DEPLOYED PROJECTS* (${projects.length})\n\n`;
  projects.slice(0, 10).forEach((p, i) => {
    text += `${i + 1}. *${p.project_name}* (Owner: \`${p.user_id}\`)\n`;
    text += `   🔧 ${p.framework} | 🟢 ${p.status}\n`;
    text += `   🌐 ${p.vercel_url}\n\n`;
  });

  if (projects.length > 10) {
    text += `_...and ${projects.length - 10} more projects._`;
  }

  await sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
}

/**
 * Handles Admin 🔎 Search User prompt
 */
export async function handleAdminSearchPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  await setUserState(from.id, 'WAITING_ADMIN_SEARCH_USER');
  await sendMessage(
    message.chat.id,
    `🔎 *SEARCH USER*\n\nPlease enter the *Telegram User ID* to look up:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin 🚫 Ban User prompt
 */
export async function handleAdminBanPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  await setUserState(from.id, 'WAITING_ADMIN_BAN_USER');
  await sendMessage(
    message.chat.id,
    `🚫 *BAN USER*\n\nPlease enter the *Telegram User ID* of the user to suspend:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin ✅ Unban User prompt
 */
export async function handleAdminUnbanPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  await setUserState(from.id, 'WAITING_ADMIN_UNBAN_USER');
  await sendMessage(
    message.chat.id,
    `✅ *UNBAN USER*\n\nPlease enter the *Telegram User ID* of the user to unban:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin 🔄 Reset Limit prompt
 */
export async function handleAdminResetLimitPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  await setUserState(from.id, 'WAITING_ADMIN_RESET_LIMIT');
  await sendMessage(
    message.chat.id,
    `🔄 *RESET DAILY USAGE*\n\nPlease enter the *Telegram User ID* to reset their daily build quota to 0:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin 📢 Broadcast prompt
 */
export async function handleAdminBroadcastPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  await setUserState(from.id, 'WAITING_BROADCAST_MESSAGE');
  await sendMessage(
    message.chat.id,
    `📢 *SYSTEM BROADCAST*\n\nPlease send the text message you wish to broadcast to all registered users:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin 📜 System Logs
 */
export async function handleAdminLogs(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const logs = await getRecentLogs(10);

  if (logs.length === 0) {
    await sendMessage(message.chat.id, `📜 No recent logs.`);
    return;
  }

  let text = `📜 *RECENT SYSTEM LOGS*\n\n`;
  logs.forEach((log) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const statusIcon = log.status === 'SUCCESS' ? '✅' : log.status === 'FAILED' ? '❌' : 'ℹ️';
    text += `${statusIcon} *${log.action}* — \`${log.user_id}\` (${time})\n`;
    if (log.details) text += `   _${log.details}_\n`;
  });

  await sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
}

/**
 * Handles Admin ➕ Add Admin prompt
 */
export async function handleAdminAddPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const superAdmin = await isSuperAdmin(from.id);
  if (!superAdmin) {
    await sendMessage(
      message.chat.id,
      `🚫 Only the Super Admin (\`${CONFIG.SUPER_ADMIN_ID}\`) can add new administrators.`
    );
    return;
  }

  await setUserState(from.id, 'WAITING_ADMIN_ADD');
  await sendMessage(
    message.chat.id,
    `➕ *ADD NEW ADMIN*\n\nPlease enter the *Telegram User ID* to grant admin privileges:`,
    { reply_markup: getCancelKeyboard('action:cancel_admin') }
  );
}

/**
 * Handles Admin ❌ Remove Admin prompt
 */
export async function handleAdminRemovePrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const superAdmin = await isSuperAdmin(from.id);
  if (!superAdmin) {
    await sendMessage(
      message.chat.id,
      `🚫 Only the Super Admin (\`${CONFIG.SUPER_ADMIN_ID}\`) can remove administrators.`
    );
    return;
  }

  const admins = await getAllAdmins();
  let text = `❌ *REMOVE ADMIN*\n\nCurrent Admins:\n`;
  admins.forEach((a) => {
    text += `• \`${a.user_id}\` (${a.role})\n`;
  });
  text += `\nEnter the *Telegram User ID* to revoke admin privileges:`;

  await setUserState(from.id, 'WAITING_ADMIN_REMOVE');
  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: getCancelKeyboard('action:cancel_admin'),
  });
}

/**
 * Handles Admin ⚙️ Settings view
 */
export async function handleAdminSettings(message: TelegramMessage) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const text = `⚙️ *SYSTEM CONFIGURATION*

• *Bot Name:* ${CONFIG.BOT_NAME}
• *Super Admin ID:* \`${CONFIG.SUPER_ADMIN_ID}\`
• *Daily Limit:* ${CONFIG.DEFAULT_DAILY_LIMIT} deployments/day
• *Max ZIP Size:* ${CONFIG.MAX_ZIP_SIZE_MB}MB
• *Force Join Channel ID:* \`${CONFIG.CHANNEL_ID || 'Not set'}\`
• *Force Join Group ID:* \`${CONFIG.GROUP_ID || 'Not set'}\`
• *GitHub Username:* \`${CONFIG.GITHUB_USERNAME || 'Not set'}\`
• *Vercel Token:* ${CONFIG.VERCEL_TOKEN ? '✅ Configured' : '❌ Missing'}`;

  await sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
}

/**
 * Process text inputs for waiting Admin actions
 */
export async function handleAdminStateInput(
  message: TelegramMessage,
  stateType: string,
  text: string
) {
  const from = message.from;
  if (!from || !(await isAdmin(from.id))) return;

  const inputTrimmed = text.trim();

  if (stateType === 'WAITING_ADMIN_SEARCH_USER') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    const user = await getUser(targetId);
    if (!user) {
      await sendMessage(message.chat.id, `❌ User \`${targetId}\` not found in database.`);
      return;
    }

    const userProjects = await getUserProjects(targetId);
    const today = getTodayDateString();
    const usage = user.daily_usage_date === today ? user.daily_usage || 0 : 0;

    const userCard = `👤 *USER INFORMATION*

🆔 *ID:* \`${user.telegram_id}\`
👤 *Name:* ${user.first_name} ${user.last_name || ''}
${user.username ? `🌐 *Username:* @${user.username}\n` : ''}
📦 *Projects:* ${userProjects.length}
📊 *Today's Usage:* ${usage} / ${CONFIG.DEFAULT_DAILY_LIMIT}
🛡 *Status:* ${user.banned ? '🚫 Banned' : '🟢 Active'}
📅 *Joined:* ${new Date(user.created_at).toLocaleString()}`;

    await sendMessage(message.chat.id, userCard, { parse_mode: 'Markdown' });
    return;
  }

  if (stateType === 'WAITING_ADMIN_BAN_USER') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    if (targetId === CONFIG.SUPER_ADMIN_ID) {
      await sendMessage(message.chat.id, `🚫 You cannot ban the Super Admin.`);
      return;
    }

    await setUserBanStatus(targetId, true);
    await logSystemAction(from.id, 'USER_BANNED', 'SUCCESS', undefined, `Banned user ${targetId}`);
    await sendMessage(message.chat.id, `🚫 *User \`${targetId}\` has been banned.*`);
    return;
  }

  if (stateType === 'WAITING_ADMIN_UNBAN_USER') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    await setUserBanStatus(targetId, false);
    await logSystemAction(
      from.id,
      'USER_UNBANNED',
      'SUCCESS',
      undefined,
      `Unbanned user ${targetId}`
    );
    await sendMessage(message.chat.id, `✅ *User \`${targetId}\` has been unbanned.*`);
    return;
  }

  if (stateType === 'WAITING_ADMIN_RESET_LIMIT') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    await resetUserDailyLimit(targetId);
    await logSystemAction(
      from.id,
      'LIMIT_RESET',
      'SUCCESS',
      undefined,
      `Reset daily limit for ${targetId}`
    );
    await sendMessage(
      message.chat.id,
      `🔄 *Daily limit for User \`${targetId}\` has been reset to 0.*`
    );
    return;
  }

  if (stateType === 'WAITING_ADMIN_ADD') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    await addAdmin(targetId, from.id);
    await logSystemAction(
      from.id,
      'ADMIN_ADDED',
      'SUCCESS',
      undefined,
      `Added admin ${targetId}`
    );
    await sendMessage(
      message.chat.id,
      `➕ *User \`${targetId}\` is now an authorized Administrator.*`
    );
    return;
  }

  if (stateType === 'WAITING_ADMIN_REMOVE') {
    await clearUserState(from.id);
    const targetId = parseInt(inputTrimmed, 10);
    if (isNaN(targetId)) {
      await sendMessage(message.chat.id, `❌ Invalid Telegram ID.`);
      return;
    }

    if (targetId === CONFIG.SUPER_ADMIN_ID) {
      await sendMessage(message.chat.id, `🚫 Super Admin cannot be removed.`);
      return;
    }

    await removeAdmin(targetId);
    await logSystemAction(
      from.id,
      'ADMIN_REMOVED',
      'SUCCESS',
      undefined,
      `Removed admin ${targetId}`
    );
    await sendMessage(
      message.chat.id,
      `❌ *Admin privileges revoked for User \`${targetId}\`.*`
    );
    return;
  }

  if (stateType === 'WAITING_BROADCAST_MESSAGE') {
    await clearUserState(from.id);
    const broadcastText = `📢 *ANNOUNCEMENT*\n\n${text}\n\n— *${CONFIG.BOT_NAME} Team*`;

    const statusMsg = await sendMessage(
      message.chat.id,
      `⏳ *Broadcasting message to registered users...*`
    );
    const statusMsgId = statusMsg.result?.message_id;

    const users = await getAllUsers();
    let sent = 0;
    let failed = 0;

    for (const u of users) {
      try {
        const res = await sendMessage(u.telegram_id, broadcastText, { parse_mode: 'Markdown' });
        if (res.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
      // Avoid Telegram rate limit
      await new Promise((r) => setTimeout(r, 60));
    }

    const summary = `📢 *BROADCAST COMPLETE*

• *Total Users:* ${users.length}
• *Sent Successfully:* ${sent}
• *Failed:* ${failed}`;

    if (statusMsgId) {
      await editMessageText(message.chat.id, statusMsgId, summary, { parse_mode: 'Markdown' });
    } else {
      await sendMessage(message.chat.id, summary, { parse_mode: 'Markdown' });
    }

    await logSystemAction(
      from.id,
      'BROADCAST',
      'SUCCESS',
      undefined,
      `Broadcast sent to ${sent} users`
    );
    return;
  }
}
