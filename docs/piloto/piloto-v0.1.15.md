# Piloto v0.1.15 — segurança e consistência histórica local

Data: 02/09/2026. Evolução da persistência local e dos documentos demonstrativos, sem alterar o workflow ou criar regra operacional nova.

## Snapshot da oficina

- Na primeira transição guiada de `Em manutenção` para `Serviço concluído`, a OS recebe uma cópia dos campos atuais de nome, razão social, CNPJ, telefone, endereço, CEP e atendimento da oficina.
- O momento reutiliza a ação existente `Concluir serviço`; não cria status, etapa ou confirmação nova. A escolha é provisória até a oficina validar fechamento, correção e reemissão de documentos.
- Orçamento e resumo final de uma OS com snapshot preferem a cópia congelada. OS antigas e alterações manuais sem snapshot continuam funcionando com as configurações atuais.
- Alterar configurações, regredir a OS ou concluí-la novamente não substitui um snapshot existente. Não há migração retroativa ou gravação silenciosa em OS antigas.

## Backup local e versão do formato

- Configurações possui uma área discreta com `Exportar backup` e `Importar backup`.
- O JSON exportado usa `format: "pitgarage-local-backup"`, `formatVersion: 1`, data ISO em `exportedAt`, dados operacionais em `data` e configurações em `workshop`.
- `data` contém integralmente clientes, veículos e ordens do piloto, incluindo histórico, atividades, exclusões lógicas e snapshots existentes. Não inclui dados externos inexistentes.
- Antes de mostrar a confirmação, a importação valida JSON, identificador e versão do formato, data, campos estruturais, IDs duplicados e vínculos entre clientes, veículos e OS. Arquivo inválido não grava nenhuma chave.
- A gravação mantém cópia dos dois valores locais anteriores e os restaura se uma das escritas falhar. Após sucesso, os estados React e as seleções seguras são atualizados; reload lê os dados importados normalmente.
- Os registros nas chaves existentes `pitgarage-pilot-v012` e `pitgarage-workshop-settings-v1` passam a incluir `schemaVersion: 1`. Leitores continuam aceitando registros anteriores sem esse campo; nenhuma chave é apagada, renomeada ou reinicializada.

## Preservação

Nenhuma mudança em workflow, estados, stepper, regressões, Nova OS, autocomplete, diagnóstico, orçamento/aprovação, execução, pagamento, garantia, timeline, exclusão lógica ou identidade visual. Nenhuma dependência nova, backend, sincronização externa, emissão fiscal, commit, push ou publicação.

## Validação

- Exportação dos dados correntes acionada pela interface com retorno de sucesso.
- JSON sintaticamente inválido rejeitado com mensagem clara e sem substituição do estado atual.
- Backup válido aceito somente após confirmação, com clientes, veículo, OS e configurações restaurados; persistência conferida após reload.
- Compatibilidade preservada para OS antiga sem snapshot por fallback e para registros locais anteriores sem `schemaVersion`.
- Caminhos documentais conferidos: OS com snapshot mantém a identificação congelada quando as configurações atuais mudam; snapshot existente não é sobrescrito.
- Build e lint dos arquivos alterados, além de `git diff --check`. Avisos preexistentes de tamanho de chunk permanecem fora do escopo.

## Limitações e decisões provisórias

- O backup é manual, local e substitui o conjunto completo conhecido do piloto; não há mesclagem, criptografia, nuvem, agendamento ou sincronização entre dispositivos.
- A versão 1 rejeita versões futuras ou formatos diferentes em vez de tentar uma conversão insegura.
- O momento do snapshot permanece provisoriamente ligado à conclusão guiada. Ajustes manuais de status não fabricam uma conclusão nem snapshot ausente.
- Dados do cliente, veículo, itens e garantia continuam refletindo as regras demonstrativas já existentes; esta versão congela somente a identificação da oficina solicitada.

## Próxima tarefa sugerida (não executada)

Validar com a oficina o momento de congelamento e definir como correções e reemissões de documentos devem preservar versões, antes de ampliar snapshots ou iniciar integração fiscal.
