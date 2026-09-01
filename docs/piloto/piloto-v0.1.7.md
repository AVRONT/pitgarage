# Piloto v0.1.7 — confirmação e reversão segura do workflow

## Objetivo

Esta evolução preserva o redesign da v0.1.6 e concentra mudanças somente no fluxo da ordem de serviço. O indicador mantém as oito etapas, estados, cores, interação e responsividade, mas deixa de exibir a linha horizontal contínua.

## Confirmações

As transições de status guiadas, correções de consistência, ajustes manuais, decisões do orçamento que podem avançar a OS, disponibilidade de peças e marcações de execução exigem confirmação explícita e contextual antes da alteração. Ações que apenas abrem uma aba continuam imediatas.

## Retorno de etapa

A ação secundária `Voltar etapa` usa uma regra central em `pilot-workflow.ts`. O modal informa o destino e lista os dados removidos ou resetados. Toda reversão atualiza `updatedAt`, acrescenta uma entrada em `statusHistory` e registra activity com o texto `Fluxo revertido: origem → destino`.

As regressões aplicam os seguintes ajustes:

- **Em diagnóstico → Recebido:** remove diagnóstico, constatações, observações, evidências, orçamento, pagamento e data de conclusão.
- **Aguardando aprovação → Em diagnóstico:** mantém diagnóstico e orçamento, mas reinicia decisões dos itens, execução, pagamento e data de conclusão.
- **Aguardando peça → Aguardando aprovação:** reinicia decisões dos itens, execução, pagamento e data de conclusão.
- **Em manutenção → Aguardando peça:** quando ainda existe peça aprovada indisponível, mantém decisões e reinicia execução, pagamento e data de conclusão.
- **Em manutenção → Aguardando aprovação:** quando não existe peça bloqueada, evita criar um estado `Aguardando peça` incoerente e reinicia decisões, execução, pagamento e data de conclusão.
- **Serviço concluído → Em manutenção:** mantém itens executados e remove pagamento e data de conclusão.
- **Aguardando retirada → Serviço concluído:** não remove registros operacionais.
- **Entregue → Aguardando retirada:** não remove registros operacionais.

Regressões manuais arbitrárias permanecem bloqueadas; o retorno usa somente o destino coerente calculado pela regra central.

## Preservação e limitações

Cálculos, busca, armazenamento local, dados históricos anteriores, orçamento e pagamentos fora dos resets descritos não foram alterados. Os estados continuam provisórios e sujeitos à validação da oficina.
