import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServiceOrders from "./tools/list-service-orders";
import getServiceOrder from "./tools/get-service-order";
import listVehicles from "./tools/list-vehicles";
import listCalendarEvents from "./tools/list-calendar-events";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "pitgarage",
  title: "PitGarage",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura do PitGarage. Consulte ordens de serviço, veículos e a agenda da oficina em nome do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listServiceOrders, getServiceOrder, listVehicles, listCalendarEvents],
});
