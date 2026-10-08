import { useState, useMemo, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  X,
  Send,
  AlertCircle,
  TrendingUp,
  Minus,
  ArrowDown,
  Plus,
  Calendar,
  ChevronDown,
  Loader2,
  ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/utils/supabase";
import { generateAvatar } from "@/utils/avatar";
import { isTaskCompleted } from "@/lib/kanban";
import { DeleteTaskDialog } from "@/components/admin/DeleteTaskDialog";

const EMPTY_ACTIVITY: ActivityEntry[] = [];
const EMPTY_COMMENTS: Comment[] = [];

import {
  priorityColors,
  departmentColors,
  priorityDisplayNames,
  departmentDisplayNames,
} from "@/types";
import type { Task, TaskPriority, Department, ActivityEntry, Comment } from "@/types";

const priorityIcons: Record<TaskPriority, React.ReactNode> = {
  urgent: <AlertCircle size={13} />,
  high: <TrendingUp size={13} />,
  medium: <Minus size={13} />,
  low: <ArrowDown size={13} />,
};

const priorityBg: Record<TaskPriority, string> = {
  urgent: "rgba(239,68,68,0.15)",
  high: "rgba(249,115,22,0.15)",
  medium: "rgba(59,130,246,0.15)",
  low: "rgba(34,197,94,0.15)",
};

const deptBg: Record<Department, string> = {
  comercial: "rgba(168,85,247,0.15)",
  financeiro: "rgba(34,197,94,0.15)",
  suporte: "rgba(242,201,76,0.12)",
};

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-[var(--c-border)] last:border-0">
      <span className="text-[9px] font-semibold tracking-[1px] text-[var(--c-muted-3)] uppercase block mb-1.5">{label}</span>
      {children}
    </div>
  );
}

export function TaskModal() {
  const open = useStore((state) => state.taskModalOpen);
  const mode = useStore((state) => state.taskModalMode);
  const taskId = useStore((state) => state.taskModalTaskId);
  const initialColumnId = useStore((state) => state.taskModalDefaultColumnId);
  const kanbanId = useStore((state) => state.activeKanbanId);
  if (!open || !kanbanId) return null;
  return <TaskModalForm key={`${kanbanId}:${mode}:${taskId ?? initialColumnId ?? "new"}`} />;
}

function TaskModalForm() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    taskModalMode,
    taskModalTaskId,
    taskModalDefaultColumnId,
    closeTaskModal,
    tasks,
    users,
    currentUser,
    addTask,
    updateTask,
    addToast,
    fetchComments,
    fetchActivityLog,
    addComment,
    addActivityEntry,
    archiveTask,
  } = useStore();

  const columns = useStore((s) => s.columns);
  const activeKanbanId = useStore((state) => state.activeKanbanId);
  const customers = useStore((s) => s.customers);
  const statusColors = Object.fromEntries(columns.map((b) => [b.id, b.color]));
  const statusDisplayNames = Object.fromEntries(columns.map((b) => [b.id, b.name]));
  const statusBg = Object.fromEntries(columns.map((b) => [b.id, `${b.color}26`]));

  const perms = usePermissions();
  const isMobile = useIsMobile();

  const existingTask = useMemo(() => {
    if (taskModalMode === "create") return null;
    return tasks.find((t) => t.id === taskModalTaskId) || null;
  }, [taskModalMode, taskModalTaskId, tasks]);

  const isEditing = taskModalMode !== "view";

  const [formTitle, setTitle] = useState(existingTask?.title ?? "");
  const title = isEditing ? formTitle : existingTask?.title ?? formTitle;
  const [formDescription, setDescription] = useState(existingTask?.description ?? "");
  const description = isEditing ? formDescription : existingTask?.description ?? formDescription;
  const [formPriority, setPriority] = useState<TaskPriority>(existingTask?.priority ?? "medium");
  const priority = isEditing ? formPriority : existingTask?.priority ?? formPriority;
  const [formColumnId, setColumnId] = useState<string>(existingTask?.columnId ?? taskModalDefaultColumnId ?? columns[0]?.id ?? "");
  const columnId = isEditing ? formColumnId : existingTask?.columnId ?? formColumnId;
  const [formDepartment, setDepartment] = useState<Department>(existingTask?.department ?? currentUser?.department ?? "suporte");
  const department = isEditing ? formDepartment : existingTask?.department ?? formDepartment;
  const [formAssigneeId, setAssigneeId] = useState<string | null>(existingTask ? existingTask.assigneeId : currentUser?.id ?? null);
  const assigneeId = isEditing ? formAssigneeId : existingTask ? existingTask.assigneeId : formAssigneeId;
  const [formDueDate, setDueDate] = useState<string>(existingTask?.dueDate ? format(existingTask.dueDate, "yyyy-MM-dd") : "");
  const dueDate = isEditing ? formDueDate : existingTask?.dueDate ? format(existingTask.dueDate, "yyyy-MM-dd") : "";
  const [formTags, setTags] = useState<string[]>(existingTask?.tags ?? []);
  const tags = isEditing ? formTags : existingTask?.tags ?? formTags;
  const [tagInput, setTagInput] = useState("");
  const [idRfc, setIdRfc] = useState<number | null>(existingTask?.idRfc ?? null);
  const [customerId, setCustomerId] = useState<string | null>(existingTask?.customerId ?? null);
  const [customerSearch, setCustomerSearch] = useState(() => {
    const customer = customers.find((entry) => entry.id === existingTask?.customerId);
    return customer ? `${customer.cod} :: ${customer.nome}` : "";
  });
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [commentImageLoading, setCommentImageLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const commentImageRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (taskModalTaskId && taskModalMode !== "create") {
      void fetchComments(taskModalTaskId);
      void fetchActivityLog(taskModalTaskId);
    }
  }, [taskModalTaskId, taskModalMode, fetchComments, fetchActivityLog]);

  const canEdit =
    taskModalMode === "create" ||
    (existingTask &&
      perms.canEditTask(existingTask.creatorId, existingTask.assigneeId));

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!title.trim()) {
      addToast({ type: "error", title: "Erro", message: "Informe um titulo para a tarefa" });
      return;
    }

    const target = columns.find((column) => column.id === columnId);
    const taskKanbanId = existingTask?.kanbanId ?? activeKanbanId;
    if (!currentUser || !target || target.kanbanId !== taskKanbanId ||
      (taskModalMode === "create" && !perms.canCreateInColumn(columnId)) ||
      (existingTask && columnId !== existingTask.columnId && !perms.canMoveToColumn(existingTask.columnId, columnId))) {
      addToast({ type: "error", title: "Coluna inválida", message: "Selecione uma coluna permitida deste Kanban." });
      return;
    }

    savingRef.current = true;
    setSaving(true);

    if (taskModalMode === "create") {
      const newTaskId = crypto.randomUUID();
      const newTask: Task = {
        id: newTaskId,
        title: title.trim(),
        description: description.trim(),
        priority,
        columnId,
        kanbanId: target.kanbanId,
        department,
        assigneeId,
        customerId,
        creatorId: currentUser!.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags,
        displayId: "",
        idTask: 0,
        idRfc,
        attachmentsCount: 0,
        archived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const created = await addTask(newTask);
      if (!created) { savingRef.current = false; setSaving(false); return; }
      await addActivityEntry(newTaskId, {
        taskId: newTaskId,
        userId: currentUser!.id,
        action: "created",
        details: `criou a tarefa "${title.trim()}"`,
      });
      addToast({ type: "success", title: "Sucesso", message: `Tarefa criada com sucesso` });
    } else if (existingTask) {
      const updates: Partial<Task> = {};
      if (title !== existingTask.title) updates.title = title;
      if (description !== existingTask.description) updates.description = description;
      if (priority !== existingTask.priority) updates.priority = priority;
      if (columnId !== existingTask.columnId) updates.columnId = columnId;
      if (department !== existingTask.department) updates.department = department;
      if (assigneeId !== existingTask.assigneeId) updates.assigneeId = assigneeId;
      if (dueDate !== (existingTask.dueDate ? format(existingTask.dueDate, "yyyy-MM-dd") : ""))
        updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (JSON.stringify(tags) !== JSON.stringify(existingTask.tags)) updates.tags = tags;
      if (idRfc !== existingTask.idRfc) updates.idRfc = idRfc;
      if (customerId !== existingTask.customerId) updates.customerId = customerId;

      if (Object.keys(updates).length > 0) {
        const updated = await updateTask(existingTask.id, updates);
        if (!updated) { savingRef.current = false; setSaving(false); return; }
        addToast({ type: "success", title: "Sucesso", message: `Tarefa atualizada` });
      }
    }

    savingRef.current = false;
    setSaving(false);
    closeTaskModal();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const uploadCommentImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${existingTask!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comment-images").upload(path, file);
    if (error) return null;
    return supabase.storage.from("comment-images").getPublicUrl(path).data.publicUrl;
  };

  const handleSelectCommentImage = (file: File) => {
    setCommentImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setCommentImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveCommentImage = () => {
    setCommentImage(null);
    setCommentImagePreview(null);
    if (commentImageRef.current) commentImageRef.current.value = "";
  };

  const handleAddComment = async () => {
    if (!commentText.trim() && !commentImage) return;
    if (!existingTask) return;

    setCommentImageLoading(true);
    let imageUrl: string | null = null;
    if (commentImage) {
      imageUrl = await uploadCommentImage(commentImage);
      if (!imageUrl) {
        addToast({ type: "error", title: "Erro", message: "Falha ao enviar imagem." });
        setCommentImageLoading(false);
        return;
      }
    }

    const added = await addComment(existingTask.id, commentText.trim(), imageUrl);
    setCommentImageLoading(false);
    if (!added) return;
    await addActivityEntry(existingTask.id, {
      taskId: existingTask.id,
      userId: currentUser!.id,
      action: "commented",
      details: commentText.trim() ? `comentou: "${commentText.trim()}"` : "anexou uma imagem",
    });
    setCommentText("");
    handleRemoveCommentImage();
    addToast({ type: "success", title: "Sucesso", message: "Comentario adicionado" });
  };

  const task = existingTask;
  const activityLog = task?.activityLog ?? EMPTY_ACTIVITY;
  const comments = task?.comments ?? EMPTY_COMMENTS;

  // Merged feed: non-comment activity entries + comment objects
  type FeedItem =
    | { kind: "activity"; entry: (typeof activityLog)[number] }
    | { kind: "comment"; comment: (typeof comments)[number] };

  const feedItems = useMemo((): FeedItem[] => {
    const toMs = (value: Date) => value.getTime();
    const acts: FeedItem[] = activityLog
      .filter((e) => e.action !== "commented")
      .map((e) => ({ kind: "activity" as const, entry: e }));
    const cmts: FeedItem[] = comments.map((c) => ({ kind: "comment" as const, comment: c }));
    return [...acts, ...cmts].sort((a, b) => {
      const ta = a.kind === "activity" ? toMs(a.entry.createdAt) : toMs(a.comment.createdAt);
      const tb = b.kind === "activity" ? toMs(b.entry.createdAt) : toMs(b.comment.createdAt);
      return tb - ta;
    });
  }, [activityLog, comments]);

  const resolveActorName = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found?.name) return found.name;
    if (currentUser?.id === userId) return currentUser.name;
    return "Usuario";
  };

  const selectedAssignee = users.find((u) => u.id === assigneeId) || null;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 30);
    return customers
      .filter((c) => c.cod.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q))
      .slice(0, 30);
  }, [customers, customerSearch]);

  const headerBadge = {
    create: { label: "Nova Tarefa", bg: "rgba(242,201,76,0.12)", color: "#F2C94C" },
    edit: { label: "Editar Tarefa", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
    view: { label: "Visualizar", bg: "rgba(138,138,138,0.12)", color: "#8A8A8A" },
  }[taskModalMode];

  return (
    <>
    <div className={`fixed inset-0 z-40 flex ${isMobile ? "items-end" : "items-center"} justify-center`} onClick={closeTaskModal}>
      {!isMobile && <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />}
      {isMobile && <div className="absolute inset-0 bg-black/50" />}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={taskModalMode === "create" ? "Nova tarefa" : "Detalhes da tarefa"}
        className={`relative bg-[var(--c-surface)] flex flex-col overflow-hidden ${isMobile ? "w-full h-[96vh] rounded-t-2xl rounded-b-none" : "rounded-2xl max-w-[780px] w-[92vw] max-h-[88vh] shadow-[0_24px_64px_rgba(0,0,0,0.7)]"}`}
        style={{ animation: "modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modal-in {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }

          /* Hide scrollbars (TaskModal) */
          .taskmodal-scroll {
            scrollbar-width: none;
          }
          .taskmodal-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide"
              style={{ background: headerBadge.bg, color: headerBadge.color }}
            >
              {headerBadge.label}
            </span>
            {task && (
              <span className="text-[11px] font-mono text-[var(--c-muted-3)] select-all">
                #{task.idTask}
                {task.idRfc && <span className="ml-2 text-[var(--c-muted-2)]">RFC-{task.idRfc}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task && perms.canDeleteTask && <button aria-label="Excluir tarefa" title="Excluir tarefa" onClick={() => setConfirmDelete(true)} className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-[var(--c-hover)]"><Trash2 size={15} /></button>}
            {taskModalMode === "view" && task && perms.canEditTaskModal() && (
              <button
                onClick={() => useStore.getState().openTaskModal("edit", task.id)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--c-surface-3)] hover:bg-[var(--c-hover)] text-[var(--c-text-2)] text-[12px] font-semibold transition-colors border border-[var(--c-border)]"
              >
                <Pencil size={13} />
                Editar
              </button>
            )}
            <button
              aria-label="Fechar tarefa"
              onClick={closeTaskModal}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-3)] transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {confirmDelete && task && <DeleteTaskDialog task={task} onClose={() => setConfirmDelete(false)} />}
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 taskmodal-scroll">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            placeholder="Titulo da tarefa..."
            className="w-full bg-transparent text-[22px] font-semibold text-[var(--c-text)] tracking-[-0.6px] leading-snug outline-none placeholder:text-[var(--c-muted-3)] border-b border-transparent focus:border-[var(--c-border)] disabled:cursor-default pb-2 mb-5 transition-colors"
          />

          {isEditing && canEdit ? (
            /* ── EDIT / CREATE MODE ── */
            <>
              {/* Description */}
              <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva a tarefa..."
                className="w-full min-h-[90px] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-3.5 text-[14px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] resize-vertical transition-colors mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              />

              <div className={`grid gap-4 mb-5 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                {/* Priority */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Prioridade</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 md:gap-1.5 md:px-2.5 md:py-1.5 rounded-lg text-[11px] md:text-[12px] font-semibold transition-all"
                        style={{
                          background: priority === p ? priorityBg[p] : "transparent",
                          color: priority === p ? priorityColors[p] : "var(--c-muted)",
                          border: `1.5px solid ${priority === p ? priorityColors[p] + "60" : "var(--c-border)"}`,
                        }}
                      >
                        {priorityIcons[p]}
                        {priorityDisplayNames[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Status</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {columns.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setColumnId(b.id)}
                        disabled={taskModalMode === "create" ? !perms.canCreateInColumn(b.id) : !!existingTask && b.id !== existingTask.columnId && !perms.canMoveToColumn(existingTask.columnId, b.id)}
                        className="inline-flex items-center px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg text-[11px] md:text-[12px] font-semibold transition-all"
                        style={{
                          background: columnId === b.id ? `${b.color}26` : "transparent",
                          color: columnId === b.id ? b.color : "var(--c-muted)",
                          border: `1.5px solid ${columnId === b.id ? b.color + "60" : "var(--c-border)"}`,
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Responsável + Prazo + ID RFC em linha */}
              <div className={`grid gap-4 mb-5 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                {/* Assignee */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Responsável</label>
                  <div className="relative">
                    {selectedAssignee && (
                      <img
                        src={selectedAssignee.avatar}
                        alt={selectedAssignee.name}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full z-10"
                      />
                    )}
                    <select
                      value={assigneeId || ""}
                      onChange={(e) => setAssigneeId(e.target.value || null)}
                      className="w-full h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg text-[13px] text-[var(--c-text-2)] outline-none focus:border-[var(--c-border-2)] appearance-none transition-colors pr-8"
                      style={{ paddingLeft: selectedAssignee ? "2.25rem" : "0.75rem" }}
                    >
                      <option value="">Não atribuído</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] pointer-events-none" />
                  </div>
                </div>

                {/* Due date */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Prazo</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] pointer-events-none" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg pl-8 pr-3 text-[13px] text-[var(--c-text-2)] outline-none focus:border-[var(--c-border-2)] transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* ID RFC */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">ID RFC</label>
                  <input
                    type="number"
                    value={idRfc ?? ""}
                    onChange={(e) => setIdRfc(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Ex: 1042"
                    min={1}
                    className="w-full h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg px-3 text-[13px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] transition-colors font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className={`grid gap-4 mb-5 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                {/* Cliente */}
                <div className="col-span-full">
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Cliente</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); setCustomerId(null); }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                      placeholder="Buscar por código ou nome..."
                      className="w-full h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg px-3 pr-8 text-[13px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] transition-colors"
                    />
                    {customerId && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setCustomerId(null); setCustomerSearch(""); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                    {customerDropdownOpen && filteredCustomers.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-h-44 overflow-y-auto">
                        {filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            onMouseDown={() => { setCustomerId(c.id); setCustomerSearch(`${c.cod} :: ${c.nome}`); setCustomerDropdownOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--c-hover)] transition-colors"
                          >
                            <span className="font-mono text-[12px] text-[var(--c-muted-2)] shrink-0">{c.cod}</span>
                            <span className="text-[13px] text-[var(--c-text)] truncate">{c.nome}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Setor</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["comercial", "financeiro", "suporte"] as Department[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDepartment(d)}
                        className="inline-flex items-center px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[11px] md:text-[12px] font-semibold transition-all"
                        style={{
                          background: department === d ? deptBg[d] : "transparent",
                          color: department === d ? departmentColors[d] : "var(--c-muted)",
                          border: `1.5px solid ${department === d ? departmentColors[d] + "60" : "var(--c-border)"}`,
                        }}
                      >
                        {departmentDisplayNames[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--c-surface-3)] text-[var(--c-muted)] text-[11px] font-medium">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-[var(--c-text)] transition-colors">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                      placeholder="Nova tag..."
                      className="flex-1 h-7 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg px-2.5 text-[12px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] transition-colors"
                    />
                    <button
                      onClick={handleAddTag}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--c-surface-4)] text-[var(--c-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* View mode — two-column desktop, single-column mobile */
            <div className={`flex mb-5 ${isMobile ? "flex-col gap-5" : "gap-6"}`}>
              {/* Left column: description + activity/comments */}
              <div className="flex-1 min-w-0">
                {/* Description */}
                {task?.description && (
                  <div className="mb-5">
                    <span className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase block mb-2">Descrição</span>
                    <p className="text-[14px] text-[var(--c-text-2)] leading-relaxed whitespace-pre-wrap">{task.description}</p>
                  </div>
                )}

                {/* Activity / Comments */}
                {task && (
                  <div className="border-t border-[var(--c-border)] pt-4">
                    <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase mb-3 block">
                      Atividade
                    </label>
                    <div className="space-y-3 mb-4 max-h-[200px] md:max-h-[320px] overflow-y-auto taskmodal-scroll pr-1">
                      {feedItems.map((item) => {
                        const userId = item.kind === "activity" ? item.entry.userId : item.comment.userId;
                        const importedActor = item.kind === "activity" ? item.entry.externalActorName : null;
                        const actorName = importedActor || resolveActorName(userId);
                        const ts = item.kind === "activity" ? item.entry.createdAt : item.comment.createdAt;
                        return (
                          <div key={item.kind === "activity" ? item.entry.id : item.comment.id} className="flex items-start gap-2.5">
                            <img
                              src={importedActor ? generateAvatar(importedActor) : users.find((u) => u.id === userId)?.avatar || currentUser?.avatar || ""}
                              alt={actorName}
                              className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              {item.kind === "activity" ? (
                                <span className="text-[13px]">
                                  <span className="font-semibold text-[var(--c-text-2)]">{actorName}</span>{" "}
                                  <span className="text-[var(--c-muted)]">{item.entry.details}</span>
                                </span>
                              ) : (
                                <div>
                                  <span className="font-semibold text-[13px] text-[var(--c-text-2)]">{actorName}</span>
                                  {item.comment.content && (
                                    <p className="text-[13px] text-[var(--c-text-2)] mt-0.5 leading-snug">{item.comment.content}</p>
                                  )}
                                  {item.comment.imageUrl && (
                                    <button
                                      onClick={() => setLightboxUrl(item.comment.imageUrl!)}
                                      className="mt-1.5 block rounded-lg overflow-hidden border border-[var(--c-border)] hover:border-[var(--c-border-2)] transition-colors"
                                    >
                                      <img
                                        src={item.comment.imageUrl}
                                        alt="anexo"
                                        className="max-h-[160px] max-w-full object-contain bg-[var(--c-surface-3)]"
                                      />
                                    </button>
                                  )}
                                </div>
                              )}
                              <span className="text-[11px] text-[var(--c-muted-2)] mt-0.5 block">
                                {format(ts, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Comment input */}
                    <div className="flex items-start gap-2.5">
                      <img src={currentUser?.avatar} alt={currentUser?.name} className="w-7 h-7 rounded-full shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        {commentImagePreview && (
                          <div className="mb-2 relative inline-flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--c-surface-3)] border border-[var(--c-border)]">
                            <img src={commentImagePreview} alt="preview" className="w-10 h-10 rounded-md object-cover" />
                            <span className="text-[11px] text-[var(--c-muted)] truncate max-w-[120px]">{commentImage?.name}</span>
                            <button onClick={handleRemoveCommentImage} className="text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors ml-1">
                              <X size={13} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(); } }}
                            placeholder="Adicionar comentário..."
                            className="flex-1 h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-3.5 text-[13px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] transition-colors"
                          />
                          <input ref={commentImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelectCommentImage(f); }} />
                          <button
                            onClick={() => commentImageRef.current?.click()}
                            title="Anexar imagem"
                            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${commentImagePreview ? "border-[#F2C94C] text-[#F2C94C] bg-[rgba(242,201,76,0.1)]" : "border-[var(--c-border)] text-[var(--c-muted)] hover:text-[var(--c-text)] hover:border-[var(--c-border-2)] bg-[var(--c-surface-2)]"}`}
                          >
                            <ImageIcon size={15} />
                          </button>
                          <button
                            onClick={() => void handleAddComment()}
                            disabled={(!commentText.trim() && !commentImage) || commentImageLoading}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2C94C] text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F5D76A] transition-colors"
                          >
                            {commentImageLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column: metadata */}
              <div className={`${isMobile ? "w-full border-t border-[var(--c-border)] pt-4" : "w-[220px] shrink-0"} space-y-3`}>
                {/* Priority badge */}
                <div>
                  <span className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase block mb-1">Prioridade</span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold"
                    style={{ background: priorityBg[priority], color: priorityColors[priority] }}
                  >
                    {priorityIcons[priority]}
                    {priorityDisplayNames[priority]}
                  </span>
                </div>
                {/* Status badge */}
                <div>
                  <span className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase block mb-1">Status</span>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold"
                    style={{ background: statusBg[columnId], color: statusColors[columnId] }}
                  >
                    {statusDisplayNames[columnId]}
                  </span>
                </div>
                {/* Assignee */}
                <MetaRow label="Responsável">
                  {selectedAssignee ? (
                    <div className="flex items-center gap-2">
                      <img src={selectedAssignee.avatar} alt={selectedAssignee.name} className="w-5 h-5 rounded-full" />
                      <span className="text-[13px] text-[var(--c-text-2)]">{selectedAssignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-[13px] text-[var(--c-muted-2)]">Não atribuído</span>
                  )}
                </MetaRow>
                {/* Due date */}
                <MetaRow label="Prazo">
                  {dueDate ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-text-2)]">
                      <Calendar size={12} className="text-[var(--c-muted-2)]" />
                      {format(new Date(dueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[var(--c-muted-2)]">Não definido</span>
                  )}
                </MetaRow>
                {/* ID RFC */}
                {task?.idRfc && (
                  <MetaRow label="ID RFC">
                    <span className="font-mono text-[13px] text-[var(--c-text-2)]">RFC-{task.idRfc}</span>
                  </MetaRow>
                )}
                {/* Cliente */}
                {task?.customerId && (() => {
                  const c = customers.find((x) => x.id === task.customerId);
                  return c ? (
                    <MetaRow label="Cliente">
                      <span className="text-[13px] text-[var(--c-text-2)]">
                        <span className="font-mono text-[var(--c-muted-2)] mr-1.5">{c.cod}</span>{c.nome}
                      </span>
                    </MetaRow>
                  ) : null;
                })()}

                {/* Department badge */}
                <div>
                  <span className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase block mb-1">Setor</span>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold"
                    style={{ background: deptBg[department], color: departmentColors[department] }}
                  >
                    {departmentDisplayNames[department]}
                  </span>
                </div>
                {/* Tags */}
                {tags.length > 0 && (
                  <MetaRow label="Tags">
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-[var(--c-surface-3)] text-[var(--c-muted)] text-[11px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </MetaRow>
                )}

                {/* Timestamps */}
                {task && (
                  <div className="pt-3 mt-2 border-t border-[var(--c-border)] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-muted-2)]">
                      <span className="text-[var(--c-muted-3)] uppercase tracking-wider text-[9px] font-semibold">Criado</span>
                      <span>{format(task.createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-muted-2)]">
                      <span className="text-[var(--c-muted-3)] uppercase tracking-wider text-[9px] font-semibold">Editado</span>
                      <span>{format(task.updatedAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity / Comments (edit mode only — view mode shows inline) */}
          {isEditing && task && (
            <div className="border-t border-[var(--c-border)] pt-5 mt-1">
              <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted)] uppercase mb-3 block">
                Atividade
              </label>
              <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto taskmodal-scroll pr-1">
                {feedItems.map((item) => {
                  const userId = item.kind === "activity" ? item.entry.userId : item.comment.userId;
                  const importedActor = item.kind === "activity" ? item.entry.externalActorName : null;
                        const actorName = importedActor || resolveActorName(userId);
                  const ts = item.kind === "activity" ? item.entry.createdAt : item.comment.createdAt;
                  return (
                    <div key={item.kind === "activity" ? item.entry.id : item.comment.id} className="flex items-start gap-2.5">
                      <img
                        src={importedActor ? generateAvatar(importedActor) : users.find((u) => u.id === userId)?.avatar || currentUser?.avatar || ""}
                        alt={actorName}
                        className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {item.kind === "activity" ? (
                          <span className="text-[13px]">
                            <span className="font-semibold text-[var(--c-text-2)]">{actorName}</span>{" "}
                            <span className="text-[var(--c-muted)]">{item.entry.details}</span>
                          </span>
                        ) : (
                          <div>
                            <span className="font-semibold text-[13px] text-[var(--c-text-2)]">{actorName}</span>
                            {item.comment.content && (
                              <p className="text-[13px] text-[var(--c-text-2)] mt-0.5 leading-snug">{item.comment.content}</p>
                            )}
                            {item.comment.imageUrl && (
                              <button
                                onClick={() => setLightboxUrl(item.comment.imageUrl!)}
                                className="mt-1.5 block rounded-lg overflow-hidden border border-[var(--c-border)] hover:border-[var(--c-border-2)] transition-colors"
                              >
                                <img src={item.comment.imageUrl} alt="anexo" className="max-h-[120px] max-w-full object-contain bg-[var(--c-surface-3)]" />
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-[11px] text-[var(--c-muted-2)] mt-0.5 block">
                          {format(ts, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comment input */}
              <div className="flex items-start gap-2.5">
                <img src={currentUser?.avatar} alt={currentUser?.name} className="w-7 h-7 rounded-full shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  {commentImagePreview && (
                    <div className="mb-2 relative inline-flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--c-surface-3)] border border-[var(--c-border)]">
                      <img src={commentImagePreview} alt="preview" className="w-10 h-10 rounded-md object-cover" />
                      <span className="text-[11px] text-[var(--c-muted)] truncate max-w-[120px]">{commentImage?.name}</span>
                      <button onClick={handleRemoveCommentImage} className="text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors ml-1">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(); } }}
                      placeholder="Adicionar comentário..."
                      className="flex-1 h-9 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-3.5 text-[13px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] transition-colors"
                    />
                    <button
                      onClick={() => commentImageRef.current?.click()}
                      title="Anexar imagem"
                      className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${commentImagePreview ? "border-[#F2C94C] text-[#F2C94C] bg-[rgba(242,201,76,0.1)]" : "border-[var(--c-border)] text-[var(--c-muted)] hover:text-[var(--c-text)] hover:border-[var(--c-border-2)] bg-[var(--c-surface-2)]"}`}
                    >
                      <ImageIcon size={15} />
                    </button>
                    <button
                      onClick={() => void handleAddComment()}
                      disabled={(!commentText.trim() && !commentImage) || commentImageLoading}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2C94C] text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F5D76A] transition-colors"
                    >
                      {commentImageLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--c-border)]">
            <button
              onClick={closeTaskModal}
              className="h-9 px-5 border border-[var(--c-border)] text-[var(--c-muted)] text-[13px] font-medium rounded-lg hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text-2)] transition-colors"
            >
              Cancelar
            </button>
            {task &&
              taskModalMode !== "create" &&
              isTaskCompleted(task, columns) &&
              !task.archived &&
              perms.canArchiveTask() && (
                <button
                  type="button"
                  disabled={archiving || saving}
                  onClick={async () => {
                    if (archiving || saving) return;
                    setArchiving(true);
                    const ok = await archiveTask(task.id);
                    setArchiving(false);
                    if (!ok) return;
                    addToast({
                      type: "success",
                      title: "Tarefa arquivada",
                      message: "Ela foi ocultada do quadro e permanece na lista de tarefas.",
                    });
                    closeTaskModal();
                  }}
                  className="h-9 px-5 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[#F2C94C] text-[13px] font-semibold hover:bg-[var(--c-surface-3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Arquivar (oculta do quadro)"
                >
                  {archiving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Arquivar
                </button>
              )}
            <button
              disabled={saving || archiving}
              onClick={() => void handleSave()}
              className="h-9 px-5 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-lg hover:bg-[#F5D76A] transition-colors shadow-[0_0_16px_rgba(242,201,76,0.25)] hover:shadow-[0_0_24px_rgba(242,201,76,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {taskModalMode === "create" ? "Criar Tarefa →" : "Salvar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Lightbox */}
    {lightboxUrl && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={() => setLightboxUrl(null)}
      >
        <button
          onClick={() => setLightboxUrl(null)}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
        <img
          src={lightboxUrl ?? undefined}
          alt="imagem ampliada"
          className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
  </>
  );
}
