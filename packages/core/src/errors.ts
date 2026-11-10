/**
 * Typed, actionable errors. Every message says what is wrong, where, and how to fix it.
 * Messages are written for the person running the build (developer-facing, English).
 */
export class VVitrineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface ContentIssue {
  /** File the value came from, when known. */
  readonly file?: string;
  /** Path inside the content, e.g. `work[0].startDate`. */
  readonly path: string;
  readonly message: string;
  readonly hint?: string;
}

export class InvalidContentError extends VVitrineError {
  readonly locale: string;
  readonly issues: readonly ContentIssue[];

  constructor(locale: string, issues: readonly ContentIssue[]) {
    const lines = issues.map(
      (i) => `  - ${i.file ? `${i.file} > ` : ''}${i.path}: ${i.message}${i.hint ? `\n      hint: ${i.hint}` : ''}`,
    );
    super(
      [
        `Invalid content for locale "${locale}" (${issues.length} problem${issues.length > 1 ? 's' : ''}):`,
        ...lines,
      ].join('\n'),
    );
    this.locale = locale;
    this.issues = issues;
  }
}

export class InvalidConfigError extends VVitrineError {
  constructor(issues: readonly ContentIssue[], where = 'vvitrine.config') {
    super([`Invalid ${where}:`, ...issues.map((i) => `  - ${i.path}: ${i.message}`)].join('\n'));
  }
}

export class InvalidPluginOptionsError extends VVitrineError {
  constructor(where: string, issues: readonly ContentIssue[]) {
    super([`Invalid options for ${where}:`, ...issues.map((i) => `  - ${i.path}: ${i.message}`)].join('\n'));
  }
}

export class UnknownSectionError extends VVitrineError {
  constructor(id: string, page: string, available: readonly string[]) {
    super(
      `Unknown section "${id}" on page "${page}". Available sections: ${available.join(', ') || '(none)'}.\n` +
        `  hint: add a section plugin that provides "${id}" to "plugins", or fix the id.`,
    );
  }
}

export class DuplicatePluginError extends VVitrineError {
  constructor(name: string) {
    super(`Plugin "${name}" is registered twice. Each plugin name must be unique.`);
  }
}

export class DuplicateSectionError extends VVitrineError {
  constructor(id: string, first: string, second: string) {
    super(`Section id "${id}" is provided by both "${first}" and "${second}". Section ids must be unique.`);
  }
}

export class ContentOwnershipError extends VVitrineError {
  constructor(key: string, first: string, second: string) {
    super(
      `Content key "${key}" is owned by both "${first}" and "${second}". A key can have only one owner.\n` +
        `  hint: the second plugin should declare it in "reads" instead of "content".`,
    );
  }
}

export class IncompatiblePluginError extends VVitrineError {
  constructor(name: string, got: unknown, supported: readonly number[]) {
    super(
      `Plugin "${name}" declares apiVersion ${String(got)}, but this kernel supports ${supported.join(', ')}.\n` +
        `  hint: upgrade the plugin or VVitrine so their versions match.`,
    );
  }
}

export class ThemeCountError extends VVitrineError {
  constructor(names: readonly string[]) {
    super(
      names.length === 0
        ? 'No theme plugin registered. Add exactly one theme to "plugins", e.g. corporate().'
        : `Exactly one theme must be registered, found ${names.length}: ${names.join(', ')}.\n` +
            '  hint: importing several themes also ships their CSS. Keep one, or use one config file per theme.',
    );
  }
}

export class MissingCapabilityError extends VVitrineError {
  constructor(plugin: string, capability: string, providers: readonly string[]) {
    super(
      `Plugin "${plugin}" requires the capability "${capability}", but no registered plugin provides it.` +
        (providers.length ? '' : `\n  hint: add a plugin that declares provides: ['${capability}'].`),
    );
  }
}

export class MissingRendererError extends VVitrineError {
  constructor(componentKey: string, themeName: string) {
    super(
      `Theme "${themeName}" has no component "${componentKey}", no fallback, and the plugin ships no default component.\n` +
        '  hint: add the component to the theme, or give the section plugin a default component.',
    );
  }
}

export class RouteConflictError extends VVitrineError {
  constructor(path: string) {
    super(`Two pages resolve to the same path "${path}". Each page path must be unique per locale.`);
  }
}
