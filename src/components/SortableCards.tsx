import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCardsProps {
  ids: (string | number)[];
  /** Called with the new id order after a drop. */
  onReorder: (nextIds: (string | number)[]) => void;
  children: ReactNode;
  label: string;
}

/** Grid whose cards can be reordered by dragging (mouse, touch) or with the keyboard. */
export function SortableCards({ ids, onReorder, children, label }: SortableCardsProps) {
  const sensors = useSensors(
    // A small distance lets clicks on buttons inside a card still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as string | number);
    const to = ids.indexOf(over.id as string | number);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul className="file-cards" aria-label={label}>
          {children}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function SortableCard({ id, children, className = '' }: { id: string | number; children: ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      className={`file-card${isDragging ? ' file-card--dragging' : ''} ${className}`.trim()}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      role="listitem"
      {...listeners}
    >
      {children}
    </li>
  );
}
