import { ChevronDown, Code2, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { platformApi } from "@/features/platform/platform-api";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, type AccessLevel } from "./auth-context";

const accessLabels: Record<AccessLevel, string> = {
  customer: "Cliente",
  owner: "Owner",
  admin: "Administrador",
  staff: "Equipe",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

export function UserMenu() {
  const { identity, logout } = useAuth();
  const navigate = useNavigate();
  const [developer, setDeveloper] = useState(false);
  useEffect(() => {
    if (identity?.isLocalBypass) setDeveloper(true);
    else if (identity)
      void platformApi
        .developerAccess()
        .then(setDeveloper)
        .catch(() => setDeveloper(false));
  }, [identity]);
  if (!identity) return null;

  const { profile, email, isLocalBypass } = identity;
  const name = profile.full_name ?? "Usuário";
  const secondary = profile.operational_role ?? accessLabels[profile.access_level];

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ml-auto flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Menu do usuário ${name}`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(name)}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-36 truncate text-sm font-semibold leading-tight">
              {name}
            </span>
            <span className="block max-w-36 truncate text-xs text-muted-foreground">
              {isLocalBypass ? "Ambiente local" : secondary}
            </span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-semibold">{name}</span>
          {email && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{email}</span>
          )}
          <span className="mt-1 block text-xs text-muted-foreground">
            {secondary} · {accessLabels[profile.access_level]}
          </span>
          {isLocalBypass && (
            <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Ambiente local
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {developer && (
          <DropdownMenuItem
            onSelect={() => void navigate({ to: "/dev" })}
            className="cursor-pointer"
          >
            <Code2 /> Área técnica
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void handleLogout()} className="cursor-pointer">
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
