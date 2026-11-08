// tsc does not understand .astro files (Astro's own tooling does). This declaration lets the
// theme entry point type-check; components are opaque to the kernel anyway (typed `unknown`).
declare module '*.astro' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
