/**
 * Message catalogs. Every plugin ships its own strings for each locale; the user can override any
 * key from the config. Resolution order (last wins): core < plugins (registration order) < user.
 */
export type Locale = string;
export type MessageCatalog = Readonly<Record<string, string>>;
export type Messages = Readonly<Record<Locale, MessageCatalog>>;

export type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

export interface TranslatorOptions {
  readonly defaultLocale: Locale;
  readonly onMissing?: (key: string, locale: Locale) => void;
}

export class Translator {
  private readonly catalogs = new Map<Locale, Record<string, string>>();
  private readonly reported = new Set<string>();

  private readonly options: TranslatorOptions;

  constructor(options: TranslatorOptions) {
    this.options = options;
  }

  /** Merge a catalog; later calls override earlier keys. */
  add(messages: Messages | undefined): void {
    if (!messages) return;
    for (const [locale, catalog] of Object.entries(messages)) {
      this.catalogs.set(locale, { ...this.catalogs.get(locale), ...catalog });
    }
  }

  forLocale(locale: Locale): Translate {
    return (key, params) => {
      const message =
        this.catalogs.get(locale)?.[key] ??
        this.catalogs.get(this.options.defaultLocale)?.[key] ??
        this.missing(key, locale);
      return params ? interpolate(message, params) : message;
    };
  }

  private missing(key: string, locale: Locale): string {
    const id = `${locale}:${key}`;
    if (!this.reported.has(id)) {
      this.reported.add(id);
      this.options.onMissing?.(key, locale);
    }
    return key;
  }
}

function interpolate(message: string, params: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
