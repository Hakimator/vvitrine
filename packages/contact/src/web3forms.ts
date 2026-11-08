import { InvalidPluginOptionsError, toIssues } from '@vvitrine/core';
import { z } from 'zod';
import type { ContactProvider } from './provider.ts';

const Options = z.object({
  /** The access key Web3Forms e-mails you (https://web3forms.com). It is visible in the page, which is expected. */
  accessKey: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'expected the access key Web3Forms sent you, e.g. 0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b',
  }),
});

export type Web3FormsOptions = z.input<typeof Options>;

/**
 * Web3Forms (https://web3forms.com): 250 free messages a month, no account dashboard, works without JavaScript.
 * See ADR-011 for the comparison with other providers.
 */
export function web3forms(options: Web3FormsOptions): ContactProvider {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('web3forms', toIssues(parsed.error));
  const { accessKey } = parsed.data;
  return {
    service: 'Web3Forms',
    // Data processing agreement: operator, hosting regions, retention and sub-processors.
    privacyUrl: 'https://web3forms.com/dpa',
    action: 'https://api.web3forms.com/submit',
    // From the DPA (checked 8 Nov 2026): run by Web3Creative from India; submissions live up to three years.
    facts: { country: 'IN', retention: { value: 3, unit: 'year' } },
    honeypot: 'botcheck',
    hiddenFields: ({ subject, siteName, thanksUrl }) => [
      { name: 'access_key', value: accessKey },
      { name: 'subject', value: subject },
      { name: 'from_name', value: siteName },
      // Without it, Web3Forms shows its own confirmation page.
      ...(thanksUrl ? [{ name: 'redirect', value: thanksUrl }] : []),
    ],
  };
}
