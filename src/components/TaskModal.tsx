import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";

import {
  priorityColors,
  statusColors,
  departmentColors,
  priorityDisplayNames,
  statusDisplayNames,
  departmentDisplayNames,
} from "@/types";
import type { Task, TaskPriority, TaskStatus, Department } from "@/types";

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

const statusBg: Record<TaskStatus, string> = {
  novo: "rgba(168,85,247,0.15)",
  em_andamento: "rgba(59,130,246,0.15)",
  em_revisao: "rgba(249,115,22,0.15)",
  concluido: "rgba(34,197,94,0.15)",
  bloqueado: "rgba(239,68,68,0.15)",
};

const deptBg: Record<Department, string> = {
  comercial: "rgba(168,85,247,0.15)",
  financeiro: "rgba(34,197,94,0.15)",
  suporte: "rgba(242,201,76,0.12)",
};

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-[#1A1A1A] last:border-0">
      <span className="text-[9px] font-semibold tracking-[1px] text-[var(--c-muted-3)] uppercase block mb-1.5">{label}</span>
      {children}
    </div>
  );
}

export function TaskModal() {
  const {
    taskModalOpen,
    taskModalMode,
    taskModalTaskId,
    taskModalDefaultStatus,
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

  const perms = usePermissions();

  const existingTask = useMemo(() => {
    if (taskModalMode === "create") return null;
    return tasks.find((t) => t.id === taskModalTaskId) || null;
  }, [taskModalMode, taskModalTaskId, tasks]);

  const isEditing = taskModalMode !== "view";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>(taskModalDefaultStatus || "novo");
  const [department, setDepartment] = useState<Department>("suporte");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (taskModalTaskId && taskModalMode !== "create") {
      void fetchComments(taskModalTaskId);
      void fetchActivityLog(taskModalTaskId);
    }
  }, [taskModalTaskId, taskModalMode]);

  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description);
      setPriority(existingTask.priority);
      setStatus(existingTask.status);
      setDepartment(existingTask.department);
      setAssigneeId(existingTask.assigneeId);
      setDueDate(existingTask.dueDate ? format(existingTask.dueDate, "yyyy-MM-dd") : "");
      setTags(existingTask.tags);
    } else if (taskModalMode === "create") {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus(taskModalDefaultStatus || "novo");
      setDepartment(currentUser?.department || "suporte");
      setAssigneeId(currentUser?.id || null);
      setDueDate("");
      setTags([]);
    }
  }, [existingTask, taskModalMode, taskModalDefaultStatus, currentUser?.department]);

  const canEdit =
    taskModalMode === "create" ||
    (existingTask &&
      perms.canEditTask(existingTask.creatorId, existingTask.assigneeId));

  const handleSave = async () => {
    if (!title.trim()) {
      addToast({ type: "error", title: "Erro", message: "Informe um titulo para a tarefa" });
      return;
    }

    if (taskModalMode === "create") {
      const newTaskId = crypto.randomUUID();
      const newTask: Task = {
        id: newTaskId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        department,
        assigneeId,
        creatorId: currentUser!.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags,
        displayId: "",
        attachmentsCount: 0,
        archived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const created = await addTask(newTask);
      if (!created) return;
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
      const statusChanged = status !== existingTask.status;
      if (statusChanged) updates.status = status;
      if (assigneeId !== existingTask.assigneeId) updates.assigneeId = assigneeId;
      if (dueDate !== (existingTask.dueDate ? format(existingTask.dueDate, "yyyy-MM-dd") : ""))
        updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (JSON.stringify(tags) !== JSON.stringify(existingTask.tags)) updates.tags = tags;

      if (Object.keys(updates).length > 0) {
        const updated = await updateTask(existingTask.id, updates);
        if (!updated) return;
        if (statusChanged) {
          await addActivityEntry(existingTask.id, {
            taskId: existingTask.id,
            userId: currentUser!.id,
            action: "status_changed",
            details: `alterou o status para ${statusDisplayNames[status]}`,
          });
        }
        addToast({ type: "success", title: "Sucesso", message: `Tarefa atualizada` });
      }
    }

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

  const handleAddComment = async () => {
    if (!commentText.trim() || !existingTask) return;
    const added = await addComment(existingTask.id, commentText.trim());
    if (!added) return;
    await addActivityEntry(existingTask.id, {
      taskId: existingTask.id,
      userId: currentUser!.id,
      action: "commented",
      details: `comentou: "${commentText.trim()}"`,
    });
    setCommentText("");
    addToast({ type: "success", title: "Sucesso", message: "Comentario adicionado" });
  };

  const task = existingTask;
  const activityLog = task?.activityLog || [];
  const sortedActivityLog = useMemo(() => {
    const toMs = (value: unknown) => {
      const d = value instanceof Date ? value : new Date(value as string);
      const ms = d.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    return [...activityLog].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  }, [activityLog]);
  const resolveActorName = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found?.name) return found.name;
    if (currentUser?.id === userId) return currentUser.name;
    return "Usuario";
  };

  const selectedAssignee = users.find((u) => u.id === assigneeId) || null;

  const headerBadge = {
    create: { label: "Nova Tarefa", bg: "rgba(242,201,76,0.12)", color: "#F2C94C" },
    edit: { label: "Editar Tarefa", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
    view: { label: "Visualizar", bg: "rgba(138,138,138,0.12)", color: "#8A8A8A" },
  }[taskModalMode];

  if (!taskModalOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={closeTaskModal}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative bg-[var(--c-surface)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] max-w-[780px] w-[92vw] max-h-[88vh] flex flex-col overflow-hidden"
        style={{ animation: "modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modal-in {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }

          /* Minimal dark scrollbars (TaskModal only) */
          .taskmodal-scroll {
            scrollbar-width: thin;
            scrollbar-color: #111 transparent;
          }
          .taskmodal-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .taskmodal-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .taskmodal-scroll::-webkit-scrollbar-thumb {
            background: #111;
            border-radius: 999px;
          }
          .taskmodal-scroll::-webkit-scrollbar-thumb:hover {
            background: #1f1f1f;
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
              <span className="text-[11px] font-mono text-[var(--c-muted-3)] select-all">{task.displayId || task.id.slice(0, 8)}</span>
            )}
          </div>
          <button
            onClick={closeTaskModal}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A5A5A] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-3)] transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            placeholder="Titulo da tarefa..."
            className="w-full bg-transparent text-[22px] font-semibold text-[var(--c-text)] tracking-[-0.6px] leading-snug outline-none placeholder:text-[#333] border-b border-transparent focus:border-[var(--c-border)] disabled:cursor-default pb-2 mb-5 transition-colors"
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
                className="w-full min-h-[90px] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-3.5 text-[14px] text-[var(--c-text-2)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)] resize-vertical transition-colors mb-6"
              />

              <div className="grid grid-cols-2 gap-4 mb-5">
                {/* Priority */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Prioridade</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                        style={{
                          background: priority === p ? priorityBg[p] : "transparent",
                          color: priority === p ? priorityColors[p] : "#555",
                          border: `1.5px solid ${priority === p ? priorityColors[p] + "60" : "#242424"}`,
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
                    {(["novo", "em_andamento", "em_revisao", "concluido", "bloqueado"] as TaskStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                        style={{
                          background: status === s ? statusBg[s] : "transparent",
                          color: status === s ? statusColors[s] : "#555",
                          border: `1.5px solid ${status === s ? statusColors[s] + "60" : "#242424"}`,
                        }}
                      >
                        {statusDisplayNames[s]}
                      </button>
                    ))}
                  </div>
                </div>

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

                {/* Department */}
                <div>
                  <label className="text-[10px] font-semibold tracking-[1px] text-[var(--c-muted-2)] uppercase mb-2 block">Setor</label>
                  <div className="flex gap-1.5">
                    {(["comercial", "financeiro", "suporte"] as Department[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDepartment(d)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                        style={{
                          background: department === d ? deptBg[d] : "transparent",
                          color: department === d ? departmentColors[d] : "#555",
                          border: `1.5px solid ${department === d ? departmentColors[d] + "60" : "#242424"}`,
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
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--c-surface-4)] text-[var(--c-muted)] hover:text-[var(--c-text)] hover:bg-[#2A2A2A] transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* View mode — right-rail badges */
            <div className="flex gap-6 mb-5">
              <div className="flex-1" />
              <div className="w-[200px] shrink-0 space-y-3">
                {/* Priority badge */}
                <div>
                  <span className="text-[10px] font-semibold tracking-[1px] text-[#555] uppercase block mb-1">Prioridade</span>
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
                  <span className="text-[10px] font-semibold tracking-[1px] text-[#555] uppercase block mb-1">Status</span>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold"
                    style={{ background: statusBg[status], color: statusColors[status] }}
                  >
                    {statusDisplayNames[status]}
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
                    <span className="text-[13px] text-[#666]">Não atribuído</span>
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
                    <span className="text-[13px] text-[#666]">Sem prazo</span>
                  )}
                </MetaRow>
                {/* Department badge */}
                <div>
                  <span className="text-[10px] font-semibold tracking-[1px] text-[#555] uppercase block mb-1">Setor</span>
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
                    <div className="flex items-center gap-1.5 text-[11px] text-[#3A3A3A]">
                      <span className="text-[#2A2A2A] uppercase tracking-wider text-[9px] font-semibold">Criado</span>
                      <span>{format(task.createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#3A3A3A]">
                      <span className="text-[#2A2A2A] uppercase tracking-wider text-[9px] font-semibold">Editado</span>
                      <span>{format(task.updatedAt, "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity / Comments */}
          {task && (
            <>
              <div className="border-t border-[#1E1E1E] pt-5 mt-1">
                <label className="text-[10px] font-semibold tracking-[1px] text-[#555] uppercase mb-3 block">
                  Atividade
                </label>
                <div className="space-y-3 mb-4">
                  {activityLog.map((entry) => {
                    const actorName = resolveActorName(entry.userId);
                    return (
                      <div key={entry.id} className="flex items-start gap-2.5">
                        <img
                          src={users.find((u) => u.id === entry.userId)?.avatar || currentUser?.avatar || ""}
                          alt={actorName}
                          className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px]">
                            <span className="font-semibold text-[#E0E0E0]">{actorName}</span>{" "}
                            <span className="text-[#666]">{entry.details}</span>
                          </span>
                          <span className="text-[11px] text-[#444] ml-2">
                            {format(entry.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser?.avatar}
                    alt={currentUser?.name}
                    className="w-7 h-7 rounded-full shrink-0"
                  />
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddComment();
                    }}
                    placeholder="Adicionar comentário..."
                    className="flex-1 h-9 bg-[#1A1A1A] border border-[#242424] rounded-xl px-3.5 text-[13px] text-[#E0E0E0] placeholder:text-[#444] outline-none focus:border-[#333] transition-colors"
                  />
                  <button
                    onClick={() => void handleAddComment()}
                    disabled={!commentText.trim()}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F2C94C] text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F5D76A] transition-colors"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
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
              task.status === "concluido" &&
              !task.archived &&
              perms.canArchiveTask() && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await archiveTask(task.id);
                    if (!ok) return;
                    addToast({
                      type: "success",
                      title: "Tarefa arquivada",
                      message: "Ela foi ocultada do quadro e permanece na lista de tarefas.",
                    });
                    closeTaskModal();
                  }}
                  className="h-9 px-5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#F2C94C] text-[13px] font-semibold hover:bg-[#222] transition-colors"
                  title="Arquivar (oculta do quadro)"
                >
                  Arquivar
                </button>
              )}
            <button
              onClick={() => void handleSave()}
              className="h-9 px-5 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-lg hover:bg-[#F5D76A] transition-colors shadow-[0_0_16px_rgba(242,201,76,0.25)] hover:shadow-[0_0_24px_rgba(242,201,76,0.4)]"
            >
              {taskModalMode === "create" ? "Criar Tarefa →" : "Salvar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
