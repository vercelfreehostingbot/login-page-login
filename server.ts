// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — FULL-STACK SERVER ENTRY POINT
// =================================================================

import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { processTelegramUpdate } from './src/bot/index';
import { verifyWebhookSecret } from './src/lib/security';
import { setTelegramWebhook, getTelegramWebhookInfo, deleteTelegramWebhook } from './src/lib/telegram';
import { getSystemStats } from './src/lib/firebase';
import { CONFIG } from './src/lib/config';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // -------------------------------------------------------------
  // 1. HEALTH CHECK & DIAGNOSTICS
  // -------------------------------------------------------------
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  // -------------------------------------------------------------
  // 2. TELEGRAM WEBHOOK ENDPOINTS (/api/telegram-webhook & /api/telegram/webhook)
  // -------------------------------------------------------------
  const handleTelegramWebhook = async (req: Request, res: Response) => {
    try {
      console.log(`[TELEGRAM WEBHOOK] Incoming ${req.method} request to ${req.originalUrl || req.path} from IP: ${req.ip}`);

      // 1. Verify webhook secret token (if configured)
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
      if (!verifyWebhookSecret(secretHeader)) {
        console.warn('[SECURITY] Blocked webhook call: Invalid secret header');
        return res.status(401).json({ error: 'Unauthorized secret token' });
      }

      const update = req.body;
      if (!update || (!update.update_id && !update.message && !update.callback_query)) {
        console.warn('[TELEGRAM WEBHOOK] Received invalid or empty update body:', update);
        return res.status(400).json({ error: 'Invalid update payload' });
      }

      console.log(`[TELEGRAM WEBHOOK] Valid update received. update_id=${update.update_id}, sender=${update.message?.from?.id || update.callback_query?.from?.id}`);

      // Acknowledge Telegram immediately with 200 OK
      res.status(200).json({ ok: true });

      // Process update in background
      try {
        await processTelegramUpdate(update);
      } catch (procErr) {
        console.error('[TELEGRAM WEBHOOK] Error processing update in background:', procErr);
      }
    } catch (err: any) {
      console.error('[TELEGRAM WEBHOOK] Fatal error handling webhook:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  };

  const handleTelegramWebhookGet = (req: Request, res: Response) => {
    res.status(200).json({
      status: 'active',
      ok: true,
      endpoint: req.originalUrl || req.path,
      bot_name: CONFIG.BOT_NAME,
      bot_username: `@${CONFIG.BOT_USERNAME}`,
      method_supported: ['POST', 'GET'],
      timestamp: Date.now(),
    });
  };

  // Register both hyphenated and slashed routes to guarantee zero 404s
  app.post('/api/telegram-webhook', handleTelegramWebhook);
  app.post('/api/telegram/webhook', handleTelegramWebhook);
  app.get('/api/telegram-webhook', handleTelegramWebhookGet);
  app.get('/api/telegram/webhook', handleTelegramWebhookGet);

  // -------------------------------------------------------------
  // 2. SYSTEM STATUS & TELEMETRY API
  // -------------------------------------------------------------
  app.get('/api/status', async (req: Request, res: Response) => {
    try {
      const stats = await getSystemStats();
      const webhookInfo = CONFIG.BOT_TOKEN ? await getTelegramWebhookInfo() : null;

      res.json({
        status: 'ONLINE',
        app_name: CONFIG.BOT_NAME,
        bot_username: `@${CONFIG.BOT_USERNAME}`,
        super_admin_id: CONFIG.SUPER_ADMIN_ID,
        stats,
        webhook: webhookInfo?.result || { status: 'unconfigured' },
        services: {
          telegram: Boolean(CONFIG.BOT_TOKEN),
          github: Boolean(CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_USERNAME),
          vercel: Boolean(CONFIG.VERCEL_TOKEN),
          firebase: Boolean(CONFIG.FIREBASE_PROJECT_ID),
        },
        uptime: process.uptime(),
        timestamp: Date.now(),
      });
    } catch (error: any) {
      res.status(500).json({ status: 'ERROR', error: error?.message });
    }
  });

  // -------------------------------------------------------------
  // 3. WEBHOOK REGISTRATION HELPER API
  // -------------------------------------------------------------
  app.post('/api/webhook/setup', async (req: Request, res: Response) => {
    try {
      const { webhookUrl, secret } = req.body;
      const targetUrl = webhookUrl || `${CONFIG.APP_URL || ''}/api/telegram-webhook`;

      if (!targetUrl || !targetUrl.startsWith('https://')) {
        return res.status(400).json({
          ok: false,
          error: 'A valid HTTPS Webhook URL is required for Telegram.',
        });
      }

      const result = await setTelegramWebhook(targetUrl, secret);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message });
    }
  });

  app.post('/api/webhook/delete', async (req: Request, res: Response) => {
    try {
      const result = await deleteTelegramWebhook();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message });
    }
  });

  // -------------------------------------------------------------
  // 4. VITE & STATIC SPA FALLBACK
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡️ Server is running on port ${PORT}`);
    console.log(`🤖 Telegram Webhook ready at /api/telegram/webhook`);
  });
}

startServer();
