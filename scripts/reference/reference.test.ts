import { expect, it } from 'vitest';
import { generateReference } from './generate.ts';

it('docs/reference.md and docs/content.schema.json match the schemas (run `pnpm reference` to update them)', async () => {
  const { markdown, schema } = generateReference();
  await expect(markdown).toMatchFileSnapshot('../../docs/reference.md');
  await expect(schema).toMatchFileSnapshot('../../docs/content.schema.json');
});
