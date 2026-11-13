/** @jsxImportSource preact */
import type { ContentChange, ContentModel, Locale, WrittenContent } from '@vvitrine/core';
import { describeContent, EditSession, SaveBlockedError } from '@vvitrine/studio-core';
import { signal, useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { StudioApi } from './api.ts';
import { Field, type FieldContext } from './Fields.tsx';
import type { Place } from './logic.ts';

export interface StudioData {
  readonly api: StudioApi;
  readonly base: string;
  readonly locales: readonly Locale[];
  readonly content: readonly ContentModel[];
  readonly written: Readonly<Record<Locale, WrittenContent>>;
}

/** Re-render when the session changes (every edit, undo, check, save). */
const version = signal(0);
/** What the status line says (read by screen readers: a polite live region). */
const status = signal('');

const CHECK_DELAY = 600;

export function App({ data }: { data: StudioData }) {
  const session = useMemo(
    () => new EditSession(Object.fromEntries(data.locales.map((l) => [l, data.written[l]!.content]))),
    [data],
  );
  const selected = useSignal(data.content[0]!.key);
  void version.value;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = session.subscribe(() => {
      version.value += 1;
    });
    // Check what was typed, after a short pause.
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void session.check(data.api).catch((error: Error) => (status.value = error.message)),
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
  const current = forms.find((f) => f.model.key === selected.value)!;
  const readOnly = data.locales.some((l) => data.written[l]!.readOnly.includes(current.model.key));
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
      const files = await session.save(data.api, data.api);
      status.value = `Saved: ${files.join(', ')}.`;
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
    content: (l) => session.content(l),
    issues: (place: Place) => session.issuesAt(locale, place),
    apply: apply(locale),
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
      <nav aria-label="Content">
        <ul>
          {forms.map(({ model, form }) => (
            <li key={model.key}>
              <button
                type="button"
                aria-current={model.key === selected.value ? 'true' : undefined}
                onClick={() => (selected.value = model.key)}
              >
                {form.label}
                {session.issues.some((issue) => issue.at?.[0] === model.key) && <span class="flag"> (to fix)</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
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
    </div>
  );
}
