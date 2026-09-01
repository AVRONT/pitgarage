import { createFileRoute } from "@tanstack/react-router";
import { PilotApp } from "@/features/pilot/pilot-app";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <PilotApp />;
}
