import { expect, it } from 'vitest';
import { generateReference } from './generate.ts';

it('docs/reference.md and the JSON Schemas match the schemas (run `pnpm reference` to update them)', async () => {
  const { markdown, schema, layoutSchema } = generateReference();
  await expect(markdown).toMatchFileSnapshot('../../docs/reference.md');
  await expect(schema).toMatchFileSnapshot('../../docs/content.schema.json');
  await expect(layoutSchema).toMatchFileSnapshot('../../docs/layout.schema.json');
});
