import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-*/**',
      '**/.astro/**',
      '**/node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-strict'],
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Plugin contracts use `any` on purpose for heterogeneous plugin lists; keep it visible but allowed.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      eqeqeq: 'error',
    },
  },
  {
    files: ['**/test/**', 'e2e/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
