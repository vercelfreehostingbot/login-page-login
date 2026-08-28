// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — CONFIGURATION
// =================================================================

export const CONFIG = {
  BOT_NAME: '𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧',
  BOT_USERNAME: process.env.BOT_USERNAME || 'Vercel_Free_Hosting_Bot',
  SUPER_ADMIN_ID: 6919025708,
  DEFAULT_DAILY_LIMIT: 5,
  MAX_ZIP_SIZE_MB: 50,
  MAX_EXTRACT_SIZE_MB: 120,
  MAX_FILE_COUNT: 4000,
  DEPLOYMENT_TIMEOUT_MS: 300000, // 5 minutes

  // Telegram credentials
  get BOT_TOKEN(): string {
    return process.env.BOT_TOKEN || '';
  },
  get TELEGRAM_WEBHOOK_SECRET(): string {
    return process.env.TELEGRAM_WEBHOOK_SECRET || '';
  },

  // Force Join Channels
  get CHANNEL_ID(): string {
    return process.env.CHANNEL_ID || '';
  },
  get GROUP_ID(): string {
    return process.env.GROUP_ID || '';
  },
  get CHANNEL_USERNAME(): string {
    return (process.env.CHANNEL_USERNAME || '').replace('@', '');
  },
  get GROUP_USERNAME(): string {
    return (process.env.GROUP_USERNAME || '').replace('@', '');
  },

  // GitHub Credentials
  get GITHUB_TOKEN(): string {
    return process.env.GITHUB_TOKEN || '';
  },
  get GITHUB_USERNAME(): string {
    return process.env.GITHUB_USERNAME || '';
  },

  // Vercel Credentials
  get VERCEL_TOKEN(): string {
    return process.env.VERCEL_TOKEN || '';
  },
  get VERCEL_TEAM_ID(): string {
    return process.env.VERCEL_TEAM_ID || '';
  },

  // Firebase
  get FIREBASE_PROJECT_ID(): string {
    return process.env.FIREBASE_PROJECT_ID || '';
  },
  get FIREBASE_CLIENT_EMAIL(): string {
    return process.env.FIREBASE_CLIENT_EMAIL || '';
  },
  get FIREBASE_PRIVATE_KEY(): string {
    let key = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    return key.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
  },

  // App URL
  get APP_URL(): string {
    return process.env.APP_URL || '';
  },
};

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
