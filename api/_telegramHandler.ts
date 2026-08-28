import { processTelegramUpdate } from '../src/bot/index';
import { verifyWebhookSecret } from '../src/lib/security';
import { CONFIG } from '../src/lib/config';

/**
 * Shared Telegram webhook handler for Vercel serverless functions.
 * Accepts POST updates from Telegram and GET for a simple health check.
 */
export default async function telegramWebhookHandler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'active',
        ok: true,
        endpoint: req.url || '',
        bot_name: CONFIG.BOT_NAME,
        bot_username: `@${CONFIG.BOT_USERNAME}`,
        method_supported: ['POST', 'GET'],
        timestamp: Date.now(),
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const secretHeader = req.headers?.['x-telegram-bot-api-secret-token'];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

    if (!verifyWebhookSecret(secret)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized secret token' });
    }

    const update = req.body;
    if (!update || typeof update !== 'object' || (!update.update_id && !update.message && !update.callback_query)) {
      return res.status(400).json({ ok: false, error: 'Invalid update payload' });
    }

    // Telegram only needs a fast 2xx acknowledgement.
    // Process the update after acknowledging it when the platform keeps the invocation alive.
    res.status(200).json({ ok: true });

    try {
      await processTelegramUpdate(update);
    } catch (error) {
      console.error('[TELEGRAM WEBHOOK] Update processing error:', error);
    }
  } catch (error: any) {
    console.error('[TELEGRAM WEBHOOK] Handler error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  }
}
