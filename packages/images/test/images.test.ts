import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { InvalidPluginOptionsError } from '@vvitrine/core';
import sharp from 'sharp';
import images from '../src/index.ts';

const root = fileURLToPath(new URL('./fixtures', import.meta.url));
const logger = { info: () => {}, warn: () => {} };

async function prepared(options = {}, base = '/') {
  const plugin = images(options);
  await plugin.images!.prepare({ root, base, logger });
  return plugin;
}

const generateCtx = { locales: ['en'], base: '/', routes: [] };

describe('@vvitrine/images', () => {
  it('describes a large image with WebP variants up to the largest width, and its real size', async () => {
    const plugin = await prepared({}, '/demo/');
    const described = plugin.images!.describe('/big.png')!;
    expect(described.width).toBe(1600);
    expect(described.height).toBe(900);
    expect(described.srcset).toMatch(
      /^\/demo\/_images\/big-[0-9a-f]{6}-480\.webp 480w, \/demo\/_images\/big-[0-9a-f]{6}-960\.webp 960w, \/demo\/_images\/big-[0-9a-f]{6}-1440\.webp 1440w$/,
    );
  });

  it('never makes a variant wider than the original', async () => {
    const plugin = await prepared();
    expect(plugin.images!.describe('/small.png')!.srcset).toMatch(/-300\.webp 300w$/);
    expect(plugin.images!.describe('/small.png')!.srcset).not.toContain('480w');
    expect(plugin.images!.describe('/projects/app.png')!.srcset).toMatch(
      /480w, .*-960\.webp 960w, .*-1000\.webp 1000w$/,
    );
  });

  it('reports photos stored sideways with their displayed size, and SVG files with their size only', async () => {
    const plugin = await prepared();
    expect(plugin.images!.describe('/sideways.jpg')).toMatchObject({ width: 200, height: 400 });
    expect(plugin.images!.describe('/logo.svg')).toEqual({ width: 100, height: 50 });
    expect(plugin.images!.describe('/notes.txt')).toBeUndefined();
    expect(plugin.images!.describe('/missing.png')).toBeUndefined();
  });

  it('generates only the variants that pages asked for, as real WebP files', async () => {
    const plugin = await prepared();
    expect(await plugin.generate(generateCtx)).toEqual([]);
    plugin.images!.describe('/small.png');
    plugin.images!.describe('/small.png');
    plugin.images!.describe('/logo.svg');
    const files = await plugin.generate(generateCtx);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toMatch(/^\/_images\/small-[0-9a-f]{6}-300\.webp$/);
    const meta = await sharp(files[0]!.contents as Uint8Array).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 300, 200]);
  });

  it('keeps images with the same name in different folders apart', async () => {
    const plugin = await prepared();
    const a = plugin.images!.describe('/small.png')!.srcset!;
    const b = plugin.images!.describe('/projects/small.png')!.srcset!;
    expect(a).toMatch(/^\/_images\/small-[0-9a-f]{6}-300\.webp 300w$/);
    expect(b).toMatch(/^\/_images\/small-[0-9a-f]{6}-300\.webp 300w$/);
    expect(a).not.toBe(b);
  });

  it('does nothing when the folder does not exist, and accepts custom widths', async () => {
    const empty = await prepared({ dir: 'nowhere' });
    expect(empty.images!.describe('/big.png')).toBeUndefined();
    const custom = await prepared({ widths: [800], outDir: '/img' });
    expect(custom.images!.describe('/big.png')!.srcset).toMatch(/^\/img\/big-[0-9a-f]{6}-800\.webp 800w$/);
  });

  it('rejects invalid options', () => {
    expect(() => images({ widths: [] })).toThrow(InvalidPluginOptionsError);
    expect(() => images({ outDir: 'no-slash' })).toThrow(InvalidPluginOptionsError);
  });
});
