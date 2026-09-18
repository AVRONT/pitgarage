import {
  CalendarDays,
  CarFront,
  ClipboardList,
  CornerDownLeft,
  Plus,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { Customer, ServiceOrder, Vehicle } from "./pilot-data";

export type GlobalSearchResult =
  | { type: "customer"; customer: Customer }
  | { type: "vehicle"; vehicle: Vehicle }
  | { type: "order"; order: ServiceOrder };

type Props = {
  open: boolean;
  query: string;
  results: GlobalSearchResult[];
  customers: Customer[];
  vehicles: Vehicle[];
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelectResult: (result: GlobalSearchResult) => void;
  onNewOrder: () => void;
  onNewQuickOrder: () => void;
  onNavigate: (screen: "calendar" | "customers" | "vehicles" | "orders" | "financial") => void;
};

const itemClass =
  "group min-h-14 cursor-pointer gap-3 rounded-md px-3 py-2.5 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground";

export function PilotCommandPalette({
  open,
  query,
  results,
  customers,
  vehicles,
  onOpenChange,
  onQueryChange,
  onSelectResult,
  onNewOrder,
  onNewQuickOrder,
  onNavigate,
}: Props) {
  const customerResults = results.filter((result) => result.type === "customer");
  const vehicleResults = results.filter((result) => result.type === "vehicle");
  const orderResults = results.filter((result) => result.type === "order");
  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        autoFocus
        value={query}
        onValueChange={onQueryChange}
        placeholder="Buscar no PitGarage..."
        aria-label="Buscar no PitGarage"
      />
      <div className="pointer-events-none absolute right-12 top-5 hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
        <kbd className="command-kbd">Ctrl / ⌘</kbd>
        <kbd className="command-kbd">K</kbd>
      </div>
      <CommandList className="max-h-[min(58vh,26rem)] p-1.5">
        <CommandEmpty>
          <p className="font-medium">Nenhum resultado encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tente um nome, telefone, placa ou número de OS.
          </p>
        </CommandEmpty>

        {!query.trim() && (
          <CommandGroup heading="Ações rápidas">
            <CommandItem className={itemClass} onSelect={() => run(onNewQuickOrder)}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                <Sparkles />
              </span>
              <span className="flex-1 font-medium">Nova OS Rápida</span>
              <CommandShortcut>ação</CommandShortcut>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(onNewOrder)}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white"><Plus /></span>
              <span className="flex-1 font-medium">Abrir OS Completa</span>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(() => onNavigate("financial"))}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white"><ClipboardList /></span>
              <span className="flex-1 font-medium">Ver pagamentos</span>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(() => onNavigate("calendar"))}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                <CalendarDays />
              </span>
              <span className="flex-1 font-medium">Abrir Agenda</span>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(() => onNavigate("customers"))}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                <Users />
              </span>
              <span className="flex-1 font-medium">Ver Clientes</span>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(() => onNavigate("vehicles"))}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                <CarFront />
              </span>
              <span className="flex-1 font-medium">Ver Veículos</span>
            </CommandItem>
            <CommandItem className={itemClass} onSelect={() => run(() => onNavigate("orders"))}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                <ClipboardList />
              </span>
              <span className="flex-1 font-medium">Ver OS</span>
            </CommandItem>
          </CommandGroup>
        )}

        {customerResults.length > 0 && (
          <CommandGroup heading="Clientes">
            {customerResults.map((result) => (
              <CommandItem
                key={result.customer.id}
                value={`cliente ${result.customer.name} ${result.customer.phone} ${result.customer.email}`}
                className={itemClass}
                onSelect={() => run(() => onSelectResult(result))}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                  <UserRound />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{result.customer.name}</strong>
                  <span className="block truncate text-xs text-muted-foreground group-data-[selected=true]:text-white/70">
                    {result.customer.phone || result.customer.email || "Cliente cadastrado"}
                  </span>
                </span>
                <CornerDownLeft className="opacity-0 group-data-[selected=true]:opacity-70" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {vehicleResults.length > 0 && customerResults.length > 0 && <CommandSeparator />}
        {vehicleResults.length > 0 && (
          <CommandGroup heading="Veículos">
            {vehicleResults.map((result) => {
              const owner = customers.find((customer) => customer.id === result.vehicle.customerId);
              return (
                <CommandItem
                  key={result.vehicle.id}
                  value={`veículo ${result.vehicle.brand} ${result.vehicle.model} ${result.vehicle.plate} ${owner?.name ?? ""}`}
                  className={itemClass}
                  onSelect={() => run(() => onSelectResult(result))}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                    <CarFront />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {result.vehicle.brand} {result.vehicle.model}
                    </strong>
                    <span className="block truncate text-xs text-muted-foreground group-data-[selected=true]:text-white/70">
                      {result.vehicle.plate}
                      {owner ? ` · ${owner.name}` : ""}
                    </span>
                  </span>
                  <CornerDownLeft className="opacity-0 group-data-[selected=true]:opacity-70" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {orderResults.length > 0 && (customerResults.length > 0 || vehicleResults.length > 0) && (
          <CommandSeparator />
        )}
        {orderResults.length > 0 && (
          <CommandGroup heading="Ordens de serviço">
            {orderResults.map((result) => {
              const vehicle = vehicles.find((item) => item.id === result.order.vehicleId);
              return (
                <CommandItem
                  key={result.order.id}
                  value={`ordem ${result.order.id} ${vehicle?.brand ?? ""} ${vehicle?.model ?? ""} ${vehicle?.plate ?? ""} ${result.order.status}`}
                  className={itemClass}
                  onSelect={() => run(() => onSelectResult(result))}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary group-data-[selected=true]:bg-white/15 group-data-[selected=true]:text-white">
                    <ClipboardList />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{result.order.id}</strong>
                    <span className="block truncate text-xs text-muted-foreground group-data-[selected=true]:text-white/70">
                      {vehicle
                        ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
                        : "Veículo indisponível"}
                    </span>
                  </span>
                  <span className="max-w-36 truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold group-data-[selected=true]:border-white/25">
                    {result.order.status}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center gap-4 border-t bg-slate-50 px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          <kbd className="command-kbd">↑</kbd>
          <kbd className="command-kbd">↓</kbd> navegar
        </span>
        <span>
          <kbd className="command-kbd">↵</kbd> abrir
        </span>
        <span className="ml-auto">
          <kbd className="command-kbd">Esc</kbd> fechar
        </span>
      </div>
    </CommandDialog>
  );
}
