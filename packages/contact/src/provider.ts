/**
 * A form provider receives the messages of the contact form and e-mails them to the site owner. The form is plain
 * HTML (no JavaScript): it posts to `action`, with the provider's hidden fields, and the visitor's `name`, `email`
 * and `message`.
 */
export interface ContactProvider {
  /** Name shown in the privacy notice, e.g. 'Web3Forms'. */
  readonly service: string;
  /** Page explaining how the provider handles the messages (privacy policy or data processing terms). */
  readonly privacyUrl: string;
  /** Address the form posts to. */
  readonly action: string;
  /** Name of a hidden checkbox that only bots tick (spam protection without a third-party script). */
  readonly honeypot?: string;
  /** Facts shown on the privacy page, from the provider's own terms. */
  readonly facts?: {
    /** Country where the company that runs the service is based (ISO 3166 code, e.g. 'IN'). */
    readonly country?: string;
    /** How long messages are kept at most. */
    readonly retention?: { readonly value: number; readonly unit: 'day' | 'month' | 'year' };
  };
  /** Hidden fields to send with each message (keys, subject, page to return to...). */
  hiddenFields(request: ContactRequest): readonly HiddenField[];
}

export interface ContactRequest {
  /** Subject of the e-mail the owner receives, in the visitor's language. */
  readonly subject: string;
  /** Name of the site, e.g. the owner's name. */
  readonly siteName: string;
  /** Full address of the "message sent" page, when the site URL is known. */
  readonly thanksUrl?: string;
}

export interface HiddenField {
  readonly name: string;
  readonly value: string;
}
