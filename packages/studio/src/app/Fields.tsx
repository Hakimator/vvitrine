/** @jsxImportSource preact */
import type { ContentChange, ContentIssue, Locale } from '@vvitrine/core';
import { itemTitle, type FieldDescriptor, type ListAction } from '@vvitrine/studio-core';
import { useEffect, useRef } from 'preact/hooks';
import { changeFor, emptyItem, filled, inputId, placeOf, valueAt, type Place } from './logic.ts';
import { Menu, type MenuItem } from './Menu.tsx';
import type { ListTexts } from './messages.ts';

/** What every field needs from the screen. */
export interface FieldContext {
  readonly key: string;
  readonly locale: Locale;
  readonly locales: readonly Locale[];
  /** The content of every language, to tell what is missing in this one. */
  readonly content: (locale: Locale) => Readonly<Record<string, unknown>>;
  readonly issues: (place: Place) => readonly ContentIssue[];
  readonly apply: (change: ContentChange, merge?: boolean) => void;
  /**
   * Do a list action in every language, as one step (US-136); then announce `said` and put the focus on the element
   * with the id `focus`.
   */
  readonly list: (place: Place, action: ListAction, said: string, focus?: string) => void;
  /** Whether the content key's items keep the order of their files (they cannot be moved). */
  readonly fixedOrder: boolean;
  readonly texts: ListTexts;
  readonly readOnly: boolean;
  /** Loads the module of a plugin's control (once), so that its element is defined. */
  readonly loadWidget: (element: string) => void;
}

/** One field, or a group, or a list, for one language. */
export function Field({
  field,
  ctx,
  positions = [],
}: {
  field: FieldDescriptor;
  ctx: FieldContext;
  positions?: readonly number[];
}) {
  const place = placeOf(ctx.key, field, positions);
  if (field.kind === 'object') return <Group field={field} ctx={ctx} positions={positions} place={place} />;
  if (field.kind === 'list') return <List field={field} ctx={ctx} positions={positions} place={place} />;
  return <Input field={field} ctx={ctx} place={place} />;
}

function Group({
  field,
  ctx,
  positions,
  place,
}: {
  field: FieldDescriptor;
  ctx: FieldContext;
  positions: readonly number[];
  place: Place;
}) {
  return (
    <fieldset class="group">
      <legend class={field.path.length === 0 ? 'visually-hidden' : undefined}>{field.label}</legend>
      {field.help && <p class="help">{field.help}</p>}
      <Issues ctx={ctx} place={place} own />
      {field.fields!.map((child) => (
        <Field key={child.path.join('.')} field={child} ctx={ctx} positions={positions} />
      ))}
    </fieldset>
  );
}

/**
 * A list: each item has a menu with every action (move up, down, to the top or bottom, duplicate, remove), usable with
 * a single pointer or the keyboard, and each action is announced (US-136). An action applies to every language, so
 * that the languages keep the same items in the same order.
 */
function List({
  field,
  ctx,
  positions,
  place,
}: {
  field: FieldDescriptor;
  ctx: FieldContext;
  positions: readonly number[];
  place: Place;
}) {
  const items = valueAt(ctx.content(ctx.locale), place);
  const list = Array.isArray(items) ? items : [];
  const id = inputId(ctx.locale, place);
  const { texts } = ctx;
  const addId = `${id}-add`;
  const menuId = (index: number) => `${id}-item-${index}`;
  // The items of a key whose files give their order cannot move (Markdown projects); their own lists can.
  const movable = !(ctx.fixedOrder && place.length === 1);
  const last = list.length - 1;

  const actions = (title: string, index: number): MenuItem[] => {
    const move = (to: number) => ({
      run: () =>
        ctx.list(
          place,
          { kind: 'move', from: index, to },
          texts.moved(title, to + 1, list.length, field.label),
          menuId(to),
        ),
    });
    return [
      ...(movable && index > 0 ? [{ label: texts.moveUp, ...move(index - 1) }] : []),
      ...(movable && index < last ? [{ label: texts.moveDown, ...move(index + 1) }] : []),
      ...(movable && index > 1 ? [{ label: texts.moveTop, ...move(0) }] : []),
      ...(movable && index < last - 1 ? [{ label: texts.moveBottom, ...move(last) }] : []),
      {
        label: texts.duplicate,
        run: () =>
          ctx.list(
            place,
            { kind: 'duplicate', index },
            texts.duplicated(title, index + 2, list.length + 1),
            menuId(index + 1),
          ),
      },
      {
        label: texts.remove,
        // The item is gone: the keyboard goes to "Add", next to where it was.
        run: () => ctx.list(place, { kind: 'remove', index }, texts.removed(title, field.label), addId),
      },
    ];
  };

  return (
    <fieldset class="group list">
      {/* The content key itself is named by the heading above it: its legend is for screen readers only. */}
      <legend class={field.path.length === 0 ? 'visually-hidden' : undefined}>{field.label}</legend>
      {field.help && <p class="help">{field.help}</p>}
      {!movable && list.length > 1 && !ctx.readOnly && <p class="help">{texts.fixedOrder}</p>}
      <Issues ctx={ctx} place={place} own />
      <Missing ctx={ctx} place={place} />
      <ol>
        {list.map((item, index) => {
          const title = itemTitle(item, field) ?? `Item ${index + 1}`;
          return (
            <li key={index} class="item-row">
              <div class="item-body">
                {field.item!.kind === 'object' ? (
                  <fieldset class="group item">
                    <legend>{title}</legend>
                    {field.item!.fields!.map((child) => (
                      <Field key={child.path.join('.')} field={child} ctx={ctx} positions={[...positions, index]} />
                    ))}
                  </fieldset>
                ) : (
                  <Field field={{ ...field.item!, label: title }} ctx={ctx} positions={[...positions, index]} />
                )}
              </div>
              {!ctx.readOnly && (
                <div class="item-tools">
                  <Menu
                    id={menuId(index)}
                    label={texts.actionsFor(title, ctx.locale.toUpperCase())}
                    text="⋯"
                    items={actions(title, index)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!ctx.readOnly && (
        <button
          type="button"
          id={addId}
          onClick={() =>
            ctx.list(place, { kind: 'add', value: emptyItem(field) }, texts.added(field.label, list.length + 1))
          }
        >
          {texts.addTo(field.label)}
        </button>
      )}
    </fieldset>
  );
}

function Input({ field, ctx, place }: { field: FieldDescriptor; ctx: FieldContext; place: Place }) {
  const id = inputId(ctx.locale, place);
  const value = valueAt(ctx.content(ctx.locale), place);
  const issues = ctx.issues(place);
  const described = [field.help && `${id}-help`, issues.length > 0 && `${id}-issues`, `${id}-missing`]
    .filter(Boolean)
    .join(' ');
  const common = {
    id,
    disabled: ctx.readOnly,
    'aria-invalid': issues.length > 0 ? ('true' as const) : undefined,
    'aria-describedby': described || undefined,
  };
  const change = (input: string | boolean, merge: boolean) => {
    const next = changeFor(field, place, input, value);
    if (next) ctx.apply(next, merge);
  };
  const text = value === undefined || value === null ? '' : String(value);
  let control;
  switch (field.kind) {
    case 'long-text':
    case 'markdown':
      control = (
        <textarea
          {...common}
          rows={field.kind === 'markdown' ? 10 : 4}
          value={text}
          onInput={(e) => change(e.currentTarget.value, true)}
        />
      );
      break;
    case 'boolean':
      control = (
        <input
          {...common}
          type="checkbox"
          checked={value === true}
          onChange={(e) => change(e.currentTarget.checked, false)}
        />
      );
      break;
    case 'select':
      control = (
        <select {...common} value={text} onChange={(e) => change(e.currentTarget.value, false)}>
          {!field.required && <option value="">(none)</option>}
          {field.options!.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      );
      break;
    case 'custom':
      control = <Custom field={field} ctx={ctx} id={id} value={text} onChange={(v) => change(v, false)} />;
      break;
    case 'unknown':
      control = (
        <pre id={id} class="raw">
          {JSON.stringify(value ?? null, null, 2)}
        </pre>
      );
      break;
    default: {
      const type = field.kind === 'email' || field.kind === 'url' || field.kind === 'number' ? field.kind : 'text';
      const placeholder = field.kind === 'date' ? 'YYYY-MM' : field.kind === 'image' ? '/photo.jpg' : undefined;
      control = (
        // Preact types each input type on its own: these four share the same attributes.
        <input
          {...common}
          type={type as 'text'}
          value={text}
          placeholder={placeholder}
          onInput={(e) => change(e.currentTarget.value, true)}
        />
      );
    }
  }
  return (
    <div class={`field ${field.kind}`}>
      <label for={id}>
        {field.label}
        {field.required && <span class="required"> (required)</span>}
      </label>
      {field.help && (
        <p class="help" id={`${id}-help`}>
          {field.help}
        </p>
      )}
      {field.kind === 'unknown' && <p class="help">Edit this one in its file.</p>}
      {control}
      <Missing ctx={ctx} place={place} id={`${id}-missing`} />
      <Issues ctx={ctx} place={place} id={`${id}-issues`} />
    </div>
  );
}

/** A plugin's own control: a custom element with a `value` property and a `change` event (US-131). */
function Custom({
  field,
  ctx,
  id,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  ctx: FieldContext;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLElement & { value: string }>(null);
  const element = field.widget!.element;
  useEffect(() => ctx.loadWidget(element), [element]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.value !== value) node.value = value;
    const listener = () => onChange(node.value);
    node.addEventListener('change', listener);
    return () => node.removeEventListener('change', listener);
  });
  const Tag = element as 'div';
  return <Tag ref={ref as never} id={id} aria-label={field.label} />;
}

/** "Missing in FR": the field has a value in another language and none here. */
function Missing({ ctx, place, id }: { ctx: FieldContext; place: Place; id?: string }) {
  if (filled(valueAt(ctx.content(ctx.locale), place))) return null;
  const elsewhere = ctx.locales.filter((other) => other !== ctx.locale && filled(valueAt(ctx.content(other), place)));
  if (elsewhere.length === 0) return null;
  return (
    <p class="missing" id={id}>
      Missing in {ctx.locale.toUpperCase()}: filled in {elsewhere.map((l) => l.toUpperCase()).join(', ')}.
    </p>
  );
}

/** The problems of a field (or, with `own`, of a group itself, not its fields). */
function Issues({ ctx, place, id, own }: { ctx: FieldContext; place: Place; id?: string; own?: boolean }) {
  const issues = ctx.issues(place).filter((issue) => !own || (issue.at?.length ?? 0) === place.length);
  if (issues.length === 0) return null;
  return (
    <ul class="issues" id={id}>
      {issues.map((issue, index) => (
        <li key={index}>{issue.message}</li>
      ))}
    </ul>
  );
}
