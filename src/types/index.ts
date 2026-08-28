// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — TYPES DEFINITIONS
// =================================================================

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  document?: TelegramDocument;
  reply_markup?: any;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
  chat_instance?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
}

// ----------------- FIREBASE SCHEMAS -----------------

export interface UserRecord {
  telegram_id: number;
  username: string;
  first_name: string;
  last_name: string;
  verified: boolean;
  banned: boolean;
  created_at: number;
  last_active: number;
  daily_usage: number;
  daily_usage_date: string; // YYYY-MM-DD
  role?: 'user' | 'admin' | 'super_admin';
}

export interface ProjectRecord {
  project_id: string;
  user_id: number;
  project_name: string;
  github_repository: string;
  github_url: string;
  vercel_project: string;
  vercel_url: string;
  deployment_id: string;
  framework: string;
  status: 'ONLINE' | 'BUILDING' | 'ERROR' | 'CANCELED' | 'INITIALIZING';
  created_at: number;
  updated_at: number;
  custom_domain?: string;
}

export interface AdminRecord {
  user_id: number;
  role: 'super_admin' | 'admin';
  username?: string;
  added_by?: number;
  created_at: number;
}

export interface SystemLogRecord {
  log_id: string;
  user_id: number;
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'INFO';
  project_id?: string;
  details?: string;
  timestamp: number;
}

export type UserWorkflowState =
  | 'IDLE'
  | 'WAITING_ZIP'
  | 'WAITING_PROJECT_NAME'
  | 'WAITING_DOMAIN'
  | 'WAITING_CODE_FILE'
  | 'WAITING_CODE_CONTENT'
  | 'WAITING_ENV_NAME'
  | 'WAITING_ENV_VALUE'
  | 'WAITING_ENV_EDIT_VALUE'
  | 'WAITING_DELETE_CONFIRMATION'
  | 'WAITING_ADMIN_SEARCH_USER'
  | 'WAITING_ADMIN_BAN_USER'
  | 'WAITING_ADMIN_UNBAN_USER'
  | 'WAITING_ADMIN_RESET_LIMIT'
  | 'WAITING_ADMIN_DELETE_PROJECT'
  | 'WAITING_ADMIN_ADD'
  | 'WAITING_ADMIN_REMOVE'
  | 'WAITING_BROADCAST_MESSAGE';

export interface UserStateRecord {
  user_id: number;
  state: UserWorkflowState;
  temp_data?: {
    file_id?: string;
    file_name?: string;
    detected_framework?: string;
    detected_root?: string;
    project_id?: string;
    project_name?: string;
    target_user_id?: number;
    [key: string]: any;
  };
  updated_at: number;
}

// ----------------- ANALYSIS & DEPLOYMENT -----------------

export interface ProjectAnalysis {
  framework: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none';
  hasPackageJson: boolean;
  hasVercelJson: boolean;
  hasIndexHtml: boolean;
  buildCommand?: string;
  outputDirectory?: string;
  compatible: boolean;
  incompatibleReason?: string;
  detectedRoot: string;
  fileCount: number;
  totalSize: number;
}

export interface DeploymentProgressCallback {
  (step: 'ANALYSIS' | 'GITHUB' | 'VERCEL' | 'BUILD' | 'DONE' | 'ERROR', details?: string): Promise<void>;
}
