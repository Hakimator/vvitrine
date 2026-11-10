import { z } from 'zod';

/**
 * Design token contract shared by every theme (ADR-010). Themes declare default values; users
 * override them through the theme options or the layout file (`theme.tokens`, for any theme). The kernel is the
 * only place that writes the CSS custom properties, so a theme never has to know about user overrides.
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

const TokenValue = z.string().regex(SAFE_VALUE, { message: 'a CSS value without ; { } < or >' });

/** Token values as data (the layout file): only known token names, safe CSS values. */
export const TokenValuesSchema = z
  .strictObject(Object.fromEntries(TOKEN_NAMES.map((name) => [name, TokenValue.optional()])))
  .describe(`Design tokens: ${TOKEN_NAMES.join(', ')}.`);

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

/**
 * Build the `:root` CSS for a set of tokens, with an optional dark variant. The dark variant follows the system
 * preference, unless the visitor chose with the theme's switch (`data-color-scheme` on <html>). It is for screens
 * only: printing always uses the light colours (no dark background on paper).
 */
export function tokensToCss(tokens: ThemeTokens): string {
  const light = `:root{color-scheme:light;${declarations(tokens.light)}}`;
  if (!tokens.dark) return light;
  const dark = `color-scheme:dark;${declarations(tokens.dark)}`;
  return (
    light +
    `@media screen and (prefers-color-scheme: dark){:root:not([data-color-scheme=light]){${dark}}}` +
    `@media screen{:root[data-color-scheme=dark]{${dark}}}`
  );
}
