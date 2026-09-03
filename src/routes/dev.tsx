import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { platformApi } from "@/features/platform/platform-api";

export const Route = createFileRoute("/dev")({ component: DevPage });
function DevPage() {
  const { identity, isLocalBypass } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!identity) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (isLocalBypass) {
      setData({ access_events: [], registration_attempts: [], attempts_24h: 0, blocked_24h: 0 });
      return;
    }
    void platformApi
      .developerAccess()
      .then((allowed) =>
        allowed ? platformApi.developerDashboard().then(setData) : setDenied(true),
      )
      .catch(() => setDenied(true));
  }, [identity, isLocalBypass, navigate]);
  if (!identity) return null;
  if (denied)
    return (
      <main className="grid min-h-screen place-items-center text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-3 text-xl font-semibold">Acesso técnico restrito</h1>
          <Button className="mt-4" onClick={() => void navigate({ to: "/" })}>
            Voltar
          </Button>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  const accesses = (data["access_events"] ?? []) as Array<Record<string, unknown>>;
  const attempts = (data["registration_attempts"] ?? []) as Array<Record<string, unknown>>;
  return (
    <main className="min-h-screen bg-slate-50 p-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Button variant="outline" onClick={() => history.back()}>
          Voltar
        </Button>
        <h1 className="mt-6 text-2xl font-semibold">Área técnica</h1>
        <p className="text-sm text-muted-foreground">
          Build {import.meta.env.MODE} · {import.meta.env.DEV ? "desenvolvimento" : "produção"}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border bg-white p-5">
            Tentativas em 24h
            <strong className="block text-3xl">{String(data["attempts_24h"] ?? 0)}</strong>
          </article>
          <article className="rounded-lg border bg-white p-5">
            Bloqueadas em 24h
            <strong className="block text-3xl">{String(data["blocked_24h"] ?? 0)}</strong>
          </article>
        </div>
        <section className="mt-6 rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Histórico de acessos</h2>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {accesses.map((item) => (
                  <tr className="border-t" key={String(item["id"])}>
                    <td className="p-2">{String(item["event_type"])}</td>
                    <td className="p-2">{String(item["ip_address"] ?? "-")}</td>
                    <td className="p-2">{String(item["user_agent"] ?? "-")}</td>
                    <td className="p-2">
                      {new Date(String(item["created_at"])).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!accesses.length && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
          </div>
        </section>
        <section className="mt-6 rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Proteção de cadastro</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {attempts.filter((item) => item["blocked"]).length} bloqueio(s) recente(s). Turnstile:{" "}
            {import.meta.env["VITE_TURNSTILE_SITE_KEY"] ? "configurado" : "não configurado"}.
          </p>
        </section>
      </div>
    </main>
  );
}
