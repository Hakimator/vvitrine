/**
 * Design token contract shared by every theme (ADR-010). Themes declare default values; users
 * override them through the theme options. The kernel is the only place that writes the CSS
 * custom properties, so a theme never has to know about user overrides.
 */
export const TOKEN_NAMES = [
  'colorPrimary',
  'colorAccent',
  'colorText',
  'colorMuted',
  'colorBackground',
  'colorSurface',
  'colorBorder',
  'colorOnPrimary',
  'fontBody',
  'fontHeading',
  'radius',
  'contentWidth',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type TokenValues = Partial<Record<TokenName, string>>;

export interface ThemeTokens {
  readonly light: TokenValues;
  readonly dark?: TokenValues;
}

/** `colorPrimary` -> `--vv-color-primary` */
export const cssVariable = (name: TokenName): string => `--vv-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const SAFE_VALUE = /^[^;{}<>]*$/;

function declarations(values: TokenValues): string {
  return TOKEN_NAMES.filter((name) => values[name] !== undefined)
    .map((name) => {
      const value = values[name]!;
      if (!SAFE_VALUE.test(value)) throw new Error(`Invalid value for design token "${name}": ${value}`);
      return `${cssVariable(name)}:${value}`;
    })
    .join(';');
}

export function mergeTokens(defaults: ThemeTokens, overrides?: Partial<ThemeTokens>): ThemeTokens {
  const dark = defaults.dark || overrides?.dark ? { ...defaults.dark, ...overrides?.dark } : undefined;
  return { light: { ...defaults.light, ...overrides?.light }, ...(dark ? { dark } : {}) };
}

/** Build the `:root` CSS for a set of tokens, with an optional dark variant. */
export function tokensToCss(tokens: ThemeTokens): string {
  const light = `:root{${declarations(tokens.light)}}`;
  const dark = tokens.dark ? `@media (prefers-color-scheme: dark){:root{${declarations(tokens.dark)}}}` : '';
  return light + dark;
}
