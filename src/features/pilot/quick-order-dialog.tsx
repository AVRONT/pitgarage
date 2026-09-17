import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warrantyDays, type Customer, type Vehicle } from "./pilot-data";
import { quickPaymentError, type PaymentMethod, type QuickOrderDraft } from "./quick-order-model";

const money = (value: string) => Number(value.replace(",", "."));

export function QuickOrderDialog({ open, onOpenChange, customers, vehicles, onFinalize, onContinueAsStandard }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
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
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [received, setReceived] = useState("0");
  const receivedEdited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Math.max(0, (money(amount) || 0) - (money(discount) || 0));
  useEffect(() => {
    if (!receivedEdited.current && method) setReceived(total.toFixed(2));
  }, [method, total]);

  const reset = () => {
    requestId.current = crypto.randomUUID();
    setNewCustomer(false); setCustomerId(""); setCustomerName(""); setCustomerPhone(""); setCustomerCpf("");
    setVehicleId(""); setBrand(""); setModel(""); setYear(""); setService(""); setAmount("");
    setDiscount("0"); setDiscountReason(""); setMethod(""); setReceived("0"); setError("");
    receivedEdited.current = false;
  };
  const close = () => { if (!creating.current) { reset(); onOpenChange(false); } };
  const selectVehicle = (id: string) => {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) { setBrand(vehicle.brand); setModel(vehicle.model); setYear(String(vehicle.year)); }
  };
  const draft = (): QuickOrderDraft | null => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const numericYear = Number(year), numericAmount = money(amount), numericDiscount = money(discount), numericReceived = money(received);
    if (newCustomer) {
      if (!customerName.trim() || cleanPhone.length < 10 || cleanPhone.length > 11) return setError("Informe nome e telefone válido do cliente."), null;
    } else if (!customerId) return setError("Selecione um cliente."), null;
    if (!brand.trim() || !model.trim() || !Number.isInteger(numericYear) || numericYear < 1900 || numericYear > new Date().getFullYear() + 1)
      return setError("Informe Marca, Modelo e Ano válidos."), null;
    if (!service.trim()) return setError("Informe o Serviço realizado."), null;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Informe o Valor do serviço."), null;
    if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || numericDiscount > numericAmount) return setError("Informe um desconto válido."), null;
    const paymentIssue = quickPaymentError(numericReceived, method || undefined, numericAmount - numericDiscount);
    if (paymentIssue) return setError(paymentIssue), null;
    setError("");
    return {
      requestId: requestId.current,
      ...(newCustomer ? { newCustomer: { name: customerName.trim(), phone: cleanPhone, ...(customerCpf.replace(/\D/g, "") ? { cpf: customerCpf.replace(/\D/g, "") } : {}) } } : { customerId }),
      ...(vehicleId ? { vehicleId } : {}), vehicleBrand: brand.trim(), vehicleModel: model.trim(), vehicleYear: numericYear,
      service: service.trim(), amount: numericAmount, discountAmount: numericDiscount,
      discountReason: discountReason.trim(), receivedAmount: numericReceived,
      warrantyDays,
      ...(numericReceived > 0 && method ? { paymentMethod: method } : {}),
    };
  };
  const finalize = async () => {
    if (creating.current) return;
    const value = draft(); if (!value) return;
    creating.current = true; setSaving(true);
    try { await onFinalize(value); reset(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível finalizar o atendimento."); }
    finally { creating.current = false; setSaving(false); }
  };
  const continueAsStandard = () => { const value = draft(); if (value) onContinueAsStandard(value); };

  const customerVehicles = vehicles.filter((item) => item.customerId === customerId && !item.deletedAt);
  return <Dialog open={open} onOpenChange={(value) => value ? onOpenChange(true) : close()}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>OS Rápida</DialogTitle><DialogDescription>Registre e finalize um atendimento simples em uma única tela.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex gap-2"><Button type="button" size="sm" variant={!newCustomer ? "default" : "outline"} onClick={() => setNewCustomer(false)}>Cliente existente</Button><Button type="button" size="sm" variant={newCustomer ? "default" : "outline"} onClick={() => { setNewCustomer(true); setCustomerId(""); setVehicleId(""); }}>Novo cliente</Button></div>
          {newCustomer ? <div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="quick-name">Nome</Label><Input id="quick-name" autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div><div><Label htmlFor="quick-phone">Telefone</Label><Input id="quick-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div><div><Label htmlFor="quick-cpf">CPF</Label><Input id="quick-cpf" value={customerCpf} onChange={(e) => setCustomerCpf(e.target.value)} /></div></div> : <div><Label htmlFor="quick-customer">Cliente</Label><select id="quick-customer" autoFocus className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }}><option value="">Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></div>}
        </section>
        {!newCustomer && customerId && customerVehicles.length > 0 && <div><Label htmlFor="quick-vehicle">Veículo existente (opcional)</Label><select id="quick-vehicle" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleId} onChange={(e) => selectVehicle(e.target.value)}><option value="">Informar somente Marca, Modelo e Ano</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.plate}</option>)}</select></div>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]"><div><Label htmlFor="quick-brand">Marca</Label><Input id="quick-brand" value={brand} onChange={(e) => { setVehicleId(""); setBrand(e.target.value); }} /></div><div><Label htmlFor="quick-model">Modelo</Label><Input id="quick-model" value={model} onChange={(e) => { setVehicleId(""); setModel(e.target.value); }} /></div><div><Label htmlFor="quick-year">Ano</Label><Input id="quick-year" inputMode="numeric" value={year} onChange={(e) => { setVehicleId(""); setYear(e.target.value); }} /></div></div>
        <div><Label htmlFor="quick-service">Serviço realizado</Label><Input id="quick-service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Troca de óleo e filtro" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-amount">Valor do serviço</Label><Input id="quick-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="180,00" /></div><div><Label htmlFor="quick-discount">Desconto (opcional)</Label><Input id="quick-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div></div>
        {money(discount) > 0 && <div><Label htmlFor="quick-discount-reason">Motivo do desconto</Label><Input id="quick-discount-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} /></div>}
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-method">Forma de pagamento</Label><select id="quick-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}><option value="">Sem recebimento agora</option><option>Dinheiro</option><option>PIX</option><option>Cartão</option></select></div><div><Label htmlFor="quick-received">Valor recebido</Label><Input id="quick-received" inputMode="decimal" value={received} onChange={(e) => { receivedEdited.current = true; setReceived(e.target.value); }} /></div></div>
        <p className="text-sm text-muted-foreground">Total final: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="ghost" disabled={saving} onClick={continueAsStandard}>Continuar como OS completa</Button><Button type="button" disabled={saving} onClick={() => void finalize()}>{saving ? "Finalizando…" : "Finalizar atendimento"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
