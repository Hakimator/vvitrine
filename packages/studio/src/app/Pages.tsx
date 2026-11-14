/** @jsxImportSource preact */
import type { PageConfig, SectionModel, WrittenLayout } from '@vvitrine/core';
import { humanise, pageChanges, placement, type EditSession, type PageAction } from '@vvitrine/studio-core';
import { useEffect, useRef } from 'preact/hooks';
import { dragItem, droppedAt, dropOnList, onDrop, type Slot } from './drag.ts';
import { Menu, type MenuItem } from './Menu.tsx';
import type { BuilderTexts } from './messages.ts';

/** The layout's name in the editing session. */
export const LAYOUT = 'layout';

interface PagesProps {
  readonly session: EditSession;
  readonly written: WrittenLayout;
  readonly sections: readonly SectionModel[];
  /** The Studio's language, to name sections and pages. */
  readonly language: string;
  readonly texts: BuilderTexts;
  /** Says what happened (the status line, a live region). */
  readonly announce: (text: string) => void;
}

/**
 * The page builder (US-135): every page with its sections in order. Each section has a menu with every action
 * (move up, down, to the top or bottom, to another page; hide; leave out of the menu; remove), usable with a single
 * pointer or the keyboard; dragging by the handle is a shortcut for the same moves. Each action is announced.
 */
export function Pages({ session, written, sections, language, texts, announce }: PagesProps) {
  const layout = session.data(LAYOUT);
  const pages = (layout.pages as readonly PageConfig[] | undefined) ?? written.pages;
  const readOnly = written.readOnly;
  /** What gets focus after the next render: the menu of the section that moved, so the keyboard stays on it. */
  const focus = useRef<string | undefined>(undefined);

  const sectionName = (id: string) => {
    const title = sections.find((section) => section.id === id)?.title;
    return title?.[language] ?? Object.values(title ?? {})[0] ?? humanise(id);
  };
  const pageName = (page: PageConfig) =>
    written.titles[page.path]?.[language] ?? (page.path === '/' ? texts.home : page.path);

  /** Do an action: one step to undo; then say what happened, and keep the focus on the section. */
  const act = (action: PageAction, said: (after: readonly PageConfig[]) => string, keep?: string) => {
    try {
      session.apply(LAYOUT, pageChanges(layout, written.pages, action));
    } catch (error) {
      announce((error as Error).message);
      return;
    }
    focus.current = keep;
    announce(said((session.data(LAYOUT).pages as readonly PageConfig[] | undefined) ?? pages));
  };

  const position = (after: readonly PageConfig[], page: number, id: string) => {
    const list = after[page]!.sections;
    return [list.findIndex((ref) => placement(ref).id === id) + 1, list.length] as const;
  };

  const move = (page: number, from: number, to: number) => {
    const id = placement(pages[page]!.sections[from]!).id;
    act(
      { kind: 'move', page, from, to },
      (after) => texts.moved(sectionName(id), ...position(after, page, id), pageName(pages[page]!)),
      menuId(page, id),
    );
  };
  const moveToPage = (page: number, index: number, target: number, at?: number) => {
    const id = placement(pages[page]!.sections[index]!).id;
    act(
      { kind: 'move-to-page', page, index, target, ...(at === undefined ? {} : { at }) },
      (after) => texts.movedToPage(sectionName(id), pageName(pages[target]!), ...position(after, target, id)),
      menuId(target, id),
    );
  };

  // A drop is the same move as the menu's, counted the same way.
  useEffect(
    () =>
      onDrop(SECTION, (from: Slot, to: Slot) => {
        if (readOnly) return;
        const [page, target] = [Number(from.list), Number(to.list)];
        if (page !== target) {
          const id = placement(pages[page]!.sections[from.index]!).id;
          const already = pages[target]!.sections.some((ref) => placement(ref).id === id);
          if (!already) moveToPage(page, from.index, target, to.index);
          return;
        }
        const final = droppedAt(from.index, to.index);
        if (final !== undefined) move(page, from.index, final);
      }),
    [layout, readOnly],
  );

  useEffect(() => {
    const target = focus.current;
    if (!target) return;
    focus.current = undefined;
    document.getElementById(target)?.focus();
  });

  const layoutIssues = session.issues.filter((issue) => issue.document === LAYOUT);
  return (
    <div class="pages">
      {readOnly ? <p class="note">{readOnly}</p> : <p class="help">{texts.hint}</p>}
      {layoutIssues.length > 0 && (
        <ul class="issues">
          {layoutIssues.map((issue, index) => (
            <li key={index}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {pages.map((page, p) => (
        <PageCard
          key={page.path}
          page={page}
          index={p}
          pages={pages}
          name={pageName(page)}
          names={{ section: sectionName, page: pageName }}
          installed={sections.map((section) => section.id)}
          texts={texts}
          readOnly={!!readOnly}
          session={session}
          actions={{
            move,
            moveToPage,
            other: (action, said, keep) => act(action, said, keep),
          }}
        />
      ))}
    </div>
  );
}

const menuId = (page: number, id: string) => `section-${page}-${id}`;
/** What the page builder drags: sections, dropped on any page (each page is a list, named by its position). */
const SECTION = 'section';

interface PageCardProps {
  readonly page: PageConfig;
  readonly index: number;
  readonly pages: readonly PageConfig[];
  readonly name: string;
  readonly names: { section: (id: string) => string; page: (page: PageConfig) => string };
  readonly installed: readonly string[];
  readonly texts: BuilderTexts;
  readonly readOnly: boolean;
  readonly session: EditSession;
  readonly actions: {
    move: (page: number, from: number, to: number) => void;
    moveToPage: (page: number, index: number, target: number) => void;
    /** Any other action, with what to say after it and what gets focus (an element id). */
    other: (action: PageAction, said: (after: readonly PageConfig[]) => string, keep?: string) => void;
  };
}

function PageCard({ page, index: p, pages, name, names, installed, texts, readOnly, session, actions }: PageCardProps) {
  const list = useRef<HTMLOListElement>(null);
  const count = page.sections.length;
  useEffect(
    () => (readOnly || !list.current ? undefined : dropOnList(SECTION, list.current, String(p), count)),
    [p, count, readOnly],
  );
  const placed = new Set(page.sections.map((ref) => placement(ref).id));
  const headingId = `page-${p}`;
  const addable: MenuItem[] = installed
    .filter((id) => !placed.has(id))
    .map((id) => ({
      label: names.section(id),
      run: () =>
        actions.other(
          { kind: 'add', page: p, id },
          (after) => texts.added(names.section(id), name, after[p]!.sections.length, after[p]!.sections.length),
          menuId(p, id),
        ),
    }));

  return (
    <section class="page" aria-labelledby={headingId}>
      <h3 id={headingId}>
        {name} <code class="file">{page.path}</code>
        {page.footer && <span class="file"> · {texts.inFooter}</span>}
      </h3>
      <ol class="sections" ref={list} aria-labelledby={headingId}>
        {page.sections.map((ref, s) => (
          <Placed
            key={placement(ref).id}
            page={page}
            p={p}
            s={s}
            pages={pages}
            names={names}
            texts={texts}
            readOnly={readOnly}
            issues={session.issuesAt(LAYOUT, ['pages', p, 'sections', s]).map((issue) => issue.message)}
            actions={actions}
            pageName={name}
          />
        ))}
      </ol>
      {count === 0 && <p class="help">{texts.empty}</p>}
      {!readOnly &&
        (addable.length > 0 ? (
          <Menu id={`add-${p}`} label={texts.addTo(name)} text={texts.addSection} items={addable} />
        ) : (
          <p class="help">{texts.nothingToAdd}</p>
        ))}
    </section>
  );
}

function Placed({
  page,
  p,
  s,
  pages,
  names,
  texts,
  readOnly,
  issues,
  actions,
  pageName,
}: {
  page: PageConfig;
  p: number;
  s: number;
  pages: readonly PageConfig[];
  names: PageCardProps['names'];
  texts: BuilderTexts;
  readOnly: boolean;
  issues: readonly string[];
  actions: PageCardProps['actions'];
  pageName: string;
}) {
  const row = useRef<HTMLLIElement>(null);
  const handle = useRef<HTMLSpanElement>(null);
  const section = placement(page.sections[s]!);
  const name = names.section(section.id);
  const last = page.sections.length - 1;
  useEffect(
    () =>
      readOnly || !row.current || !handle.current
        ? undefined
        : dragItem(SECTION, row.current, handle.current, { list: String(p), index: s }),
    [p, s, readOnly],
  );

  const keep = menuId(p, section.id);
  const items: MenuItem[] = [];
  if (s > 0) items.push({ label: texts.moveUp, run: () => actions.move(p, s, s - 1) });
  if (s < last) items.push({ label: texts.moveDown, run: () => actions.move(p, s, s + 1) });
  if (s > 1) items.push({ label: texts.moveTop, run: () => actions.move(p, s, 0) });
  if (s < last - 1) items.push({ label: texts.moveBottom, run: () => actions.move(p, s, last) });
  pages.forEach((other, target) => {
    if (target === p || other.sections.some((ref) => placement(ref).id === section.id)) return;
    items.push({ label: texts.moveToPage(names.page(other)), run: () => actions.moveToPage(p, s, target) });
  });
  items.push(
    section.hidden
      ? {
          label: texts.show,
          run: () =>
            actions.other(
              { kind: 'hide', page: p, index: s, hidden: false },
              () => texts.shownOn(name, pageName),
              keep,
            ),
        }
      : {
          label: texts.hide,
          run: () =>
            actions.other(
              { kind: 'hide', page: p, index: s, hidden: true },
              () => texts.hiddenOn(name, pageName),
              keep,
            ),
        },
  );
  // Footer pages give their sections no header link: there is no menu entry to change.
  if (!page.footer) {
    items.push(
      section.nav === false
        ? {
            label: texts.showInMenu,
            run: () =>
              actions.other({ kind: 'menu', page: p, index: s, shown: true }, () => texts.shownInMenu(name), keep),
          }
        : {
            label: texts.leaveOutOfMenu,
            run: () =>
              actions.other({ kind: 'menu', page: p, index: s, shown: false }, () => texts.leftOutOfMenu(name), keep),
          },
    );
  }
  items.push({
    label: texts.remove,
    // The section is gone: the keyboard goes to "Add a section", which can bring it back.
    run: () => actions.other({ kind: 'remove', page: p, index: s }, () => texts.removed(name, pageName), `add-${p}`),
  });

  const states = [section.hidden && texts.hidden, section.nav === false && !page.footer && texts.notInMenu].filter(
    (state): state is string => typeof state === 'string',
  );
  return (
    <li ref={row} class={`placed${section.hidden ? ' is-hidden' : ''}`}>
      {!readOnly && (
        <span class="grip" ref={handle} aria-hidden="true" title={texts.dragHandle}>
          ⠿
        </span>
      )}
      <span class="name">{name}</span>
      {states.length > 0 && <span class="states"> ({states.join(', ')})</span>}
      {!readOnly && <Menu id={menuId(p, section.id)} label={texts.actionsFor(name, pageName)} text="⋯" items={items} />}
      {issues.length > 0 && (
        <ul class="issues">
          {issues.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
