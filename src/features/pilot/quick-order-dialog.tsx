import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { warrantyDays, type Customer, type Vehicle } from "./pilot-data";
import { filterQuickCustomers, quickOrderSubtotal, quickPaymentError, quickPaymentStatus, quickServiceDescription, type PaymentMethod, type QuickOrderDraft } from "./quick-order-model";

const money = (value: string) => Number(value.replace(",", "."));
const numericSafe = (value: string) => Number.isFinite(money(value)) ? money(value) : 0;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type QuickPartForm = { id: string; name: string; quantity: string; unitPrice: string; unitCost: string };

export function QuickOrderDialog({ open, onOpenChange, customers, vehicles, financialAllowed, onFinalize, onContinueAsStandard }: {
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
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [service, setService] = useState("");
  const [serviceType, setServiceType] = useState<"review" | "oil" | "rescue" | "other" | "">("");
  const [rescuePickup, setRescuePickup] = useState("");
  const [rescueDestination, setRescueDestination] = useState("");
  const [rescueNote, setRescueNote] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [received, setReceived] = useState("0");
  const [internalCost, setInternalCost] = useState("");
  const [cardFee, setCardFee] = useState("0");
  const [receiveNow, setReceiveNow] = useState(false);
  const [parts, setParts] = useState<QuickPartForm[]>([]);
  const [partsOpen, setPartsOpen] = useState(false);
  const receivedEdited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const partsSubtotal = parts.reduce((sum, part) => sum + numericSafe(part.quantity) * numericSafe(part.unitPrice), 0);
  const subtotal = numericSafe(amount) + partsSubtotal;
  const total = Math.max(0, subtotal - numericSafe(discount));
  const balance = Math.max(0, total - numericSafe(received));
  const paymentStatus = quickPaymentStatus(total, numericSafe(received));
  useEffect(() => {
    if (!receivedEdited.current && method) setReceived(total.toFixed(2));
  }, [method, total]);

  const reset = () => {
    requestId.current = crypto.randomUUID();
    setNewCustomer(false); setCustomerId(""); setCustomerName(""); setCustomerPhone(""); setCustomerCpf(""); setCustomerEmail(""); setCustomerSearch("");
    setVehicleId(""); setBrand(""); setModel(""); setYear(""); setService(""); setServiceType(""); setRescuePickup(""); setRescueDestination(""); setRescueNote(""); setAmount("");
    setDiscount("0"); setDiscountReason(""); setMethod(""); setReceived("0"); setInternalCost(""); setCardFee("0"); setReceiveNow(false); setParts([]); setPartsOpen(false); setError("");
    receivedEdited.current = false;
  };
  const close = () => { if (!creating.current) { reset(); onOpenChange(false); } };
  const selectVehicle = (id: string) => {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) { setBrand(vehicle.brand); setModel(vehicle.model); setYear(String(vehicle.year)); }
  };
  const rejectDraft = (message: string, fieldId: string): null => {
    setError(message);
    const field = document.getElementById(fieldId);
    const disclosure = field?.closest("details");
    if (disclosure) disclosure.open = true;
    field?.scrollIntoView({ block: "center", behavior: "auto" });
    field?.focus({ preventScroll: true });
    return null;
  };
  const draft = (): QuickOrderDraft | null => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const numericYear = Number(year), numericAmount = money(amount), numericDiscount = money(discount), numericReceived = money(received);
    const numericCost = internalCost === "" ? undefined : money(internalCost), numericFee = money(cardFee);
    const normalizedParts = parts.map((part) => ({
      id: part.id, name: part.name.trim(), quantity: Number(part.quantity), unitPrice: money(part.unitPrice),
      ...(financialAllowed && part.unitCost !== "" ? { unitCost: money(part.unitCost) } : {}),
    }));
    if (newCustomer) {
      if (!customerName.trim()) return rejectDraft("Informe nome e telefone válido do cliente.", "quick-name");
      if (cleanPhone.length < 10 || cleanPhone.length > 11) return rejectDraft("Informe nome e telefone válido do cliente.", "quick-phone");
    } else if (!customerId) return rejectDraft("Selecione um cliente.", "quick-customer-search");
    if (!brand.trim()) return rejectDraft("Informe Marca, Modelo e Ano válidos.", "quick-brand");
    if (!model.trim()) return rejectDraft("Informe Marca, Modelo e Ano válidos.", "quick-model");
    if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > new Date().getFullYear() + 1)
      return rejectDraft("Informe Marca, Modelo e Ano válidos.", "quick-year");
    if (!service.trim()) return rejectDraft("Informe o Serviço realizado.", "quick-service");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return rejectDraft("Informe o Valor do serviço.", "quick-amount");
    for (const part of normalizedParts) {
      if (!part.name) return rejectDraft("Confira nome, quantidade, valor e custo das peças.", `quick-part-name-${part.id}`);
      if (!Number.isInteger(part.quantity) || part.quantity < 1)
        return rejectDraft("Confira nome, quantidade, valor e custo das peças.", `quick-part-quantity-${part.id}`);
      if (!Number.isFinite(part.unitPrice) || part.unitPrice < 0)
        return rejectDraft("Confira nome, quantidade, valor e custo das peças.", `quick-part-price-${part.id}`);
      if (part.unitCost !== undefined && (!Number.isFinite(part.unitCost) || part.unitCost < 0))
        return rejectDraft("Confira nome, quantidade, valor e custo das peças.", `quick-part-cost-${part.id}`);
    }
    const numericSubtotal = quickOrderSubtotal(numericAmount, normalizedParts);
    if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || numericDiscount > numericSubtotal)
      return rejectDraft("Informe um desconto válido.", "quick-discount");
    if (numericCost !== undefined && (!Number.isFinite(numericCost) || numericCost < 0))
      return rejectDraft("Informe um custo interno válido.", "quick-cost");
    const paymentIssue = quickPaymentError(numericReceived, method || undefined, numericSubtotal - numericDiscount, numericFee);
    if (paymentIssue) {
      const paymentField = paymentIssue === "Selecione a forma de pagamento."
        ? "quick-method"
        : paymentIssue.includes("taxa") || paymentIssue.includes("Taxa")
          ? "quick-fee"
          : "quick-received";
      return rejectDraft(paymentIssue, paymentField);
    }
    setError("");
    return {
      requestId: requestId.current,
      ...(newCustomer ? { newCustomer: { name: customerName.trim(), phone: cleanPhone, ...(customerCpf.replace(/\D/g, "") ? { cpf: customerCpf.replace(/\D/g, "") } : {}), ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}) } } : { customerId }),
      ...(vehicleId ? { vehicleId } : {}), vehicleBrand: brand.trim(), vehicleModel: model.trim(), vehicleYear: numericYear,
      service: quickServiceDescription(service, serviceType === "rescue" ? { pickup: rescuePickup, destination: rescueDestination, note: rescueNote } : undefined), amount: numericAmount, discountAmount: numericDiscount,
      discountReason: discountReason.trim(), receivedAmount: numericReceived,
      warrantyDays,
      parts: normalizedParts,
      ...(numericCost === undefined ? {} : { internalCost: numericCost }), cardFee: numericFee,
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
  const visibleCustomers = filterQuickCustomers(customers, customerSearch);
  const selectServiceType = (type: "review" | "oil" | "rescue" | "other", suggestion: string) => {
    setServiceType(type);
    setService(suggestion);
  };
  return <Dialog open={open} onOpenChange={(value) => value ? onOpenChange(true) : close()}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>Nova OS Rápida</DialogTitle><DialogDescription>Registre o atendimento, confira o pagamento e finalize.</DialogDescription></DialogHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={!newCustomer ? "default" : "outline"} onClick={() => setNewCustomer(false)}>Cliente existente</Button><Button type="button" size="sm" variant={newCustomer ? "default" : "outline"} onClick={() => { setNewCustomer(true); setCustomerId(""); setVehicleId(""); }}>Novo cliente</Button></div>
            {newCustomer ? <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-name">Nome *</Label><Input id="quick-name" autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div><div><Label htmlFor="quick-phone">Telefone *</Label><Input id="quick-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div><div><Label htmlFor="quick-cpf">CPF (opcional)</Label><Input id="quick-cpf" value={customerCpf} onChange={(e) => setCustomerCpf(e.target.value)} /></div><div><Label htmlFor="quick-email">Email (opcional)</Label><Input id="quick-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div></div> : <div><Label>Buscar cliente</Label><Command shouldFilter={false} className="mt-1 overflow-hidden rounded-lg border bg-background"><CommandInput id="quick-customer-search" autoFocus value={customerSearch} onValueChange={(value) => { setCustomerSearch(value); if (customerId) { setCustomerId(""); setVehicleId(""); } }} aria-label="Buscar cliente por nome ou telefone" placeholder="Digite nome ou telefone" /><CommandList className="max-h-56 p-2"><CommandEmpty><div className="px-3 py-5 text-center"><p className="text-sm font-medium">Nenhum cliente encontrado</p><p className="mt-1 text-xs text-muted-foreground">Revise a busca ou escolha Novo cliente.</p></div></CommandEmpty>{visibleCustomers.map((customer) => <CommandItem key={customer.id} value={customer.id} onSelect={() => { setCustomerId(customer.id); setVehicleId(""); setCustomerSearch(customer.name); }} className={`mb-1 flex min-h-12 items-center justify-between rounded-md border px-3 py-2 last:mb-0 ${customerId === customer.id ? "border-primary/30 bg-primary/[0.07]" : "border-transparent"}`}><span className="min-w-0"><strong className="block truncate text-sm">{customer.name}</strong><span className="block truncate text-xs text-muted-foreground">{customer.phone}</span></span>{customerId === customer.id && <span className="text-xs font-semibold text-primary">Selecionado</span>}</CommandItem>)}</CommandList></Command></div>}
          </section>

          {!newCustomer && customerId && customerVehicles.length > 0 && <div><Label htmlFor="quick-vehicle">Veículo existente (opcional)</Label><select id="quick-vehicle" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleId} onChange={(e) => selectVehicle(e.target.value)}><option value="">Informar somente Marca, Modelo e Ano</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.plate}</option>)}</select></div>}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]"><div><Label htmlFor="quick-brand">Marca</Label><Input id="quick-brand" value={brand} onChange={(e) => { setVehicleId(""); setBrand(e.target.value); }} /></div><div><Label htmlFor="quick-model">Modelo</Label><Input id="quick-model" value={model} onChange={(e) => { setVehicleId(""); setModel(e.target.value); }} /></div><div><Label htmlFor="quick-year">Ano</Label><Input id="quick-year" inputMode="numeric" value={year} onChange={(e) => { setVehicleId(""); setYear(e.target.value); }} /></div></div>

          <section className="space-y-3">
            <div><p className="text-sm font-medium">Tipo de serviço</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button type="button" size="sm" variant={serviceType === "review" ? "default" : "outline"} onClick={() => selectServiceType("review", "Revisão")}>🔧 Revisão</Button>
              <Button type="button" size="sm" variant={serviceType === "oil" ? "default" : "outline"} onClick={() => selectServiceType("oil", "Troca de óleo")}>🛢 Troca de óleo</Button>
              <Button type="button" size="sm" variant={serviceType === "rescue" ? "default" : "outline"} onClick={() => selectServiceType("rescue", "Resgate de veículo")}>🚚 Resgate</Button>
              <Button type="button" size="sm" variant={serviceType === "other" ? "default" : "outline"} onClick={() => selectServiceType("other", "")}>➕ Outros</Button>
            </div></div>
            <div><Label htmlFor="quick-service">Serviço realizado</Label><Input id="quick-service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Descreva o serviço" /></div>
            {serviceType === "rescue" && <div className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2"><div><Label htmlFor="quick-rescue-pickup">Local de retirada (opcional)</Label><Input id="quick-rescue-pickup" value={rescuePickup} onChange={(e) => setRescuePickup(e.target.value)} /></div><div><Label htmlFor="quick-rescue-destination">Destino (opcional)</Label><Input id="quick-rescue-destination" value={rescueDestination} onChange={(e) => setRescueDestination(e.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="quick-rescue-note">Observação (opcional)</Label><Input id="quick-rescue-note" value={rescueNote} onChange={(e) => setRescueNote(e.target.value)} /></div></div>}
          </section>

          <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-amount">Valor do serviço</Label><Input id="quick-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="180,00" /></div><div><Label htmlFor="quick-discount">Desconto (opcional)</Label><Input id="quick-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div></div>
          {money(discount) > 0 && <div><Label htmlFor="quick-discount-reason">Motivo do desconto</Label><Input id="quick-discount-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} /></div>}

          <section className="rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">Peças / itens adicionais</p><p className="text-xs text-muted-foreground">Opcional — adicione somente quando precisar.</p></div><Button type="button" size="sm" variant="outline" onClick={() => { setPartsOpen(true); setParts((current) => [...current, { id: `quick-part-${crypto.randomUUID()}`, name: "", quantity: "1", unitPrice: "", unitCost: "" }]); }}>Adicionar peça</Button></div>
            {partsOpen && parts.length > 0 && <div className="mt-3 space-y-3">{parts.map((part, index) => <div key={part.id} className="grid gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_9rem_auto]"><div><Label htmlFor={`quick-part-name-${part.id}`}>Descrição</Label><Input id={`quick-part-name-${part.id}`} value={part.name} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, name: e.target.value } : item))} /></div><div><Label htmlFor={`quick-part-quantity-${part.id}`}>Quantidade</Label><Input id={`quick-part-quantity-${part.id}`} inputMode="numeric" value={part.quantity} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, quantity: e.target.value } : item))} /></div><div><Label htmlFor={`quick-part-price-${part.id}`}>Preço cobrado</Label><Input id={`quick-part-price-${part.id}`} inputMode="decimal" value={part.unitPrice} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, unitPrice: e.target.value } : item))} /></div><Button type="button" size="sm" variant="ghost" className="self-end" aria-label={`Remover peça ${index + 1}`} onClick={() => setParts((current) => current.filter((item) => item.id !== part.id))}>Remover</Button></div>)}</div>}
          </section>

          <section className="space-y-3"><p className="text-sm font-medium">Pagamento</p><div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant={receiveNow ? "default" : "outline"} onClick={() => { setReceiveNow(true); receivedEdited.current = false; }}>Recebido agora</Button><Button type="button" size="sm" variant={!receiveNow ? "default" : "outline"} onClick={() => { setReceiveNow(false); setMethod(""); setReceived("0"); setCardFee("0"); receivedEdited.current = true; }}>Receber depois</Button></div>
            {receiveNow ? <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-method">Forma de pagamento</Label><select id="quick-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={(e) => { const next = e.target.value as PaymentMethod | ""; setMethod(next); if (next !== "Cartão") setCardFee("0"); }}><option value="">Selecione</option><option>Dinheiro</option><option>PIX</option><option>Cartão</option></select></div><div><Label htmlFor="quick-received">Valor recebido</Label><Input id="quick-received" inputMode="decimal" value={received} onChange={(e) => { receivedEdited.current = true; setReceived(e.target.value); }} /></div></div> : <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Pagamento ficará pendente.</p>}
          </section>

          {financialAllowed && <details className="rounded-md border px-3 py-2"><summary className="cursor-pointer text-sm font-medium">Dados internos da oficina</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-cost">Custo do serviço</Label><Input id="quick-cost" inputMode="decimal" value={internalCost} onChange={(e) => setInternalCost(e.target.value)} /></div>{receiveNow && method === "Cartão" && <div><Label htmlFor="quick-fee">Taxa da máquina</Label><Input id="quick-fee" inputMode="decimal" value={cardFee} onChange={(e) => setCardFee(e.target.value)} /></div>}{parts.map((part, index) => <div key={`cost-${part.id}`}><Label htmlFor={`quick-part-cost-${part.id}`}>Custo da oficina — peça {index + 1}</Label><Input id={`quick-part-cost-${part.id}`} inputMode="decimal" value={part.unitCost} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, unitCost: e.target.value } : item))} /></div>)}</div>{receiveNow && method === "Cartão" && <p className="mt-3 text-sm text-muted-foreground">Líquido recebido: {currency(numericSafe(received) - numericSafe(cardFee))}</p>}</details>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <aside className="space-y-3 rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-0" aria-labelledby="quick-summary-title">
          <div className="flex items-center justify-between gap-3"><h3 id="quick-summary-title" className="font-semibold">Resumo do atendimento</h3><span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentStatus === "Pago" ? "bg-emerald-100 text-emerald-800" : paymentStatus === "Parcial" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>{paymentStatus}</span></div>
          <dl className="space-y-2 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Serviço</dt><dd className="tabular-nums">{currency(numericSafe(amount))}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Peças</dt><dd className="tabular-nums">{currency(partsSubtotal)}</dd></div><div className="flex items-center justify-between gap-4 border-t pt-2"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{currency(subtotal)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Desconto</dt><dd className="tabular-nums">-{currency(numericSafe(discount))}</dd></div><div className="flex items-center justify-between gap-4 rounded-md bg-background px-3 py-2 text-base font-semibold"><dt>Total final</dt><dd className="tabular-nums">{currency(total)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Recebido</dt><dd className="tabular-nums">{currency(numericSafe(received))}</dd></div><div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-base font-semibold"><dt>Saldo</dt><dd className="tabular-nums">{currency(balance)}</dd></div></dl>
        </aside>
      </div>
      <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="ghost" disabled={saving} onClick={continueAsStandard}>Continuar como OS completa</Button><Button type="button" disabled={saving} onClick={() => void finalize()}>{saving ? "Finalizando…" : "Finalizar atendimento"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
