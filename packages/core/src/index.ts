// Public API of @vvitrine/core. Plugins and the integration must import from here only
// (enforced by dependency-cruiser): anything not exported here is an internal detail.
export * from './errors.ts';
export * from './config.ts';
export * from './plugin.ts';
export * from './kernel.ts';
export * from './views.ts';
export * from './images.ts';
export { PluginRegistry } from './registry.ts';
export { Basics, PartialDate, Profile, Url, CONTENT_SCHEMA_VERSION, RESERVED_KEYS } from './content/schemas.ts';
export { formatPath, toIssues } from './content/zod-issues.ts';
export { Translator, type Locale, type MessageCatalog, type Messages, type Translate } from './i18n/translator.ts';
export { formatPartialDate, formatPeriod } from './i18n/dates.ts';
export { coreMessages } from './i18n/core-messages.ts';
export { renderHeadTag, renderHeadTags, type HeadTag } from './render/head.ts';
export {
  TOKEN_NAMES,
  cssVariable,
  mergeTokens,
  tokensToCss,
  type ThemeTokens,
  type TokenName,
  type TokenValues,
} from './render/tokens.ts';
