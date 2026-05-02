import { useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import type { Board } from "@/types";

const PRESET_COLORS = [
  "#A855F7", "#3B82F6", "#22C55E", "#EF4444",
  "#F97316", "#F2C94C", "#EC4899", "#14B8A6",
  "#6366F1", "#84CC16", "#F43F5E", "#8B5CF6",
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full border-2 transition-all"
          style={{
            backgroundColor: c,
            borderColor: value === c ? "#fff" : "transparent",
            boxShadow: value === c ? `0 0 0 2px ${c}` : undefined,
          }}
        />
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={7}
        placeholder="#hex"
        className="w-20 h-7 px-2 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded text-[12px] text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)] font-mono"
      />
    </div>
  );
}

interface BoardFormState {
  name: string;
  key: string;
  color: string;
  keyManuallyEdited: boolean;
}

function SortableBoardRow({ board, taskCount }: { board: Board; taskCount: number }) {
  const updateBoard = useStore((s) => s.updateBoard);
  const deleteBoard = useStore((s) => s.deleteBoard);
  const addToast = useStore((s) => s.addToast);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BoardFormState>({
    name: board.name,
    key: board.key,
    color: board.color,
    keyManuallyEdited: true,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const ok = await updateBoard(board.id, { name: form.name.trim(), color: form.color });
    setLoading(false);
    if (ok) {
      setEditing(false);
      addToast({ type: "success", title: "Quadro atualizado", message: form.name });
    } else {
      addToast({ type: "error", title: "Erro ao atualizar", message: "Tente novamente." });
    }
  };

  const handleDelete = async () => {
    if (taskCount > 0) return;
    setDeleting(true);
    const ok = await deleteBoard(board.id);
    setDeleting(false);
    if (!ok) addToast({ type: "error", title: "Erro ao excluir", message: "Tente novamente." });
  };

  const handleCancel = () => {
    setForm({ name: board.name, key: board.key, color: board.color, keyManuallyEdited: true });
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-col gap-3 p-4 bg-[var(--c-surface-3)] rounded-lg border border-[var(--c-border-2)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: form.color }} />
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="flex-1 h-9 px-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)]"
            placeholder="Nome do quadro"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <button
            onClick={() => void handleSave()}
            disabled={loading || !form.name.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[#22C55E]/15 text-[#22C55E] hover:bg-[#22C55E]/25 transition-colors disabled:opacity-40"
          >
            <Check size={15} />
          </button>
          <button
            onClick={handleCancel}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:bg-[var(--c-hover)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--c-muted-2)] font-mono">key: {board.key}</span>
          <span className="text-[10px] text-[var(--c-muted-3)]">(a key não pode ser alterada)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--c-surface-3)] rounded-lg border border-[var(--c-border)] group"
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-[var(--c-muted-3)] hover:text-[var(--c-muted)] transition-colors touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: board.color }} />

      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-medium text-[var(--c-text)]">{board.name}</span>
        <span className="ml-2 text-[11px] text-[var(--c-muted-2)] font-mono">{board.key}</span>
      </div>

      <span className="text-[11px] text-[var(--c-muted-2)] shrink-0">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </span>

      <button
        onClick={() => setEditing(true)}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
        title="Editar"
      >
        <Pencil size={14} />
      </button>

      <div className="relative group/del">
        <button
          onClick={() => void handleDelete()}
          disabled={taskCount > 0 || deleting}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={taskCount > 0 ? "Quadro possui tasks — não pode excluir" : "Excluir quadro"}
        >
          <Trash2 size={14} />
        </button>
        {taskCount > 0 && (
          <div className="absolute right-0 bottom-full mb-1.5 px-2 py-1 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded text-[11px] text-[var(--c-muted)] whitespace-nowrap pointer-events-none opacity-0 group-hover/del:opacity-100 transition-opacity z-10">
            Quadro possui tasks
          </div>
        )}
      </div>
    </div>
  );
}

export function Configuracoes() {
  const boards = useStore((s) => s.boards);
  const tasks = useStore((s) => s.tasks);
  const createBoard = useStore((s) => s.createBoard);
  const updateBoard = useStore((s) => s.updateBoard);
  const fetchBoards = useStore((s) => s.fetchBoards);
  const addToast = useStore((s) => s.addToast);

  useEffect(() => { void fetchBoards(); }, []);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<BoardFormState>({
    name: "",
    key: "",
    color: "#3B82F6",
    keyManuallyEdited: false,
  });
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const taskCountByBoard = (key: string) => tasks.filter((t) => t.status === key).length;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = boards.findIndex((b) => b.id === active.id);
    const newIndex = boards.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(boards, oldIndex, newIndex);

    // Update positions optimistically in store then persist
    useStore.setState({ boards: reordered });
    await Promise.all(
      reordered.map((b, i) => updateBoard(b.id, { position: i }))
    );
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      key: f.keyManuallyEdited ? f.key : slugify(name),
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.key.trim()) return;
    setSaving(true);
    const ok = await createBoard({ key: form.key, name: form.name.trim(), color: form.color });
    setSaving(false);
    if (ok) {
      setCreating(false);
      setForm({ name: "", key: "", color: "#3B82F6", keyManuallyEdited: false });
      addToast({ type: "success", title: "Quadro criado", message: form.name });
    } else {
      addToast({ type: "error", title: "Erro ao criar", message: "A key já pode estar em uso." });
    }
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setForm({ name: "", key: "", color: "#3B82F6", keyManuallyEdited: false });
  };

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl mx-auto py-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--c-surface-3)] flex items-center justify-center">
            <Settings size={20} className="text-[var(--c-muted)]" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--c-text)] tracking-[-0.6px]">
              Configurações
            </h1>
            <p className="text-[13px] text-[var(--c-muted)]">Gerencie os quadros do Kanban</p>
          </div>
        </div>

        {/* Section */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
            <span className="text-[13px] font-semibold text-[var(--c-text)]">Quadros</span>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 h-8 px-3 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[12px] font-semibold rounded-md transition-colors"
              >
                <Plus size={14} />
                Novo Quadro
              </button>
            )}
          </div>

          <div className="p-3 flex flex-col gap-2">
            {/* Create form */}
            {creating && (
              <div className="flex flex-col gap-3 p-4 bg-[var(--c-surface-3)] rounded-lg border border-[#F2C94C]/40">
                <p className="text-[12px] font-semibold text-[var(--c-muted)] uppercase tracking-[0.5px]">
                  Novo quadro
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: form.color }} />
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="flex-1 h-9 px-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)]"
                    placeholder="Nome do quadro"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") handleCancelCreate();
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--c-muted-2)] shrink-0">Key:</span>
                  <input
                    value={form.key}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, key: slugify(e.target.value), keyManuallyEdited: true }))
                    }
                    className="w-40 h-7 px-2 bg-[var(--c-surface)] border border-[var(--c-border)] rounded text-[12px] text-[var(--c-text)] font-mono outline-none focus:border-[var(--c-border-2)]"
                    placeholder="slug_da_key"
                  />
                  <span className="text-[10px] text-[var(--c-muted-3)]">usada no status das tasks</span>
                </div>
                <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => void handleCreate()}
                    disabled={saving || !form.name.trim() || !form.key.trim()}
                    className="h-8 px-4 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[12px] font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Criando…" : "Criar quadro"}
                  </button>
                  <button
                    onClick={handleCancelCreate}
                    className="h-8 px-4 text-[var(--c-muted)] text-[12px] hover:text-[var(--c-text)] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Sortable board list */}
            <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
              <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {boards.map((board) => (
                  <SortableBoardRow
                    key={board.id}
                    board={board}
                    taskCount={taskCountByBoard(board.key)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
