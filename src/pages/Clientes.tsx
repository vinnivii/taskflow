import { useState, useMemo, useEffect } from "react";
import { Building2, Plus, X, Pencil, Trash2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import type { Customer } from "@/types";

export function Clientes() {
  const customers = useStore((s) => s.customers);
  const fetchCustomers = useStore((s) => s.fetchCustomers);
  const createCustomer = useStore((s) => s.createCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const deleteCustomer = useStore((s) => s.deleteCustomer);
  const addToast = useStore((s) => s.addToast);
  const perms = usePermissions();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formCod, setFormCod] = useState("");
  const [formDocumento, setFormDocumento] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchCustomers().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cod.toLowerCase().includes(q) ||
        c.documento.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setFormCod("");
    setFormDocumento("");
    setFormNome("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormCod(customer.cod);
    setFormDocumento(customer.documento);
    setFormNome(customer.nome);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setFormError("");
  };

  const handleSave = async () => {
    setFormError("");
    if (!formCod.trim()) { setFormError("Informe o código."); return; }
    if (!formDocumento.trim()) { setFormError("Informe o documento."); return; }
    if (!formNome.trim()) { setFormError("Informe o nome."); return; }

    setFormLoading(true);
    if (editingCustomer) {
      const ok = await updateCustomer(editingCustomer.id, {
        cod: formCod.trim(),
        documento: formDocumento.trim(),
        nome: formNome.trim(),
      });
      setFormLoading(false);
      if (!ok) { setFormError("Erro ao atualizar cliente."); return; }
      addToast({ type: "success", title: "Cliente atualizado", message: formNome.trim() });
    } else {
      const result = await createCustomer({
        cod: formCod.trim(),
        documento: formDocumento.trim(),
        nome: formNome.trim(),
      });
      setFormLoading(false);
      if (!result.success) { setFormError(result.error ?? "Erro ao criar cliente."); return; }
      addToast({ type: "success", title: "Cliente criado", message: formNome.trim() });
    }
    closeModal();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const ok = await deleteCustomer(deleteTarget.id);
    setDeleteLoading(false);
    if (!ok) {
      addToast({ type: "error", title: "Erro ao excluir", message: "Não foi possível excluir o cliente." });
    } else {
      addToast({ type: "success", title: "Cliente excluído", message: deleteTarget.nome });
    }
    setDeleteTarget(null);
  };

  return (
    <AppLayout title="Clientes">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
            Clientes
          </h1>
          <span className="text-[13px] text-[var(--c-muted)]">
            {customers.length} cadastrados
          </span>
        </div>
        {perms.canViewClientes && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-all hover:-translate-y-px"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, código ou documento..."
          className="w-full max-w-sm h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[var(--c-muted-2)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Building2 size={48} className="text-[var(--c-muted-2)]" />
          <p className="text-[13px] text-[var(--c-muted)]">
            {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--c-border)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-border)] bg-[var(--c-surface-3)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--c-muted)] tracking-[0.3px]">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--c-muted)] tracking-[0.3px]">Documento</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--c-muted)] tracking-[0.3px]">Nome</th>
                {perms.canViewClientes && (
                  <th className="text-right px-4 py-3 font-semibold text-[var(--c-muted)] tracking-[0.3px]">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-hover)] transition-colors"
                >
                  <td className="px-4 py-3 text-[var(--c-muted)] font-mono">{customer.cod}</td>
                  <td className="px-4 py-3 text-[var(--c-text-2)]">{customer.documento}</td>
                  <td className="px-4 py-3 font-medium text-[var(--c-text)]">{customer.nome}</td>
                  {perms.canViewClientes && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(customer)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(customer)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-red-400 hover:bg-[var(--c-hover)] transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-5 gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--c-muted)]">Linhas por página:</span>
            {[20, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => handlePerPageChange(n)}
                className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                  perPage === n
                    ? "bg-[#F2C94C] text-[#0A0A0A]"
                    : "bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--c-muted-2)]">
              {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} de {filtered.length}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] text-[12px] rounded-md hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && (arr[i - 1] as number) + 1 < p) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="text-[var(--c-muted-2)] text-[12px] px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 text-[11px] font-medium rounded-md transition-colors ${
                      p === currentPage
                        ? "bg-[#F2C94C] text-[#0A0A0A]"
                        : "bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] text-[12px] rounded-md hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:items-stretch md:justify-end">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={closeModal}
          />
          <div className="relative bg-[var(--c-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in zoom-in-95 fade-in duration-350 w-[90vw] max-w-[420px] md:w-[340px] md:max-w-none rounded-xl md:rounded-none md:rounded-l-xl flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-[15px] font-semibold text-[var(--c-text)]">
                {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-muted)] mb-1.5">Código</label>
                <input
                  type="text"
                  value={formCod}
                  onChange={(e) => setFormCod(e.target.value)}
                  placeholder="Ex: 00123"
                  className="w-full h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-muted)] mb-1.5">Documento (CPF/CNPJ)</label>
                <input
                  type="text"
                  value={formDocumento}
                  onChange={(e) => setFormDocumento(e.target.value)}
                  placeholder="Ex: 000.000.000-00"
                  className="w-full h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--c-muted)] mb-1.5">Nome</label>
                <input
                  type="text"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
              </div>

              {formError && (
                <p className="text-[12px] text-red-400">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="h-9 px-4 rounded-md text-[13px] text-[var(--c-muted)] hover:bg-[var(--c-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={formLoading}
                  className="flex items-center gap-2 h-9 px-4 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formLoading && <Loader2 size={14} className="animate-spin" />}
                  {editingCustomer ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-[var(--c-surface)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in zoom-in-95 fade-in duration-350 w-[90vw] max-w-[360px] p-5">
            <h2 className="text-[15px] font-semibold text-[var(--c-text)] mb-2">Excluir cliente</h2>
            <p className="text-[13px] text-[var(--c-muted)] leading-relaxed mb-5">
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold text-[var(--c-text)]">{deleteTarget.nome}</span>?
              {" "}Essa ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-md text-[13px] text-[var(--c-muted)] hover:bg-[var(--c-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleteLoading}
                className="flex items-center gap-2 h-9 px-4 bg-red-500 text-white text-[13px] font-semibold rounded-md hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
