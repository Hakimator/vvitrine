/**
 * Instant tag filter: a progressive enhancement for the links of a project filter.
 *
 * Without JavaScript, each tag link opens the page of that tag. With it, a click on a tag hides the other cards in
 * place, marks the link as current, announces how many projects are shown and puts the tag page's address in the
 * history (so the address can be shared and Back works).
 *
 * Themes print it, inline, right after the filter's links, only when the view asks for it (`filter.instant`). It
 * works on this markup, inside one <section>:
 * - links with `data-tag` (the tag's slug, empty for "All");
 * - cards with `data-tags` (space-separated slugs);
 * - an element with `data-tag-status` and the messages `data-one` / `data-other` (`{count}` is replaced), whose
 *   text is announced (give it role="status").
 */
function enhanceTagFilter(script: HTMLScriptElement | null): void {
  const section = script?.closest('section');
  if (!section) return;
  const links = [...section.querySelectorAll<HTMLAnchorElement>('a[data-tag]')];
  const status = section.querySelector<HTMLElement>('[data-tag-status]');
  const plural = new Intl.PluralRules(document.documentElement.lang || undefined);

  const show = (tag: string, announce: boolean) => {
    let count = 0;
    // Looked up now: the script runs before the cards that follow it are parsed.
    for (const card of section.querySelectorAll<HTMLElement>('[data-tags]')) {
      card.hidden = tag !== '' && !(card.dataset.tags ?? '').split(' ').includes(tag);
      if (!card.hidden) count += 1;
    }
    for (const link of links) {
      if (link.dataset.tag === tag) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (announce && status) {
      const message = status.dataset[plural.select(count)] ?? status.dataset.other ?? '';
      status.textContent = message.replace('{count}', String(count));
    }
  };

  for (const link of links) {
    link.addEventListener('click', (event) => {
      // Let the browser handle "open in a new tab" and similar.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const tag = link.dataset.tag ?? '';
      show(tag, true);
      history.pushState({ vvitrineTag: tag }, '', link.href);
    });
  }
  addEventListener('popstate', (event) => {
    const state = event.state as { vvitrineTag?: string } | null;
    show(state?.vvitrineTag ?? '', true);
  });
}

/** The script to print inline (`<script set:html={tagFilterScript}>`): about 1 KB, no request, no dependency. */
export const tagFilterScript = `(${enhanceTagFilter.toString()})(document.currentScript);`;
