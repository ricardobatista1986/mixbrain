"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderTracklist } from "@/app/app/projetos/[id]/actions";

export type DragItem = {
  /**
   * Identidade da unidade arrastável: para blocos congelados é
   * `block-${block_id}`, para itens soltos é o próprio tracklist_item_id.
   * Blocos são movidos como unidade única — o conteúdo interno não é
   * reordenável por drag.
   */
  id: string;
  node: ReactNode;
  /**
   * IDs reais de set_tracklist_items representados por esta unidade, na
   * ordem interna que devem manter. Para um item solto é [item.id]. Para
   * um bloco é a lista de todos os tracklist_item_id dos membros, na
   * ordem em que já estão dentro do bloco — reorderTracklist recebe a
   * lista achatada (flat) destes IDs, nunca o id sintético `block-*`.
   */
  memberIds: string[];
};

function SortableRow({ id, node }: Pick<DragItem, "id" | "node">) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="mt-4 shrink-0 cursor-grab touch-none rounded-lg border border-claude-border bg-claude-surface px-1.5 py-3 text-claude-text-muted transition hover:text-white active:cursor-grabbing"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">{node}</div>
    </div>
  );
}

export function TracklistDragList({
  projectId,
  items,
}: {
  projectId: string;
  items: DragItem[];
}) {
  const idsKey = items.map((item) => item.id).join("|");
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const [syncedKey, setSyncedKey] = useState(idsKey);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Ressincroniza a ordem local sempre que o server re-renderiza com um
  // conjunto de IDs diferente (ex.: após aprovar candidata, criar/dissolver
  // bloco, ou revalidatePath de outra ação). Ajuste feito durante a
  // renderização (não em useEffect) para evitar um render extra em
  // cascata; evita também que o estado local do drag fique "preso" numa
  // ordem antiga depois de qualquer mutação externa.
  if (idsKey !== syncedKey) {
    setSyncedKey(idsKey);
    setOrder(items.map((item) => item.id));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemsById = new Map(items.map((item) => [item.id, item]));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const nextOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(nextOrder);
    setError(null);

    const flatItemIds = nextOrder.flatMap((id) => itemsById.get(id)?.memberIds ?? []);

    startTransition(async () => {
      try {
        await reorderTracklist(projectId, flatItemIds);
      } catch (err) {
        // Reverte a ordem otimista em caso de falha (ex.: RLS, projeto
        // removido em outra aba) e avisa o usuário.
        setOrder(order);
        setError(err instanceof Error ? err.message : "Falha ao reordenar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className={isPending ? "opacity-70 transition-opacity" : ""}>
            {order.map((id) => {
              const item = itemsById.get(id);
              if (!item) return null;
              return <SortableRow key={id} id={id} node={item.node} />;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
