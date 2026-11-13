import { resolveConfig, type LayoutFile, type VVitrineConfig } from './config.ts';
import { formatPath, toIssues } from './content/zod-issues.ts';
import { InvalidConfigError, type ContentIssue } from './errors.ts';
import type { PluginRegistry } from './registry.ts';

const issue = (at: readonly (string | number)[], message: string, file?: string): ContentIssue => ({
  path: formatPath(at),
  at,
  message,
  ...(file ? { file } : {}),
});

/**
 * The problems a build would find in a layout (the layout file's data, US-135): the file's schema and the settings it
 * shares with vvitrine.config.ts, then each page (one address per page) and each section placed on it (installed,
 * options valid). The theme cannot change here: `layout` names the one that was loaded, or none.
 */
export function layoutIssues(
  config: VVitrineConfig,
  registry: PluginRegistry,
  file: LayoutFile,
  data: Readonly<Record<string, unknown>>,
): ContentIssue[] {
  let pages;
  try {
    pages = resolveConfig(config, { ...file, data }).pages;
  } catch (error) {
    if (error instanceof InvalidConfigError) return [...error.issues];
    throw error;
  }
  if (data.pages === undefined || !pages) return [];
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  pages.forEach((page, p) => {
    if (seen.has(page.path)) {
      issues.push(issue(['pages', p, 'path'], `another page has the address ${page.path}`, file.origin));
    }
    seen.add(page.path);
    page.sections.forEach((ref, s) => {
      const at = ['pages', p, 'sections', s];
      const { id, options } = typeof ref === 'string' ? { id: ref, options: undefined } : ref;
      const section = registry.section(id);
      if (!section) {
        const installed = registry.sectionIds().join(', ');
        issues.push(issue(at, `no installed section is "${id}" (installed: ${installed})`, file.origin));
        return;
      }
      const parsed = section.optionsSchema?.safeParse(options ?? {});
      if (parsed && !parsed.success) issues.push(...toIssues(parsed.error, [...at, 'options'], file.origin));
    });
  });
  return issues;
}
