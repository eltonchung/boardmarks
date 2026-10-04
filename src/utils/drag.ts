import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
// Nested Collection drop zones must not intercept keyboard sorting of their own children.
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const kind = args.context.active?.data.current?.type;
  if (kind === 'tab') {
    const rect = args.context.collisionRect;
    if (!rect || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
    event.preventDefault();
    const candidates = args.context.droppableContainers
      .getEnabled()
      .filter((c) => c.data.current?.type === 'collection-drop')
      .map((c) => args.context.droppableRects.get(c.id))
      .filter((r) => !!r)
      .map((r) => ({ x: r.left, y: r.top, dx: r.left - rect.left, dy: r.top - rect.top }))
      .filter((p) =>
        event.code === 'ArrowLeft'
          ? p.dx < -1
          : event.code === 'ArrowRight'
            ? p.dx > 1
            : event.code === 'ArrowUp'
              ? p.dy < -1
              : p.dy > 1,
      )
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
    return candidates[0];
  }
  const droppableRects = new Map(
    [...args.context.droppableRects].filter(
      ([id]) => args.context.droppableContainers.get(id)?.data.current?.type === kind,
    ),
  );
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableRects },
  });
};
