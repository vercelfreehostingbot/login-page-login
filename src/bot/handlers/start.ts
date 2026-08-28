// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — START & VERIFICATION HANDLERS
// =================================================================

import { CONFIG } from '../../lib/config';
import { getOrCreateUser, setUserVerified, logSystemAction, getUser } from '../../lib/firebase';
import { sendMessage, checkChatMember, answerCallbackQuery } from '../../lib/telegram';
import { getVerificationKeyboard, getMainMenuKeyboard } from '../keyboards';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';

/**
 * Handles /start command
 */
export async function handleStartCommand(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  // 1. Register or update user record in Firebase
  const user = await getOrCreateUser(from.id, {
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name,
  });

  // 2. Check if user is banned
  if (user.banned) {
    await sendMessage(
      message.chat.id,
      `🚫 *ACCOUNT SUSPENDED*\n\nYour account has been suspended by the administrator. You cannot use this bot.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // 3. Check Force Join status
  const isForceJoinEnabled = Boolean(CONFIG.CHANNEL_ID || CONFIG.GROUP_ID);

  if (isForceJoinEnabled && !user.verified) {
    // Check real membership via getChatMember
    const channelCheck = CONFIG.CHANNEL_ID
      ? await checkChatMember(CONFIG.CHANNEL_ID, from.id)
      : { isMember: true };
    const groupCheck = CONFIG.GROUP_ID
      ? await checkChatMember(CONFIG.GROUP_ID, from.id)
      : { isMember: true };

    if (channelCheck.isMember && groupCheck.isMember) {
      // User is already a member
      await setUserVerified(from.id, true);
      await sendWelcomeSuccess(message.chat.id, from.first_name);
      return;
    }

    // Show verification required prompt
    const verificationText = `🔐 *Verification Required*

To use *${CONFIG.BOT_NAME}*, please join our required Channel and Group.

Once you have joined both, press *✅ Verify* below.`;

    await sendMessage(message.chat.id, verificationText, {
      parse_mode: 'Markdown',
      reply_markup: getVerificationKeyboard(),
    });
    return;
  }

  // User is verified or Force Join is not required
  await sendWelcomeSuccess(message.chat.id, from.first_name);
}

/**
 * Handles the inline "✅ Verify" button click
 */
export async function handleVerifyCallback(callbackQuery: TelegramCallbackQuery) {
  const from = callbackQuery.from;
  const chatId = callbackQuery.message?.chat.id || from.id;

  // Verify membership
  const channelCheck = CONFIG.CHANNEL_ID
    ? await checkChatMember(CONFIG.CHANNEL_ID, from.id)
    : { isMember: true };
  const groupCheck = CONFIG.GROUP_ID
    ? await checkChatMember(CONFIG.GROUP_ID, from.id)
    : { isMember: true };

  if (channelCheck.isMember && groupCheck.isMember) {
    await setUserVerified(from.id, true);
    await logSystemAction(from.id, 'USER_VERIFIED', 'SUCCESS');

    await answerCallbackQuery(callbackQuery.id, {
      text: '✅ Verification Successful!',
      show_alert: false,
    });

    await sendWelcomeSuccess(chatId, from.first_name);
  } else {
    await answerCallbackQuery(callbackQuery.id, {
      text: '❌ Verification Failed! Please join both Channel & Group first.',
      show_alert: true,
    });

    const failedText = `❌ *Verification Failed*

Please join our required Channel and Group first.

Then press *✅ Verify* again below.`;

    await sendMessage(chatId, failedText, {
      parse_mode: 'Markdown',
      reply_markup: getVerificationKeyboard(),
    });
  }
}

/**
 * Sends the main welcome message and displays Main Menu Reply Keyboard
 */
export async function sendWelcomeSuccess(chatId: number | string, firstName: string) {
  const welcomeText = `✅ *Verification Successful!*

Welcome to
*${CONFIG.BOT_NAME}* 🚀

You can now host and deploy your websites to Vercel directly from Telegram.

• *5 Free Deployments Daily*
• *Next.js, Vite, React, Astro, HTML & more*
• *Instant Live URL & GitHub integration*

Please select an option from the menu below:`;

  await sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });
}
