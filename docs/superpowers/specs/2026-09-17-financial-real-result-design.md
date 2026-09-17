# Resultado financeiro real — desenho aprovado

## Objetivo

Separar venda, pagamento bruto, custo direto, taxa financeira, entrada líquida e resultado real sem criar uma segunda fonte financeira.

## Modelo

- Venda bruta: itens aprovados e executados.
- Venda final: venda bruta menos desconto comercial.
- Pago pelo cliente: soma bruta dos recebimentos.
- Taxas: soma das taxas dos recebimentos; PIX e Dinheiro aceitam somente zero, Cartão aceita de zero ao bruto.
- Entrada líquida: recebimentos brutos menos taxas.
- Custos: custos diretos conhecidos de peças e serviços na estrutura privada `order_part_financials`.
- Resultado: venda bruta menos desconto, custos e taxas.
- Contas a receber: venda final menos recebimentos brutos.

Recebimentos antigos equivalem a taxa zero e líquido igual ao bruto. `netAmount` é calculado e validado pelo backend. Custos, taxas, líquido e resultado nunca são expostos ao customer.

## Persistência e segurança

`service_orders.payment.receipts` permanece canônico para recebimentos. A tabela privada existente de custos passa a aceitar qualquer item do orçamento. Correções financeiras usam RPC transacional, versão esperada, `request_id` idempotente, motivo obrigatório e permissão `can_view_financial()`.

Valores anteriores e novos ficam numa tabela privada de auditoria. A atividade operacional recebe apenas um evento genérico, sem valores internos. A OS concluída/entregue não muda de status após correção.

## UX

OS normal e rápida exibem custo somente a usuários financeiros. Taxa aparece apenas para Cartão, com líquido calculado imediatamente. “Corrigir financeiro” fica separado do workflow operacional e permite ajustar recebimento, desconto ou custo com motivo obrigatório.

## Compatibilidade e não objetivos

Dados antigos continuam válidos. Não entram despesas fixas, contabilidade fiscal, estorno automático, novas formas de pagamento, nova tabela canônica de receipts ou mudança do workflow operacional.

## Restrições

Tudo permanece local até autorização posterior. Sem Lovable, migration remota, commit ou push.
