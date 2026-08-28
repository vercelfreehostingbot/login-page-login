// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — VERCEL REST API CLIENT
// =================================================================

import { CONFIG } from './config';
import { ProjectAnalysis } from '../types';
import { ExtractedFile, processAndAnalyzeZip } from './zip';
import { getGitHubRepoId, downloadGitHubRepoZip } from './github';

const VERCEL_API = 'https://api.vercel.com';

function getHeaders() {
  const token = CONFIG.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN environment variable is missing.');

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function getQueryString() {
  if (CONFIG.VERCEL_TEAM_ID) {
    return `?teamId=${CONFIG.VERCEL_TEAM_ID}`;
  }
  return '';
}

/**
 * Returns the clean canonical production URL for a Vercel project (e.g. https://my-project.vercel.app)
 */
export function getCanonicalProjectUrl(
  projectName: string,
  customDomain?: string,
  aliases?: string[]
): string {
  if (customDomain) {
    const cleanDomain = customDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `https://${cleanDomain}`;
  }

  if (aliases && aliases.length > 0) {
    // 1. Look for exact <projectName>.vercel.app
    const exactAlias = aliases.find((a) => a === `${projectName}.vercel.app`);
    if (exactAlias) return `https://${exactAlias}`;

    // 2. Look for any alias without the long random deployment hash
    const cleanAlias = aliases.find((a) => {
      if (a.endsWith('.vercel.app')) {
        // Exclude hashes like project-abc123xyz-team.vercel.app
        const parts = a.replace('.vercel.app', '').split('-');
        return parts.length <= 2 || !/\d[a-z0-9]{6,}/i.test(a);
      }
      return true; // custom domain alias
    });
    if (cleanAlias) return `https://${cleanAlias}`;
  }

  return `https://${projectName}.vercel.app`;
}

/**
 * Creates or retrieves a Vercel project and links it to GitHub
 */
export async function getOrCreateVercelProject(
  projectName: string,
  analysis: ProjectAnalysis,
  githubRepoName?: string
): Promise<{
  id: string;
  name: string;
}> {
  const headers = getHeaders();
  const teamQuery = getQueryString();
  const username = CONFIG.GITHUB_USERNAME;

  // Map framework preset if supported
  const frameworkMap: Record<string, string> = {
    'Next.js': 'nextjs',
    'Vue.js': 'vue',
    'Nuxt.js': 'nuxtjs',
    'Remix': 'remix',
    'Astro': 'astro',
    'SvelteKit': 'sveltekit',
    'React (Vite)': 'vite',
    'Vite Project': 'vite',
    'Vite': 'vite',
    'Angular': 'angular',
  };

  const preset = frameworkMap[analysis.framework];

  // Check if project exists
  const checkRes = await fetch(`${VERCEL_API}/v9/projects/${projectName}${teamQuery}`, {
    method: 'GET',
    headers,
  });

  if (checkRes.status === 200) {
    const data = await checkRes.json();
    return { id: data.id, name: data.name };
  }

  // Create Project payload
  const payload: any = {
    name: projectName,
  };

  if (preset) {
    payload.framework = preset;
  }
  if (analysis.buildCommand) {
    payload.buildCommand = analysis.buildCommand;
  }
  if (analysis.outputDirectory) {
    payload.outputDirectory = analysis.outputDirectory;
  }

  // Link GitHub repository if username and repo are provided
  if (username && githubRepoName) {
    payload.gitRepository = {
      type: 'github',
      repo: `${username}/${githubRepoName}`,
    };
  }

  let createRes = await fetch(`${VERCEL_API}/v10/projects${teamQuery}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // If failed with gitRepository linking (e.g. GitHub app not installed on Vercel), retry without gitRepository
  if (!createRes.ok && payload.gitRepository) {
    delete payload.gitRepository;
    createRes = await fetch(`${VERCEL_API}/v10/projects${teamQuery}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Vercel project creation failed: ${err.error?.message || createRes.statusText}`);
  }

  const data = await createRes.json();
  return { id: data.id, name: data.name };
}

/**
 * Creates a new deployment for a project linked to a GitHub repository or direct files
 */
export async function createVercelDeployment(
  projectName: string,
  githubRepo: string,
  githubBranch = 'main',
  repoId?: number | string,
  files?: ExtractedFile[],
  commitSha?: string,
  analysis?: ProjectAnalysis
): Promise<{
  deploymentId: string;
  url: string;
  readyState: 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
}> {
  const headers = getHeaders();
  const teamId = CONFIG.VERCEL_TEAM_ID;
  const queryParams = new URLSearchParams({
    skipAutoDetectionConfirmation: '1',
  });
  if (teamId) {
    queryParams.set('teamId', teamId);
  }
  const deploymentQuery = `?${queryParams.toString()}`;
  const username = CONFIG.GITHUB_USERNAME;

  // Derive projectSettings framework if known
  const frameworkMap: Record<string, string | null> = {
    'Next.js': 'nextjs',
    'Vue.js': 'vue',
    'Nuxt.js': 'nuxtjs',
    'Remix': 'remix',
    'Astro': 'astro',
    'SvelteKit': 'sveltekit',
    'React (Vite)': 'vite',
    'Vite Project': 'vite',
    'Vite': 'vite',
    'Angular': 'angular',
    'Static HTML / Web': null,
  };

  const detectedFramework = analysis ? frameworkMap[analysis.framework] : undefined;
  const projectSettings: any = {
    framework: detectedFramework !== undefined ? detectedFramework : null,
  };
  if (analysis?.buildCommand) {
    projectSettings.buildCommand = analysis.buildCommand;
  }
  if (analysis?.outputDirectory) {
    projectSettings.outputDirectory = analysis.outputDirectory;
  }

  // Auto-fetch repoId if not provided
  if (!repoId && githubRepo) {
    try {
      const fetchedId = await getGitHubRepoId(githubRepo);
      if (fetchedId) {
        repoId = fetchedId;
      }
    } catch (e) {
      console.warn(`[VERCEL] Auto-fetch repoId failed for ${githubRepo}:`, e);
    }
  }

  // 1. Try Deploying using GitHub Git Source
  const payload: any = {
    name: projectName,
    project: projectName,
    target: 'production',
    projectSettings,
    gitSource: {
      type: 'github',
      repo: `${username}/${githubRepo}`,
      ref: githubBranch || 'main',
    },
  };

  if (commitSha) {
    payload.gitSource.sha = commitSha;
  }
  if (repoId) {
    payload.gitSource.repoId = String(repoId);
  }

  let lastErrorMessage = '';

  try {
    const res = await fetch(`${VERCEL_API}/v13/deployments${deploymentQuery}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      const canonicalUrl = getCanonicalProjectUrl(projectName, undefined, data.alias);
      return {
        deploymentId: data.id,
        url: canonicalUrl,
        readyState: data.readyState || 'BUILDING',
      };
    } else {
      const err = await res.json();
      lastErrorMessage = err.error?.message || res.statusText;
      console.warn(`[VERCEL] Git source deployment attempt returned: ${lastErrorMessage}`);
    }
  } catch (gitErr: any) {
    lastErrorMessage = gitErr.message;
    console.warn(`[VERCEL] Git deployment error: ${gitErr.message}`);
  }

  // 2. Direct File Deployment Fallback: If Git source fails or files are provided directly
  if (files && files.length > 0) {
    console.log(`[VERCEL] Attempting direct file upload deployment for ${files.length} files...`);

    const validFiles = files
      .map((f) => {
        const cleanPath = f.relativePath.replace(/^[\\\/]+/, '');
        if (!cleanPath) return null;
        return {
          file: cleanPath,
          data: f.buffer.toString('base64'),
          encoding: 'base64',
        };
      })
      .filter(Boolean);

    const filePayload = {
      name: projectName,
      project: projectName,
      target: 'production',
      projectSettings,
      files: validFiles,
    };

    const directRes = await fetch(`${VERCEL_API}/v13/deployments${deploymentQuery}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(filePayload),
    });

    if (directRes.ok) {
      const directData = await directRes.json();
      const canonicalUrl = getCanonicalProjectUrl(projectName, undefined, directData.alias);
      return {
        deploymentId: directData.id,
        url: canonicalUrl,
        readyState: directData.readyState || 'BUILDING',
      };
    } else {
      const directErr = await directRes.json();
      const directErrMsg = directErr.error?.message || directRes.statusText;
      throw new Error(`Vercel deployment failed: ${directErrMsg} (Git fallback: ${lastErrorMessage})`);
    }
  }

  throw new Error(`Vercel deployment failed: ${lastErrorMessage || 'Unknown error'}`);
}

/**
 * Polls Vercel deployment status until READY, ERROR, CANCELED, or timeout
 */
export async function pollVercelDeployment(
  deploymentId: string,
  projectName?: string,
  onProgress?: (state: string) => Promise<void>
): Promise<{
  status: 'READY' | 'ERROR' | 'CANCELED' | 'TIMEOUT';
  liveUrl?: string;
  error?: string;
}> {
  const headers = getHeaders();
  const teamQuery = getQueryString();
  const startTime = Date.now();
  const timeout = CONFIG.DEPLOYMENT_TIMEOUT_MS;

  let lastState = '';

  while (Date.now() - startTime < timeout) {
    try {
      const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        console.warn(`Failed to poll Vercel deployment ${deploymentId}: ${res.statusText}`);
      } else {
        const data = await res.json();
        const state = data.readyState; // INITIALIZING, ANALYZING, BUILDING, READY, ERROR, CANCELED

        if (state !== lastState) {
          lastState = state;
          if (onProgress) {
            await onProgress(state);
          }
        }

        if (state === 'READY') {
          const resolvedName = projectName || data.name || (data.url ? data.url.split('-')[0] : '');
          const liveUrl = getCanonicalProjectUrl(resolvedName, undefined, data.alias);
          return { status: 'READY', liveUrl };
        }

        if (state === 'ERROR') {
          return {
            status: 'ERROR',
            error: data.errorMessage || 'Vercel build encountered an error.',
          };
        }

        if (state === 'CANCELED') {
          return { status: 'CANCELED', error: 'Deployment was canceled.' };
        }
      }
    } catch (e) {
      console.warn('Vercel polling network warning:', e);
    }

    // Wait 4 seconds between poll cycles
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  return { status: 'TIMEOUT', error: 'Build monitoring timed out after 5 minutes.' };
}

/**
 * Triggers a redeploy for an existing project
 */
export async function redeployVercelProject(
  projectName: string,
  githubRepo: string,
  branch = 'main',
  previousDeploymentId?: string
): Promise<{
  deploymentId: string;
  url: string;
}> {
  // 1. Try fast native Vercel redeployment endpoint if previous deployment ID is available
  if (previousDeploymentId) {
    const headers = getHeaders();
    const teamId = CONFIG.VERCEL_TEAM_ID;
    const queryParams = new URLSearchParams({
      deploymentId: previousDeploymentId,
      target: 'production',
      skipAutoDetectionConfirmation: '1',
    });
    if (teamId) {
      queryParams.set('teamId', teamId);
    }

    try {
      const res = await fetch(`${VERCEL_API}/v13/deployments?${queryParams.toString()}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: projectName,
          project: projectName,
          target: 'production',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          deploymentId: data.id,
          url: getCanonicalProjectUrl(projectName, undefined, data.alias),
        };
      } else {
        const err = await res.json();
        console.warn(`[VERCEL] Native redeploy attempt note: ${err.error?.message || res.statusText}`);
      }
    } catch (e) {
      console.warn(`[VERCEL] Native redeploy error:`, e);
    }
  }

  // 2. Try Git Source deployment via createVercelDeployment
  const repoId = await getGitHubRepoId(githubRepo);
  try {
    const result = await createVercelDeployment(projectName, githubRepo, branch, repoId || undefined);
    return {
      deploymentId: result.deploymentId,
      url: result.url,
    };
  } catch (gitDeployErr: any) {
    console.warn(`[VERCEL] Git source redeployment note: ${gitDeployErr?.message}. Proceeding to GitHub Archive Sync...`);
  }

  // 3. Robust Fallback: Download latest code from GitHub, extract in memory, and deploy direct files
  try {
    const zipBuffer = await downloadGitHubRepoZip(githubRepo, branch);
    const { analysis, files } = await processAndAnalyzeZip(zipBuffer);

    const directResult = await createVercelDeployment(
      projectName,
      githubRepo,
      branch,
      repoId || undefined,
      files,
      undefined,
      analysis
    );

    return {
      deploymentId: directResult.deploymentId,
      url: directResult.url,
    };
  } catch (archiveErr: any) {
    console.error(`[VERCEL] GitHub archive sync redeploy failed:`, archiveErr);
    throw new Error(`Redeployment failed: ${archiveErr?.message || 'Could not fetch or deploy project files.'}`);
  }
}

/**
 * Adds a custom domain to a Vercel project
 */
export async function addDomainToVercel(
  projectName: string,
  domain: string
): Promise<{
  success: boolean;
  apexName?: string;
  verification?: any;
  error?: string;
}> {
  const headers = getHeaders();
  const teamQuery = getQueryString();

  const res = await fetch(`${VERCEL_API}/v9/projects/${projectName}/domains${teamQuery}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: domain }),
  });

  if (!res.ok) {
    const err = await res.json();
    return {
      success: false,
      error: err.error?.message || 'Failed to add custom domain to Vercel.',
    };
  }

  const data = await res.json();
  return {
    success: true,
    apexName: data.apexName,
    verification: data.verification,
  };
}

/**
 * Deletes a Vercel project
 */
export async function deleteVercelProject(projectName: string): Promise<boolean> {
  const headers = getHeaders();
  const teamQuery = getQueryString();

  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${projectName}${teamQuery}`, {
      method: 'DELETE',
      headers,
    });
    return res.status === 200 || res.status === 204 || res.status === 404;
  } catch (e) {
    console.error(`Failed to delete Vercel project ${projectName}:`, e);
    return false;
  }
}
