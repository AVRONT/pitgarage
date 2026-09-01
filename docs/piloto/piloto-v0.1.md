# Piloto v0.1

## Objetivo

O Piloto v0.1 é uma aplicação visual e funcional para demonstrar o fluxo proposto aos responsáveis pela oficina. Ele serve como instrumento de validação e não representa MVP final, arquitetura aprovada ou sistema pronto para uso real.

## Escopo implementado

- dashboard com visão dos veículos na oficina e estados operacionais;
- listagem, pesquisa, criação e detalhe de clientes;
- listagem, pesquisa e detalhe de carros e motos;
- criação e acompanhamento de ordem de serviço;
- registro de problema relatado, diagnóstico, problema adicional e observações;
- fotos e vídeos representados em experiência local simulada;
- orçamento com peças, serviços, custo de peça, acréscimo demonstrativo de 30% e totais;
- aprovação, recusa ou espera por item do orçamento;
- novo problema criado inicialmente como aguardando aprovação;
- estados provisórios da ordem de serviço;
- marcação de execução apenas para itens aprovados;
- registro local de pagamento por PIX ou cartão;
- cálculo visual de garantia padrão de 30 dias após conclusão;
- histórico do veículo com data, quilometragem, OS, problemas, itens, valor, responsáveis e garantia;
- dados fictícios de carros, motos e cenários em diferentes estados.

## Decisões temporárias

- O piloto utiliza o scaffold frontend existente por conveniência, sem aprová-lo como arquitetura definitiva.
- Os dados são mockados e alterações ficam em estado React e `localStorage` do navegador.
- Não há servidor de aplicação, banco ou sincronização entre dispositivos.
- Mídias são apenas registros simulados; nenhum arquivo real é armazenado.
- Os oito estados atuais da OS foram usados para demonstrar o fluxo e continuam não definitivos.
- A garantia usa 30 dias e, no piloto, é calculada a partir da conclusão; data-base e exceções precisam de validação.
- A margem de 30% é exibida como prática atual aproximada, não como regra imutável.
- Permissões não são aplicadas; o piloto representa uma visão operacional única.

## Limitações conhecidas

- não possui autenticação nem perfis de acesso;
- não possui backend, banco, API ou armazenamento definitivo;
- dados locais podem ser perdidos ao limpar o armazenamento do navegador;
- não envia mensagens ou integra com WhatsApp;
- não processa PIX ou cartão;
- não possui controle quantitativo de estoque;
- não envia nem reproduz arquivos reais de mídia;
- não representa todos os casos excepcionais, como cancelamento, abandono, retrabalho ou estorno;
- navegação ocorre dentro de uma única rota do piloto;
- não está preparado para produção, múltiplos usuários ou uso simultâneo.

## Cenários para demonstração

1. Pesquisar João da Silva ou a placa `ABC1D23` e abrir o Honda Civic.
2. Consultar a OS atual e o histórico anterior do veículo.
3. Abrir o orçamento da `OS-1048` e demonstrar aprovação parcial.
4. Registrar um problema adicional e confirmar que ele nasce aguardando aprovação.
5. Marcar apenas itens aprovados como executados.
6. Alterar o status para serviço concluído, registrar pagamento e visualizar a garantia.
7. Criar um cliente e uma nova ordem de serviço fictícia.

## Roteiro de validação com a oficina

Durante a demonstração, registrar sem interpretar ou completar por conta própria:

- O fluxo representa o trabalho diário?
- Qual tela ou etapa ficou confusa?
- Que informação importante está faltando?
- Que informação não precisa aparecer?
- Os estados da OS ajudam ou deveriam ser diferentes?
- O orçamento e a aprovação por item estão claros?
- O histórico do veículo entrega o ganho esperado?
- O que precisa mudar antes de um próximo piloto?

As respostas validadas deverão atualizar requisitos, regras, questões pendentes e escopo, preservando as versões anteriores.
