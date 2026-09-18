import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Banknote,
  Bike,
  Box,
  ChevronDown,
  ClipboardList,
  CreditCard,
  DollarSign,
  Info,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserRound,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { warrantyDays, type Customer, type Vehicle } from "./pilot-data";
import {
  quickOrderSubtotal,
  quickPaymentError,
  type PaymentMethod,
  type QuickOrderDraft,
} from "./quick-order-model";

const money = (value: string) => Number(value.replace(",", "."));
const numericSafe = (value: string) => (Number.isFinite(money(value)) ? money(value) : 0);
const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type QuickPartForm = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  unitCost: string;
};
const selectClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";
const servicePresets = ["Revisão", "Troca de óleo", "Resgate", "Outros"];

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <Icon className="h-4 w-4 text-slate-700" />
      {children}
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 flex-1 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        active
          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function QuickOrderDialog({
  open,
  onOpenChange,
  customers,
  vehicles,
  financialAllowed,
  onFinalize,
  onContinueAsStandard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  financialAllowed: boolean;
  onFinalize: (draft: QuickOrderDraft) => Promise<void>;
  onContinueAsStandard: (draft: QuickOrderDraft) => void;
}) {
  const creating = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [service, setService] = useState("");
  const [servicePreset, setServicePreset] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [receiveNow, setReceiveNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [received, setReceived] = useState("0");
  const [internalCost, setInternalCost] = useState("");
  const [cardFee, setCardFee] = useState("0");
  const [parts, setParts] = useState<QuickPartForm[]>([]);
  const receivedEdited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const partsSubtotal = parts.reduce(
    (sum, part) => sum + numericSafe(part.quantity) * numericSafe(part.unitPrice),
    0,
  );
  const subtotal = numericSafe(amount) + partsSubtotal;
  const total = Math.max(0, subtotal - numericSafe(discount));
  const balance = Math.max(0, total - numericSafe(received));
  useEffect(() => {
    if (!receivedEdited.current && receiveNow && method) setReceived(total.toFixed(2));
  }, [method, receiveNow, total]);

  const reset = () => {
    requestId.current = crypto.randomUUID();
    setNewCustomer(false);
    setCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCpf("");
    setVehicleId("");
    setBrand("");
    setModel("");
    setYear("");
    setService("");
    setServicePreset("");
    setAmount("");
    setDiscount("0");
    setDiscountReason("");
    setReceiveNow(false);
    setMethod("");
    setReceived("0");
    setInternalCost("");
    setCardFee("0");
    setParts([]);
    setError("");
    receivedEdited.current = false;
  };
  const close = () => {
    if (!creating.current) {
      reset();
      onOpenChange(false);
    }
  };
  const choosePaymentTiming = (now: boolean) => {
    setReceiveNow(now);
    if (!now) {
      setMethod("");
      setReceived("0");
      setCardFee("0");
      receivedEdited.current = false;
    }
  };
  const selectVehicle = (id: string) => {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) {
      setBrand(vehicle.brand);
      setModel(vehicle.model);
      setYear(String(vehicle.year));
    }
  };
  const addPart = () =>
    setParts((current) => [
      ...current,
      {
        id: `quick-part-${crypto.randomUUID()}`,
        name: "",
        quantity: "1",
        unitPrice: "",
        unitCost: "",
      },
    ]);
  const updatePart = (id: string, field: keyof QuickPartForm, value: string) =>
    setParts((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );

  const draft = (): QuickOrderDraft | null => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const numericYear = Number(year),
      numericAmount = money(amount),
      numericDiscount = money(discount),
      numericReceived = money(received);
    const numericCost = internalCost === "" ? undefined : money(internalCost),
      numericFee = money(cardFee);
    const normalizedParts = parts.map((part) => ({
      id: part.id,
      name: part.name.trim(),
      quantity: Number(part.quantity),
      unitPrice: money(part.unitPrice),
      ...(financialAllowed && part.unitCost !== "" ? { unitCost: money(part.unitCost) } : {}),
    }));
    if (newCustomer) {
      if (!customerName.trim() || cleanPhone.length < 10 || cleanPhone.length > 11)
        return (setError("Informe nome e telefone válido do cliente."), null);
    } else if (!customerId) return (setError("Selecione um cliente."), null);
    if (
      !brand.trim() ||
      !model.trim() ||
      !Number.isInteger(numericYear) ||
      numericYear < 1900 ||
      numericYear > new Date().getFullYear() + 1
    )
      return (setError("Informe Marca, Modelo e Ano válidos."), null);
    if (!service.trim()) return (setError("Informe o Serviço realizado."), null);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0)
      return (setError("Informe o Valor do serviço."), null);
    for (const part of normalizedParts) {
      if (
        !part.name ||
        !Number.isInteger(part.quantity) ||
        part.quantity < 1 ||
        !Number.isFinite(part.unitPrice) ||
        part.unitPrice < 0 ||
        (part.unitCost !== undefined && (!Number.isFinite(part.unitCost) || part.unitCost < 0))
      )
        return (setError("Confira nome, quantidade, valor e custo das peças."), null);
    }
    const numericSubtotal = quickOrderSubtotal(numericAmount, normalizedParts);
    if (
      !Number.isFinite(numericDiscount) ||
      numericDiscount < 0 ||
      numericDiscount > numericSubtotal
    )
      return (setError("Informe um desconto válido."), null);
    if (numericCost !== undefined && (!Number.isFinite(numericCost) || numericCost < 0))
      return (setError("Informe um custo interno válido."), null);
    const paymentIssue = quickPaymentError(
      numericReceived,
      method || undefined,
      numericSubtotal - numericDiscount,
      numericFee,
    );
    if (paymentIssue) return (setError(paymentIssue), null);
    setError("");
    return {
      requestId: requestId.current,
      ...(newCustomer
        ? {
            newCustomer: {
              name: customerName.trim(),
              phone: cleanPhone,
              ...(customerCpf.replace(/\D/g, "") ? { cpf: customerCpf.replace(/\D/g, "") } : {}),
            },
          }
        : { customerId }),
      ...(vehicleId ? { vehicleId } : {}),
      vehicleBrand: brand.trim(),
      vehicleModel: model.trim(),
      vehicleYear: numericYear,
      service: service.trim(),
      amount: numericAmount,
      discountAmount: numericDiscount,
      discountReason: discountReason.trim(),
      receivedAmount: numericReceived,
      warrantyDays,
      parts: normalizedParts,
      ...(numericCost === undefined ? {} : { internalCost: numericCost }),
      cardFee: numericFee,
      ...(numericReceived > 0 && method ? { paymentMethod: method } : {}),
    };
  };
  const finalize = async () => {
    if (creating.current) return;
    const value = draft();
    if (!value) return;
    creating.current = true;
    setSaving(true);
    try {
      await onFinalize(value);
      reset();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível finalizar o atendimento.",
      );
    } finally {
      creating.current = false;
      setSaving(false);
    }
  };
  const continueAsStandard = () => {
    const value = draft();
    if (value) onContinueAsStandard(value);
  };
  const customerVehicles = vehicles.filter(
    (item) => item.customerId === customerId && !item.deletedAt,
  );

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[1180px] flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-start gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 text-blue-700">
              <Zap className="h-6 w-6 fill-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl text-slate-950">OS Rápida</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Atendimento rápido em menos de 1 minuto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="space-y-6 p-5 sm:p-6 lg:border-r lg:border-slate-200">
              <section className="space-y-3" aria-labelledby="quick-customer-title">
                <SectionTitle icon={UserRound}>
                  <span id="quick-customer-title">Cliente</span>
                </SectionTitle>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <SegmentedButton active={!newCustomer} onClick={() => setNewCustomer(false)}>
                    Cliente existente
                  </SegmentedButton>
                  <SegmentedButton
                    active={newCustomer}
                    onClick={() => {
                      setNewCustomer(true);
                      setCustomerId("");
                      setVehicleId("");
                    }}
                  >
                    Novo cliente
                  </SegmentedButton>
                </div>
                {newCustomer ? (
                  <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr_1fr]">
                    <div>
                      <Label htmlFor="quick-name">Nome do cliente</Label>
                      <Input
                        id="quick-name"
                        autoFocus
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-phone">Telefone</Label>
                      <Input
                        id="quick-phone"
                        inputMode="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-cpf">
                        CPF <span className="font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      <Input
                        id="quick-cpf"
                        inputMode="numeric"
                        value={customerCpf}
                        onChange={(e) => setCustomerCpf(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="quick-customer">Buscar cliente</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        id="quick-customer"
                        autoFocus
                        className={cn(selectClass, "pl-9")}
                        value={customerId}
                        onChange={(e) => {
                          setCustomerId(e.target.value);
                          setVehicleId("");
                        }}
                      >
                        <option value="">Selecione pelo nome ou telefone</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} · {customer.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="quick-vehicle-title">
                <SectionTitle icon={Bike}>
                  <span id="quick-vehicle-title">Veículo</span>
                </SectionTitle>
                {!newCustomer && customerId && customerVehicles.length > 0 && (
                  <div>
                    <Label htmlFor="quick-vehicle">
                      Veículo cadastrado{" "}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <select
                      id="quick-vehicle"
                      className={selectClass}
                      value={vehicleId}
                      onChange={(e) => selectVehicle(e.target.value)}
                    >
                      <option value="">Informar marca, modelo e ano</option>
                      {customerVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.plate}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_1.25fr_7rem]">
                  <div>
                    <Label htmlFor="quick-brand">Marca</Label>
                    <Input
                      id="quick-brand"
                      value={brand}
                      onChange={(e) => {
                        setVehicleId("");
                        setBrand(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quick-model">Modelo</Label>
                    <Input
                      id="quick-model"
                      value={model}
                      onChange={(e) => {
                        setVehicleId("");
                        setModel(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quick-year">Ano</Label>
                    <Input
                      id="quick-year"
                      inputMode="numeric"
                      value={year}
                      onChange={(e) => {
                        setVehicleId("");
                        setYear(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="quick-service-title">
                <SectionTitle icon={Wrench}>
                  <span id="quick-service-title">Tipo de serviço</span>
                </SectionTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {servicePresets.map((preset) => (
                    <SegmentedButton
                      key={preset}
                      active={servicePreset === preset}
                      onClick={() => {
                        setServicePreset(preset);
                        if (preset !== "Outros") setService(preset);
                      }}
                    >
                      {preset}
                    </SegmentedButton>
                  ))}
                </div>
                <div>
                  <Label htmlFor="quick-service">Serviço realizado</Label>
                  <Input
                    id="quick-service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder={
                      servicePreset === "Outros"
                        ? "Descreva o serviço"
                        : "Ex.: troca de óleo e filtro"
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="quick-amount">Valor do serviço</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      R$
                    </span>
                    <Input
                      id="quick-amount"
                      className="pl-9"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="quick-parts-title">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={Box}>
                    <span id="quick-parts-title">
                      Peças adicionadas{" "}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </span>
                  </SectionTitle>
                  {parts.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {parts.length} {parts.length === 1 ? "item" : "itens"}
                    </span>
                  )}
                </div>
                {parts.length === 0 ? (
                  <button
                    type="button"
                    onClick={addPart}
                    className="group flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Box className="mb-2 h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                    <span className="text-xs text-slate-500">Nenhuma peça adicionada.</span>
                    <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-700">
                      <Plus className="h-4 w-4" />
                      Adicionar peça
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {parts.map((part, index) => (
                      <div
                        key={part.id}
                        className={cn(
                          "grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3",
                          financialAllowed
                            ? "sm:grid-cols-[minmax(140px,1fr)_4.5rem_7.5rem_7.5rem_2.5rem]"
                            : "sm:grid-cols-[minmax(140px,1fr)_4.5rem_7.5rem_2.5rem]",
                        )}
                      >
                        <div>
                          <Label htmlFor={`quick-part-name-${part.id}`}>Peça</Label>
                          <Input
                            id={`quick-part-name-${part.id}`}
                            value={part.name}
                            onChange={(e) => updatePart(part.id, "name", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`quick-part-quantity-${part.id}`}>Qtd.</Label>
                          <Input
                            id={`quick-part-quantity-${part.id}`}
                            inputMode="numeric"
                            value={part.quantity}
                            onChange={(e) => updatePart(part.id, "quantity", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`quick-part-price-${part.id}`}>Preço cobrado</Label>
                          <Input
                            id={`quick-part-price-${part.id}`}
                            inputMode="decimal"
                            value={part.unitPrice}
                            onChange={(e) => updatePart(part.id, "unitPrice", e.target.value)}
                          />
                        </div>
                        {financialAllowed && (
                          <div>
                            <Label
                              htmlFor={`quick-part-cost-${part.id}`}
                              className="flex items-center gap-1"
                            >
                              Custo <LockKeyhole className="h-3 w-3" />
                            </Label>
                            <Input
                              id={`quick-part-cost-${part.id}`}
                              inputMode="decimal"
                              value={part.unitCost}
                              onChange={(e) => updatePart(part.id, "unitCost", e.target.value)}
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="self-end text-slate-500 hover:text-destructive"
                          aria-label={`Remover peça ${index + 1}`}
                          onClick={() =>
                            setParts((current) => current.filter((item) => item.id !== part.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed text-blue-700"
                      onClick={addPart}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar peça
                    </Button>
                  </div>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="quick-payment-title">
                <SectionTitle icon={WalletCards}>
                  <span id="quick-payment-title">Recebimento</span>
                </SectionTitle>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <SegmentedButton active={receiveNow} onClick={() => choosePaymentTiming(true)}>
                    Recebido agora
                  </SegmentedButton>
                  <SegmentedButton active={!receiveNow} onClick={() => choosePaymentTiming(false)}>
                    Receber depois
                  </SegmentedButton>
                </div>
                {receiveNow ? (
                  <div className="grid gap-3 sm:grid-cols-[1.25fr_.7fr_.7fr]">
                    <div>
                      <Label>Forma de pagamento</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <SegmentedButton
                          active={method === "Dinheiro"}
                          onClick={() => {
                            setMethod("Dinheiro");
                            setCardFee("0");
                          }}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <Banknote className="h-4 w-4" />
                            Dinheiro
                          </span>
                        </SegmentedButton>
                        <SegmentedButton
                          active={method === "PIX"}
                          onClick={() => {
                            setMethod("PIX");
                            setCardFee("0");
                          }}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            PIX
                          </span>
                        </SegmentedButton>
                        <SegmentedButton
                          active={method === "Cartão"}
                          onClick={() => setMethod("Cartão")}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <CreditCard className="h-4 w-4" />
                            Cartão
                          </span>
                        </SegmentedButton>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="quick-received">Valor recebido</Label>
                      <Input
                        id="quick-received"
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => {
                          receivedEdited.current = true;
                          setReceived(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-discount">
                        Desconto{" "}
                        <span className="font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      <Input
                        id="quick-discount"
                        inputMode="decimal"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-sm text-orange-900">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <div>
                      <p className="font-medium">Nenhum pagamento registrado agora.</p>
                      <p className="mt-0.5 text-xs text-orange-800/80">
                        A OS ficará com saldo em aberto.
                      </p>
                    </div>
                  </div>
                )}
                {numericSafe(discount) > 0 && (
                  <div>
                    <Label htmlFor="quick-discount-reason">Motivo do desconto</Label>
                    <Input
                      id="quick-discount-reason"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </div>
                )}
              </section>
            </div>

            <aside
              className="space-y-4 bg-slate-50/60 p-5 sm:p-6 lg:sticky lg:top-0"
              aria-label="Resumo e dados internos"
            >
              <section
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                aria-labelledby="quick-summary-title"
              >
                <SectionTitle icon={ClipboardList}>
                  <span id="quick-summary-title">Resumo do atendimento</span>
                </SectionTitle>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Serviço</dt>
                    <dd className="font-medium tabular-nums text-slate-900">
                      {currency(numericSafe(amount))}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">
                      Peças ({parts.length} {parts.length === 1 ? "item" : "itens"})
                    </dt>
                    <dd className="font-medium tabular-nums text-slate-900">
                      {currency(partsSubtotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <dt className="text-slate-600">Subtotal</dt>
                    <dd className="font-medium tabular-nums">{currency(subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600">Desconto</dt>
                    <dd className="font-medium tabular-nums">
                      - {currency(numericSafe(discount))}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg bg-blue-50 px-3 py-3 text-base font-bold text-blue-950">
                    <dt>Total final</dt>
                    <dd className="tabular-nums">{currency(total)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-800">
                    <dt>Valor recebido</dt>
                    <dd className="tabular-nums">{currency(numericSafe(received))}</dd>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 font-semibold",
                      balance > 0
                        ? "bg-orange-50 text-orange-800"
                        : "bg-emerald-50 text-emerald-800",
                    )}
                  >
                    <dt>{balance > 0 ? "Saldo em aberto" : "Saldo"}</dt>
                    <dd className="tabular-nums">{currency(balance)}</dd>
                  </div>
                </dl>
              </section>
              {financialAllowed && (
                <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                    <SectionTitle icon={Settings2}>Dados internos da oficina</SectionTitle>
                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 p-4">
                    <p className="text-xs text-slate-500">
                      Custos e informações internas, visíveis apenas para a equipe autorizada.
                    </p>
                    <div>
                      <Label htmlFor="quick-cost">
                        Custo do serviço{" "}
                        <span className="font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      <Input
                        id="quick-cost"
                        inputMode="decimal"
                        value={internalCost}
                        onChange={(e) => setInternalCost(e.target.value)}
                      />
                    </div>
                    {method === "Cartão" && (
                      <div>
                        <Label htmlFor="quick-fee">Taxa do cartão</Label>
                        <Input
                          id="quick-fee"
                          inputMode="decimal"
                          value={cardFee}
                          onChange={(e) => setCardFee(e.target.value)}
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Líquido recebido: {currency(numericSafe(received) - numericSafe(cardFee))}
                        </p>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </aside>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700 sm:px-6"
          >
            {error}
          </div>
        )}
        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:justify-end sm:px-6">
          <Button type="button" variant="outline" disabled={saving} onClick={continueAsStandard}>
            Continuar como OS completa
          </Button>
          <Button
            type="button"
            className="min-w-48 bg-blue-700 hover:bg-blue-800"
            disabled={saving}
            onClick={() => void finalize()}
          >
            {saving ? "Finalizando…" : "Finalizar atendimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
