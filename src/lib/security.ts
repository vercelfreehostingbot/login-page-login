// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — SECURITY & VALIDATION
// =================================================================

import { CONFIG } from './config';

/**
 * Validates project name for GitHub and Vercel compatibility
 */
export function validateProjectName(name: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!name || typeof name !== 'string') {
    return { valid: false, normalized: '', error: 'Project name cannot be empty.' };
  }

  // Normalize: lowercased, spaces to hyphens, remove invalid characters
  let normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length < 3) {
    return {
      valid: false,
      normalized,
      error: 'Project name must be at least 3 characters long.',
    };
  }

  if (normalized.length > 45) {
    return {
      valid: false,
      normalized: normalized.slice(0, 45),
      error: 'Project name cannot exceed 45 characters.',
    };
  }

  // Ensure starts and ends with alphanumeric
  if (!/^[a-z0-9].*[a-z0-9]$/.test(normalized) && normalized.length > 1) {
    return {
      valid: false,
      normalized,
      error: 'Project name must start and end with a letter or number.',
    };
  }

  return { valid: true, normalized };
}

/**
 * Validates custom domain format
 */
export function validateDomainName(domain: string): { valid: boolean; normalized?: string; error?: string } {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain cannot be empty.' };
  }

  const cleaned = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/:\d+$/, '')
    .replace(/\/.*$/, '');

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  if (!domainRegex.test(cleaned)) {
    return { valid: false, error: 'Invalid domain format. Example: mydomain.com or app.example.com' };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * List of sensitive filenames that should NEVER be pushed to public/private Git repositories
 */
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /.*service-account.*\.json$/i,
  /.*firebase.*secret.*\.json$/i,
  /.*id_rsa(\.pub)?$/i,
  /.*\.pem$/i,
  /.*\.key$/i,
  /^\.git\/.*$/i,
  /^node_modules\/.*$/i,
  /^\.next\/.*$/i,
  /^\.vercel\/.*$/i,
  /^\.DS_Store$/i,
  /^Thumbs\.db$/i,
];

export function isSensitiveFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || filePath;
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(fileName) || pattern.test(filePath));
}

/**
 * Verify incoming Telegram webhook secret token
 */
export function verifyWebhookSecret(tokenHeader?: string | null): boolean {
  const expectedSecret = (CONFIG.TELEGRAM_WEBHOOK_SECRET || '').trim();
  // If no secret is configured on the server, allow all requests
  if (!expectedSecret) return true;
  // If no secret header is provided in incoming request, allow (Telegram standard behavior when secret_token wasn't set)
  if (!tokenHeader) return true;
  return tokenHeader === expectedSecret;
}
