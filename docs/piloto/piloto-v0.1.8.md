# Piloto v0.1.8 — entrada operacional concentrada na Nova OS

## Objetivo

A Nova ordem de serviço passa a ser a entrada principal do balcão. O fluxo orientado segue `Cliente → Veículo → Dados da OS → Confirmar`, permite voltar antes da conclusão e mantém clientes e veículos novos apenas como rascunhos até a confirmação final.

## Combinações suportadas

- cliente existente com veículo existente do próprio cliente;
- cliente existente com veículo novo;
- cliente novo com veículo novo.

A busca de clientes considera nome, telefone, CPF e e-mail. As validações e normalizações locais já existentes continuam sendo usadas para cliente, placa, ano, quilometragem e dados da OS. Duplicidades são verificadas inclusive contra registros excluídos logicamente.

## Criação transacional local

Cliente e veículo novos não são persistidos durante as etapas intermediárias. A confirmação final insere os novos registros e a OS na mesma interação; cancelar o diálogo descarta todos os rascunhos. O veículo selecionável sempre é filtrado pelo cliente definido.

## Clientes e veículos

As páginas permanecem como áreas de consulta e gestão. Seus CTAs direcionam para a Nova OS e foram adicionados resumos compactos calculados somente com clientes, veículos e ordens existentes.

## Exclusão lógica

Clientes e veículos recebem o campo opcional `deletedAt`. Registros excluídos deixam de aparecer nas listagens operacionais, no dashboard e na Nova OS, mas permanecem no armazenamento para resolver ordens antigas.

Ao excluir um cliente, seus veículos também são marcados como excluídos operacionalmente. Excluir um veículo não altera o cliente nem remove ordens. Nenhuma exclusão apaga OS em cascata; detalhes históricos identificam discretamente registros excluídos.

## Persistência e preservação

O formato anterior do `localStorage` continua válido porque `deletedAt` é opcional. Workflow, confirmações, reversões, histórico, cálculos e o redesign das versões anteriores foram preservados.
