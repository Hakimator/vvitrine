import { createKernel, VVitrineError, type BuiltSite, type VVitrineConfig } from '@vvitrine/core';
import layout from 'virtual:vvitrine/layout';
import { base, dev, root, siteUrl } from 'virtual:vvitrine/runtime';
import { diskFiles } from './files.ts';

let cached: Promise<BuiltSite> | undefined;

/**
 * Build the site model once per production build (shared by every route), or on every request
 * in dev so that content edits show up immediately.
 */
export function getSite(config: VVitrineConfig): Promise<BuiltSite> {
  if (dev) return build(config);
  cached ??= build(config);
  return cached;
}

async function build(config: VVitrineConfig): Promise<BuiltSite> {
  try {
    return await createKernel(config, {
      root,
      base,
      files: diskFiles(root),
      ...(siteUrl ? { siteUrl } : {}),
      ...(layout ? { layout } : {}),
    }).build();
  } catch (error) {
    if (error instanceof VVitrineError) {
      // Our messages are self-explanatory: hide the internal stack trace (spike finding F2).
      error.stack = `${error.name}: ${error.message}`;
    }
    throw error;
  }
}

/** '/' -> undefined, '/fr/' -> 'fr', '/en/projects/x' -> 'en/projects/x' */
export function toParam(path: string): string | undefined {
  const trimmed = path.replace(/^\/|\/$/g, '');
  return trimmed === '' ? undefined : trimmed;
}

const TYPES: Record<string, string> = {
  xml: 'application/xml',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json',
  pdf: 'application/pdf',
  webp: 'image/webp',
  html: 'text/html; charset=utf-8',
};

export const contentType = (path: string): string => TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream';
