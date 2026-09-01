# Proposta de MVP

Esta é uma proposta para validação, não um escopo aprovado.

## Objetivo do MVP

Centralizar o ciclo principal de uma ordem de serviço e produzir um histórico confiável por veículo, com destaque para diagnóstico, evidências, orçamento e autorização.

## Escopo proposto

- cadastro e consulta de clientes e veículos;
- ordem de serviço com relato, data e quilometragem;
- diagnóstico com fotos e vídeos;
- serviços e peças recomendados;
- orçamento discriminado e seu histórico de alterações;
- aprovação ou recusa por item;
- registro de autorização adicional quando surgir novo problema;
- execução limitada aos itens aprovados;
- associação dos funcionários envolvidos;
- registro de pagamento e forma, sem integração externa;
- conclusão ou entrega e cálculo da garantia;
- histórico centralizado do veículo.

## Estoque básico

**Proposta:** posicionar o controle completo de estoque na versão imediatamente posterior ao MVP. O problema central já confirmado é a falta de histórico e rastreabilidade da ordem de serviço; incluir movimentação e correções de estoque amplia sensivelmente o primeiro recorte.

Para não perder o contexto operacional, o MVP pode registrar a peça prevista ou utilizada e se ela está disponível, solicitada ou aguardando chegada, sem assumir um controle quantitativo completo. Essa divisão precisa ser validada: se divergências de estoque bloquearem o trabalho com frequência, o estoque básico pode subir de prioridade.

## Fora do MVP

- representação 3D;
- dashboards avançados;
- inteligência artificial e manutenção preditiva;
- integrações financeiras, com fornecedores ou compras automáticas;
- aplicativo mobile nativo;
- automações não confirmadas.

## Critério para aprovação

O MVP só deve orientar modelagem e desenvolvimento depois que a oficina validar o fluxo, os estados, as regras, as permissões, o recorte do estoque e as pendências críticas.
