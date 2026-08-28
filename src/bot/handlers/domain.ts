// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — CUSTOM DOMAIN HANDLER
// =================================================================

import { getUserProjects, getProject, saveProject, getUserState, setUserState, clearUserState, logSystemAction } from '../../lib/firebase';
import { sendMessage, editMessageText, answerCallbackQuery } from '../../lib/telegram';
import { validateDomainName } from '../../lib/security';
import { addDomainToVercel } from '../../lib/vercel';
import { getCancelKeyboard, getProjectActionKeyboard } from '../keyboards';
import { TelegramMessage, TelegramCallbackQuery } from '../../types';

/**
 * Handles "🌐 Add Domain" button from Main Menu
 */
export async function handleAddDomainPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const projects = await getUserProjects(from.id);

  if (projects.length === 0) {
    await sendMessage(
      message.chat.id,
      `🌐 *ADD CUSTOM DOMAIN*\n\nYou have no active projects.\n\nDeploy a website first using *🚀 Deploy Website*.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const text = `🌐 *ADD CUSTOM DOMAIN*\n\nSelect the project you would like to connect a custom domain to:`;

  const keyboard = projects.map((p) => [
    { text: `🌐 ${p.project_name}`, callback_data: `proj:domain:${p.project_id}` },
  ]);
  keyboard.push([{ text: '❌ Cancel', callback_data: 'action:cancel_domain' }]);

  await sendMessage(message.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Handles domain button click for a specific project
 */
export async function handleDomainCallback(
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

  await setUserState(from.id, 'WAITING_DOMAIN', { project_id: projectId });
  await answerCallbackQuery(callbackQuery.id);

  const text = `🌐 *ADD CUSTOM DOMAIN*

Project: \`${project.project_name}\`

Please send your custom domain name now:
(Example: \`mywebsite.com\` or \`app.example.com\`)`;

  await sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: getCancelKeyboard('action:cancel_domain'),
  });
}

/**
 * Handles incoming domain name text input
 */
export async function handleDomainInput(message: TelegramMessage, rawDomain: string) {
  const from = message.from;
  if (!from) return;

  const state = await getUserState(from.id);
  const projectId = state.temp_data?.project_id;

  if (!projectId) {
    await clearUserState(from.id);
    await sendMessage(message.chat.id, `❌ Session expired. Please select *🌐 Add Domain* again.`);
    return;
  }

  const validation = validateDomainName(rawDomain);
  if (!validation.valid || !validation.normalized) {
    await sendMessage(
      message.chat.id,
      `❌ *Invalid Domain*\n\n${validation.error}\n\nPlease enter a valid domain (e.g. \`example.com\`):`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const domain = validation.normalized;
  const project = await getProject(projectId);

  if (!project || project.user_id !== from.id) {
    await clearUserState(from.id);
    await sendMessage(message.chat.id, `❌ Project not found or access denied.`);
    return;
  }

  await clearUserState(from.id);

  const statusMsg = await sendMessage(
    message.chat.id,
    `⏳ *Configuring domain \`${domain}\` on Vercel...*`,
    { parse_mode: 'Markdown' }
  );
  const statusMsgId = statusMsg.result?.message_id;

  try {
    const result = await addDomainToVercel(project.vercel_project, domain);

    if (!result.success) {
      throw new Error(result.error || 'Failed to add domain on Vercel.');
    }

    project.custom_domain = domain;
    project.updated_at = Date.now();
    await saveProject(project);

    await logSystemAction(from.id, 'DOMAIN_ADDED', 'SUCCESS', projectId, domain);

    const successText = `🌐 *DOMAIN ADDED SUCCESSFULLY!*

*Domain:* \`${domain}\`
*Project:* \`${project.project_name}\`

━━━━━━━━━━━━━━━━━━━
⚠️ *Required DNS Configuration:*

To point your domain to Vercel, add one of the following DNS records in your domain registrar (e.g., Cloudflare, Namecheap, GoDaddy):

• *For Root Domain (e.g. \`${domain}\`):*
  Type: \`A\`
  Name: \`@\`
  Value: \`76.76.21.21\`

• *For Subdomain (e.g. \`sub.${domain}\`):*
  Type: \`CNAME\`
  Name: \`sub\`
  Value: \`cname.vercel-dns.com\`

🔒 _Vercel will automatically provision a free SSL certificate once DNS records propagate!_`;

    if (statusMsgId) {
      await editMessageText(message.chat.id, statusMsgId, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(project.project_id, `https://${domain}`),
      });
    } else {
      await sendMessage(message.chat.id, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(project.project_id, `https://${domain}`),
      });
    }
  } catch (error: any) {
    console.error('Domain addition failed:', error);
    await logSystemAction(from.id, 'DOMAIN_ADDED', 'FAILED', projectId, error?.message);

    const errText = `❌ *Domain Configuration Failed*\n\n${error?.message || 'Could not add domain.'}`;
    if (statusMsgId) {
      await editMessageText(message.chat.id, statusMsgId, errText, { parse_mode: 'Markdown' });
    } else {
      await sendMessage(message.chat.id, errText, { parse_mode: 'Markdown' });
    }
  }
}
