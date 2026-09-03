import { createFileRoute } from "@tanstack/react-router";
import { PilotApp } from "@/features/pilot/pilot-app";
import { AuthGuard } from "@/features/auth/auth-guard";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AuthGuard>
      <PilotApp />
    </AuthGuard>
  );
}
