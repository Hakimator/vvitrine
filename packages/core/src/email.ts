/**
 * An e-mail address shown in a page without handing it to spam harvesters, and without JavaScript.
 *
 * Measured on real harvesters (Spencer Mortensen, "Email address obfuscation: What works in 2026?"):
 * - the link target is percent-encoded (`mailto:%6A%61...`), which browsers decode and most harvesters do not;
 * - the visible text contains hidden decoy parts (`display: none`), so the page source holds a wrong address while
 *   people see, copy and hear the right one (hidden text is neither copied nor read by screen readers).
 */
export interface ProtectedEmail {
  /** Percent-encoded `mailto:` link. Use it as `href`. */
  readonly href: string;
  /** The text to show, in order. Render a part with `hidden: true` with the `hidden` attribute (display: none). */
  readonly parts: readonly { readonly text: string; readonly hidden?: true }[];
}

const DECOY = 'nospam';
const percentEncode = (value: string) =>
  [...new TextEncoder().encode(value)].map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');

export function protectEmail(address: string): ProtectedEmail {
  const at = address.lastIndexOf('@');
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return {
    href: `mailto:${percentEncode(address)}`,
    parts:
      at < 1 || dot < 1
        ? [{ text: address }]
        : [
            { text: local },
            { text: `.${DECOY}`, hidden: true },
            { text: `@${domain.slice(0, dot)}` },
            { text: `-${DECOY}`, hidden: true },
            { text: domain.slice(dot) },
          ],
  };
}
