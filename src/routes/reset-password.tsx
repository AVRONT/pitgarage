import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  consumePasswordRecovery,
  preparePasswordRecovery,
  validatePasswordRecovery,
} from "@/features/auth/password-recovery";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });
const errorMessage = (error: { code?: string | undefined }) =>
  error.code === "weak_password"
    ? "Senha muito fraca. Use uma combinação menos previsível de letras, números e símbolos."
    : error.code === "same_password"
      ? "Escolha uma senha diferente da senha atual."
      : "Não foi possível atualizar a senha. Tente novamente. Se o problema continuar, solicite um novo link.";

const invalidLink = "Este link expirou ou é inválido. Solicite um novo.";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<"validating" | "ready" | "invalid" | "ending" | "success">(
    "validating",
  );
  const savingRef = useRef(false);
  useEffect(() => {
    let active = true;
    void preparePasswordRecovery()
      .then(async (valid) => {
        const verified = valid && (await validatePasswordRecovery());
        if (active) setState(verified ? "ready" : "invalid");
      })
      .catch(() => {
        if (active) setState("invalid");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (state !== "success") return;
    // Display duration only; session validation never relies on a timer.
    const timer = window.setTimeout(() => void navigate({ to: "/login", replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [state, navigate]);
  const finishRecovery = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setFeedback("Senha atualizada com sucesso.");
      setState("success");
    } catch {
      setFeedback(
        "Senha atualizada com sucesso. Não foi possível encerrar a sessão. Tente novamente para ir ao login.",
      );
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state !== "ready" || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFeedback("");
    try {
      if (!(await validatePasswordRecovery())) {
        setState("invalid");
        return;
      }
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error || !data.user) {
        if (import.meta.env.DEV && error) console.error("updateUser falhou", error);
        const expired =
          error?.status === 401 ||
          error?.status === 403 ||
          /session|jwt|expired/i.test(error?.message ?? "");
        if (expired) {
          consumePasswordRecovery();
          setState("invalid");
          return;
        }
        setFeedback(
          error
            ? errorMessage(error)
            : "Não foi possível confirmar a atualização. Tente novamente.",
        );
        return;
      }

      consumePasswordRecovery();
      setPassword("");
      setState("ending");
      setFeedback("Senha atualizada com sucesso.");
      await finishRecovery();
    } catch {
      setFeedback(
        "Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <main className="auth-page grid min-h-screen place-items-center p-4">
      <form
        onSubmit={submit}
        className="auth-card w-full max-w-md rounded-lg border bg-white p-6 shadow-lg"
      >
        <h1 className="text-2xl font-semibold">Criar nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use uma combinação forte e pouco previsível.
        </p>
        <Input
          aria-label="Nova senha"
          disabled={state !== "ready" || saving}
          className="mt-5"
          type="password"
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        {state === "validating" && (
          <p className="mt-3 text-sm" role="status">
            Validando link de recuperação…
          </p>
        )}
        {state === "invalid" && (
          <p className="mt-3 text-sm" role="alert">
            {invalidLink}
          </p>
        )}
        {feedback && (
          <p className="mt-3 text-sm" role="status">
            {feedback}
          </p>
        )}
        <Button className="mt-4 w-full" disabled={saving || state !== "ready"}>
          {saving ? "Salvando…" : "Atualizar senha"}
        </Button>
        {state === "ending" && (
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void finishRecovery().finally(() => setSaving(false));
            }}
          >
            Encerrar sessão e ir ao login
          </Button>
        )}
        {state === "invalid" && (
          <a href="/login" className="mt-4 block text-center text-sm text-primary underline">
            Voltar ao login e solicitar novo link
          </a>
        )}
      </form>
    </main>
  );
}
