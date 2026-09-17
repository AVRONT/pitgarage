import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";

export type ActivityAuthors = Readonly<Record<string, string>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const displayName = (value: unknown) =>
  typeof value === "string" && value.trim() && !uuid.test(value.trim()) ? value.trim() : "";

/** Display-only resolution: never replaces the audit UUID or persists a legacy lookup. */
export function activityAuthorName(
  actor: { recordedBy?: string; actorName?: unknown },
  names: ActivityAuthors = {},
) {
  return displayName(actor.actorName) ||
    displayName(actor.recordedBy ? names[actor.recordedBy] : undefined) || "Usuário interno";
}

export async function loadActivityAuthors(): Promise<ActivityAuthors> {
  try {
    // Same restricted directory already used by the OS team assignment.
    const { data, error } = await supabase.rpc("list_assignable_members");
    if (error) return {};
    return Object.fromEntries((data ?? []).flatMap(member => {
      const name = displayName(member.full_name);
      return name ? [[member.user_id, name]] : [];
    }));
  } catch {
    return {};
  }
}

/** One lookup per authenticated identity while the order detail is mounted. */
export function useActivityAuthors(): ActivityAuthors {
  const { identity, accessLevel, isLocalBypass } = useAuth();
  const userId = identity?.userId;
  const [directory, setDirectory] = useState<{ userId: string; names: ActivityAuthors }>();
  const allowed = !isLocalBypass && ["owner", "admin", "staff"].includes(accessLevel ?? "");
  useEffect(() => {
    let active = true;
    setDirectory(undefined);
    if (allowed && userId) {
      void loadActivityAuthors().then(names => {
        if (active) setDirectory({ userId, names });
      });
    }
    return () => { active = false; };
  }, [allowed, userId]);
  return allowed && directory?.userId === userId ? directory?.names ?? {} : {};
}
