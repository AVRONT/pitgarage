# Piloto v0.1.4 — progresso visual e visão do cliente

## Objetivo

Tornar o avanço da ordem de serviço visualmente inequívoco e demonstrar como o cliente poderia receber diagnóstico, evidências e orçamento organizados. A versão continua local, fictícia e exploratória, sem backend, autenticação, compartilhamento ou decisão de arquitetura.

## Problema e causa da barra

Na v0.1.3, `order.status` já determinava corretamente o contador e os estilos dos oito segmentos. O React rerenderizava o detalhe e a persistência mantinha o mesmo valor. Porém, cada etapa era desenhada como um traço fino e separado: avançar apenas trocava mais um pequeno segmento para verde e outro para laranja. Sem preenchimento acumulado, a distância percorrida permanecia pouco perceptível, especialmente em telas largas.

Não foram encontrados estado duplicado, memoização incorreta, chave antiga, referência obsoleta ou outra fonte de progresso.

## Solução implementada

- `order.status` permanece a única fonte de verdade;
- o índice atual continua derivado da lista central e ordenada `orderStatuses`;
- a largura da barra contínua é calculada por `currentStepIndex / (totalSteps - 1) * 100`;
- a primeira etapa representa o início e a entrega representa 100%;
- marcadores anteriores ficam concluídos, o atual recebe destaque e os futuros permanecem neutros;
- avanço e regressão usam o mesmo cálculo e não são bloqueados;
- contador, barra, dashboard, listagem, detalhe, histórico e timeline continuam sincronizados pelo status persistido.

## Visualização do cliente

A área de orçamento ganhou a ação **Visualizar como cliente**, que abre uma apresentação somente leitura, visualmente separada da operação interna. Ela exibe:

- identificação da PITGARAGE e da oficina fictícia;
- número da OS e status atual do veículo;
- cliente, veículo, placa, ano/modelo e quilometragem de entrada;
- problema relatado, diagnóstico e problema adicional, quando existente;
- fotos e vídeos simulados como cartões de evidência;
- descrição, tipo, valor e decisão de cada item;
- totais orçado, aprovado, recusado e aguardando aprovação.

Nenhuma ação da visualização altera a OS. Aprovações reais, autenticação, link público, token, assinatura, WhatsApp, SMS, e-mail e QR Code não foram implementados.

## Impressão

A visualização oferece **Imprimir orçamento** usando `window.print()`, sem biblioteca adicional ou geração no servidor. As regras de impressão ocultam navegação e controles do modal, permitindo usar a função nativa de salvar como PDF do navegador.

## Melhorias internas do orçamento

- alerta na OS quando existem itens aguardando aprovação do cliente;
- borda cromática por decisão para diferenciar itens aprovados, recusados e pendentes;
- resumo financeiro preservado com valores calculados apenas dos itens existentes;
- cenário da `OS-1048` mantido com aprovações, recusas, pendências e evidências fictícias.

## Compatibilidade

A chave `pitgarage-pilot-v012` permanece inalterada. Não foi incluído campo obrigatório novo, reset automático ou migração destrutiva. Registros existentes continuam adaptados na leitura pela migração da v0.1.3.

## Possibilidade futura documentada

**Enviar orçamento ao cliente por link seguro:** oficina gera o orçamento → cliente recebe o link → visualiza evidências → aprova ou recusa cada item → autorização fica registrada.

Essa possibilidade não foi implementada e depende da validação do fluxo, da forma válida de autorização e das decisões técnicas futuras.

## Limitações e decisões temporárias

- os oito estados continuam provisórios;
- a visão do cliente é somente uma demonstração local;
- evidências são placeholders e não representam arquivos reais;
- impressão depende do recurso nativo do navegador;
- não há envio, aprovação pública, banco, backend, autenticação ou múltiplos usuários;
- dados permanecem sujeitos à perda se o armazenamento local do navegador for limpo.

## Diferenças da v0.1.3

A v0.1.3 corrigiu sobrescritas de estado e centralizou atualizações funcionais. A v0.1.4 preserva essa base e corrige a comunicação visual do progresso, além de retirar do adiamento a visualização local do orçamento para o cliente. Isso não transforma o preview em canal real de autorização.

## Próxima tarefa recomendada

Demonstrar o Piloto v0.1.4 aos usuários reais da oficina e registrar feedback sobre clareza do progresso, linguagem da visão do cliente, informações necessárias no orçamento e utilidade da impressão. Não implementar o link seguro antes de validar como a autorização precisa ser comprovada.
