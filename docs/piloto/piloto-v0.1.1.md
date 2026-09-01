# Piloto v0.1.1 — polimento e preparação para demonstração

## Objetivo

Preparar o Piloto v0.1 para uma demonstração consistente à oficina, preservando seu caráter exploratório. Esta versão não cria requisitos confirmados, não aprova o MVP e não introduz backend, banco, autenticação ou arquitetura de produção.

## Auditoria realizada

Foram percorridos no navegador os fluxos de dashboard, busca, clientes, veículos, abertura de ordem, diagnóstico, evidências simuladas, orçamento, aprovação parcial, problema adicional, execução, pagamento, conclusão, histórico e garantia. A interface também foi conferida em largura de tablet.

Principais lacunas observadas no piloto anterior:

- busca global limitada e sem acesso direto por telefone;
- indicador de diagnóstico com valor artificial;
- ausência de restauração do cenário entre demonstrações;
- orçamento de uma nova OS sem ação para incluir item comum;
- histórico do veículo pouco informativo;
- responsáveis ausentes exibidos em branco;
- ausência de orientação em listas vazias;
- identificação aleatória de novas ordens.

## Melhorias da v0.1.1

- busca unificada por nome, telefone, e-mail, marca, modelo e placa;
- indicadores operacionais baseados apenas nos dados locais e acessíveis como atalhos;
- linha de progresso dos estados da OS, explicitamente marcada como provisória;
- inclusão separada de serviço ou peça comum no orçamento;
- problema adicional mantido como item sujeito a nova aprovação;
- histórico com diagnóstico, itens, responsável, valor e situação demonstrativa da garantia;
- estados vazios e valores substitutos claros, como `A definir`;
- numeração sequencial estável para novas ordens;
- comando de restauração dos dados fictícios com confirmação antes da substituição;
- ajustes de rótulos, hierarquia visual e responsividade.

## Diferenças em relação à v0.1

A v0.1 demonstrava o fluxo principal. A v0.1.1 torna esse mesmo fluxo mais repetível, legível e seguro para apresentação, sem ampliar o produto para uma solução persistente ou produtiva. A documentação formal v2 permanece vigente.

## Decisões temporárias preservadas

- dados fictícios em estado React e `localStorage`;
- fotos e vídeos apenas simulados localmente;
- ações de aprovação, pagamento e garantia apenas demonstrativas;
- estados da OS, garantia padrão de 30 dias e cálculo demonstrativo de margem continuam sujeitos a validação;
- ausência de autenticação, integrações, banco e infraestrutura de produção.

## Roteiro sugerido de demonstração

1. Restaurar o cenário original e confirmar que a ação pede autorização.
2. Buscar João da Silva pelo telefone e abrir um de seus veículos.
3. Revisar o histórico do veículo e iniciar uma nova ordem.
4. Registrar quilometragem e relato, preencher diagnóstico e simular evidências.
5. Adicionar serviço e peça ao orçamento, decidir itens separadamente e registrar um problema adicional.
6. Mostrar bloqueios de execução, avançar estados, registrar pagamento e concluir a ordem.
7. Voltar ao histórico do veículo e conferir a situação demonstrativa da garantia.
8. Anotar as reações e dúvidas da equipe sem convertê-las automaticamente em requisitos.

## Questões que continuam pendentes

Todas as questões de [`../10-questoes-pendentes.md`](../10-questoes-pendentes.md) continuam abertas, especialmente validação dos estados da OS, permissões, aprovações, pagamento, garantia e estoque. A linha de progresso e os atalhos do dashboard são hipóteses de interface, não regras aprovadas.

## Próxima tarefa recomendada

Realizar a demonstração assistida com usuários reais da oficina e produzir um registro de feedback separado por: entendimento do fluxo, informações faltantes, etapas desnecessárias, termos confusos e decisões explicitamente confirmadas. Não iniciar implementação permanente antes dessa validação.
