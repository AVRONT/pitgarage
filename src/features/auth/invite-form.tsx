import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
export function InviteForm({
  initialEmail = "",
  fullName = "",
}: {
  initialEmail?: string;
  fullName?: string;
}) {
  const [email, setEmail] = useState(initialEmail),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage("");
    const { error } = await supabase.functions.invoke("invite-user", { body: { email, fullName } });
    setSending(false);
    setMessage(
      error
        ? "Não foi possível enviar o convite. Verifique se já existe uma conta ou convite."
        : "Convite enviado com segurança.",
    );
  };
  return (
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={submit}>
      <Input
        className="min-w-56 flex-1"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@exemplo.com"
      />
      <Button disabled={sending}>{sending ? "Enviando…" : "Enviar convite"}</Button>
      {message && (
        <p className="w-full text-sm" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
