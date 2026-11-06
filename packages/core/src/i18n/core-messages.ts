import type { Messages } from './translator.ts';

/** Strings owned by the core and shared by every theme. Plugins and users can override them. */
export const coreMessages: Messages = {
  fr: {
    'common.present': 'aujourd’hui',
    'common.skipToContent': 'Aller au contenu',
    'common.language': 'Langue',
    'common.backHome': 'Retour à l’accueil',
    'locale.fr': 'Français',
    'locale.en': 'English',
  },
  en: {
    'common.present': 'present',
    'common.skipToContent': 'Skip to content',
    'common.language': 'Language',
    'common.backHome': 'Back to home',
    'locale.fr': 'Français',
    'locale.en': 'English',
  },
};
