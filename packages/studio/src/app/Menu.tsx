/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';

export interface MenuItem {
  readonly label: string;
  readonly run: () => void;
}

/**
 * A menu button (WAI-ARIA APG): the button opens a list of actions. Every pointer and keyboard way works: click or
 * Enter, Space, Down (first item) or Up (last item) to open; Up, Down, Home and End to move; Enter or Space to run;
 * Escape or Tab to close. Each action is a button, so it runs as any button does. After an action, focus goes back to the button, or wherever the action put it.
 */
export function Menu({
  label,
  text,
  items,
  id,
}: {
  /** The button's accessible name, e.g. "Move or change Experience". */
  label: string;
  /** What the button shows. */
  text: string;
  items: readonly MenuItem[];
  id: string;
}) {
  const [open, setOpen] = useState<'first' | 'last' | false>(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const entries = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return;
    const all = entries();
    (open === 'last' ? all.at(-1) : all[0])?.focus();
    const outside = (event: PointerEvent) => {
      if (!list.current?.contains(event.target as Node) && event.target !== button.current) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const run = (item: MenuItem) => {
    close(true);
    item.run();
  };
  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };
  const onMenuKey = (event: KeyboardEvent) => {
    const all = entries();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => all[(index + all.length) % all.length]?.focus();
    const keys: Record<string, () => void> = {
      ArrowDown: () => go(at + 1),
      ArrowUp: () => go(at - 1),
      Home: () => go(0),
      End: () => go(all.length - 1),
      Escape: () => close(true),
    };
    if (event.key === 'Tab') return close(false);
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div class="menu">
      <button
        type="button"
        ref={button}
        id={id}
        class="menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen(open ? false : 'first')}
        onKeyDown={onButtonKey}
      >
        {text}
      </button>
      {open && (
        <ul role="menu" id={`${id}-menu`} aria-labelledby={id} ref={list} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <li role="none" key={item.label}>
              <button type="button" role="menuitem" tabIndex={-1} onClick={() => run(item)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
