# Priorização das questões pendentes

Este documento classifica as 27 perguntas preservadas integralmente em [`10-questoes-pendentes.md`](10-questoes-pendentes.md). A classificação organiza a validação; não responde perguntas, cria regras ou transforma hipóteses em fatos.

## Critérios

- **P0 — Bloqueia o MVP:** resposta necessária para fechar o escopo mínimo, o fluxo principal ou regras essenciais antes de prototipação definitiva, modelagem conceitual e implementação.
- **P1 — Importante, mas não bloqueia o MVP:** pode ser resolvida durante prototipação, implementação ou validação posterior sem impedir o avanço inicial.
- **P2 — Pós-MVP / futura:** detalha uma capacidade atualmente proposta para depois do MVP.
- **P3 — Não precisa entrar na próxima entrevista:** é prematura ou já possui informação suficiente para o momento, mas permanece registrada.

## Análise das questões

| Nº | Pergunta original | Prioridade | Justificativa e decisão afetada | Informação parcial existente |
| --- | --- | --- | --- | --- |
| 1 | Quais dados são obrigatórios no cadastro de cliente, veículo e entrada da ordem? | **P0** | Define os dados centrais e o mínimo necessário para iniciar e consultar uma OS. Afeta cadastro, entrada e modelagem conceitual futura. | **Resposta parcial já existente — requer validação.** Data, quilometragem e problema relatado aparecem em [RF005](04-requisitos-funcionais.md); cliente e veículo aparecem em RF001–RF004. |
| 2 | Como clientes e veículos devem ser identificados e pesquisados na prática? | **P1** | A busca é importante para a experiência, mas seus campos e interação podem ser refinados na prototipação. Afeta busca e usabilidade. | **Resposta parcial já existente — requer validação.** Telefone, WhatsApp, rosto, veículo ou modelo são usados informalmente no [processo atual](02-processo-atual.md); RF003 exige busca e histórico. |
| 3 | O fluxo proposto representa todas as situações comuns da oficina? | **P0** | Valida se o fluxo principal cobre a operação mínima. Afeta o escopo e o ciclo completo da OS. | **Resposta parcial já existente — requer validação.** Há um fluxo proposto em [processo atual](02-processo-atual.md) e no [MVP](08-mvp.md). |
| 4 | Quais estados da ordem de serviço são realmente necessários e quais transições são permitidas? | **P0** | Define o acompanhamento operacional e os bloqueios entre diagnóstico, aprovação, peça, execução e entrega. | **Resposta parcial já existente — requer validação.** Oito estados provisórios constam em [processo atual](02-processo-atual.md). |
| 5 | Como ficam serviços cancelados, veículos abandonados, retornos e retrabalho? | **P1** | São exceções relevantes, mas o fluxo principal pode ser validado antes. Afeta estados excepcionais e histórico. | Não há resposta confirmada. Retorno em garantia se relaciona à questão 23. |
| 6 | Como registrar de forma válida a aprovação ou recusa feita pelo cliente? | **P0** | A autorização controla o que pode ser executado e é central à rastreabilidade. Afeta orçamento, evidência da decisão e execução. | **Resposta parcial já existente — requer validação.** Aprovação total ou parcial e proibição de executar sem autorização constam em [regras de negócio](06-regras-de-negocio.md); hoje o orçamento é enviado pelo WhatsApp. |
| 7 | É necessário enviar mensagens pelo sistema no MVP ou basta registrar decisões obtidas pelo WhatsApp? | **P0** | Pode incluir ou excluir uma integração significativa do primeiro escopo. Afeta fronteira do MVP e fluxo de autorização. | **Resposta parcial já existente — requer validação.** O WhatsApp é o canal atual; automações não confirmadas estão fora do [MVP proposto](08-mvp.md). |
| 8 | Como devem ser tratadas alterações de preço, quantidade ou escopo após uma aprovação? | **P0** | Define versionamento do orçamento e quando uma nova autorização é obrigatória. Afeta orçamento, histórico e execução. | **Resposta parcial já existente — requer validação.** RF011 preserva alterações e RN003 exige nova autorização para problema adicional, mas outras alterações não estão definidas. |
| 9 | A margem de 30% é fixa, sugerida ou pode variar por peça e situação? | **P0** | Define como o preço de peças deve ser proposto ou registrado. Afeta orçamento e regra de formação de preço. | **Resposta parcial já existente — requer validação.** RN006 registra a prática atual como “normalmente” custo mais aproximadamente 30%. |
| 10 | Existem descontos, acréscimos, impostos ou outras regras de formação de preço? | **P0** | Pode alterar itens, totais e histórico do orçamento. Afeta o funcionamento mínimo do orçamento. | Não há resposta confirmada. Pode ser consolidada com as questões 9 e 11. |
| 11 | A mão de obra é calculada por item, tempo, valor fixo ou outro critério? | **P0** | Define como a mão de obra entra e é discriminada no orçamento. | **Resposta parcial já existente — requer validação.** RN007 confirma apenas que a mão de obra é acrescentada além das peças. |
| 12 | Existem pagamentos parciais, múltiplas formas no mesmo atendimento, parcelamento ou estorno? | **P0** | Define a estrutura mínima do registro de pagamentos e quando um atendimento está quitado. | **Resposta parcial já existente — requer validação.** PIX e cartão são formas atuais; RF015 e RN012 limitam o MVP ao registro, sem integração. |
| 13 | Quais informações financeiras o atendente e o mecânico podem visualizar ou alterar? | **P0** | Permissões financeiras essenciais precisam ser conhecidas antes do desenho definitivo e da futura autorização. | **Resposta parcial já existente — requer validação.** O mecânico vê valores ligados aos próprios serviços; o acesso financeiro do atendente permanece indefinido em [perfis e permissões](07-perfis-e-permissoes.md). |
| 14 | Os dois donos têm permissões idênticas? | **P1** | A documentação já confirma acesso de ambos a valores e operação geral; eventuais diferenças podem ser refinadas na matriz de permissões. | **Resposta parcial já existente — requer validação.** Consultar [perfis e permissões](07-perfis-e-permissoes.md). |
| 15 | Quem pode criar, alterar e concluir diagnósticos, orçamentos, serviços, pagamentos e entregas? | **P0** | Define ações essenciais de cada perfil e evita prototipar fluxos incompatíveis com a operação. | **Resposta parcial já existente — requer validação.** Os perfis e alguns acessos conhecidos constam em [perfis e permissões](07-perfis-e-permissoes.md), mas não há matriz definitiva. |
| 16 | É obrigatório indicar um responsável por cada diagnóstico e serviço ou apenas os participantes da ordem? | **P1** | A rastreabilidade é importante, mas a granularidade pode ser decidida durante prototipação sem impedir a validação do fluxo central. | **Resposta parcial já existente — requer validação.** RF014 permite vários envolvidos e registra como desejável identificar responsáveis futuramente. |
| 17 | Com que frequência e como são feitas as conferências físicas? | **P2** | Detalha o controle quantitativo de estoque, atualmente proposto para a versão pós-MVP. Afeta o fluxo futuro de inventário. | **Resposta parcial já existente — requer validação.** O levantamento menciona conferências frequentes, possivelmente diárias; o [roadmap](09-roadmap.md) posiciona estoque quantitativo na V1 pós-MVP. |
| 18 | Quais são os principais problemas atuais de estoque e com que frequência bloqueiam serviços? | **P0** | Determina se o estoque quantitativo precisa subir para o MVP. Afeta diretamente o recorte de escopo. | **Resposta parcial já existente — requer validação.** Sabe-se que peças ausentes são solicitadas e o serviço relacionado aguarda; frequência e impacto não foram medidos. Consultar [MVP](08-mvp.md). |
| 19 | O estoque quantitativo precisa estar no MVP ou a versão posterior atende à operação? | **P0** | É a decisão explícita sobre o limite do primeiro escopo. | **Resposta parcial já existente — requer validação.** O [MVP](08-mvp.md) propõe registrar a situação da peça e deixar o controle quantitativo completo para a versão seguinte. |
| 20 | Como identificar peças e tratar unidades, fornecedores, devoluções, perdas e correções? | **P2** | Detalha modelagem e fluxos do estoque completo, atualmente pós-MVP. Não deve atrasar o recorte inicial, salvo mudança na questão 19. | **Resposta parcial já existente — requer validação.** RF018 prevê peça, quantidade, custo, entradas, saídas e correções; integrações com fornecedores não são iniciais. |
| 21 | A garantia começa na conclusão do serviço ou na entrega do veículo? | **P0** | Define a data-base do cálculo de garantia incluído no MVP. | **Resposta parcial já existente — requer validação.** RN011 e RF016 registram as duas possibilidades sem escolher uma. |
| 22 | Os 30 dias são fixos ou variam por peça, serviço ou exceção? | **P0** | Define se a garantia usa um padrão único ou precisa aceitar períodos por item ou atendimento. | **Resposta parcial já existente — requer validação.** RN010 registra aproximadamente 30 dias como prática padrão. |
| 23 | Como registrar atendimento em garantia, retorno e eventual extensão? | **P0** | Garantia e histórico estão no MVP; é necessário saber o mínimo para representar um retorno sem perder vínculo com o serviço original. | **Resposta parcial já existente — requer validação.** RF016 e RF017 exigem garantia e histórico, mas não definem retorno ou extensão. Relaciona-se à questão 5. |
| 24 | Por quanto tempo fotos, vídeos e demais registros devem ser mantidos? | **P1** | Mídia é prioritária, porém a política de retenção pode ser refinada antes da implementação técnica sem impedir o fechamento do fluxo. Afeta armazenamento, privacidade e histórico. | **Resposta parcial já existente — requer validação.** RNF005 pede preservação do histórico; retenção e limites estão em [decisões técnicas futuras](11-decisoes-tecnicas-futuras.md). |
| 25 | Quais dispositivos serão usados na oficina e como é a conectividade do local? | **P1** | Orienta protótipos e requisitos operacionais, mas não altera as regras centrais do MVP. Afeta experiência, plataforma e eventual operação com conexão limitada. | Não há resposta confirmada. O sistema deve ser simples e rápido conforme [visão](01-visao-projeto.md). |
| 26 | Qual problema causa mais impacto hoje e qual resultado indicará que o MVP funcionou? | **P0** | É necessário para validar prioridades, evitar expansão indevida e aprovar o recorte do MVP. Afeta critérios de sucesso e ordem de entrega. | **Resposta parcial já existente — requer validação.** Fragmentação e ausência de histórico estão documentadas em [problemas identificados](03-problemas-identificados.md), mas impacto e indicador não foram validados. |
| 27 | Qual volume aproximado de clientes, veículos, ordens e mídias o sistema deve atender? | **P3** | É prematura para a próxima entrevista focada no negócio e pode ser levantada antes das decisões técnicas. Não precisa bloquear escopo, fluxo ou prototipação inicial. | Não há volume confirmado. Capacidade e retenção já estão registradas como pendências técnicas em [requisitos não funcionais](05-requisitos-nao-funcionais.md) e [decisões técnicas futuras](11-decisoes-tecnicas-futuras.md). |

## Questões relacionadas ou redundantes

Nenhuma pergunta deve ser removida. Na próxima conversa, estes conjuntos podem ser consolidados:

- **3 e 4:** validar o fluxo comum e, dentro dele, os estados e transições necessários.
- **5 e 23:** retornos e retrabalho se sobrepõem parcialmente ao atendimento em garantia; cancelamento e abandono continuam como exceções distintas.
- **9, 10 e 11:** compõem uma única conversa sobre formação de preço de peças, mão de obra e ajustes.
- **13 e 15:** a visibilidade financeira deve fazer parte da validação da matriz de ações por perfil.
- **17, 18, 19 e 20:** tratam do estoque em níveis diferentes; somente impacto e inclusão no MVP são P0 agora.
- **21, 22 e 23:** formam a definição mínima da garantia no MVP.
- **24 e 27:** influenciam armazenamento de mídias, mas podem ser tratados em momentos técnicos diferentes.

# Próxima conversa com a oficina

O roteiro abaixo consolida somente as questões P0. As referências entre parênteses apontam para as perguntas originais.

## Ordem de serviço e dados principais

1. Quais dados precisam ser obrigatórios para cadastrar cliente e veículo e abrir uma ordem de serviço? (1)
2. O fluxo proposto cobre os casos comuns? Quais estados e mudanças de estado são realmente necessários do recebimento à entrega? (3 e 4)

## Orçamento, aprovação e serviços adicionais

3. Como a oficina precisa comprovar aprovação ou recusa do cliente? O MVP deve enviar mensagens ou apenas registrar decisões recebidas pelo WhatsApp? (6 e 7)
4. Depois de uma aprovação, quais mudanças de preço, quantidade ou serviço exigem uma nova autorização e como o histórico deve aparecer? (8)
5. Como são definidos preço de peça, margem, descontos, acréscimos e mão de obra? Quais dessas regras variam? (9, 10 e 11)

## Pagamento

6. Um atendimento pode ter pagamento parcial, mais de uma forma de pagamento, parcelamento ou estorno? O que precisa ser registrado em cada caso? (12)

## Funcionários e permissões

7. Para donos, mecânico e atendente, quem pode visualizar valores e criar, alterar ou concluir diagnóstico, orçamento, serviço, pagamento e entrega? (13 e 15)

## Estoque

8. Com que frequência a falta ou divergência de peças bloqueia serviços? Isso exige controle quantitativo no MVP ou basta registrar peça disponível, solicitada ou aguardando chegada? (18 e 19)

## Garantia

9. A garantia começa na conclusão ou na entrega, os 30 dias podem variar e como deve ser registrado um retorno ou uma extensão? (21, 22 e 23)

## Prioridade e sucesso do MVP

10. Qual problema causa mais impacto hoje e qual resultado prático mostrará que o MVP resolveu esse problema? (26)

## Resultado da classificação

| Prioridade | Quantidade |
| --- | ---: |
| P0 — Bloqueia o MVP | 18 |
| P1 — Importante, mas não bloqueia | 6 |
| P2 — Pós-MVP / futura | 2 |
| P3 — Não precisa entrar na próxima entrevista | 1 |
| **Total** | **27** |

## Análise de prontidão

Depois de responder e validar somente as questões P0, **provavelmente haverá informação suficiente** para:

1. **Aprovar formalmente o escopo do MVP:** provavelmente sim, porque estarão definidos os limites do estoque, comunicação, pagamentos, garantia e prioridades.
2. **Definir o fluxo principal da ordem de serviço:** provavelmente sim, desde que a oficina valide os casos comuns, estados, autorizações e alterações de orçamento.
3. **Começar prototipação:** sim, com as P1 tratadas como pontos a testar e refinar durante os protótipos.
4. **Iniciar posteriormente a modelagem conceitual do banco:** provavelmente sim para o núcleo do MVP, após documentar as respostas P0 e revisar sua consistência. As P1 que afetarem detalhes de dados devem ser resolvidas antes da modelagem detalhada.

Essa avaliação não executa nem autoriza as etapas seguintes.

## Versionamento documental

Esta priorização é uma organização das informações já existentes. Ela não traz respostas validadas, altera requisitos, muda o MVP ou cria regras de negócio. Portanto, permanece na **v1 — Descoberta e documentação inicial** e não gera v2.
