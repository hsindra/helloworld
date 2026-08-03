'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ReorderRow<T> {
  /** Identifica a linha na tela de ordenar (não persiste) — precisa ser
   * único mesmo quando a mesma música aparece duas vezes no setlist. */
  uid: string;
  title: string;
  preferredKey: string;
  /** O item original (ex: `ResolvedSetlistItem`) — devolvido intacto em
   * `onDone`, na nova ordem, pra quem chamou não precisar remontar nada. */
  item: T;
}

function SortableRow<T>({ row, onRemove }: { row: ReorderRow<T>; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
  });

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'reorder-row dragging' : 'reorder-row'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="reorder-handle" aria-label="Arrastar" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <span className="reorder-title">{row.title}</span>
      <span className="badge badge-tom">{row.preferredKey}</span>
      <button type="button" className="reorder-remove" aria-label="Remover" onClick={onRemove}>
        ×
      </button>
    </li>
  );
}

export default function SetlistReorder<T>({
  title,
  items,
  onDone,
  onCancel,
}: {
  title: string;
  items: ReorderRow<T>[];
  onDone: (items: ReorderRow<T>[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(items);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((current) => {
      const oldIndex = current.findIndex((r) => r.uid === active.id);
      const newIndex = current.findIndex((r) => r.uid === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  return (
    <div className="reorder-panel">
      <button type="button" className="back-button" onClick={onCancel} aria-label="Voltar" title="Voltar">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <h2 className="reorder-heading">{title}</h2>

      {rows.length === 0 ? (
        <p className="meta">Nenhuma música neste setlist.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
            <ul className="reorder-list">
              {rows.map((row) => (
                <SortableRow
                  key={row.uid}
                  row={row}
                  onRemove={() => setRows((current) => current.filter((r) => r.uid !== row.uid))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="actions">
        <button type="button" onClick={() => onDone(rows)}>
          Concluir
        </button>
      </div>
    </div>
  );
}
