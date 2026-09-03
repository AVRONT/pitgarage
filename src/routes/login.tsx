import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LockKeyhole, Wrench } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { identity, isLoading, isLocalBypass, login, message, resumeLocalAccess } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (identity) void navigate({ to: "/", replace: true });
  }, [identity, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.ok) await navigate({ to: "/", replace: true });
  };

  if (isLoading && !submitting) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <LoaderCircle
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Verificando acesso"
        />
      </main>
    );
  }

  return (
    <main className="auth-page min-h-screen px-4 py-8 sm:px-6">
      <section className="auth-card mx-auto w-full max-w-md rounded-lg border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="brand-mark grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight">PitGarage</p>
            <p className="text-sm text-muted-foreground">Gestão da oficina</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Entre com as credenciais fornecidas pelo responsável da oficina.
          </p>
        </div>

        {message && (
          <div
            className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            role="alert"
          >
            {message}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium" htmlFor="email">
            E-mail
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-11"
              placeholder="seuemail@exemplo.com"
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="password">
            Senha
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 h-11"
              placeholder="Digite sua senha"
            />
          </label>
          <Button className="h-11 w-full" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        {import.meta.env.DEV &&
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
          !isLocalBypass && (
            <div className="mt-5 border-t pt-5 text-center">
              <Button type="button" variant="outline" onClick={resumeLocalAccess}>
                Entrar como Admin Local
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Disponível somente neste ambiente local.
              </p>
            </div>
          )}

        <p className="mt-7 text-center text-xs text-muted-foreground">
          Acesso restrito à equipe autorizada.
        </p>
      </section>
    </main>
  );
}
