import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LockKeyhole, UserPlus, Wrench } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const {
    forgetRememberedAccount,
    identity,
    isLoading,
    isLocalBypass,
    login,
    message,
    register,
    rememberedAccount,
    resumeLocalAccess,
  } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    if (identity)
      void navigate({
        to: identity.profile.access_level === "customer" ? "/cliente" : "/",
        replace: true,
      });
  }, [identity, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    if (isRegistering && password !== passwordConfirmation) {
      setFormMessage("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const result = isRegistering
      ? await register(fullName.trim(), email.trim(), password)
      : await login(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) return;
    if ("requiresEmailConfirmation" in result && result.requiresEmailConfirmation) {
      setIsRegistering(false);
      setPassword("");
      setPasswordConfirmation("");
      setFormMessage("Conta criada. Confirme seu e-mail para entrar.");
      return;
    }

    if ("accessLevel" in result && result.accessLevel)
      await navigate({
        to: result.accessLevel === "customer" ? "/cliente" : "/",
        replace: true,
      });
  };

  const toggleMode = () => {
    setIsRegistering((current) => !current);
    setPassword("");
    setPasswordConfirmation("");
    setFormMessage(null);
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
          <h1 className="text-2xl font-semibold tracking-tight">
            {isRegistering ? "Crie sua conta" : "Acesse sua conta"}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {isRegistering
              ? "Cadastre-se para acessar sua futura área de veículos e serviços."
              : "Entre com seu e-mail e senha."}
          </p>
        </div>

        {(message || formMessage) && (
          <div
            className={`mb-5 rounded-md border px-3 py-2.5 text-sm ${
              formMessage?.startsWith("Conta criada")
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role="status"
          >
            {formMessage ?? message}
          </div>
        )}

        {!isRegistering && rememberedAccount && (
          <div className="mb-5 rounded-md border bg-slate-50 p-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setEmail(rememberedAccount.email)}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                {rememberedAccount.initials}
              </span>
              <span>
                <strong className="block text-sm">Continuar como {rememberedAccount.name}</strong>
                <span className="text-xs text-muted-foreground">{rememberedAccount.email}</span>
              </span>
            </button>
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => setEmail("")}
              >
                Usar outra conta
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-muted-foreground"
                onClick={forgetRememberedAccount}
              >
                Esquecer esta conta neste dispositivo
              </Button>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegistering && (
            <label className="block text-sm font-medium" htmlFor="full-name">
              Nome
              <Input
                id="full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 h-11"
                placeholder="Seu nome"
              />
            </label>
          )}
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
              autoComplete={isRegistering ? "new-password" : "current-password"}
              aria-describedby={isRegistering ? "strong-password-guidance" : undefined}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 h-11"
              placeholder="Digite sua senha"
            />
            {isRegistering && (
              <span
                id="strong-password-guidance"
                className="mt-1.5 block text-xs font-normal leading-5 text-muted-foreground"
              >
                Use uma combinação menos previsível de letras, números e símbolos.
              </span>
            )}
          </label>
          {isRegistering && (
            <label className="block text-sm font-medium" htmlFor="password-confirmation">
              Confirmar senha
              <Input
                id="password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                className="mt-1.5 h-11"
                placeholder="Digite a senha novamente"
              />
            </label>
          )}
          <Button className="h-11 w-full" type="submit" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="animate-spin" />
            ) : isRegistering ? (
              <UserPlus />
            ) : (
              <LockKeyhole />
            )}
            {submitting ? "Aguarde…" : isRegistering ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <div className="mt-5 border-t pt-5 text-center">
          <p className="text-sm text-muted-foreground">
            {isRegistering ? "Já possui cadastro?" : "Ainda não possui cadastro?"}
          </p>
          <Button type="button" variant="link" className="mt-1" onClick={toggleMode}>
            {isRegistering ? "Entrar na conta" : "Criar conta"}
          </Button>
        </div>

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
          Acesso seguro para clientes e equipe autorizada.
        </p>
      </section>
    </main>
  );
}
