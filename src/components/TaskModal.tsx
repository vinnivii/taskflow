import { useState, useMemo, useEffect } from "react";
import { X, Send, User, Clock, Tag, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";

import {
  priorityColors,
  statusColors,
  priorityDisplayNames,
  statusDisplayNames,
  departmentDisplayNames,
  roleDisplayNames,
} from "@/types";
import type { Task, TaskPriority, TaskStatus, Department } from "@/types";

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

  // Fetch comments and activity when opening an existing task
  useEffect(() => {
    if (taskModalTaskId && taskModalMode !== "create") {
      void fetchComments(taskModalTaskId);
      void fetchActivityLog(taskModalTaskId);
    }
  }, [taskModalTaskId, taskModalMode]);

  // Populate form when viewing/editing existing task
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
      setAssigneeId(null);
      setDueDate("");
      setTags([]);
    }
  }, [existingTask, taskModalMode, taskModalDefaultStatus, currentUser?.department]);

  if (!taskModalOpen) return null;

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
      addToast({ type: "success", title: "Sucesso", message: `Tarefa ${newTask.id} criada` });
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
        addToast({ type: "success", title: "Sucesso", message: `Tarefa ${existingTask.id} atualizada` });
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
  const resolveActorName = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found?.name) return found.name;
    if (currentUser?.id === userId) return currentUser.name;
    return "Usuario";
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" onClick={closeTaskModal}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Dialog */}
      <div
        className="relative bg-[#141414] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[720px] w-[90vw] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-350"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
          <span className="text-[11px] font-medium tracking-[0.5px] text-[#5A5A5A] font-mono">
            {task ? task.id : "Nova Tarefa"}
          </span>
          <button
            onClick={closeTaskModal}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            placeholder="Titulo da tarefa..."
            className="w-full bg-transparent text-[24px] font-semibold text-[#F0F0F0] tracking-[-0.8px] leading-[30px] outline-none placeholder:text-[#3A3A3A] border-b border-transparent focus:border-[#2A2A2A] disabled:cursor-default pb-2 mb-4"
          />

          <div className="flex gap-6">
            {/* Left column */}
            <div className="flex-1 min-w-0">
              {/* Description */}
              <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-2 block">
                Descricao
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
                placeholder="Descreva a tarefa..."
                className="w-full min-h-[120px] bg-[#1E1E1E] border border-[#2A2A2A] rounded-md p-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A] resize-vertical disabled:opacity-60"
              />

              {/* Activity / Comments */}
              {task && (
                <>
                  <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mt-6 mb-2 block">
                    Atividade
                  </label>
                  <div className="space-y-3 mb-4">
                    {activityLog.map((entry) => {
                      const actorName = resolveActorName(entry.userId);
                      return (
                        <div key={entry.id} className="flex items-start gap-2">
                          <img
                            src={users.find((u) => u.id === entry.userId)?.avatar || currentUser?.avatar || ""}
                            alt={actorName}
                            className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] text-[#8A8A8A]">
                              <span className="font-semibold text-[#F0F0F0]">{actorName}</span>{" "}
                              <span className="text-[#8A8A8A]">{entry.details}</span>
                            </span>
                            <span className="text-[11px] text-[#5A5A5A] ml-2">
                              {format(entry.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comment input */}
                  <div className="flex items-center gap-2">
                    <img
                      src={currentUser?.avatar}
                      alt={currentUser?.name}
                      className="w-6 h-6 rounded-full shrink-0"
                    />
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAddComment();
                      }}
                      placeholder="Adicionar comentario..."
                      className="flex-1 h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                    />
                    <button
                      onClick={() => void handleAddComment()}
                      disabled={!commentText.trim()}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-[#F2C94C] text-[#0A0A0A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5D76A] transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Right column - Metadata */}
            <div className="w-[220px] shrink-0 space-y-4">
              {/* Status */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  disabled={!canEdit}
                  className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A] disabled:opacity-60"
                >
                  {Object.entries(statusDisplayNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Responsavel
                </label>
                <select
                  value={assigneeId || ""}
                  onChange={(e) => setAssigneeId(e.target.value || null)}
                  disabled={!canEdit}
                  className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A] disabled:opacity-60"
                >
                  <option value="">Nao atribuido</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={!canEdit}
                  className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A] disabled:opacity-60"
                >
                  {Object.entries(priorityDisplayNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Prazo
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A] disabled:opacity-60"
                />
              </div>

              {/* Department */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Setor
                </label>
                {taskModalMode === "create" ? (
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A]"
                  >
                    {Object.entries(departmentDisplayNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold"
                    style={{
                      backgroundColor:
                        department === "comercial"
                          ? "rgba(168, 85, 247, 0.15)"
                          : department === "financeiro"
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(242, 201, 76, 0.12)",
                      color:
                        department === "comercial"
                          ? "#A855F7"
                          : department === "financeiro"
                          ? "#22C55E"
                          : "#F2C94C",
                    }}
                  >
                    {departmentDisplayNames[department]}
                  </span>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2A2A2A] text-[#8A8A8A] text-[10px] font-semibold"
                    >
                      {tag}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-[#F0F0F0]"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                      placeholder="Nova tag..."
                      className="flex-1 h-7 bg-[#1E1E1E] border border-[#2A2A2A] rounded px-2 text-[11px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                    />
                  </div>
                )}
              </div>

              {/* Created/Updated */}
              {task && (
                <div className="pt-3 border-t border-[#2A2A2A] space-y-1">
                  <div className="text-[11px] text-[#5A5A5A]">
                    Criado: {format(task.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                  <div className="text-[11px] text-[#5A5A5A]">
                    Atualizado: {format(task.updatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2A2A2A]">
            <button
              onClick={closeTaskModal}
              className="h-9 px-4 border border-[#2A2A2A] text-[#8A8A8A] text-[13px] font-medium rounded-md hover:bg-[#1E1E1E] hover:text-[#F0F0F0] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              className="h-9 px-4 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-colors"
            >
              {taskModalMode === "create" ? "Criar Tarefa" : "Salvar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
