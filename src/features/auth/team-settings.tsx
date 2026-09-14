import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

import { useAuth, type AccessLevel } from "./auth-context";
import { InviteForm } from "./invite-form";

type TeamUser = {
  user_id: string;
  full_name: string | null;
  email: string;
  access_level: AccessLevel;
  operational_role: string | null;
  is_active: boolean;
  customer_id: string | null;
};

const managedLevels: AccessLevel[] = ["customer", "staff", "admin"];
const ownerManagedLevels: AccessLevel[] = ["customer", "staff", "admin", "owner"];
const standardRoles = ["Mecânico", "Atendente", "Gestor da oficina", "Administrativo"] as const;

const roleSelection = (role: string | null) =>
  standardRoles.includes(role as (typeof standardRoles)[number]) ? role : role ? "Outro" : "";

export function TeamSettings() {
  const { accessLevel, isLocalBypass } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customRoleUsers, setCustomRoleUsers] = useState<Set<string>>(new Set());
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase.rpc("list_team_users");
      if (error) throw error;
      const loaded = (data ?? []) as TeamUser[];
      setUsers(loaded);
      setCustomRoleUsers(
        new Set(
          loaded
            .filter(
              (user) => user.operational_role && roleSelection(user.operational_role) === "Outro",
            )
            .map((user) => user.user_id),
        ),
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessLevel === "owner" && !isLocalBypass) void load();
  }, [accessLevel, isLocalBypass, load]);

  if (accessLevel !== "owner") return null;
  if (isLocalBypass) {
    return (
      <section id="equipe" className="mt-7 scroll-mt-28 rounded-lg border bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Equipe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão de usuários indisponível no Admin Local isolado. Nenhuma consulta cloud foi feita.
        </p>
      </section>
    );
  }

  const updateDraft = (userId: string, patch: Partial<TeamUser>) =>
    setUsers((current) =>
      current.map((user) => (user.user_id === userId ? { ...user, ...patch } : user)),
    );

  const save = async (user: TeamUser) => {
    if (savingRef.current || accessLevel !== "owner" || user.access_level === "owner") return;
    if (user.access_level !== "customer" && !user.operational_role?.trim()) {
      return setMessage("Informe o cargo operacional para staff ou admin.");
    }
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("administer_user_profile", {
        target_user_id: user.user_id,
        new_full_name: user.full_name as string,
        new_operational_role: (user.access_level === "customer"
          ? null
          : user.operational_role?.trim() || null) as string,
        new_access_level: user.access_level,
        new_is_active: user.is_active,
      });
      if (error) throw error;
      setMessage("Usuário atualizado.");
      await load();
    } catch {
      setMessage(
        "Não foi possível confirmar a atualização. Seus ajustes foram mantidos; confira a conexão e tente novamente.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section
      id="equipe"
      className="mt-7 scroll-mt-28 rounded-lg border bg-white p-5 sm:p-6"
      aria-labelledby="team-title"
    >
      <h2 id="team-title" className="font-semibold">
        Equipe
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Somente o proprietário altera níveis de acesso. Contas nunca são excluídas por esta tela.{" "}
        Ajuste o nível, cargo e situação e clique em Salvar para confirmar.
      </p>
      <InviteForm />
      {loading && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Carregando equipe…
        </p>
      )}
      {loadError && (
        <div className="mt-4 text-sm" role="alert">
          <p>Não foi possível carregar a equipe. Nenhuma conta foi removida.</p>
          <Button
            className="mt-2"
            variant="outline"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {!loading && !loadError && users.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma conta disponível para gestão. Confira seu acesso de proprietário.
        </p>
      )}
      <div className="mt-5 space-y-3">
        {users.map((user) => {
          const isOwner = user.access_level === "owner";
          return (
            <article
              key={user.user_id}
              className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end"
            >
              <div className="min-w-0 break-words sm:col-span-2 xl:col-span-2">
                <p className="font-medium">{user.full_name || "Nome não informado"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                {user.customer_id && (
                  <p className="text-xs text-emerald-700">Vinculado a cliente</p>
                )}
              </div>
              <label className="text-xs font-medium">
                Nível
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={user.access_level}
                  disabled={isOwner || saving || loading || loadError}
                  onChange={(event) =>
                    updateDraft(user.user_id, { access_level: event.target.value as AccessLevel })
                  }
                >
                  {isOwner && <option value="owner">Owner</option>}
                  {managedLevels.map((level) => (
                    <option key={level} value={level}>
                      {
                        {
                          customer: "Cliente",
                          staff: "Equipe",
                          admin: "Administrador",
                          owner: "Proprietário",
                        }[level]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-medium xl:col-span-2">
                <label htmlFor={`role-${user.user_id}`}>Cargo</label>
                <select
                  id={`role-${user.user_id}`}
                  className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={
                    isOwner
                      ? "Proprietário"
                      : customRoleUsers.has(user.user_id)
                        ? "Outro"
                        : (roleSelection(user.operational_role) ?? "")
                  }
                  disabled={
                    isOwner || user.access_level === "customer" || saving || loading || loadError
                  }
                  onChange={(event) => {
                    const custom = event.target.value === "Outro";
                    setCustomRoleUsers((current) => {
                      const next = new Set(current);
                      if (custom) next.add(user.user_id);
                      else next.delete(user.user_id);
                      return next;
                    });
                    updateDraft(user.user_id, {
                      operational_role: custom ? "" : event.target.value,
                    });
                  }}
                >
                  {isOwner ? (
                    <option value="Proprietário">Proprietário</option>
                  ) : (
                    <>
                      <option value="">Selecione o cargo</option>
                      {standardRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                      <option value="Outro">Outro</option>
                    </>
                  )}
                </select>
                {!isOwner &&
                  user.access_level !== "customer" &&
                  customRoleUsers.has(user.user_id) && (
                    <Input
                      className="mt-2"
                      aria-label="Cargo personalizado"
                      value={user.operational_role ?? ""}
                      disabled={saving || loading || loadError}
                      maxLength={80}
                      placeholder="Informe o cargo"
                      onChange={(event) =>
                        updateDraft(user.user_id, { operational_role: event.target.value })
                      }
                    />
                  )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2 xl:col-span-1">
                {!isOwner ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || loading || loadError}
                      onClick={() => updateDraft(user.user_id, { is_active: !user.is_active })}
                    >
                      {user.is_active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      type="button"
                      disabled={saving || loading || loadError}
                      onClick={() => void save(user)}
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Protegido</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {message && (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
