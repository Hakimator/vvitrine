/**
 * Shared view shapes ("view kinds"). A section that declares a `viewKind` and returns the matching shape is drawn by
 * any theme that registers a component for that kind (`components['kind:entries']`), so a new section plugin looks
 * right in every theme without shipping a component of its own.
 */

/** One dated entry: a job, a degree, an award, a certificate, a publication... */
export interface EntryItem {
  /** Main line, e.g. a position, an award or a certificate name. */
  readonly title: string;
  /** Organisation, school, issuer or publisher, shown after the title. */
  readonly subtitle?: string;
  /** Link for the title line (organisation website, certificate, publication). */
  readonly url?: string;
  /** Short facts shown on one line, e.g. [period, location]. Empty strings are not allowed. */
  readonly meta: readonly string[];
  readonly summary?: string;
  /** Bullet points: highlights, courses... */
  readonly notes: readonly string[];
}

export interface EntriesView {
  readonly title: string;
  readonly items: readonly EntryItem[];
}

/** A named group of keywords, e.g. a skill area or an interest. */
export interface TagGroup {
  readonly name: string;
  readonly level?: string;
  readonly keywords: readonly string[];
}

export interface TagsView {
  readonly title: string;
  readonly groups: readonly TagGroup[];
}

/** A quotation with its author: a reference, a testimonial. */
export interface QuoteItem {
  readonly quote: string;
  readonly author: string;
  /** Who the author is, e.g. "Team lead at Acme". */
  readonly role?: string;
}

export interface QuotesView {
  readonly title: string;
  readonly items: readonly QuoteItem[];
}

/** A key figure, e.g. { value: '12', label: 'projects shipped' }. */
export interface FigureItem {
  /** Shown large. A string, so it can hold '3+', '98 %' or '2 yrs'. */
  readonly value: string;
  readonly label: string;
}

export interface FiguresView {
  readonly title: string;
  readonly items: readonly FigureItem[];
}

/** View kind name -> view shape. */
export interface ViewKinds {
  readonly entries: EntriesView;
  readonly tags: TagsView;
  readonly quotes: QuotesView;
  readonly figures: FiguresView;
}

export type ViewKind = keyof ViewKinds;

export const VIEW_KINDS: readonly ViewKind[] = ['entries', 'tags', 'quotes', 'figures'];

/** Theme component key for a view kind, e.g. 'kind:entries'. */
export const viewKindKey = (kind: ViewKind): `kind:${ViewKind}` => `kind:${kind}`;
