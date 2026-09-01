export const normalizeCpf = (value: string) => value.replace(/\D/g, "");

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
};

export const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export const normalizePlate = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

export const isBasicCpfValid = (value: string) => {
  const cpf = normalizeCpf(value);
  return cpf.length === 11 && !/^(\d)\1{10}$/.test(cpf);
};

export const isBasicEmailValid = (value: string) =>
  !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

export const nextOrderId = (ids: string[]) => {
  const used = new Set(ids);
  let number = Math.max(0, ...ids.map((id) => Number(id.match(/^OS-(\d+)$/)?.[1] ?? 0))) + 1;
  while (used.has(`OS-${number}`)) number += 1;
  return `OS-${number}`;
};
