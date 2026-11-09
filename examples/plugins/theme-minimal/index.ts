/**
 * Example theme plugin: the smallest complete theme. One layout, one component per shared view kind, a fallback for
 * everything else, and design tokens. Sections with a view of their own (hero, projects...) use the fallback, which
 * shows their title and items: enough to read the page, a starting point to style.
 */
import { mergeTokens, type ThemePlugin, type ThemeTokens } from '@vvitrine/core';
import Layout from './components/Layout.astro';
import Entries from './components/Entries.astro';
import Tags from './components/Tags.astro';
import Fallback from './components/Fallback.astro';

/** Every colour pair keeps at least 4.5:1 contrast (WCAG 1.4.3), in light and dark. */
export const defaults: ThemeTokens = {
  light: {
    colorPrimary: '#0b5394',
    colorAccent: '#a6460a',
    colorText: '#1a1a1a',
    colorMuted: '#555555',
    colorBackground: '#ffffff',
    colorSurface: '#f4f4f4',
    colorBorder: '#d0d0d0',
    colorOnPrimary: '#ffffff',
    fontBody: 'system-ui, sans-serif',
    fontHeading: 'system-ui, sans-serif',
    radius: '6px',
    contentWidth: '42rem',
  },
  dark: {
    colorPrimary: '#8ab8f0',
    colorAccent: '#f0a868',
    colorText: '#ececec',
    colorMuted: '#b0b0b0',
    colorBackground: '#161616',
    colorSurface: '#222222',
    colorBorder: '#3a3a3a',
    colorOnPrimary: '#161616',
  },
};

export interface MinimalOptions {
  /** Override any design token, e.g. { light: { colorPrimary: '#0b5' } }. */
  readonly tokens?: Partial<ThemeTokens>;
}

export default function minimal(options: MinimalOptions = {}): ThemePlugin {
  return {
    name: 'example-theme-minimal',
    kind: 'theme',
    apiVersion: 1,
    layout: Layout,
    components: { 'kind:entries': Entries, 'kind:tags': Tags },
    fallback: Fallback,
    tokens: mergeTokens(defaults, options.tokens),
  };
}
