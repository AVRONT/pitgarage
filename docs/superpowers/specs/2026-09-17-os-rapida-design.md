# OS Rápida / Atendimento rápido

## Objetivo

Adicionar um fluxo compacto de ordem de serviço para atendimentos já definidos, preenchido e finalizado em uma única tela, sem substituir nem alterar o fluxo completo existente. A OS Rápida continua sendo uma `service_order`, usa a numeração `OS-X` atual e reaproveita as regras vigentes de desconto, recebimentos, garantia, histórico e Financeiro.

## Escopo

Incluído:

- entrada “OS Rápida” ao lado de “Nova OS”;
- seleção de cliente existente ou cadastro rápido com nome, telefone e CPF;
- seleção opcional de veículo existente ou snapshot de marca, modelo e ano;
- serviço único, valor, desconto opcional e recebimento inicial;
- criação e finalização atômicas;
- pagamentos integral, parcial ou em aberto;
- continuação do rascunho rápido como OS completa, antes da finalização;
- histórico, listagens, documentos e Financeiro compatíveis com OS sem veículo oficial;
- proteção backend de permissões e idempotência;
- migration apenas local.

Fora do escopo:

- peças e custos na criação rápida;
- alterações no fluxo da OS completa;
- novo modelo de cliente ou veículo provisório;
- aplicação remota de migration, Lovable, commit ou push.

## Modelo de dados

`public.service_orders` receberá:

- `flow_type text not null default 'standard'`, limitado a `standard` e `quick`;
- `vehicle_id` anulável, preservando a FK composta quando preenchido;
- `quick_vehicle_brand text`;
- `quick_vehicle_model text`;
- `quick_vehicle_year integer`;
- `creation_request_id uuid`, com índice único parcial quando preenchido.

Compatibilidade:

- registros existentes recebem `standard` pelo default/backfill;
- `vehicle_id` continua obrigatório por regra na criação standard;
- uma OS quick exige veículo oficial ou snapshot completo;
- o snapshot é preservado quando o rascunho continua como OS completa e recebe vínculo oficial;
- a sequência `service_order_number_seq` permanece a única fonte de numeração.

O valor e o serviço serão representados por um único item no `budget` existente:

- tipo `Serviço`;
- nome igual a “Serviço realizado”;
- preço igual ao valor informado;
- aprovação `Aprovado`;
- `executed: true`.

Isso mantém subtotal, desconto, total, saldo, contas a receber e relatórios na mesma regra financeira já usada pelas OS completas.

## Cliente rápido

O formulário permite selecionar cliente existente ou cadastrar um novo com:

- nome obrigatório;
- telefone obrigatório;
- CPF opcional, preservando a regra atual;
- e-mail vazio, valor aceito atualmente pelo schema.

A RPC reaproveita as restrições de telefone e CPF já existentes, rejeita duplicidades e não cria outro tipo de cliente. O cadastro completo continua inalterado.

## Veículo

Com veículo existente, o usuário escolhe um veículo do cliente e marca, modelo e ano são preenchidos automaticamente. A OS preserva `vehicle_id` e também congela o snapshot.

Sem veículo existente, o usuário informa apenas marca, modelo e ano. Nenhum registro é criado em `vehicles`; `vehicle_id` permanece nulo e a identificação usa o snapshot em histórico, listagens e documentos.

## Criação e finalização atômicas

Uma nova RPC `create_quick_service_order` executará em uma transação:

1. validar membro operacional e impedir `customer`;
2. localizar cliente existente ou criar o cadastro rápido;
3. validar que o veículo existente pertence ao cliente, quando informado;
4. validar snapshot, serviço, valor, desconto e recebimento;
5. reutilizar a mesma fonte vigente de garantia;
6. inserir a OS quick com status final `Entregue`, datas de abertura/conclusão e snapshot da oficina;
7. gravar o item de serviço aprovado/executado;
8. aplicar o desconto comercial com motivo opcional;
9. gravar o recebimento inicial usando a estrutura atual de `payment.receipts`, somente quando o valor recebido for maior que zero;
10. derivar `Em aberto`, `Parcial` ou `Pago` a partir do total final;
11. registrar criação, serviço, valor, desconto, recebimento e finalização em `activities`/`status_history`, com UUID interno e nome legível quando disponível;
12. devolver a OS criada.

`creation_request_id` será gerado uma vez no formulário. Chamadas repetidas com o mesmo identificador retornam a OS já criada e não repetem OS, desconto, recebimento ou finalização. O botão também permanece bloqueado enquanto a chamada está em andamento.

Valores serão normalizados e validados no backend. O desconto não pode ser negativo, exceder o subtotal ou deixar o total abaixo do valor recebido. O recebimento não pode ser negativo nem exceder o total final. Zero representa OS em aberto e não exige forma de pagamento; qualquer valor maior que zero exige Dinheiro, PIX ou Cartão.

## Pagamento, desconto e Financeiro

A RPC rápida produzirá a mesma estrutura persistida pelas RPCs atuais de desconto e recebimento:

- métodos permitidos quando houver recebimento: Dinheiro, PIX e Cartão;
- `receipts` preserva múltiplos recebimentos futuros;
- pagamento inicial pode ser integral, parcial ou zero;
- total final = subtotal − desconto;
- saldo = total final − recebido;
- recebimentos posteriores continuam usando `record_order_payment`;
- edição/remoção posterior do desconto continua usando `set_order_discount` e suas proteções;
- contas a receber e relatório financeiro passam a aceitar `vehicle_id` nulo e usam o snapshot como identificação.

Não haverá Receita Extra nem cálculo financeiro paralelo.

## Garantia

A OS Rápida congela `warranty_days` com a mesma fonte de 90 dias usada pela OS completa. Histórico e documentos usam o snapshot persistido, sem novo número hardcoded no formulário ou na RPC.

## Continuar como OS completa

A continuação ocorre antes de persistir ou finalizar uma OS quick. O modal mantém um único rascunho e oferece dois destinos:

- `Finalizar atendimento`: envia o rascunho à RPC rápida, que cria a OS como `quick` e `Entregue` em uma transação;
- `Continuar como OS completa`: transfere o rascunho para o fluxo standard e solicita o veículo oficial antes de criar a OS.

Não será criada uma OS quick intermediária, não haverá transição de `Entregue` para outro status e uma OS quick já entregue não poderá ser convertida para standard.

Ao continuar como completa, o usuário seleciona um veículo existente do cliente ou cadastra o veículo oficial com os campos normais. Marca, modelo e ano do snapshot preenchem os defaults do cadastro. Depois disso, a OS é criada diretamente como `standard` no status inicial `Recebido`, usando a numeração normal.

O rascunho preserva cliente, snapshot de marca/modelo/ano, serviço, valor, desconto, motivo, valor recebido e forma de pagamento já informada. Serviço e valor entram como o mesmo item de serviço no orçamento da OS standard. Desconto e recebimento somente são persistidos quando válidos pelas regras financeiras atuais; nenhum estorno ou ajuste automático é feito.

## Interface

A entrada atual passa a oferecer duas ações separadas:

- “Nova OS”, abrindo o wizard existente sem alterações;
- “OS Rápida”, abrindo um modal único.

Ordem do modal:

1. cliente existente ou cadastro rápido;
2. veículo existente ou marca/modelo/ano;
3. serviço realizado;
4. valor do serviço;
5. desconto e motivo opcionais;
6. forma de pagamento e valor recebido;
7. ação principal “Finalizar atendimento” e ação discreta “Continuar como OS completa”.

Ao escolher uma forma de pagamento, “Valor recebido” inicia com o total final e continua editável. Alterar valor ou desconto atualiza esse default somente enquanto o usuário ainda não editou manualmente o recebimento. Se o valor recebido for zero, a forma de pagamento fica opcional e não é persistido recibo. Se for maior que zero, a forma de pagamento é obrigatória.

O primeiro campo recebe foco; Tab segue a ordem visual; Enter finaliza somente quando não conflitar com seletores e campos multilinha. Não haverá abas, wizard, modal aninhado ou confirmação intermediária. Feedback de processamento é imediato e sem animação que atrase o fluxo frequente.

Cenário principal: uma seleção de cliente, três campos do snapshot, um serviço, um valor, uma forma de pagamento e um clique final. São seis campos/seleções e um clique de finalização; com veículo existente, a seleção substitui os três campos.

## Exibição e histórico

Um helper único resolve a identificação do veículo:

- veículo oficial quando disponível;
- snapshot da OS quando não houver vínculo.

Ele será aplicado somente nos pontos relacionados a OS, histórico do cliente, resumo/documento, Financeiro e contas a receber. Histórico veicular continua incluindo a OS apenas quando houver `vehicle_id` oficial.

OS quick será identificada como “Atendimento rápido”, sem alterar `OS-X`. UUID de autor nunca será exibido; a resolução atual de nome e o fallback “Usuário interno” serão reutilizados.

## Permissões

As RPCs usam `security definer`, `search_path` vazio, grants apenas para `authenticated` e validação explícita de membro operacional. `owner`, `admin` e `staff` seguem a permissão operacional atual; `customer` é bloqueado no backend. A interface também oculta ações sem permissão, mas não é a barreira de segurança.

## Compatibilidade

- OS standard e o wizard atual permanecem intactos;
- OS antigas são tratadas como `standard`;
- orçamento, evidências, ORC-X, exclusão/cancelamento e pagamentos continuam com as regras existentes;
- funções e relatórios que fazem `join` obrigatório com `vehicles` serão ajustados pontualmente para `left join` e snapshot;
- backups estruturados incluirão os novos campos sem remover dados antigos;
- portal do cliente continuará protegido e precisará tolerar `vehicle_id` nulo na projeção mínima.

## Erros e consistência

Falhas de validação não gravam nada. Erros inesperados revertem toda a RPC. Resultado incerto pode ser consultado novamente pelo mesmo `creation_request_id`. Conflitos de versão posteriores continuam usando o mecanismo existente. Mensagens da interface indicam o campo ou regra que precisa ser corrigido e preservam o formulário preenchido.

## Testes

Serão escritos antes da implementação correspondente:

- testes de modelo/mapeamento para `flow_type`, snapshot e compatibilidade antiga;
- testes da migration/RPC para criação, idempotência, permissões, cliente rápido, veículo existente e snapshot;
- Dinheiro, PIX, Cartão, desconto, pagamento parcial e saldo;
- garantia e atividades;
- Financeiro e contas a receber sem veículo oficial;
- continuação do rascunho como standard, preservando os dados preenchidos;
- bloqueio da criação standard sem veículo oficial;
- garantia de que uma quick entregue não é convertida ou reaberta;
- regressão da criação standard;
- teste do formulário contra clique duplo e defaults de recebimento;
- typecheck, build e testes relacionados;
- conferência manual local do fluxo e contagem de ações, sem dados de produção.

## Implantação

A migration será criada e validada localmente, mas não aplicada remotamente. Frontend e migration precisam ser publicados juntos após autorização. Se o acesso administrativo continuar indisponível, o material ficará pronto para uma única aplicação no Lovable Cloud, sem usar Lovable durante esta implementação.
