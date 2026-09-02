# Piloto v0.1.11 — configurações e prévia de documentos

Data: 01/09/2026. Evolução demonstrativa local, sem emissão fiscal.

## Implementado

- Configurações em duas colunas a partir de 1280 px: formulário à esquerda e prévia à direita. Abaixo desse tamanho, prévia após o formulário. Direção visual existente preservada.
- Prévia de orçamento e resumo com cabeçalho compartilhado com os documentos reais do piloto. Exemplo OS-1052, cliente/veículo fictícios e itens que totalizam R$ 400,00; nada é inserido nas ordens operacionais.
- Rascunho atualiza instantaneamente a prévia. Cancelar restaura os valores salvos; sair desmonta o rascunho. Indicador discreto de alterações pendentes e confirmação após salvar. Falhas mantêm os campos.
- Razão social e CEP opcionais. Cabeçalho omite campos vazios ou com apenas espaços, incluindo linhas de contato, endereço e observações.
- CNPJ numérico completo recebe pontuação, CEP completo recebe hífen e telefone de 10/11 dígitos recebe máscara brasileira, reutilizando a normalização existente de prefixo 55. Formatação na saída do campo, no salvamento e na apresentação; valores incompletos ou não reconhecidos não são rejeitados nem truncados. Não há verificação fiscal, consulta externa ou validação de dígitos verificadores.
- Impressão existente de orçamento e resumo continua isolando o documento, sem sidebar, busca, botões e edição. Aviso operacional da visão do cliente não aparece na impressão. Qualificações de garantia demonstrativa permanecem para não apresentar uma regra provisória como definitiva.

## Compatibilidade

- Mesma chave `pitgarage-workshop-settings-v1`. Leitura de registros antigos completa somente razão social e CEP ausentes com strings vazias em memória. Não grava durante leitura ou digitação.
- `pitgarage-pilot-v012`, ordens, clientes, veículos, `deletedAt`, atividades e histórico não são alterados por essas configurações.
- Nenhuma alteração nas regras de workflow, pagamento, garantia, orçamento, Nova OS, busca, stepper, regressão ou restauração.
- Todas as versões anteriores permanecem disponíveis. Nenhuma dependência foi adicionada.

## Integração fiscal — apenas possibilidade futura

Fluxo a avaliar com a oficina:

OS concluída → dados da oficina + cliente + serviços/peças → emissão fiscal → retorno de número/status/documento → associação à OS.

Esse fluxo não representa requisito aprovado nem automação existente. Não foram implementados NFS-e, NF-e, NFC-e, API fiscal, certificado, XML, prefeitura, SEFAZ, tributos ou cálculo de imposto. Não existe botão de emissão.

Se houver conteúdo útil no futuro, as configurações poderão ser organizadas em Geral, Documentos e Fiscal. Não foi criada aba Fiscal vazia.

## Documentos históricos — pendente

Não existe mecanismo de snapshot no piloto atual. Alterar os dados da oficina ainda muda o cabeçalho ao reabrir uma OS antiga. Avaliar momento de congelamento, correção e reemissão antes de qualquer implementação, sem definir agora um modelo de banco. Questões registradas em [pendências](../10-questoes-pendentes.md).

## Validação

- Navegador isolado com configurações legadas sem os campos novos: leitura compatível e persistência apenas após salvar.
- Prévia sem salvar, troca de modo, cancelar, sair sem salvar, reload, campos vazios e formatação de CNPJ/telefone/CEP.
- Desktop 1440 px e tablet 834 px; conferência do cabeçalho também no orçamento OS-1048 e resumo final OS-1045, incluindo mídia de impressão.
- Build, lint dos arquivos alterados e `git diff --check`.

## Próxima tarefa sugerida (não executada)

Validar os documentos com a oficina e definir quando os dados devem ser congelados em documentos históricos. Não iniciar integração fiscal antes de confirmar sua necessidade e escopo.
