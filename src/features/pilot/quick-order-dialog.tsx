import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warrantyDays, type Customer, type Vehicle } from "./pilot-data";
import { quickOrderSubtotal, quickPaymentError, type PaymentMethod, type QuickOrderDraft } from "./quick-order-model";

const money = (value: string) => Number(value.replace(",", "."));
const numericSafe = (value: string) => Number.isFinite(money(value)) ? money(value) : 0;
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
  const [internalCost, setInternalCost] = useState("");
  const [cardFee, setCardFee] = useState("0");
  const [parts, setParts] = useState<QuickPartForm[]>([]);
  const [partsOpen, setPartsOpen] = useState(false);
  const receivedEdited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const partsSubtotal = parts.reduce((sum, part) => sum + numericSafe(part.quantity) * numericSafe(part.unitPrice), 0);
  const subtotal = numericSafe(amount) + partsSubtotal;
  const total = Math.max(0, subtotal - numericSafe(discount));
  useEffect(() => {
    if (!receivedEdited.current && method) setReceived(total.toFixed(2));
  }, [method, total]);

  const reset = () => {
    requestId.current = crypto.randomUUID();
    setNewCustomer(false); setCustomerId(""); setCustomerName(""); setCustomerPhone(""); setCustomerCpf("");
    setVehicleId(""); setBrand(""); setModel(""); setYear(""); setService(""); setAmount("");
    setDiscount("0"); setDiscountReason(""); setMethod(""); setReceived("0"); setInternalCost(""); setCardFee("0"); setParts([]); setPartsOpen(false); setError("");
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
    const numericCost = internalCost === "" ? undefined : money(internalCost), numericFee = money(cardFee);
    const normalizedParts = parts.map((part) => ({
      id: part.id, name: part.name.trim(), quantity: Number(part.quantity), unitPrice: money(part.unitPrice),
      ...(financialAllowed && part.unitCost !== "" ? { unitCost: money(part.unitCost) } : {}),
    }));
    if (newCustomer) {
      if (!customerName.trim() || cleanPhone.length < 10 || cleanPhone.length > 11) return setError("Informe nome e telefone válido do cliente."), null;
    } else if (!customerId) return setError("Selecione um cliente."), null;
    if (!brand.trim() || !model.trim() || !Number.isInteger(numericYear) || numericYear < 1900 || numericYear > new Date().getFullYear() + 1)
      return setError("Informe Marca, Modelo e Ano válidos."), null;
    if (!service.trim()) return setError("Informe o Serviço realizado."), null;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Informe o Valor do serviço."), null;
    for (const part of normalizedParts) {
      if (!part.name || !Number.isInteger(part.quantity) || part.quantity < 1 || !Number.isFinite(part.unitPrice) || part.unitPrice < 0
        || (part.unitCost !== undefined && (!Number.isFinite(part.unitCost) || part.unitCost < 0)))
        return setError("Confira nome, quantidade, valor e custo das peças."), null;
    }
    const numericSubtotal = quickOrderSubtotal(numericAmount, normalizedParts);
    if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || numericDiscount > numericSubtotal) return setError("Informe um desconto válido."), null;
    if (numericCost !== undefined && (!Number.isFinite(numericCost) || numericCost < 0)) return setError("Informe um custo interno válido."), null;
    const paymentIssue = quickPaymentError(numericReceived, method || undefined, numericSubtotal - numericDiscount, numericFee);
    if (paymentIssue) return setError(paymentIssue), null;
    setError("");
    return {
      requestId: requestId.current,
      ...(newCustomer ? { newCustomer: { name: customerName.trim(), phone: cleanPhone, ...(customerCpf.replace(/\D/g, "") ? { cpf: customerCpf.replace(/\D/g, "") } : {}) } } : { customerId }),
      ...(vehicleId ? { vehicleId } : {}), vehicleBrand: brand.trim(), vehicleModel: model.trim(), vehicleYear: numericYear,
      service: service.trim(), amount: numericAmount, discountAmount: numericDiscount,
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
        <section className="rounded-md border border-dashed p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-sm font-medium">Peças / itens adicionais</p><p className="text-xs text-muted-foreground">Opcional — abra somente quando precisar.</p></div>
            <Button type="button" size="sm" variant="outline" onClick={() => { setPartsOpen(true); setParts((current) => [...current, { id: `quick-part-${crypto.randomUUID()}`, name: "", quantity: "1", unitPrice: "", unitCost: "" }]); }}>Adicionar peça</Button>
          </div>
          {partsOpen && parts.length > 0 && <div className="mt-3 space-y-3">{parts.map((part, index) => <div key={part.id} className={`grid gap-2 border-t pt-3 ${financialAllowed ? "sm:grid-cols-[minmax(0,1fr)_5rem_8rem_8rem_auto]" : "sm:grid-cols-[minmax(0,1fr)_5rem_8rem_auto]"}`}>
            <div><Label htmlFor={`quick-part-name-${part.id}`}>Peça</Label><Input id={`quick-part-name-${part.id}`} value={part.name} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, name: e.target.value } : item))} /></div>
            <div><Label htmlFor={`quick-part-quantity-${part.id}`}>Qtd.</Label><Input id={`quick-part-quantity-${part.id}`} inputMode="numeric" value={part.quantity} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, quantity: e.target.value } : item))} /></div>
            <div><Label htmlFor={`quick-part-price-${part.id}`}>Venda unit.</Label><Input id={`quick-part-price-${part.id}`} inputMode="decimal" value={part.unitPrice} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, unitPrice: e.target.value } : item))} /></div>
            {financialAllowed && <div><Label htmlFor={`quick-part-cost-${part.id}`}>Custo unit.</Label><Input id={`quick-part-cost-${part.id}`} inputMode="decimal" value={part.unitCost} onChange={(e) => setParts((current) => current.map((item) => item.id === part.id ? { ...item, unitCost: e.target.value } : item))} /></div>}
            <Button type="button" size="sm" variant="ghost" className="self-end" aria-label={`Remover peça ${index + 1}`} onClick={() => setParts((current) => current.filter((item) => item.id !== part.id))}>Remover</Button>
          </div>)}</div>}
        </section>
        {money(discount) > 0 && <div><Label htmlFor="quick-discount-reason">Motivo do desconto</Label><Input id="quick-discount-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} /></div>}
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-method">Forma de pagamento</Label><select id="quick-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={(e) => { const next = e.target.value as PaymentMethod | ""; setMethod(next); if (next !== "Cartão") setCardFee("0"); }}><option value="">Sem recebimento agora</option><option>Dinheiro</option><option>PIX</option><option>Cartão</option></select></div><div><Label htmlFor="quick-received">Valor recebido</Label><Input id="quick-received" inputMode="decimal" value={received} onChange={(e) => { receivedEdited.current = true; setReceived(e.target.value); }} /></div></div>
        {financialAllowed && <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quick-cost">Custo interno do serviço (opcional)</Label><Input id="quick-cost" inputMode="decimal" value={internalCost} onChange={(e) => setInternalCost(e.target.value)} /></div>{method === "Cartão" && <div><Label htmlFor="quick-fee">Taxa do cartão</Label><Input id="quick-fee" inputMode="decimal" value={cardFee} onChange={(e) => setCardFee(e.target.value)} /></div>}</div>}
        {financialAllowed && method === "Cartão" && <p className="text-sm text-muted-foreground">Líquido recebido: {(numericSafe(received) - numericSafe(cardFee)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
        <div className="text-sm text-muted-foreground">{parts.length > 0 && <p>Subtotal: {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}<p>Total final: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter className="gap-2 sm:justify-between"><Button type="button" variant="ghost" disabled={saving} onClick={continueAsStandard}>Continuar como OS completa</Button><Button type="button" disabled={saving} onClick={() => void finalize()}>{saving ? "Finalizando…" : "Finalizar atendimento"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
