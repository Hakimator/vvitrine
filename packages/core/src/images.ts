/** What a theme needs to draw an image well: a fallback `src`, optional responsive variants and real dimensions. */
export interface ResponsiveImage {
  readonly src: string;
  /** e.g. "/_images/photo-a1b2c3-480.webp 480w, /_images/photo-a1b2c3-960.webp 960w" */
  readonly srcset?: string;
  /** Intrinsic size, so the browser reserves the space before the file arrives (no layout shift). */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Optimises local images. Provided by at most one generator plugin (`images` field), e.g. `@vvitrine/images`:
 * the kernel calls `prepare` once before rendering, `describe` for every local image a view asks for, and the
 * plugin's `generate` afterwards, so it can produce only the variants that pages use.
 */
export interface ImageProvider {
  prepare(ctx: {
    readonly root: string;
    readonly base: string;
    /** Same shape as the kernel's Logger (kept structural to avoid an import cycle with plugin.ts). */
    readonly logger: { info(message: string): void; warn(message: string): void };
  }): Promise<void>;
  /** Variants and size for a local path such as '/photo.jpg', or undefined to use the file as it is. */
  describe(path: string): Omit<ResponsiveImage, 'src'> | undefined;
}
