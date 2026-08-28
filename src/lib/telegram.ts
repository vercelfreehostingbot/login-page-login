// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — TELEGRAM BOT API CLIENT (ULTRA-FAST)
// =================================================================

import https from 'https';
import http from 'http';
import { CONFIG } from './config';
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from '../types';

const API_BASE = 'https://api.telegram.org';

// High-performance persistent connection agent (Keep-Alive)
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 30,
  timeout: 15000,
  keepAliveMsecs: 60000,
});

export async function callTelegramApi<T = any>(
  method: string,
  payload: Record<string, any> = {}
): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const token = CONFIG.BOT_TOKEN;
  if (!token) {
    console.warn(`Telegram API call skipped (${method}): BOT_TOKEN not configured.`);
    return { ok: false, description: 'BOT_TOKEN is not configured.' };
  }

  const postData = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request(
      `${API_BASE}/bot${token}/${method}`,
      {
        method: 'POST',
        agent: httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (!parsed.ok) {
              console.warn(`Telegram API Error [${method}]:`, parsed);
            }
            resolve(parsed);
          } catch (err: any) {
            console.error(`Telegram API JSON parse error [${method}]:`, err);
            resolve({ ok: false, description: 'JSON parse error' });
          }
        });
      }
    );

    req.on('error', (error) => {
      console.error(`Telegram API Network Error [${method}]:`, error);
      resolve({ ok: false, description: error?.message || 'Network request failed' });
    });

    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ ok: false, description: 'Telegram API timeout' });
    });

    req.write(postData);
    req.end();
  });
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: {
    reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | { remove_keyboard: true };
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
    reply_to_message_id?: number;
  } = {}
) {
  const parseMode = options.parse_mode !== undefined ? options.parse_mode : 'Markdown';
  const res = await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: options.disable_web_page_preview !== false,
    reply_markup: options.reply_markup,
    reply_to_message_id: options.reply_to_message_id,
  });

  // If Markdown parse failed (e.g. unescaped user characters in name or text), fallback to raw plain text
  if (!res.ok && parseMode && res.description?.toLowerCase().includes('can\'t parse entities')) {
    console.warn(`[TELEGRAM] Markdown parse error on sendMessage. Retrying with plain text.`);
    return callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: text.replace(/[*_`\[\]()~>#+\-=|{}.!]/g, (m) => m),
      disable_web_page_preview: options.disable_web_page_preview !== false,
      reply_markup: options.reply_markup,
      reply_to_message_id: options.reply_to_message_id,
    });
  }

  return res;
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options: {
    reply_markup?: InlineKeyboardMarkup;
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
  } = {}
) {
  const parseMode = options.parse_mode !== undefined ? options.parse_mode : 'Markdown';
  const res = await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: options.disable_web_page_preview !== false,
    reply_markup: options.reply_markup,
  });

  // If Markdown parse failed, fallback to raw plain text
  if (!res.ok && parseMode && res.description?.toLowerCase().includes('can\'t parse entities')) {
    console.warn(`[TELEGRAM] Markdown parse error on editMessageText. Retrying with plain text.`);
    return callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: options.disable_web_page_preview !== false,
      reply_markup: options.reply_markup,
    });
  }

  return res;
}

export async function deleteMessage(chatId: number | string, messageId: number) {
  return callTelegramApi('deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
}

export function answerCallbackQuery(
  callbackQueryId: string,
  options: {
    text?: string;
    show_alert?: boolean;
    url?: string;
  } = {}
) {
  return callTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: options.text,
    show_alert: options.show_alert || false,
    url: options.url,
  });
}

export async function checkChatMember(
  chatId: string | number,
  userId: number
): Promise<{ isMember: boolean; status?: string }> {
  if (!chatId) return { isMember: true }; // If not configured, pass check

  const response = await callTelegramApi('getChatMember', {
    chat_id: chatId,
    user_id: userId,
  });

  if (!response.ok || !response.result) {
    return { isMember: false };
  }

  const status = response.result.status;
  const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
  return {
    isMember: validStatuses.includes(status),
    status,
  };
}

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const token = CONFIG.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is missing');

  // Step 1: get file path
  const fileRes = await callTelegramApi<{ file_path?: string }>('getFile', {
    file_id: fileId,
  });

  if (!fileRes.ok || !fileRes.result?.file_path) {
    throw new Error(fileRes.description || 'Could not retrieve file metadata from Telegram');
  }

  const filePath = fileRes.result.file_path;
  const downloadUrl = `${API_BASE}/file/bot${token}/${filePath}`;

  return new Promise((resolve, reject) => {
    https.get(downloadUrl, { agent: httpsAgent }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file from Telegram: ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}

export async function setTelegramWebhook(
  url: string,
  secretToken?: string
): Promise<{ ok: boolean; description?: string }> {
  return callTelegramApi('setWebhook', {
    url,
    secret_token: secretToken || CONFIG.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
}

export async function getTelegramWebhookInfo(): Promise<any> {
  return callTelegramApi('getWebhookInfo');
}

export async function deleteTelegramWebhook(): Promise<any> {
  return callTelegramApi('deleteWebhook', { drop_pending_updates: true });
}

