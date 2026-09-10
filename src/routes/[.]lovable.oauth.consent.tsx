import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
};

type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Autorização inválida.");
    const { data } = await supabase.auth.getSession();
    if (!data.session)
      throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data ?? null;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar este pedido de acesso: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "o aplicativo";

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O serviço de autorização não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Conectar {clientName}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {clientName} poderá consultar os dados do PitGarage com as suas permissões, como se fosse
          você. Você pode revogar o acesso depois.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void decide(true)}>
            Permitir
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            Recusar
          </Button>
        </div>
      </section>
    </main>
  );
}
