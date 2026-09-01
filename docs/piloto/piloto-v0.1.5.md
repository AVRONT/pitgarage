# Piloto v0.1.5 — workflow funcional da ordem de serviço

## Problema observado

Na v0.1.4, a barra refletia corretamente `order.status`, mas o funcionário precisava escolher estados livremente no seletor. Isso permitia registros incompatíveis, como uma OS em “Aguardando retirada” ainda com itens aguardando aprovação.

## Nova abordagem

`order.status` continua sendo a única fonte persistida. Uma camada central de workflow passou a derivar etapa, próxima ação, pré-requisitos, bloqueios, avisos e inconsistências a partir do diagnóstico, orçamento, decisões, peças, execução e pagamento.

O caminho normal é orientado pela **Próxima ação sugerida**, que abre diretamente Diagnóstico, Orçamento, Execução ou Pagamento e garantia. A mudança manual ficou secundária e é registrada como correção excepcional.

## Progressão orientada por ações

- iniciar diagnóstico, colocar o orçamento em aprovação, concluir serviço, preparar retirada e confirmar entrega são ações explícitas;
- registrar diagnóstico e montar orçamento abrem a aba necessária sem criar avanço oculto;
- decisões concluídas levam a OS a “Aguardando peça” quando há peça aprovada indisponível, ou a “Em manutenção” quando tudo está disponível;
- atualizar a última peça necessária como disponível leva a OS a “Em manutenção”;
- executar o último item aprovado apenas disponibiliza a ação confirmada “Concluir serviço”.

## Confirmações e rastreabilidade

Colocar em aprovação, concluir serviço, preparar retirada e confirmar entrega exigem confirmação. Toda transição registra origem, destino, horário, atividade e `updatedAt`. A conclusão preenche `completedAt`.

## Inconsistências anteriores

Registros incompatíveis não são apagados nem corrigidos silenciosamente. A tela informa o problema, recomenda o estado coerente e oferece correção explícita, preservando `statusHistory` e `activities`.

## Mudança manual excepcional

“Ajustar status manualmente” abre um diálogo secundário. Pré-requisitos ausentes aparecem como alerta; a confirmação registra a alteração como correção manual. Esse recurso existe para regressões e exceções operacionais do piloto, não como caminho normal.

## Progresso visual

O trilho agora é neutro, o trecho concluído é verde, a etapa atual é laranja e as futuras permanecem cinza. Etapas futuras não alteram status: explicam os pré-requisitos reais ainda ausentes. Em larguras menores, a barra mantém largura mínima e rolagem horizontal controlada.

## Regras preservadas e provisórias

Confirmadas no escopo atual: decisões por item, execução somente de itens aprovados e preservação do histórico. Continuam provisórios: os oito estados, as transições, pagamento pendente sem bloqueio definitivo da entrega, garantia de 30 dias a partir da conclusão e o tratamento de nenhum item aprovado.

## Compatibilidade e limitações

A chave `pitgarage-pilot-v012` e a estrutura existente foram preservadas. Não há reset automático, migração destrutiva, envio real de orçamento, estoque quantitativo, backend ou autenticação. A disponibilidade de peças é somente o controle mínimo necessário dentro da OS.

