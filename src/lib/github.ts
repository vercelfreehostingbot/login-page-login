// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — GITHUB REST API CLIENT
// =================================================================

import { CONFIG } from './config';
import { ExtractedFile } from './zip';

const GITHUB_API = 'https://api.github.com';

function getHeaders() {
  const token = CONFIG.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN environment variable is missing.');

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Vercel-Free-Hosting-Telegram-Bot',
  };
}

/**
 * Creates or retrieves a GitHub repository under GITHUB_USERNAME
 */
export async function createGitHubRepository(
  repoName: string,
  isPrivate = false
): Promise<{
  id: number;
  owner: string;
  repo: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
}> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) throw new Error('GITHUB_USERNAME environment variable is missing.');

  const headers = getHeaders();

  // Step 1: Check if repo already exists
  const checkRes = await fetch(`${GITHUB_API}/repos/${username}/${repoName}`, {
    method: 'GET',
    headers,
  });

  if (checkRes.status === 200) {
    const existing = await checkRes.json();
    return {
      id: existing.id,
      owner: username,
      repo: repoName,
      html_url: existing.html_url,
      clone_url: existing.clone_url,
      default_branch: existing.default_branch || 'main',
    };
  }

  // Step 2: Create new repo with auto_init to ensure non-empty initial state
  const createRes = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: repoName,
      description: `Deployed via @Vercel_Free_Hosting_Bot on Telegram`,
      private: isPrivate,
      auto_init: true, // Initializes with main branch and README
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`GitHub repo creation failed: ${err.message || createRes.statusText}`);
  }

  const data = await createRes.json();

  // Ensure default branch is main
  try {
    await fetch(`${GITHUB_API}/repos/${username}/${repoName}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_branch: 'main' }),
    });
  } catch (e) {
    // Non-fatal
  }

  return {
    id: data.id,
    owner: username,
    repo: repoName,
    html_url: data.html_url,
    clone_url: data.clone_url,
    default_branch: data.default_branch || 'main',
  };
}

/**
 * Retrieves numerical GitHub repository ID by repo name
 */
export async function getGitHubRepoId(repoName: string): Promise<number | null> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) return null;
  const headers = getHeaders();

  try {
    const res = await fetch(`${GITHUB_API}/repos/${username}/${repoName}`, {
      method: 'GET',
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      return data.id || null;
    }
  } catch (error) {
    console.warn(`Could not get GitHub repo ID for ${repoName}:`, error);
  }
  return null;
}

/**
 * Downloads GitHub repository archive as a Buffer
 */
export async function downloadGitHubRepoZip(repoName: string, branch = 'main'): Promise<Buffer> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) throw new Error('GITHUB_USERNAME is missing');
  const headers = getHeaders();

  // Try specific branch first, then main, then master
  const branches = [branch, 'main', 'master'];
  for (const b of branches) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${username}/${repoName}/zipball/${b}`, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch (e) {
      console.warn(`[GITHUB] Download zipball for branch ${b} failed:`, e);
    }
  }

  // Fallback: download default branch
  const defaultRes = await fetch(`${GITHUB_API}/repos/${username}/${repoName}/zipball`, {
    method: 'GET',
    headers,
    redirect: 'follow',
  });

  if (!defaultRes.ok) {
    throw new Error(`Failed to download repository files from GitHub for ${repoName}`);
  }

  const arrayBuf = await defaultRes.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Uploads project files to GitHub using Git Tree, Blobs, and Commit API.
 * Ensures the 'main' branch exists, contains all project files, and is the default branch.
 */
export async function uploadFilesToGitHub(
  repoName: string,
  files: ExtractedFile[],
  commitMessage = 'Deploy project from Telegram Bot'
): Promise<{ commit_sha: string; tree_sha: string; branch: string }> {
  const username = CONFIG.GITHUB_USERNAME;
  const headers = getHeaders();
  const repoUrl = `${GITHUB_API}/repos/${username}/${repoName}`;

  if (!files || files.length === 0) {
    throw new Error('Cannot upload to GitHub: No project files provided.');
  }

  // 1. Get reference to target branch (always prefer 'main')
  const targetBranch = 'main';
  let latestCommitSha = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const refRes = await fetch(`${repoUrl}/git/refs/heads/${targetBranch}`, { headers });
    if (refRes.ok) {
      const refData = await refRes.json();
      latestCommitSha = refData.object?.sha || '';
      if (latestCommitSha) break;
    } else {
      // Check if master branch exists
      const masterRes = await fetch(`${repoUrl}/git/refs/heads/master`, { headers });
      if (masterRes.ok) {
        const masterData = await masterRes.json();
        latestCommitSha = masterData.object?.sha || '';
        if (latestCommitSha) break;
      }
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // 2. Create blobs for files in batches
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const cleanPath = file.relativePath.replace(/^[\\\/]+/, '');
          if (!cleanPath) return;

          const contentEncoding = file.isText ? 'utf-8' : 'base64';
          const content = file.isText
            ? file.content !== undefined
              ? file.content
              : file.buffer.toString('utf-8')
            : file.buffer.toString('base64');

          const blobRes = await fetch(`${repoUrl}/git/blobs`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              encoding: contentEncoding,
            }),
          });

          if (!blobRes.ok) {
            console.warn(`Failed to create blob for ${cleanPath}: ${blobRes.statusText}`);
            return;
          }

          const blobData = await blobRes.json();
          treeItems.push({
            path: cleanPath,
            mode: '100644', // standard file
            type: 'blob',
            sha: blobData.sha,
          });
        } catch (e) {
          console.warn(`Error uploading file blob for ${file.relativePath}:`, e);
        }
      })
    );
  }

  if (treeItems.length === 0) {
    throw new Error('No files could be processed for GitHub upload.');
  }

  // 3. Create tree
  const treePayload: any = {
    tree: treeItems,
  };
  if (latestCommitSha) {
    treePayload.base_tree = latestCommitSha;
  }

  const treeRes = await fetch(`${repoUrl}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(treePayload),
  });

  if (!treeRes.ok) {
    const err = await treeRes.json();
    throw new Error(`Failed to create GitHub tree: ${err.message || treeRes.statusText}`);
  }
  const treeData = await treeRes.json();

  // 4. Create commit
  const commitPayload: any = {
    message: commitMessage,
    tree: treeData.sha,
  };
  if (latestCommitSha) {
    commitPayload.parents = [latestCommitSha];
  }

  const commitRes = await fetch(`${repoUrl}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(commitPayload),
  });

  if (!commitRes.ok) {
    const err = await commitRes.json();
    throw new Error(`Failed to create GitHub commit: ${err.message || commitRes.statusText}`);
  }
  const commitData = await commitRes.json();

  // 5. Update or create branch reference for 'main'
  const updateRefRes = await fetch(`${repoUrl}/git/refs/heads/${targetBranch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: commitData.sha,
      force: true,
    }),
  });

  if (!updateRefRes.ok) {
    // If refs/heads/main doesn't exist, create it
    const createRefRes = await fetch(`${repoUrl}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${targetBranch}`,
        sha: commitData.sha,
      }),
    });

    if (!createRefRes.ok) {
      console.warn(`Could not create refs/heads/${targetBranch}, trying force update:`, await createRefRes.text());
    }
  }

  // 6. Ensure default branch is set to 'main'
  try {
    await fetch(repoUrl, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_branch: targetBranch }),
    });
  } catch (e) {
    // Ignore if already default
  }

  return {
    commit_sha: commitData.sha,
    tree_sha: treeData.sha,
    branch: targetBranch,
  };
}



export interface GitHubRepositoryFile {
  path: string;
  type: 'file' | 'dir' | string;
  sha?: string;
  size?: number;
}

/** Lists source files in a repository tree (recursive). */
export async function listGitHubRepositoryFiles(
  repoName: string,
  branch = 'main'
): Promise<GitHubRepositoryFile[]> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) throw new Error('GITHUB_USERNAME is missing');
  const headers = getHeaders();
  const repoUrl = `${GITHUB_API}/repos/${username}/${repoName}`;

  let refRes = await fetch(`${repoUrl}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
  if (!refRes.ok && branch !== 'main') {
    refRes = await fetch(`${repoUrl}/git/ref/heads/main`, { headers });
  }
  if (!refRes.ok) throw new Error(`Could not read GitHub branch ${branch}.`);
  const refData = await refRes.json();
  const treeSha = refData.object?.sha;
  if (!treeSha) throw new Error('GitHub branch tree could not be resolved.');

  const treeRes = await fetch(`${repoUrl}/git/trees/${treeSha}?recursive=1`, { headers });
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    throw new Error(`Could not list GitHub files: ${err.message || treeRes.statusText}`);
  }
  const tree = await treeRes.json();
  return (tree.tree || [])
    .filter((item: any) => item.type === 'blob')
    .map((item: any) => ({ path: item.path, type: 'file', sha: item.sha, size: item.size }))
    .sort((a: GitHubRepositoryFile, b: GitHubRepositoryFile) => a.path.localeCompare(b.path));
}

/** Reads a text file directly from the actual GitHub repository. */
export async function getGitHubFileContent(
  repoName: string,
  filePath: string,
  branch = 'main'
): Promise<{ content: string; sha: string; encoding: string }> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) throw new Error('GITHUB_USERNAME is missing');
  const cleanPath = filePath.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.includes('..')) throw new Error('Invalid repository file path.');
  const headers = getHeaders();
  const url = `${GITHUB_API}/repos/${username}/${repoName}/contents/${cleanPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not read ${cleanPath}: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) throw new Error('Selected path is a directory.');
  if (data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new Error('GitHub returned an unsupported file encoding.');
  }
  return { content: Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8'), sha: data.sha, encoding: data.encoding };
}

/** Replaces the actual file content in GitHub and creates a commit. */
export async function updateGitHubFileContent(
  repoName: string,
  filePath: string,
  content: string,
  sha: string,
  branch = 'main',
  commitMessage = 'Edit project file from Telegram Bot'
): Promise<{ commit_sha: string; content_sha: string }> {
  const username = CONFIG.GITHUB_USERNAME;
  if (!username) throw new Error('GITHUB_USERNAME is missing');
  const cleanPath = filePath.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.includes('..')) throw new Error('Invalid repository file path.');
  if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new Error('File is too large for Telegram code editing (max 1 MB).');
  const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
  const url = `${GITHUB_API}/repos/${username}/${repoName}/contents/${cleanPath.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: commitMessage, content: Buffer.from(content, 'utf8').toString('base64'), sha, branch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub file update failed: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  return { commit_sha: data.commit?.sha || '', content_sha: data.content?.sha || '' };
}

/**
 * Deletes a GitHub repository
 */
export async function deleteGitHubRepository(repoName: string): Promise<boolean> {
  const username = CONFIG.GITHUB_USERNAME;
  const headers = getHeaders();

  try {
    const res = await fetch(`${GITHUB_API}/repos/${username}/${repoName}`, {
      method: 'DELETE',
      headers,
    });
    return res.status === 204 || res.status === 404;
  } catch (error) {
    console.error(`Failed to delete GitHub repository ${repoName}:`, error);
    return false;
  }
}

