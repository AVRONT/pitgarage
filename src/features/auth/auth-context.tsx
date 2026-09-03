import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";

export type AccessLevel = "owner" | "admin" | "staff";

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

type LoginResult = { ok: true } | { ok: false; message: string };

interface AuthContextValue {
  user: User | null;
  identity: AuthIdentity | null;
  profile: UserProfile | null;
  accessLevel: AccessLevel | null;
  isLocalBypass: boolean;
  isLoading: boolean;
  message: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const clearAuth = useCallback((nextMessage: string | null = null) => {
    setUser(null);
    setIdentity(null);
    setMessage(nextMessage);
    setIsLoading(false);
  }, []);

  const loadAuthenticatedIdentity = useCallback(
    async (nextUser: User): Promise<LoginResult> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          "user_id, full_name, operational_role, access_level, is_active, created_at, updated_at",
        )
        .eq("user_id", nextUser.id)
        .maybeSingle();

      if (error || !data) {
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
      return { ok: true };
    },
    [clearAuth],
  );

  useEffect(() => {
    let active = true;

    if (isLocalDevelopmentHost()) {
      setIdentity(localIdentity);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session?.user) {
        clearAuth();
        return;
      }
      void loadAuthenticatedIdentity(data.session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        clearAuth();
        return;
      }
      queueMicrotask(() => {
        if (active) void loadAuthenticatedIdentity(session.user);
      });
    });

    return () => {
      active = false;
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

  const logout = useCallback(async () => {
    setIsLoading(true);
    if (!identity?.isLocalBypass) await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth, identity]);

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
      login,
      logout,
      resumeLocalAccess,
    }),
    [identity, isLoading, login, logout, message, resumeLocalAccess, user],
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
