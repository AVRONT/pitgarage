import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

import { useAuth, type AccessLevel } from "./auth-context";

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

export function TeamSettings() {
  const { accessLevel, isLocalBypass } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data, error } = await supabase.rpc("list_team_users");
    if (error) return setMessage("Não foi possível carregar a equipe.");
    setUsers((data ?? []) as TeamUser[]);
  };

  useEffect(() => {
    if (accessLevel === "owner" && !isLocalBypass) void load();
  }, [accessLevel, isLocalBypass]);

  if (accessLevel !== "owner") return null;
  if (isLocalBypass) {
    return (
      <section className="mt-7 rounded-lg border bg-white p-5 sm:p-6">
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
    if (user.access_level !== "customer" && !user.operational_role?.trim()) {
      return setMessage("Informe o cargo operacional para staff ou admin.");
    }
    const { error } = await supabase.rpc("administer_user_profile", {
      target_user_id: user.user_id,
      new_full_name: user.full_name,
      new_operational_role:
        user.access_level === "customer" ? null : user.operational_role?.trim() || null,
      new_access_level: user.access_level,
      new_is_active: user.is_active,
    });
    setMessage(error ? "Não foi possível atualizar este usuário." : "Usuário atualizado.");
    if (!error) await load();
  };

  return (
    <section className="mt-7 rounded-lg border bg-white p-5 sm:p-6" aria-labelledby="team-title">
      <h2 id="team-title" className="font-semibold">
        Equipe
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Somente o proprietário altera níveis de acesso. Contas nunca são excluídas por esta tela.
      </p>
      <div className="mt-5 space-y-3">
        {users.map((user) => {
          const isOwner = user.access_level === "owner";
          return (
            <article
              key={user.user_id}
              className="grid gap-3 rounded-md border p-4 lg:grid-cols-6 lg:items-end"
            >
              <div className="lg:col-span-2">
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
                  disabled={isOwner}
                  onChange={(event) =>
                    updateDraft(user.user_id, { access_level: event.target.value as AccessLevel })
                  }
                >
                  {isOwner && <option value="owner">Owner</option>}
                  {managedLevels.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium lg:col-span-2">
                Cargo
                <Input
                  className="mt-1"
                  value={user.operational_role ?? ""}
                  disabled={isOwner}
                  placeholder="Mecânico, Atendente ou Outro"
                  onChange={(event) =>
                    updateDraft(user.user_id, { operational_role: event.target.value })
                  }
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                {!isOwner ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateDraft(user.user_id, { is_active: !user.is_active })}
                    >
                      {user.is_active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button type="button" onClick={() => void save(user)}>
                      Salvar
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
