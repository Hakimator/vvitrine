import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge';

/**
 * Drag and drop of the page builder (US-135), the only place that knows the drag-and-drop library (Pragmatic drag and
 * drop, chosen in the US-135 spike): swapping it changes this file only. It is a shortcut: every move it makes is
 * also in the section's menu (WCAG 2.5.7).
 */

/** A section on a page: the page's position, and the section's position on it. */
export interface Slot {
  readonly page: number;
  readonly index: number;
}

const KIND = 'vvitrine-section';
const isSlot = (data: Record<string | symbol, unknown>): boolean => data.kind === KIND;

/** Shows where a dragged section would land: a line above or below the item under the pointer. */
const EDGE = 'data-drop-edge';

/** Let a section be dragged by its handle, and dropped before or after it. Gives the clean-up. */
export function dragSection(element: HTMLElement, handle: HTMLElement, slot: Slot): () => void {
  const clear = () => element.removeAttribute(EDGE);
  return combine(
    draggable({
      element,
      dragHandle: handle,
      getInitialData: () => ({ kind: KIND, ...slot }),
      onDragStart: () => element.setAttribute('data-dragging', ''),
      onDrop: () => element.removeAttribute('data-dragging'),
    }),
    dropTargetForElements({
      element,
      canDrop: ({ source }) => isSlot(source.data),
      getData: ({ input }) =>
        attachClosestEdge({ kind: KIND, ...slot }, { element, input, allowedEdges: ['top', 'bottom'] }),
      onDrag: ({ self }) => element.setAttribute(EDGE, extractClosestEdge(self.data) ?? 'top'),
      onDragLeave: clear,
      onDrop: clear,
    }),
  );
}

/** Let sections be dropped on a page's list, after its last one (an empty page has no item to drop on). */
export function dropOnPage(element: HTMLElement, page: number, count: number): () => void {
  return dropTargetForElements({
    element,
    canDrop: ({ source }) => isSlot(source.data),
    getData: () => ({ kind: KIND, page, index: count, edge: 'end' }),
    onDragEnter: () => element.setAttribute('data-drop-over', ''),
    onDragLeave: () => element.removeAttribute('data-drop-over'),
    onDrop: () => element.removeAttribute('data-drop-over'),
  });
}

/**
 * Be told of each drop of a section: where it came from, and the position it should take on the page it was dropped
 * on (counted before it is taken off its own page). Gives the clean-up.
 */
export function onSectionDrop(handle: (from: Slot, to: Slot) => void): () => void {
  return monitorForElements({
    canMonitor: ({ source }) => isSlot(source.data),
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets[0];
      if (!target) return;
      const from = { page: source.data.page as number, index: source.data.index as number };
      const on = target.data;
      const edge = extractClosestEdge(on);
      const index = (on.index as number) + (edge === 'bottom' ? 1 : 0);
      handle(from, { page: on.page as number, index });
    },
  });
}
