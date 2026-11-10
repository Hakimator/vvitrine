declare module 'virtual:vvitrine/config' {
  import type { VVitrineConfig } from '@vvitrine/core';
  const config: VVitrineConfig;
  export default config;
}

declare module 'virtual:vvitrine/runtime' {
  export const root: string;
  export const base: string;
  export const siteUrl: string | null;
  export const dev: boolean;
}

declare module 'virtual:vvitrine/layout' {
  import type { LayoutFile } from '@vvitrine/core';
  /** The layout file (site.yaml or site.json), or null when the site has none. */
  const layout: LayoutFile | null;
  export default layout;
}
