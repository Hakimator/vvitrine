/**
 * Architecture rules (NFR-07, ADR-007). Run with `pnpm boundaries`.
 * The dependency rule of Clean Architecture: the kernel depends on nothing; plugins depend on
 * the kernel's public API only; nothing depends on the user's site.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-is-framework-free',
      comment: '@vvitrine/core must not depend on Astro, UI frameworks, Node file APIs or other VVitrine packages.',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { path: ['node_modules/astro', '^packages/(?!core/)', '^themes/', '^site/', 'node:fs', '^fs$'] },
    },
    {
      name: 'plugins-use-public-api-only',
      comment: 'Plugins and themes import @vvitrine/core, never its internal files.',
      severity: 'error',
      from: { path: '^(packages/(?!core/)|themes/|site/)' },
      to: { path: '^packages/core/src/(?!index\\.ts$|testing\\.ts$)' },
    },
    {
      name: 'no-dependency-on-user-site',
      comment: 'Framework code must never import from the user site.',
      severity: 'error',
      from: { path: '^(packages|themes|examples)/' },
      to: { path: '^site/' },
    },
    {
      name: 'plugins-are-independent',
      comment: 'A plugin package must not import another plugin package (themes may import section view types).',
      severity: 'error',
      from: {
        path: '^packages/(sections|seo|source-yaml|source-markdown|service-seo|images|contact|consent|analytics|resume-pdf|og-image)/',
      },
      to: {
        path: '^(packages/(sections|seo|source-yaml|source-markdown|service-seo|images|contact|consent|analytics|resume-pdf|og-image|astro)/|themes/)',
        pathNot: '^packages/$1',
      },
    },
    {
      name: 'examples-use-public-api-only',
      comment: 'Example plugins show what any author can do: they import @vvitrine/core and nothing else of VVitrine.',
      severity: 'error',
      from: { path: '^examples/' },
      to: { path: '^(packages/(?!core/src/(index|testing)\\.ts$)|themes/|site/)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/dist', '/\\.astro/', '/test/', 'e2e/'] },
    preserveSymlinks: false,
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.astro'],
    },
  },
};
