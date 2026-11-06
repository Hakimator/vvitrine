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
