import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });
const errorMessage = (error: { code?: string | undefined }) =>
  error.code === "weak_password"
    ? "Senha muito fraca. Use uma combinação menos previsível de letras, números e símbolos."
    : "O link expirou ou a sessão de recuperação é inválida. Solicite um novo link.";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setFeedback(errorMessage(error));
    setFeedback("Senha atualizada com sucesso.");
    setTimeout(() => void navigate({ to: "/login", replace: true }), 1200);
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
          className="mt-5"
          type="password"
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        {feedback && (
          <p className="mt-3 text-sm" role="status">
            {feedback}
          </p>
        )}
        <Button className="mt-4 w-full" disabled={saving}>
          {saving ? "Salvando…" : "Atualizar senha"}
        </Button>
      </form>
    </main>
  );
}
