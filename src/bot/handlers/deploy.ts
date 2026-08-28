// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — DEPLOYMENT PIPELINE HANDLER
// =================================================================

import { CONFIG, getTodayDateString } from '../../lib/config';
import {
  getUser,
  getUserState,
  setUserState,
  clearUserState,
  incrementUserUsage,
  checkProjectNameExists,
  saveProject,
  logSystemAction,
} from '../../lib/firebase';
import {
  sendMessage,
  editMessageText,
  downloadTelegramFile,
  deleteMessage,
} from '../../lib/telegram';
import { processAndAnalyzeZip, ExtractedFile } from '../../lib/zip';
import { validateProjectName } from '../../lib/security';
import { createGitHubRepository, uploadFilesToGitHub } from '../../lib/github';
import {
  getOrCreateVercelProject,
  createVercelDeployment,
  pollVercelDeployment,
} from '../../lib/vercel';
import { addVercelEnv } from '../../lib/vercelEnv';
import { getProjectActionKeyboard, getMainMenuKeyboard } from '../keyboards';
import { TelegramMessage, ProjectRecord } from '../../types';

// In-memory cache for temporary extracted files during user project name naming step
const pendingZipFilesCache = new Map<number, { files: ExtractedFile[]; analysis: any }>();

/**
 * Triggered when user presses "🚀 Deploy Website"
 */
export async function handleDeployPrompt(message: TelegramMessage) {
  const from = message.from;
  if (!from) return;

  const user = await getUser(from.id);
  if (user?.banned) {
    await sendMessage(
      message.chat.id,
      `🚫 *ACCOUNT SUSPENDED*\n\nYour account has been suspended by administrator.`
    );
    return;
  }

  // Check daily limit (5 per day)
  const today = getTodayDateString();
  const usage = user?.daily_usage_date === today ? user.daily_usage || 0 : 0;
  if (usage >= CONFIG.DEFAULT_DAILY_LIMIT && user?.role !== 'super_admin' && user?.role !== 'admin') {
    await sendMessage(
      message.chat.id,
      `⚠️ *DAILY LIMIT REACHED*\n\nYou have used *${usage} / ${CONFIG.DEFAULT_DAILY_LIMIT}* deployments for today.\n\nYour limit will automatically reset tomorrow.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Set user state to WAITING_ZIP
  await setUserState(from.id, 'WAITING_ZIP');

  const promptText = `📦 *DEPLOY WEBSITE*

Please upload your website or web project as a *ZIP file* (.zip).

• *Supported:* Next.js, Vite, React, Vue, Svelte, Astro, HTML/CSS, Node.js
• *Max Size:* ${CONFIG.MAX_ZIP_SIZE_MB}MB
• *Security:* Sensitive \`.env\` files and credentials will be automatically excluded.`;

  await sendMessage(message.chat.id, promptText, { parse_mode: 'Markdown' });
}

/**
 * Handles ZIP file upload from user
 */
export async function handleZipUpload(message: TelegramMessage) {
  const from = message.from;
  if (!from || !message.document) return;

  const doc = message.document;
  const fileName = doc.file_name || '';

  if (!fileName.toLowerCase().endsWith('.zip') && doc.mime_type !== 'application/zip') {
    await sendMessage(
      message.chat.id,
      `❌ *Invalid File*\n\nPlease upload a valid *.zip* file.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const statusMsg = await sendMessage(
    message.chat.id,
    `⏳ *Processing ZIP File...*\n\nDownloading and scanning archive for security...`,
    { parse_mode: 'Markdown' }
  );

  const statusMsgId = statusMsg.result?.message_id;

  try {
    // 1. Download ZIP buffer from Telegram
    const zipBuffer = await downloadTelegramFile(doc.file_id);

    // 2. Extract & Validate ZIP
    const { analysis, files } = await processAndAnalyzeZip(zipBuffer);

    if (!analysis.compatible) {
      const errorReason = analysis.incompatibleReason || 'This project is not compatible with Vercel.';
      if (statusMsgId) {
        await editMessageText(
          message.chat.id,
          statusMsgId,
          `❌ *Unsupported Project*\n\n${errorReason}`
        );
      }
      await clearUserState(from.id);
      return;
    }

    // Store in pending cache for project name step
    pendingZipFilesCache.set(from.id, { files, analysis });

    // Update state to WAITING_PROJECT_NAME
    await setUserState(from.id, 'WAITING_PROJECT_NAME', {
      file_name: fileName,
      detected_framework: analysis.framework,
      file_count: files.length,
    });

    const analysisText = `📦 *PROJECT ANALYSIS*

• *Framework:* ${analysis.framework}
• *Package Manager:* ${analysis.packageManager}
• *Files Detected:* ${files.length}
• *Vercel Compatibility:* ✅ Compatible

━━━━━━━━━━━━━━━━━━━
📝 *Enter your Project Name:*

(Use lowercase letters, numbers, and hyphens. Example: \`my-portfolio\`)`;

    if (statusMsgId) {
      await editMessageText(message.chat.id, statusMsgId, analysisText, {
        parse_mode: 'Markdown',
      });
    } else {
      await sendMessage(message.chat.id, analysisText, { parse_mode: 'Markdown' });
    }
  } catch (error: any) {
    console.error('ZIP processing error:', error);
    const errMsg = `❌ *ZIP Extraction Failed*\n\n${error?.message || 'Something went wrong while processing the archive.'}`;
    if (statusMsgId) {
      await editMessageText(message.chat.id, statusMsgId, errMsg, { parse_mode: 'Markdown' });
    } else {
      await sendMessage(message.chat.id, errMsg, { parse_mode: 'Markdown' });
    }
    await clearUserState(from.id);
  }
}

/**
 * Handles project name input and executes full deployment flow
 */
export async function handleProjectNameInput(message: TelegramMessage, rawName: string) {
  const from = message.from;
  if (!from) return;

  const validation = validateProjectName(rawName);
  if (!validation.valid) {
    await sendMessage(
      message.chat.id,
      `❌ *Invalid Project Name*\n\n${validation.error}\n\nPlease enter another project name:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const projectName = validation.normalized;

  // Check if project name already exists for this user
  const exists = await checkProjectNameExists(projectName, from.id);
  if (exists) {
    await sendMessage(
      message.chat.id,
      `❌ *Project Name Already Exists*\n\nYou already have a project named \`${projectName}\`.\n\nPlease choose another name:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Retrieve cached files
  const cached = pendingZipFilesCache.get(from.id);
  if (!cached || !cached.files || cached.files.length === 0) {
    await sendMessage(
      message.chat.id,
      `⚠️ Session expired. Please send your ZIP file again by clicking *🚀 Deploy Website*.`,
      { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
    );
    await clearUserState(from.id);
    return;
  }

  const { files, analysis } = cached;
  const currentState = await getUserState(from.id);
  const deployReady = Boolean(currentState.temp_data?.deploy_ready);
  const pendingEnvs = Array.isArray(currentState.temp_data?.envs) ? currentState.temp_data?.envs : [];

  // Optional environment-variable setup before the existing deployment pipeline.
  if (!deployReady) {
    await setUserState(from.id, 'WAITING_ENV_NAME', {
      ...currentState.temp_data,
      initial_deploy: true,
      project_name: projectName,
      envs: [],
    });
    await sendMessage(message.chat.id, `⚙️ *Environment Variables (Optional)*\n\nYou can add one or more Production variables now. They will be stored only in Vercel — never in GitHub.\n\nSend a variable name to add one, or press *Skip & Deploy*.`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '⏭ Skip & Deploy', callback_data: 'env:initial_done' }], [{ text: '❌ Cancel', callback_data: 'action:cancel_env' }]] }
    });
    return;
  }

  // Clear state and cache only when the actual deployment begins.
  await clearUserState(from.id);
  pendingZipFilesCache.delete(from.id);

  // Send single progress message
  let progressMessageText = `🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ⏳
▲ Vercel: ⏳
⚙️ Build: ⏳`;

  const progressMsg = await sendMessage(message.chat.id, progressMessageText, {
    parse_mode: 'Markdown',
  });
  const progressMsgId = progressMsg.result?.message_id;

  const updateProgress = async (text: string) => {
    if (progressMsgId) {
      try {
        await editMessageText(message.chat.id, progressMsgId, text, {
          parse_mode: 'Markdown',
        });
      } catch (e) {
        // Ignore Telegram edit rate limit errors
      }
    }
  };

  try {
    // 1. Create GitHub Repository
    updateProgress(`🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ⏳ Creating repository...
▲ Vercel: ⏳
⚙️ Build: ⏳`);

    const repo = await createGitHubRepository(projectName, false);

    // 2. Upload files to GitHub
    updateProgress(`🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ⏳ Uploading ${files.length} files...
▲ Vercel: ⏳
⚙️ Build: ⏳`);

    const gitUpload = await uploadFilesToGitHub(projectName, files);

    // 3. Create Vercel Project
    updateProgress(`🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ✅
▲ Vercel: ⏳ Initializing deployment...
⚙️ Build: ⏳`);

    await getOrCreateVercelProject(projectName, analysis, projectName);

    // 4. Optional Vercel Environment Variables. These are never committed to GitHub.
    if (pendingEnvs.length > 0) {
      for (const env of pendingEnvs) {
        await addVercelEnv(projectName, env.key, env.value, ['production']);
      }
    }

    // 5. Create Vercel Deployment (pointing to verified main branch & commit SHA, with direct files fallback)
    const deployment = await createVercelDeployment(
      projectName,
      projectName,
      gitUpload.branch || 'main',
      repo.id,
      files,
      gitUpload.commit_sha,
      analysis
    );

    // 6. Monitor Vercel Build
    updateProgress(`🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ✅
▲ Vercel: ✅
⚙️ Build: ⏳ Building & compiling...`);

    const pollResult = await pollVercelDeployment(deployment.deploymentId, projectName, async (state) => {
      updateProgress(`🚀 *DEPLOYMENT IN PROGRESS*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}

📦 Upload: ✅
🔍 Analysis: ✅
🐙 GitHub: ✅
▲ Vercel: ✅
⚙️ Build: ⏳ ${state}...`);
    });

    if (pollResult.status === 'ERROR' || pollResult.status === 'CANCELED') {
      throw new Error(pollResult.error || 'Vercel build failed.');
    }

    const liveUrl = pollResult.liveUrl || deployment.url;
    const projectId = `proj_${Date.now()}_${projectName}`;

    // 7. Save Project Record to Firebase
    const projectRecord: ProjectRecord = {
      project_id: projectId,
      user_id: from.id,
      project_name: projectName,
      github_repository: `${CONFIG.GITHUB_USERNAME}/${projectName}`,
      github_url: repo.html_url,
      vercel_project: projectName,
      vercel_url: liveUrl,
      deployment_id: deployment.deploymentId,
      framework: analysis.framework,
      status: 'ONLINE',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await saveProject(projectRecord);
    await incrementUserUsage(from.id);
    await logSystemAction(from.id, 'PROJECT_DEPLOYED', 'SUCCESS', projectId, projectName);

    // 8. Send Success Message
    const successText = `🎉 *WEBSITE DEPLOYED SUCCESSFULLY!*

📦 *Project:* \`${projectName}\`
🔧 *Framework:* ${analysis.framework}
🐙 *GitHub:* Connected
▲ *Vercel:* Connected
🟢 *Status:* Online

🌐 *Live Website:*
${liveUrl}`;

    if (progressMsgId) {
      await editMessageText(message.chat.id, progressMsgId, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(projectId, liveUrl),
      });
    } else {
      await sendMessage(message.chat.id, successText, {
        parse_mode: 'Markdown',
        reply_markup: getProjectActionKeyboard(projectId, liveUrl),
      });
    }
  } catch (error: any) {
    console.error('Deployment failure:', error);
    await logSystemAction(from.id, 'PROJECT_DEPLOYED', 'FAILED', undefined, error?.message);

    const failText = `❌ *Deployment Failed*

*Error:* ${error?.message || 'Failed to complete deployment.'}

Please check your project structure and try again.`;

    if (progressMsgId) {
      await editMessageText(message.chat.id, progressMsgId, failText, {
        parse_mode: 'Markdown',
      });
    } else {
      await sendMessage(message.chat.id, failText, { parse_mode: 'Markdown' });
    }
  }
}
