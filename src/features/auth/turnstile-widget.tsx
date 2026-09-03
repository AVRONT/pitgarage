import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (target: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId = "";
    const render = () => {
      if (!container.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    let script = document.querySelector<HTMLScriptElement>("script[data-pitgarage-turnstile]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset["pitgarageTurnstile"] = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    render();
    return () => {
      script?.removeEventListener("load", render);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={container} aria-label="Verificação de segurança" />;
}
