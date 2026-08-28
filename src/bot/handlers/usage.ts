// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — USAGE, ACCOUNT & HELP HANDLERS
// =================================================================

import { CONFIG, getTodayDateString } from '../../lib/config';
import { getUser, getUserProjects } from '../../lib/firebase';
import { sendMessage } from '../../lib/telegram';
import { TelegramMessage } from '../../types';

/**
 * Handles "📊 My Usage"
 */
export async function handleMyUsage(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const user = await getUser(from.id);
  const today = getTodayDateString();

  const dailyUsage = user?.daily_usage_date === today ? user.daily_usage || 0 : 0;
  const maxLimit = CONFIG.DEFAULT_DAILY_LIMIT;
  const remaining = Math.max(0, maxLimit - dailyUsage);

  const usageText = `📊 *MY USAGE*

📅 *Date:* ${today}

*Today's Deployments:*
${dailyUsage} / ${maxLimit}

*Remaining Deployments:*
${remaining}

━━━━━━━━━━━━━━━━━━━
🔄 _Daily deployment limit automatically resets every 24 hours at 00:00 UTC._`;

  await sendMessage(message.chat.id, usageText, { parse_mode: 'Markdown' });
}

/**
 * Handles "👤 My Account"
 */
export async function handleMyAccount(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const user = await getUser(from.id);
  const projects = await getUserProjects(from.id);
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : 'Recently';

  const accountText = `👤 *MY ACCOUNT*

🆔 *Telegram ID:* \`${from.id}\`
👤 *Name:* ${from.first_name || ''} ${from.last_name || ''}
${from.username ? `🌐 *Username:* @${from.username}\n` : ''}
📦 *Total Projects:* ${projects.length}
📅 *Joined Date:* ${joinedDate}
🛡 *Account Status:* ${user?.banned ? '🚫 Suspended' : '🟢 Active'}
⚡️ *Plan:* Free Tier (5 builds / day)`;

  await sendMessage(message.chat.id, accountText, { parse_mode: 'Markdown' });
}

/**
 * Handles "ℹ️ Help"
 */
export async function handleHelp(message: TelegramMessage) {
  const helpText = `ℹ️ *HOW TO USE ${CONFIG.BOT_NAME}*

1️⃣ *Prepare your Project:*
Zip your web project folder. Make sure your \`package.json\` or \`index.html\` is at the project root.

2️⃣ *Deploy:*
Click *🚀 Deploy Website*, upload the *.zip* file, and enter your desired project name.

3️⃣ *Instant Vercel Live URL:*
The bot will create a GitHub repository, initiate a Vercel build, and provide you with a live HTTPS URL.

4️⃣ *Custom Domains & Redeploy:*
Use *🌐 Add Domain* or *🔄 Redeploy* anytime from the Main Menu.

━━━━━━━━━━━━━━━━━━━
🔧 *Supported Frameworks & Stacks:*
• Next.js / React / Remix
• Vite / Vue / Nuxt
• Astro / Svelte / SvelteKit
• HTML5, CSS3, JavaScript
• Node.js Serverless Functions

💬 Need support or have inquiries? Contact the platform administrator.`;

  await sendMessage(message.chat.id, helpText, { parse_mode: 'Markdown' });
}
