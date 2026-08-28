// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — SECURE ZIP EXTRACTION & PROJECT ANALYSIS
// =================================================================

import JSZip from 'jszip';
import path from 'path';
import { CONFIG } from './config';
import { ProjectAnalysis } from '../types';
import { isSensitiveFile } from './security';

export interface ExtractedFile {
  relativePath: string;
  buffer: Buffer;
  isText: boolean;
  content?: string;
}

export async function processAndAnalyzeZip(
  zipBuffer: Buffer
): Promise<{
  analysis: ProjectAnalysis;
  files: ExtractedFile[];
}> {
  if (!zipBuffer || zipBuffer.length === 0) {
    throw new Error('Empty ZIP file provided.');
  }

  // Size limit check
  const maxBytes = CONFIG.MAX_ZIP_SIZE_MB * 1024 * 1024;
  if (zipBuffer.length > maxBytes) {
    throw new Error(`ZIP size exceeds maximum allowed limit of ${CONFIG.MAX_ZIP_SIZE_MB}MB.`);
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(zipBuffer);
  } catch (e: any) {
    throw new Error('Invalid or corrupted ZIP archive.');
  }

  const fileEntries = Object.keys(loadedZip.files);
  if (fileEntries.length === 0) {
    throw new Error('The ZIP archive is empty.');
  }

  if (fileEntries.length > CONFIG.MAX_FILE_COUNT) {
    throw new Error(
      `ZIP contains too many files (${fileEntries.length}). Maximum limit is ${CONFIG.MAX_FILE_COUNT}.`
    );
  }

  // Step 1: Detect Project Root
  const detectedRoot = findProjectRoot(fileEntries);

  let totalUncompressedSize = 0;
  const maxUncompressed = CONFIG.MAX_EXTRACT_SIZE_MB * 1024 * 1024;
  const extractedFiles: ExtractedFile[] = [];

  for (const rawPath of fileEntries) {
    const entry = loadedZip.files[rawPath];
    if (entry.dir) continue;

    // Security Check: Zip Slip & Path Traversal Guard
    const normalized = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '');
    if (
      normalized.startsWith('..') ||
      path.isAbsolute(normalized) ||
      rawPath.includes('..') ||
      rawPath.startsWith('/') ||
      rawPath.startsWith('\\')
    ) {
      console.warn(`[SECURITY] Skipping potentially dangerous path: ${rawPath}`);
      continue;
    }

    // Strip detected root directory prefix
    let cleanRelativePath = normalized;
    if (detectedRoot && normalized.startsWith(detectedRoot)) {
      cleanRelativePath = normalized.slice(detectedRoot.length).replace(/^[\\\/]/, '');
    }

    if (!cleanRelativePath) continue;

    // Security: Filter out sensitive credentials or git metadata
    if (isSensitiveFile(cleanRelativePath)) {
      console.log(`[SECURITY] Excluded sensitive file from push: ${cleanRelativePath}`);
      continue;
    }

    const fileBuf = await entry.async('nodebuffer');
    totalUncompressedSize += fileBuf.length;

    if (totalUncompressedSize > maxUncompressed) {
      throw new Error(`Extracted size exceeds ${CONFIG.MAX_EXTRACT_SIZE_MB}MB limit.`);
    }

    // Check if file is text/code or binary
    const isText = isTextFile(cleanRelativePath);
    let textContent: string | undefined = undefined;
    if (isText && fileBuf.length < 5 * 1024 * 1024) {
      textContent = fileBuf.toString('utf-8');
    }

    extractedFiles.push({
      relativePath: cleanRelativePath,
      buffer: fileBuf,
      isText,
      content: textContent,
    });
  }

  // Step 2: Analyze Framework & Compatibility
  const analysis = analyzeProject(extractedFiles, detectedRoot, totalUncompressedSize);

  return {
    analysis,
    files: extractedFiles,
  };
}

/**
 * Automatically detects whether files are wrapped in a single root directory or located at the root
 */
function findProjectRoot(filePaths: string[]): string {
  const nonDirs = filePaths.filter((p) => !p.endsWith('/'));
  if (nonDirs.length === 0) return '';

  // If there is package.json or index.html at root, root is empty ''
  if (nonDirs.some((p) => p === 'package.json' || p === 'index.html' || p === 'vercel.json')) {
    return '';
  }

  // Check top-level folder names
  const topFolders = new Set<string>();
  for (const p of nonDirs) {
    const parts = p.split(/[\\\/]/);
    if (parts.length > 1) {
      topFolders.add(parts[0]);
    } else {
      // There's a file at root
      return '';
    }
  }

  // If all files share exactly one top-level directory
  if (topFolders.size === 1) {
    const rootFolder = Array.from(topFolders)[0];
    return rootFolder + '/';
  }

  return '';
}

/**
 * Analyzes extracted project files to detect framework, package manager, and build configuration
 */
function analyzeProject(
  files: ExtractedFile[],
  detectedRoot: string,
  totalSize: number
): ProjectAnalysis {
  let hasPackageJson = false;
  let hasVercelJson = false;
  let hasIndexHtml = false;
  let packageJsonContent: any = null;

  let framework = 'Static HTML / JS';
  let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none' = 'none';
  let buildCommand: string | undefined = undefined;
  let outputDirectory: string | undefined = undefined;

  for (const f of files) {
    if (f.relativePath === 'package.json') {
      hasPackageJson = true;
      try {
        packageJsonContent = JSON.parse(f.content || '{}');
      } catch (e) {
        // Corrupted package.json
      }
    }
    if (f.relativePath === 'vercel.json') hasVercelJson = true;
    if (f.relativePath === 'index.html') hasIndexHtml = true;
    if (f.relativePath === 'yarn.lock') packageManager = 'yarn';
    if (f.relativePath === 'pnpm-lock.yaml') packageManager = 'pnpm';
    if (f.relativePath === 'bun.lockb' || f.relativePath === 'bun.lock') packageManager = 'bun';
    if (f.relativePath === 'package-lock.json' && packageManager === 'none') packageManager = 'npm';
  }

  if (hasPackageJson && packageManager === 'none') {
    packageManager = 'npm';
  }

  // Inspect package.json dependencies and devDependencies
  if (packageJsonContent) {
    const deps = {
      ...(packageJsonContent.dependencies || {}),
      ...(packageJsonContent.devDependencies || {}),
    };

    if (deps['next']) {
      framework = 'Next.js';
    } else if (deps['@remix-run/react'] || deps['remix']) {
      framework = 'Remix';
    } else if (deps['@astrojs/core'] || deps['astro']) {
      framework = 'Astro';
    } else if (deps['@sveltejs/kit'] || deps['svelte']) {
      framework = 'SvelteKit';
    } else if (deps['nuxt'] || deps['nuxt3']) {
      framework = 'Nuxt.js';
    } else if (deps['@angular/core']) {
      framework = 'Angular';
    } else if (deps['vue']) {
      framework = 'Vue.js';
    } else if (deps['vite']) {
      framework = deps['react'] ? 'React (Vite)' : 'Vite Project';
    } else if (deps['react']) {
      framework = 'React';
    } else if (deps['express'] || deps['fastify'] || deps['koa']) {
      framework = 'Node.js Serverless';
    } else {
      framework = 'Node.js Web App';
    }

    if (packageJsonContent.scripts?.build) {
      buildCommand = packageJsonContent.scripts.build;
    }
  } else {
    // Check config files if no package.json
    if (files.some((f) => f.relativePath.startsWith('next.config.'))) {
      framework = 'Next.js';
    } else if (files.some((f) => f.relativePath.startsWith('vite.config.'))) {
      framework = 'Vite';
    } else if (files.some((f) => f.relativePath.startsWith('astro.config.'))) {
      framework = 'Astro';
    } else if (hasIndexHtml) {
      framework = 'Static HTML / Web';
    }
  }

  // Check Vercel Compatibility
  let compatible = true;
  let incompatibleReason: string | undefined = undefined;

  // Reject unsupported project structures (e.g. general non-web projects or heavy native binaries)
  const isCPlusPlusOrJava = files.some(
    (f) =>
      f.relativePath.endsWith('.cpp') ||
      f.relativePath.endsWith('.java') ||
      f.relativePath.endsWith('.exe') ||
      f.relativePath.endsWith('.apk')
  );

  if (isCPlusPlusOrJava && !hasPackageJson && !hasIndexHtml) {
    compatible = false;
    incompatibleReason =
      'Unsupported project type: Vercel is optimized for Web applications (HTML, Next.js, Vite, React, Node.js, Astro, Nuxt, Svelte).';
  }

  return {
    framework,
    packageManager,
    hasPackageJson,
    hasVercelJson,
    hasIndexHtml,
    buildCommand,
    outputDirectory,
    compatible,
    incompatibleReason,
    detectedRoot,
    fileCount: files.length,
    totalSize,
  };
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const textExtensions = new Set([
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '.json',
    '.md',
    '.mdx',
    '.txt',
    '.svg',
    '.xml',
    '.yaml',
    '.yml',
    '.env.example',
    '.gitignore',
    '.prettierrc',
    '.eslintrc',
  ]);
  return textExtensions.has(ext);
}
