/** @jsxImportSource preact */
import type {
  ContentChange,
  ContentModel,
  ContentPath,
  Locale,
  SectionModel,
  WrittenContent,
  WrittenLayout,
} from '@vvitrine/core';
import {
  describeContent,
  EditSession,
  listChanges,
  SaveBlockedError,
  type SessionDocument,
} from '@vvitrine/studio-core';
import { signal, useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { StudioApi } from './api.ts';
import { Field, type FieldContext } from './Fields.tsx';
import type { Place } from './logic.ts';
import { builderTexts, listTexts } from './messages.ts';
import { LAYOUT, Pages } from './Pages.tsx';

export interface StudioData {
  readonly api: StudioApi;
  readonly base: string;
  readonly locales: readonly Locale[];
  readonly content: readonly ContentModel[];
  readonly written: Readonly<Record<Locale, WrittenContent>>;
  /** The sections that can be placed on pages. */
  readonly sections: readonly SectionModel[];
  readonly layout: WrittenLayout;
}

/** The page builder's entry in the list (no content key has a '#'). */
const PAGES = '#pages';
/** The Studio's own language (its other languages come with US-149). */
const LANGUAGE = 'en';

/** Re-render when the session changes (every edit, undo, check, save). */
const version = signal(0);
/** What the status line says (read by screen readers: a polite live region). */
const status = signal('');

const CHECK_DELAY = 600;

export function App({ data }: { data: StudioData }) {
  const session = useMemo(
    () =>
      new EditSession({
        ...Object.fromEntries(
          data.locales.map((l) => [
            l,
            {
              data: data.written[l]!.content,
              store: { save: (changes) => data.api.saveContent(l, changes) },
              checker: { check: (content) => data.api.checkContent(l, content) },
            } satisfies SessionDocument,
          ]),
        ),
        [LAYOUT]: {
          data: data.layout.layout,
          store: { save: (changes) => data.api.saveLayout(changes) },
          checker: { check: async (layout) => data.api.checkLayout(layout) },
        },
      }),
    [data],
  );
  const selected = useSignal(data.content[0]!.key);
  void version.value;
  /** What gets focus after the next render: the menu of the item that moved, so the keyboard stays on it. */
  const focusNext = useRef<string | undefined>(undefined);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = undefined;
    if (target) document.getElementById(target)?.focus();
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = session.subscribe(() => {
      version.value += 1;
    });
    // Check what was typed, after a short pause.
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void session.check().catch((error: Error) => (status.value = error.message)),
        CHECK_DELAY,
      );
    };
    const stopCheck = session.subscribe(() => {
      if (session.dirty) check();
    });
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void save();
      } else if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (session.dirty) event.preventDefault();
    };
    addEventListener('keydown', keys);
    addEventListener('beforeunload', leave);
    return () => {
      stop();
      stopCheck();
      clearTimeout(timer);
      removeEventListener('keydown', keys);
      removeEventListener('beforeunload', leave);
    };
  }, [session]);

  const forms = useMemo(() => data.content.map((model) => ({ model, form: describeContent(model) })), [data]);
  const current = forms.find((f) => f.model.key === selected.value) ?? forms[0]!;
  const readOnly = data.locales.some((l) => data.written[l]!.readOnly.includes(current.model.key));
  const fixedOrder = data.locales.some((l) => data.written[l]!.fixedOrder.includes(current.model.key));
  const toFix = (key: string) =>
    session.issues.some((issue) =>
      key === PAGES ? issue.document === LAYOUT : issue.document !== LAYOUT && issue.at?.[0] === key,
    );
  const entry = (key: string, label: string) => (
    <li key={key}>
      <button
        type="button"
        aria-current={key === selected.value ? 'true' : undefined}
        onClick={() => (selected.value = key)}
      >
        {label}
        {toFix(key) && <span class="flag"> (to fix)</span>}
      </button>
    </li>
  );
  const loaded = new Set<string>();

  const apply =
    (locale: Locale) =>
    (change: ContentChange, merge = false) => {
      try {
        session.apply(locale, change, { merge });
      } catch (error) {
        status.value = (error as Error).message;
      }
    };
  const undo = () => {
    const undone = session.undo();
    status.value = undone ? 'Undone.' : 'Nothing to undo.';
  };
  const redo = () => {
    const redone = session.redo();
    status.value = redone ? 'Redone.' : 'Nothing to redo.';
  };
  async function save() {
    if (!session.dirty) {
      status.value = 'Nothing to save.';
      return;
    }
    status.value = 'Saving…';
    try {
      const files = await session.save();
      // The files are the truth: a source may have put a new item elsewhere (Markdown files are read by name), and
      // later changes must point at the items as they are in the files.
      const moved = [];
      for (const locale of data.locales) {
        if (session.rebase(locale, (await data.api.content(locale)).content)) moved.push(locale);
      }
      status.value = `Saved: ${files.join(', ')}.${moved.length > 0 ? ' Items are now in the order of their files.' : ''}`;
    } catch (error) {
      status.value =
        error instanceof SaveBlockedError
          ? `Not saved: ${error.issues.length} problem${error.issues.length > 1 ? 's' : ''} to fix first (marked below).`
          : `Not saved: ${(error as Error).message}`;
    }
  }

  const context = (locale: Locale): FieldContext => ({
    key: current.model.key,
    locale,
    locales: data.locales,
    content: (l) => session.data(l),
    issues: (place: Place) => session.issuesAt(locale, place),
    apply: apply(locale),
    list: (place, action, said, focus) => {
      const documents = Object.fromEntries(data.locales.map((l) => [l, session.data(l)]));
      try {
        session.applyTogether(listChanges(documents, place as unknown as ContentPath, action));
      } catch (error) {
        status.value = (error as Error).message;
        return;
      }
      focusNext.current = focus;
      status.value = said;
    },
    fixedOrder,
    texts: listTexts,
    readOnly,
    loadWidget: (element) => {
      if (loaded.has(element) || customElements.get(element)) return;
      loaded.add(element);
      const script = document.createElement('script');
      script.type = 'module';
      script.src = `${data.base}widgets/${element}.js`;
      document.head.append(script);
    },
  });

  const unsaved = session.pending.length;
  return (
    <div class="studio">
      <header class="bar">
        <h1>VVitrine Studio</h1>
        <div class="actions">
          <button type="button" onClick={undo} disabled={!session.canUndo} aria-keyshortcuts="Control+Z">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!session.canRedo} aria-keyshortcuts="Control+Shift+Z">
            Redo
          </button>
          <button type="button" class="primary" onClick={() => void save()} aria-keyshortcuts="Control+S">
            Save{unsaved > 0 ? ` (${unsaved} change${unsaved > 1 ? 's' : ''})` : ''}
          </button>
        </div>
        <p class="status" role="status" aria-live="polite">
          {status.value}
        </p>
      </header>
      <nav aria-label="Studio">
        <p class="group-name" id="nav-site">
          Site
        </p>
        <ul aria-labelledby="nav-site">{entry(PAGES, builderTexts.pages)}</ul>
        <p class="group-name" id="nav-content">
          Content
        </p>
        <ul aria-labelledby="nav-content">{forms.map(({ model, form }) => entry(model.key, form.label))}</ul>
      </nav>
      {selected.value === PAGES ? (
        <main>
          <h2>{builderTexts.pages}</h2>
          <Pages
            session={session}
            written={data.layout}
            sections={data.sections}
            language={LANGUAGE}
            texts={builderTexts}
            announce={(text) => (status.value = text)}
          />
        </main>
      ) : (
        <main>
          <h2>{current.form.label}</h2>
          {current.form.help && <p class="help">{current.form.help}</p>}
          {readOnly && <p class="note">This content comes from a source that cannot save: it is shown read-only.</p>}
          <div class="languages">
            {data.locales.map((locale) => (
              <section key={locale} lang={locale} aria-labelledby={`language-${locale}`}>
                <h3 id={`language-${locale}`}>
                  {locale.toUpperCase()}
                  {data.written[locale]!.origin[current.model.key] && (
                    <span class="file"> · {data.written[locale]!.origin[current.model.key]}</span>
                  )}
                </h3>
                <Field field={current.form} ctx={context(locale)} />
              </section>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
