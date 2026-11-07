import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import {
  InvalidPluginOptionsError,
  toIssues,
  type GeneratedFile,
  type GeneratorPlugin,
  type ResponsiveImage,
} from '@vvitrine/core';
import sharp from 'sharp';
import { z } from 'zod';

const Options = z.object({
  /** Folder of the site's static files, relative to the project root. */
  dir: z.string().default('public'),
  /** Widths of the WebP variants, in pixels. Variants wider than the original are skipped. */
  widths: z.array(z.number().int().min(16).max(4096)).min(1).default([480, 960, 1440]),
  /** WebP quality, 1 to 100. */
  quality: z.number().int().min(1).max(100).default(80),
  /** URL folder of the generated variants. */
  outDir: z
    .string()
    .regex(/^\/[a-z0-9_-]+$/, { message: 'expected a folder such as "/_images"' })
    .default('/_images'),
});

export type ImagesOptions = z.input<typeof Options>;

const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

interface Info {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly raster: boolean;
}

/** Every file under `dir`, as absolute paths. */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]))),
  );
  return nested.flat();
}

/**
 * Responsive images without changing the content: themes keep using paths such as `/photo.jpg`, and pages get
 * `srcset` (WebP at several widths) and the real width and height, which avoid layout shifts. Only the images that
 * pages use are converted. SVG files get their dimensions only.
 */
export default function images(options: ImagesOptions = {}): GeneratorPlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/images', toIssues(parsed.error));
  const { dir, widths, quality, outDir } = parsed.data;

  const known = new Map<string, Info>();
  const used = new Map<string, readonly number[]>();
  let base = '/';

  /** '/projects/app.png' -> '/_images/app-1a2b3c' (the hash keeps files with the same name apart). */
  const variantStem = (path: string) => {
    const name = path
      .split('/')
      .pop()!
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');
    return `${outDir}/${name}-${createHash('sha1').update(path).digest('hex').slice(0, 6)}`;
  };

  return {
    name: '@vvitrine/images',
    kind: 'generator',
    apiVersion: 1,
    images: {
      async prepare(ctx) {
        base = ctx.base;
        known.clear();
        used.clear();
        const folder = isAbsolute(dir) ? dir : join(ctx.root, dir);
        if (!existsSync(folder)) return;
        for (const file of await walk(folder)) {
          const ext = extname(file).toLowerCase();
          if (!RASTER.has(ext) && ext !== '.svg') continue;
          const meta = await sharp(file).metadata();
          // Photos taken sideways store their orientation apart: report the size as displayed.
          const turned = (meta.orientation ?? 1) >= 5;
          const width = turned ? meta.height : meta.width;
          const height = turned ? meta.width : meta.height;
          if (!width || !height) continue;
          const path = `/${relative(folder, file).replaceAll('\\', '/')}`;
          known.set(path, { file, width, height, raster: RASTER.has(ext) });
        }
        ctx.logger.info(`${known.size} image(s) found in ${dir}/.`);
      },
      describe(path): Omit<ResponsiveImage, 'src'> | undefined {
        const info = known.get(path);
        if (!info) return undefined;
        if (!info.raster) return { width: info.width, height: info.height };
        const largest = Math.max(...widths);
        const sizes = [...new Set([...widths.filter((w) => w < info.width), Math.min(info.width, largest)])].sort(
          (a, b) => a - b,
        );
        used.set(path, sizes);
        const stem = `${base.replace(/\/$/, '')}${variantStem(path)}`;
        return {
          srcset: sizes.map((w) => `${stem}-${w}.webp ${w}w`).join(', '),
          width: info.width,
          height: info.height,
        };
      },
    },
    async generate(): Promise<readonly GeneratedFile[]> {
      const files: GeneratedFile[] = [];
      for (const [path, sizes] of used) {
        const { file } = known.get(path)!;
        for (const width of sizes) {
          const contents = await sharp(file).rotate().resize({ width }).webp({ quality }).toBuffer();
          files.push({ path: `${variantStem(path)}-${width}.webp`, contents: new Uint8Array(contents) });
        }
      }
      return files;
    },
  };
}
