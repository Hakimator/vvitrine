/**
 * <now-month>: the Studio's control for the "updated" month of the now section (US-131). A custom element, so the
 * plugin does not depend on the Studio's UI library: the Studio sets `value` (YYYY-MM) and listens to `change`.
 * It wraps the browser's month picker, which has a keyboard and screen reader support of its own.
 *
 * Written as a function so that TypeScript checks it; the Studio receives its source (`monthInputModule`).
 */
function defineMonthInput(): void {
  if (customElements.get('now-month')) return;
  customElements.define(
    'now-month',
    class extends HTMLElement {
      readonly #input = document.createElement('input');

      constructor() {
        super();
        this.#input.type = 'month';
        this.#input.addEventListener('change', () => this.dispatchEvent(new Event('change', { bubbles: true })));
      }

      connectedCallback(): void {
        // The Studio gives the field's label to the element: pass it on to the input.
        this.#input.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Month');
        if (!this.#input.isConnected) this.append(this.#input);
      }

      get value(): string {
        return this.#input.value;
      }

      set value(month: string) {
        this.#input.value = month;
      }
    },
  );
}

/** The module the Studio loads to define <now-month>. */
export const monthInputModule = `(${defineMonthInput.toString()})();`;
