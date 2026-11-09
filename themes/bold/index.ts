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
import Privacy from './components/Privacy.astro';
import Contact from './components/Contact.astro';
import ContactSent from './components/ContactSent.astro';
import Figures from './components/Figures.astro';
import Quotes from './components/Quotes.astro';

const defaults: ThemeTokens = {
  light: {
    colorPrimary: '#6d28d9',
    colorAccent: '#be185d',
    colorText: '#0f0f14',
    colorMuted: '#4a4a5a',
    colorBackground: '#ffffff',
    colorSurface: '#f4f1fb',
    colorBorder: '#e4def3',
    colorOnPrimary: '#ffffff',
    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontHeading: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    radius: '1rem',
    contentWidth: '64rem',
  },
  dark: {
    colorPrimary: '#c4b5fd',
    colorAccent: '#f9a8d4',
    colorText: '#f5f5fa',
    colorMuted: '#b8b8c8',
    colorBackground: '#0b0a10',
    colorSurface: '#1c1a26',
    colorBorder: '#2e2a3d',
    colorOnPrimary: '#0b0a10',
  },
};

export interface BoldOptions {
  /** Override any design token, e.g. { light: { colorPrimary: '#0b5' } }. */
  readonly tokens?: Partial<ThemeTokens>;
  /** Add a light/dark switch to the header, remembered per visitor (adds a 1 KB inline script). Default false. */
  readonly colorSchemeToggle?: boolean;
}

/** Modern theme with strong colours and large type. */
export default function bold(options: BoldOptions = {}): ThemePlugin {
  return {
    name: '@vvitrine/theme-bold',
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
      contact: Contact,
      privacy: Privacy,
      'contact:sent': ContactSent,
    },
    fallback: Generic,
    tokens: mergeTokens(defaults, options.tokens),
    ...(options.colorSchemeToggle ? { colorSchemeToggle: true } : {}),
    messages: {
      fr: { 'theme.builtWith': 'Site réalisé avec {name}', 'theme.footerNav': 'Liens du pied de page' },
      en: { 'theme.builtWith': 'Built with {name}', 'theme.footerNav': 'Footer links' },
    },
  };
}
