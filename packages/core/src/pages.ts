/** Pages and the sections on them, as the configuration and the layout file write them (ADR-016). */

export type SectionRef =
  | string
  | {
      readonly id: string;
      readonly options?: unknown;
      /** Show a link to this section in the site navigation (default true when it has a title). */
      readonly nav?: boolean;
      /** Keep the section on the page without showing it: it is left out of the page, its options are kept. */
      readonly hidden?: boolean;
    };

export interface PageConfig {
  /** Path without locale prefix, e.g. '/' or '/cv'. */
  readonly path: string;
  /** Message key or literal title. Defaults to the person's name. */
  readonly title?: string;
  readonly sections: readonly SectionRef[];
  /**
   * Link this page from the footer of every page, with its title as the label (e.g. a privacy page). Its sections
   * then get no header link.
   */
  readonly footer?: boolean;
}
