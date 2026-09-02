# Piloto v0.1.10 — apresentação e fechamento

Data: 01/09/2026. Evolução local demonstrativa; não aprova arquitetura nem regras definitivas.

## Entregas

- Reutilização de `Visualizar como cliente` na aba Orçamento: identificação configurável da oficina, veículo, placa, relato, diagnóstico, evidências demonstrativas existentes, itens e totais por aprovação. Sem edição, compartilhamento ou autorização real.
- `Resumo final` no cabeçalho de OS em Serviço concluído, Aguardando retirada ou Entregue. Exibe cliente, veículo, placa, km de entrada, relato, diagnóstico, execução registrada, peças utilizadas, itens recusados/sem execução, responsáveis, valor aprovado, pagamento, conclusão e garantia demonstrativa.
- Impressão nativa nos dois documentos, com margens A4, cabeçalho sóbrio e remoção dos controles internos. Salvar como PDF depende das opções do navegador. Não produz documento fiscal.
- Configurações da oficina na navegação: nome obrigatório; CNPJ, telefone, endereço e observação opcionais. Erros de gravação mantêm os campos. Ícone de ferramenta preservado, sem upload de logo.

## Compatibilidade e decisões provisórias

- Configurações em `pitgarage-workshop-settings-v1`; leitura combina campos existentes com defaults sem gravar automaticamente. Valores vazios opcionais são preservados. Dados inválidos usam defaults na tela, sem apagar a chave original antes de um salvamento explícito.
- `pitgarage-pilot-v012`, dados fictícios, histórico, atividades, exclusão lógica e restauração operacional permanecem intactos. Restaurar dados operacionais não apaga as configurações da oficina.
- Default: Oficina Pit Stop, observação de demonstração e contatos/CNPJ/endereço vazios. Não são inventados dados fiscais ou de contato.
- Configurações atuais aparecem também em OS antigas; ainda não existe congelamento documental por atendimento.
- Valor final segue a soma de preços aprovados já usada pelo piloto, independentemente de pagamento e execução. Listas de execução seguem `executed`; ausência não é convertida em execução por causa do status da OS.
- Garantia mantém exatamente 30 dias após conclusão e comparação com 01/09/2026, referência fixa já usada no piloto. Não é garantia jurídica ou cálculo em tempo real.
- Não foram alterados workflow, permissões, pagamento, cálculos, regressão, autocomplete, stepper ou redesign. Nenhum backend, banco, Supabase, dependência nova, link público ou envio externo foi adicionado.

## Validação

- Navegador isolado, sem acessar os dados do navegador de uso da oficina.
- OS-1048: total R$ 3.476,00, aprovado R$ 926,00, aguardando R$ 2.370,00 e recusado R$ 180,00; evidências existentes e ausência de resumo final antes da conclusão.
- OS-1045: orçamento total/aprovado R$ 355,50, recusado/aguardando zero, estado vazio de evidências; resumo com serviço e peça executados, pagamento PIX/Pago, conclusão 31/08/2026 e garantia até 30/09/2026.
- Configurações salvas e relidas após reload; conteúdo serializado de clientes, veículos, ordens e histórico idêntico antes/depois.
- Inspeção em desktop (1440 px) e tablet (834 px), além de mídia de impressão: dados da oficina presentes, controles não visíveis e documento sem deslocamento lateral.
- Build e lint dos arquivos TypeScript alterados; `git diff --check`. Avisos do build referentes ao scaffold/tamanho de pacote não motivam refatoração fora do escopo.
- Campos preservados após nome vazio e simulação de falha de gravação. Nenhum erro de execução no navegador de teste.
- Checagem adicional `tsc --noEmit`: nove erros preexistentes em `pilot-app.tsx` e `pilot-workflow.ts`, reproduzidos com a versão original de `pilot-app.tsx` lida de `HEAD` em memória. Nenhum diagnóstico novo nos módulos adicionados; correção geral de tipagem permanece fora desta entrega.

## Próxima tarefa sugerida (não executada)

Validar orçamento e resumo com a oficina usando atendimentos representativos; confirmar conteúdo, apresentação e regras ainda provisórias de pagamento/garantia antes de ampliar o piloto.
