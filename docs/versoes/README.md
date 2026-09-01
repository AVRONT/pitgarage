# Versionamento da documentação

Os documentos numerados em `docs/` representam o estado vigente do projeto. Este diretório define como preservar versões quando esse estado evoluir.

## Quando criar uma nova versão

Criar uma nova versão documental quando houver mudança relevante em requisitos, regras de negócio, MVP, roadmap, arquitetura, modelagem ou escopo. Mudanças pequenas e esclarecimentos que não alteram substancialmente o entendimento podem ser registrados apenas no changelog e no documento vigente.

## Como registrar

1. Preservar a versão e as decisões anteriores no histórico.
2. Criar um resumo da nova versão sem copiar desnecessariamente toda a documentação.
3. Informar data, quando confirmada, motivação, alterações, decisões afetadas e pendências.
4. Para cada decisão alterada, registrar:
   - decisão anterior;
   - nova decisão;
   - motivo;
   - status da decisão anterior: substituída, descartada, adiada ou mantida como futura.
5. Atualizar os documentos vigentes, [`AI_CONTEXT.md`](../AI_CONTEXT.md), [`docs/README.md`](../README.md) e [`CHANGELOG.md`](../../CHANGELOG.md) conforme necessário.
6. Confirmar que os links existentes continuam funcionando e que nenhuma informação anterior foi perdida.

## Identificação

As versões usam numeração sequencial (`v1`, `v2`, `v3`...) e um nome curto descritivo. A versão inicial está registrada em [`historico/v1-documentacao-inicial.md`](../historico/v1-documentacao-inicial.md).
