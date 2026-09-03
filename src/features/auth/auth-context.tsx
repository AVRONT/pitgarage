import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";

export type AccessLevel = "customer" | "staff" | "admin" | "owner";

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  operational_role: string | null;
  access_level: AccessLevel;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthIdentity {
  actorId: string;
  userId: string | null;
  email: string | null;
  profile: UserProfile;
  isLocalBypass: boolean;
}

export interface RememberedAccount {
  name: string;
  email: string;
  initials: string;
}

type LoginResult = { ok: true; accessLevel: AccessLevel } | { ok: false; message: string };
type RegisterResult =
  | { ok: true; requiresEmailConfirmation: boolean; accessLevel?: AccessLevel }
  | { ok: false; message: string };

interface AuthContextValue {
  user: User | null;
  identity: AuthIdentity | null;
  profile: UserProfile | null;
  accessLevel: AccessLevel | null;
  isLocalBypass: boolean;
  isLoading: boolean;
  message: string | null;
  rememberedAccount: RememberedAccount | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (fullName: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  retryProfile: () => Promise<void>;
  forgetRememberedAccount: () => void;
  resumeLocalAccess: () => void;
}

const localProfile: UserProfile = {
  user_id: "local:admin",
  full_name: "Admin Local",
  operational_role: "Desenvolvimento",
  access_level: "owner",
  is_active: true,
};

const localIdentity: AuthIdentity = {
  actorId: "local:admin",
  userId: null,
  email: null,
  profile: localProfile,
  isLocalBypass: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);
const rememberedAccountKey = "pitgarage-last-account-v1";

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR"))
    .join("");

function readRememberedAccount(): RememberedAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(rememberedAccountKey) ?? "null") as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    return typeof candidate["name"] === "string" &&
      typeof candidate["email"] === "string" &&
      typeof candidate["initials"] === "string"
      ? { name: candidate["name"], email: candidate["email"], initials: candidate["initials"] }
      : null;
  } catch {
    return null;
  }
}

function isLocalDevelopmentHost() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function translateAuthError(message: string) {
  const normalized = message.toLocaleLowerCase("en-US");

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }
  return "Não foi possível entrar. Verifique os dados e tente novamente.";
}

function translateRegistrationError(message: string, code?: string) {
  const normalized = message.toLocaleLowerCase("en-US");

  if (code === "weak_password" || normalized.includes("weak_password")) {
    return "Senha muito fraca. Use uma combinação menos previsível de letras, números e símbolos.";
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Este e-mail já possui cadastro. Tente entrar na sua conta.";
  }
  if (normalized.includes("password") && normalized.includes("least")) {
    return "A senha não atende ao tamanho mínimo exigido.";
  }
  if (normalized.includes("invalid") && normalized.includes("email")) {
    return "Informe um e-mail válido.";
  }
  if (normalized.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }
  return "Não foi possível criar a conta. Verifique os dados e tente novamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const profileRequest = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rememberedAccount, setRememberedAccount] = useState<RememberedAccount | null>(
    readRememberedAccount,
  );

  const clearAuth = useCallback((nextMessage: string | null = null) => {
    profileRequest.current += 1;
    setUser(null);
    setIdentity(null);
    setMessage(nextMessage);
    setIsLoading(false);
  }, []);

  const loadAuthenticatedIdentity = useCallback(
    async (nextUser: User): Promise<LoginResult> => {
      const request = ++profileRequest.current;
      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          "user_id, full_name, operational_role, access_level, is_active, created_at, updated_at",
        )
        .eq("user_id", nextUser.id)
        .maybeSingle();

      if (request !== profileRequest.current)
        return { ok: false, message: "Verificação substituída por uma sessão mais recente." };

      if (error) {
        if (import.meta.env.DEV) console.error("Falha temporária ao carregar perfil", error);
        setUser(nextUser);
        setIdentity(null);
        setMessage(
          "Não foi possível carregar seu perfil agora. Sua sessão foi mantida; tente novamente.",
        );
        setIsLoading(false);
        return { ok: false, message: "Não foi possível carregar seu perfil agora." };
      }

      if (!data) {
        await supabase.auth.signOut();
        const nextMessage =
          "Sua conta ainda não possui um perfil no PitGarage. Procure o responsável pela oficina.";
        clearAuth(nextMessage);
        return { ok: false, message: nextMessage };
      }

      const profile = data as UserProfile;
      if (!profile.is_active) {
        await supabase.auth.signOut();
        const nextMessage =
          "Seu acesso ao PitGarage está inativo. Procure o responsável pela oficina.";
        clearAuth(nextMessage);
        return { ok: false, message: nextMessage };
      }

      setUser(nextUser);
      setIdentity({
        actorId: profile.user_id,
        userId: profile.user_id,
        email: nextUser.email ?? null,
        profile,
        isLocalBypass: false,
      });
      setMessage(null);
      setIsLoading(false);
      if (nextUser.email) {
        const name = profile.full_name ?? nextUser.email.split("@")[0] ?? nextUser.email;
        const remembered = { name, email: nextUser.email, initials: initialsFor(name) };
        try {
          localStorage.setItem(rememberedAccountKey, JSON.stringify(remembered));
        } catch {
          /* Optional device hint must not break authentication. */
        }
        setRememberedAccount(remembered);
      }
      return { ok: true, accessLevel: profile.access_level };
    },
    [clearAuth],
  );

  useEffect(() => {
    let active = true;
    let authEvent = 0;

    if (isLocalDevelopmentHost()) {
      setIdentity(localIdentity);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEvent > 0) return;
      if (error) {
        if (import.meta.env.DEV) console.error("Falha ao restaurar sessão", error);
        setMessage("Não foi possível verificar sua sessão agora. Tente novamente.");
        setIsLoading(false);
        return;
      }
      if (!data.session?.user) {
        clearAuth();
        return;
      }
      void loadAuthenticatedIdentity(data.session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const event = ++authEvent;
      profileRequest.current += 1;
      if (!session?.user) {
        clearAuth();
        return;
      }
      setTimeout(() => {
        if (active && event === authEvent) void loadAuthenticatedIdentity(session.user);
      }, 0);
    });

    return () => {
      active = false;
      profileRequest.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [clearAuth, loadAuthenticatedIdentity]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setIsLoading(true);
      setMessage(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        const nextMessage = translateAuthError(error?.message ?? "");
        clearAuth(nextMessage);
        return { ok: false, message: nextMessage };
      }

      return loadAuthenticatedIdentity(data.user);
    },
    [clearAuth, loadAuthenticatedIdentity],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<RegisterResult> => {
      setIsLoading(true);
      setMessage(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error || !data.user || data.user.identities?.length === 0) {
        if (error && import.meta.env.DEV) {
          console.error("Falha no cadastro Supabase", { code: error.code, message: error.message });
        }
        const nextMessage =
          data.user?.identities?.length === 0
            ? "Este e-mail já possui cadastro. Tente entrar na sua conta."
            : translateRegistrationError(error?.message ?? "", error?.code);
        clearAuth(nextMessage);
        return { ok: false, message: nextMessage };
      }

      if (!data.session) {
        clearAuth();
        return { ok: true, requiresEmailConfirmation: true };
      }

      const identityResult = await loadAuthenticatedIdentity(data.user);
      if (!identityResult.ok) return identityResult;
      return {
        ok: true,
        requiresEmailConfirmation: false,
        accessLevel: identityResult.accessLevel,
      };
    },
    [clearAuth, loadAuthenticatedIdentity],
  );

  const logout = useCallback(async () => {
    profileRequest.current += 1;
    setIsLoading(true);
    if (!identity?.isLocalBypass) await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth, identity]);

  const retryProfile = useCallback(async () => {
    const request = ++profileRequest.current;
    setIsLoading(true);
    const { data, error } = await supabase.auth.getUser();
    if (request !== profileRequest.current) return;
    if (
      error &&
      ![401, 403].includes(error.status ?? 0) &&
      error.name !== "AuthSessionMissingError"
    ) {
      setMessage("Não foi possível verificar sua sessão agora. Tente novamente.");
      setIsLoading(false);
      return;
    }
    if (error || !data.user)
      return clearAuth("Sua sessão não está mais disponível. Entre novamente.");
    await loadAuthenticatedIdentity(data.user);
  }, [clearAuth, loadAuthenticatedIdentity]);

  const forgetRememberedAccount = useCallback(() => {
    try {
      localStorage.removeItem(rememberedAccountKey);
    } catch {
      /* Storage may be blocked. */
    }
    setRememberedAccount(null);
  }, []);

  const resumeLocalAccess = useCallback(() => {
    if (!isLocalDevelopmentHost()) return;
    setUser(null);
    setIdentity(localIdentity);
    setMessage(null);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      identity,
      profile: identity?.profile ?? null,
      accessLevel: identity?.profile.access_level ?? null,
      isLocalBypass: identity?.isLocalBypass ?? false,
      isLoading,
      message,
      rememberedAccount,
      login,
      register,
      logout,
      retryProfile,
      forgetRememberedAccount,
      resumeLocalAccess,
    }),
    [
      forgetRememberedAccount,
      identity,
      isLoading,
      login,
      logout,
      message,
      register,
      rememberedAccount,
      resumeLocalAccess,
      retryProfile,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Context and hook intentionally share this module so every consumer uses one auth contract.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
