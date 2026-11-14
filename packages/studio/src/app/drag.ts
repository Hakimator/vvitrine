import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge';

/**
 * Drag and drop in the Studio (US-135, US-136), the only place that knows the drag-and-drop library (Pragmatic drag
 * and drop, chosen in the US-135 spike): swapping it changes this file only. It is a shortcut: every move it makes is
 * also in the item's menu (WCAG 2.5.7).
 *
 * Items are dragged by a handle and dropped before or after another item, or at the end of a list. Each kind of item
 * ('section', 'item'...) is only dropped among items of its kind.
 */

/** An item: the list it is in (a page, a list of jobs in one language...), and its position there. */
export interface Slot {
  readonly list: string;
  readonly index: number;
}

/** Shows where a dragged item would land: a line above or below the item under the pointer. */
const EDGE = 'data-drop-edge';

const ofKind = (kind: string) => (data: Record<string | symbol, unknown>) => data.kind === kind;

/**
 * Let an item be dragged by its handle, and dropped before or after it. With `within`, only items of the same list
 * can be dropped on it. Gives the clean-up.
 */
export function dragItem(
  kind: string,
  element: HTMLElement,
  handle: HTMLElement,
  slot: Slot,
  within = false,
): () => void {
  const clear = () => element.removeAttribute(EDGE);
  const accepts = (data: Record<string | symbol, unknown>) =>
    ofKind(kind)(data) && (!within || data.list === slot.list);
  return combine(
    draggable({
      element,
      dragHandle: handle,
      getInitialData: () => ({ kind, ...slot }),
      onDragStart: () => element.setAttribute('data-dragging', ''),
      onDrop: () => element.removeAttribute('data-dragging'),
    }),
    dropTargetForElements({
      element,
      canDrop: ({ source }) => accepts(source.data),
      getData: ({ input }) => attachClosestEdge({ kind, ...slot }, { element, input, allowedEdges: ['top', 'bottom'] }),
      onDrag: ({ self }) => element.setAttribute(EDGE, extractClosestEdge(self.data) ?? 'top'),
      onDragLeave: clear,
      onDrop: clear,
    }),
  );
}

/** Let items be dropped on a list, after its last one (an empty list has no item to drop on). */
export function dropOnList(kind: string, element: HTMLElement, list: string, count: number, within = false) {
  return dropTargetForElements({
    element,
    canDrop: ({ source }) => ofKind(kind)(source.data) && (!within || source.data.list === list),
    getData: () => ({ kind, list, index: count }),
    onDragEnter: () => element.setAttribute('data-drop-over', ''),
    onDragLeave: () => element.removeAttribute('data-drop-over'),
    onDrop: () => element.removeAttribute('data-drop-over'),
  });
}

/**
 * Be told of each drop of an item of `kind`: where it came from, and the position it should take in the list it was
 * dropped on (counted before it leaves its own place). Gives the clean-up.
 */
export function onDrop(kind: string, handle: (from: Slot, to: Slot) => void): () => void {
  return monitorForElements({
    canMonitor: ({ source }) => ofKind(kind)(source.data),
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets[0];
      if (!target) return;
      const from = { list: source.data.list as string, index: source.data.index as number };
      const on = target.data;
      const index = (on.index as number) + (extractClosestEdge(on) === 'bottom' ? 1 : 0);
      handle(from, { list: on.list as string, index });
    },
  });
}

/** The position a dropped item takes in its own list, once it has left its place; undefined when it does not move. */
export function droppedAt(from: number, to: number): number | undefined {
  const final = to > from ? to - 1 : to;
  return final === from ? undefined : final;
}
