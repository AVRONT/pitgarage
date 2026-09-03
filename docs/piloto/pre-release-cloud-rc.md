# Pré-release cloud / release candidate — revisão de 03/09/2026

Status: **candidato local, ainda não liberado para uso real na oficina**. Base revisada: commit `943265c`, com árvore inicialmente limpa em `C:\PITGARAGE\pitgarage`. Esta rodada não aplicou SQL, não acessou Lovable e não fez commit/push.

## Estado e limites da auditoria

Auth e bootstrap do primeiro owner já estão aplicados conforme o contexto e histórico do projeto; não foram reinspecionados remotamente nem repetidos. A migration operacional `20260902230000_create_operational_base.sql` continua somente local e **não recebeu alteração nesta rodada**. Nenhuma versão anterior foi sobrescrita.

Revisão estática das três tabelas: PK UUID, sequência única de OS, FKs sem cascade operacional e FK composta veículo/cliente; exclusão de Auth anula somente o vínculo comercial. Constraints/índices, RLS, grants por coluna, revokes, funções definer com search_path vazio, auth.uid e funções invoker/trigger de perfil continuam coerentes com a matriz solicitada. Não houve execução/compilação em PostgreSQL: confirmação real de RLS, rollback e locks continua obrigatória.

## Achados por prioridade

### P0 — integridade e isolamento

- Escrita cloud sem retorno de linha podia parecer sucesso após perda de permissão ou desaparecimento do registro. UPDATE de OS e exclusões lógicas agora exigem retorno de exatamente uma linha; erro deixa de ser sucesso silencioso.
- Duas instâncias podiam sobrescrever a mesma OS sem detectar que a base mudou. O repositório usa o `updated_at` lido como precondição de UPDATE, avança a versão e guarda a versão retornada. Divergência/nenhuma linha exige recarga, sem merge automático.
- Escritas de uma tela são serializadas; chamadas ao repositório saíram do updater de estado React, que pode ser reexecutado. Após falha, a fila para e a tela exige conferência dos dados salvos. Nova OS aguarda escritas anteriores antes de recarregar a lista.
- Na troca de conta, a identidade anterior é retirada antes de carregar o perfil do novo usuário. Isso evita manter a aplicação da conta anterior montada durante a consulta.

Essas correções protegem os caminhos do runtime atual, não tornam histórico/JSON imutáveis nem impedem um operador autorizado de modificar dados diretamente pela API. O controle de versão precisa passar pelo teste real de duas sessões.

### P1 — fluxo e primeira impressão

- Sucesso de exclusão só aparece após confirmação. Feedback de gravação pendente é distinto de sucesso; falha persistente não desaparece em três segundos.
- Busca textual já não retorna todos os clientes com CPF por comparação com uma sequência vazia; busca sem resultado tem orientação.
- Dashboard vazio orienta a primeira OS; ausência de aprovações não é apresentada como valor pendente de R$ 0,00. Data demonstrativa fixa foi retirada do título, sem mudar datas/regras dos atendimentos.
- Equipe mostra carregamento, erro com retry, vazio e salvamento; controles ficam indisponíveis durante gravação. Explica que ajustes dependem de Salvar e mantém o rascunho em falha. Layout e quebra de e-mail evitam compressão excessiva.
- Portal oferece retry e descarta respostas de consultas anteriores. Cadastro informa o vínculo necessário, sem prometer uma área inexistente.
- Nova OS: botões de seleção/cadastro quebram linha no celular. Detalhe da OS: contêiner posicionado mantém os rótulos acessíveis do stepper dentro da rolagem, eliminando largura indevida da página. Lógica, ordem, animações e reduced-motion preservados.
- Mensagens de diagnóstico/pagamento não dizem “localmente” quando o runtime está em cloud.

### P2/P3 — documentados, sem ampliação de escopo

- P2: idempotência entre reenvios após resposta incerta ainda não existe; conferir a lista antes de repetir criação. Não equivale ao bloqueio de duplo clique.
- P2: backup cloud/recuperação, autoria imutável, validação interna dos JSONs e paginação para grandes volumes continuam pendentes. Não anunciar o backup legado como cloud.
- P2: cargo/responsáveis, visibilidade financeira, CPF básico, telefone único e garantia/datas demonstrativas continuam provisórios; não são regras definitivas aprovadas para produção.
- P2: salvar perfil e recarregar lista ainda pode descartar rascunhos de outras linhas; editar e salvar uma conta por vez até melhoria futura.
- P3: nome técnico owner em alguns pontos, identificação visual v0.1.15 e avisos do scaffold de build não foram motivo para redesign/refatoração.

## Matriz de acesso revisada

| Perfil | Acesso previsto |
| --- | --- |
| customer ativo | RPCs do próprio cadastro, veículos e resumo de OS; nenhum custo/JSON interno, acesso de terceiro ou escrita operacional. |
| staff ativo | Operação interna; sem alteração de access_level ou listagem administrativa de terceiros. |
| admin ativo | Operação interna; sem alteração de access_level ou promoção de owner. |
| owner ativo | Lista mínima de contas; administra customer/staff/admin, cargo e ativo; sem criar owner pela UI ou rebaixar/desativar owner existente. |
| ausente/inativo/anon | Sem operação interna; consultas privilegiadas negadas/vazias segundo o contrato. |

Frontend não consulta auth.users. Vínculo continua por e-mail confirmado, normalizado e único, nunca por nome. Nova OS mantém Cliente → Veículo → Dados → Confirmar, sem criação de Auth e sem persistência dos novos cadastros antes da confirmação. A atomicidade depende da RPC SQL já preparada.

Última conta contém nome/e-mail/iniciais; senha e token customizado não são gravados. Persistência/renovação de sessão é do SDK. Retry transitório, bloqueio por perfil ausente/inativo e tradução de weak_password foram preservados. Cloud não carrega fixtures; Admin Local só funciona em DEV/localhost com adapter separado vazio por padrão. Legado e dados reais não foram modificados pelos testes.

## Validações locais desta rodada

- Typecheck, lint dos seis TS/TSX alterados, Prettier e build aprovados. Avisos de vite-tsconfig-paths e inlineDynamicImports pertencem ao scaffold; sem alteração de configuração/dependências.
- Navegador Edge headless com contexto temporário, endpoint Supabase fictício em loopback e bloqueio de requisições externas. Nenhuma credencial, sessão ou dado do navegador real foi utilizado.
- Capturas em 1366×768, 1920×1080, 768×1024 e 390×844 para login, Dashboard, Nova OS, Equipe e detalhe; portal sem vínculo também em desktop/tablet/mobile. Clientes, Veículos e OS vazios conferidos em amostra representativa. Capturas finais de detalhe mobile/tablet confirmaram largura de página de 390/768 px.
- Retry de perfil e portal testados com respostas simuladas; legado-sentinela preservado. Fluxo existente+existente e novo+novo percorreu os quatro passos; nenhum envio antes de confirmar, estado Salvando, erro mantendo dados e criação simulada abrindo detalhe.
- Testes isolados do repositório: duas instâncias carregam a mesma versão; primeira salva, segunda é rejeitada; sequência válida continua; update/exclusão sem linha/permissão são rejeitados. Isso não é teste real de RLS nem de concorrência PostgreSQL.
- Formulário novo+novo manteve cliente/veículo/problema após erro simulado. Rollback real, vínculo real, cadastro/confirmador de e-mail, revogação e gestão real de Equipe aguardam a matriz abaixo.
- Não houve teste visual exaustivo de todos os status/documentos nem homologação em dispositivos físicos. Paleta e CSS global preservados.

Referências técnicas da correção: [retorno de UPDATE no Supabase](https://supabase.com/docs/reference/javascript/update) e [reavaliação de condições em atualizações concorrentes no PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html).

## Checklist pós-migration — executar nesta ordem

Pré-condições: migration aplicada uma única vez no projeto correto; frontend desta revisão disponível em ambiente de homologação; owner real já existente. Usar e-mails/contas de teste controlados e contextos de navegador separados. Nunca excluir a conta do proprietário. Testes de falha/exclusão somente em dados de teste autorizados.

| # | Ação | Resultado esperado | Falha grave |
| --- | --- | --- | --- |
| 1 | Entrar com owner real, recarregar e abrir Dashboard/Equipe. | Perfil owner ativo; base nova vazia, sem fixtures; lista mínima de contas. | Sem acesso, perfil errado ou dados fictícios operacionais automáticos. |
| 2 | Criar conta de teste e usar owner para torná-la staff com cargo; entrar em outro contexto; tentar alterar access_level por RPC/API. | Operação interna permitida, gestão negada. | Staff muda permissões ou lista terceiros. |
| 3 | Repetir com admin; tentar promoção a owner por API. | Operação interna; nenhuma gestão de nível. | Admin altera access_level ou promove owner. |
| 4 | Criar/confirmar customer A e cadastro comercial A correspondente; entrar como A. | Somente cadastro/veículos/resumo permitido de A. | Escrita operacional, custos ou JSON administrativo exposto. |
| 5 | Repetir para customer B, com e-mail e veículo distintos. | Somente registros B. | Exposição de registros A. |
| 6 | Com JWT A/B, chamar tabelas e RPCs diretamente; tentar UUID do outro, escrita de vínculo e helper privado; repetir anon/inativo. | Sem dados de terceiro nem escrita; portal usa projeções mínimas. | Qualquer acesso cruzado, enumeração ou privilégio indevido. |
| 7 | Owner altera cargo/nível/ativo de não-owner; confirmar reload; testar rebaixar/desativar owner e promover outro owner via UI/API. | Mudanças autorizadas persistem; operações sobre owner proibidas. | Owner desativado/rebaixado, novo owner ou sucesso sem gravação. |
| 8 | Criar OS com cliente/veículo existentes; depois existente+veículo novo. Abrir a mesma OS em duas sessões e salvar mudanças diferentes. | Titularidade correta, OS certa aberta; segunda edição desatualizada exige recarga sem sobrescrever a primeira. | Veículo de terceiro, OS incorreta ou perda silenciosa de alteração. |
| 9 | Nova OS com cliente+veículo novos: passar quatro etapas, cancelar e conferir banco; repetir e confirmar uma vez; testar duplo clique e duplicidades. | Cancelar não grava; confirmar cria trio consistente; nenhum usuário Auth criado. | Cadastro parcial, duplicação por clique simultâneo ou nova conta Auth. |
| 10 | Em dados de teste, chamar RPC com novo cliente/veículo válidos e entryMileage inválida para falhar no insert da OS. | Erro e nenhum dos três registros persistido; lacuna na sequência é aceitável. | Cliente/veículo parcial ou OS inconsistente. |
| 11 | Oficina cria cliente com e-mail controlado sem conta; criar/confirmar conta depois e abrir portal. Testar não confirmado, e-mail diferente e nome igual. | Vincula só após confirmação e correspondência sem conflito. | Nome vincula, conta não confirmada vincula ou associação de terceiro. |
| 12 | Criar/confirmar conta antes; depois oficina cadastra cliente pelo mesmo e-mail normalizado; testar conflito/ambiguidade e chamadas concorrentes. | Vínculo único correto; conflitos não escolhem arbitrariamente. | Vínculo duplo/errado ou escolha arbitrária. |
| 13 | Entrar com customer confirmado sem cadastro comercial correspondente. | Estado vazio claro, logout disponível; erro de rede oferece retry. | Tela quebrada, dados de terceiros ou confusão entre erro e vazio. |
| 14 | Testar login/cadastro, confirmação, weak_password real, reload, última conta, falha de perfil/getUser com retry, expiração/revogação e troca de conta. | Sessão válida restaura; transitório não faz logout; inválida pede login; perfil inativo bloqueia; última conta sem segredo. | Acesso com perfil indevido, persistência de senha/token customizado, logout transitório ou dados da conta anterior. |
| 15 | Excluir somente Auth de customer de teste com OS/histórico, usando administração autorizada. | Perfil Auth removido, vínculo comercial nulo; cliente, veículo, OS e histórico retidos. | Cascade remove histórico, veículo ou OS. |

Adicional de segurança: verificar grants reais de INSERT/DELETE/TRUNCATE/sequence em ambiente de teste, sem executar operações destrutivas em produção. Revogação de sessão deve considerar a validade do access token já emitido; bloqueio por perfil inativo precisa valer imediatamente nas políticas.

## Condição objetiva de liberação

Não liberar para a oficina apenas porque build passou. Exigir: migration aplicada sem erro; 15 testes acima aprovados com evidências; nenhuma falha P0/P1 aberta; dados e acesso do owner conferidos; primeiro atendimento real validado em ambiente autorizado; backup/recuperação e limitações demonstrativas explicitamente alinhados com a oficina. Testes de mock não substituem esse aceite.

## Próxima ação exata — não executada

No projeto correto do PitGarage no Lovable Cloud, abrir o editor SQL, confirmar Auth/bootstrap já existentes e ausência de aplicação da migration operacional. Executar uma única vez o arquivo integral `supabase/migrations/20260902230000_create_operational_base.sql`, com BEGIN/COMMIT. Se já houver objetos operacionais inesperados, parar e reconciliar antes. Não reaplicar Auth nem bootstrap. Depois executar este checklist em homologação; não publicar para uso real antes do aceite.

