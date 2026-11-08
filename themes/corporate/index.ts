import { mergeTokens, type ThemePlugin, type ThemeTokens } from '@vvitrine/core';
import Layout from './components/Layout.astro';
import Hero from './components/Hero.astro';
import Timeline from './components/Timeline.astro';
import Skills from './components/Skills.astro';
import Languages from './components/Languages.astro';
import Projects from './components/Projects.astro';
import ProjectDetail from './components/ProjectDetail.astro';
import Generic from './components/Generic.astro';
import Article from './components/Article.astro';
import Figures from './components/Figures.astro';
import Quotes from './components/Quotes.astro';

const defaults: ThemeTokens = {
  light: {
    colorPrimary: '#1f3a5f',
    colorAccent: '#8a5a00',
    colorText: '#1c2430',
    colorMuted: '#555f6d',
    colorBackground: '#ffffff',
    colorSurface: '#f5f7fa',
    colorBorder: '#d9dee5',
    colorOnPrimary: '#ffffff',
    fontBody: 'Georgia, "Times New Roman", serif',
    fontHeading: 'system-ui, "Segoe UI", Roboto, sans-serif',
    radius: '4px',
    contentWidth: '48rem',
  },
  dark: {
    colorPrimary: '#9cc0ea',
    colorAccent: '#e0b35c',
    colorText: '#e6e9ee',
    colorMuted: '#a7b0bc',
    colorBackground: '#12161c',
    colorSurface: '#1a2029',
    colorBorder: '#2c3440',
    colorOnPrimary: '#12161c',
  },
};

export interface CorporateOptions {
  /** Override any design token, e.g. { light: { colorPrimary: '#0b5' } }. */
  readonly tokens?: Partial<ThemeTokens>;
}

/** Classic, recruiter-friendly theme (default). */
export default function corporate(options: CorporateOptions = {}): ThemePlugin {
  return {
    name: '@vvitrine/theme-corporate',
    kind: 'theme',
    apiVersion: 1,
    layout: Layout,
    components: {
      hero: Hero,
      // Shared view kinds: any section that returns these shapes is drawn by these components.
      'kind:entries': Timeline,
      'kind:tags': Skills,
      'kind:quotes': Quotes,
      'kind:figures': Figures,
      languages: Languages,
      projects: Projects,
      'projects:detail': ProjectDetail,
      'blog:post': Article,
    },
    fallback: Generic,
    tokens: mergeTokens(defaults, options.tokens),
    messages: {
      fr: { 'theme.builtWith': 'Site réalisé avec {name}' },
      en: { 'theme.builtWith': 'Built with {name}' },
    },
  };
}
