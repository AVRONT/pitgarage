# PitGarage

Sistema de gestão para uma oficina real de carros e motos. O projeto busca centralizar informações hoje distribuídas entre WhatsApp, papéis, planilhas, cadernos e a memória dos funcionários, tornando o atendimento e o acompanhamento dos serviços mais simples e rastreáveis.

## O que o projeto busca resolver

A oficina precisa localizar rapidamente o histórico de um veículo e acompanhar o caminho de cada atendimento: problema relatado, diagnóstico, orçamento, decisão do cliente, serviço executado, pagamento e entrega. O registro das decisões é especialmente importante quando o orçamento muda ou o cliente aprova apenas parte dos itens.

O sistema atende a equipe da oficina e oferece uma área separada para o cliente consultar os veículos e o andamento de suas ordens de serviço.

## Estado do projeto

O PitGarage continua em fase de **piloto**. O escopo definitivo do MVP e as regras ainda pendentes devem ser validados com a oficina.

| Situação | Recursos e limites |
| --- | --- |
| **Publicado no cloud**, conforme informado pelo responsável em 03/09/2026 | Frontend, autenticação, base de clientes, veículos e ordens de serviço, Agenda, notificações e Chat. O portal do cliente consulta veículos, ordens e contadores; aprovação de orçamento e envio de arquivos pelo portal foram adiados. |
| **Preparado no repositório/localmente** | Evoluções como OS rápida, desconto comercial, recebimentos e melhorias financeiras. A presença do código ou de migrations não comprova publicação no cloud. |
| **Pendente de validação ou configuração** | Regras e fluxos com a oficina, além das configurações e verificações do ambiente cloud descritas no [contexto atual](docs/AI_CONTEXT.md#pendências). |

Essa separação reflete o estado documentado do projeto; não substitui uma conferência do ambiente publicado. O histórico de versões do piloto está no [índice da documentação](docs/README.md#piloto).

## Fluxo principal

1. Registrar o cliente, o veículo e o problema relatado.
2. Abrir uma ordem de serviço e registrar o diagnóstico e suas evidências.
3. Preparar o orçamento com serviços e peças discriminados.
4. Registrar a aprovação ou recusa de cada item pelo cliente.
5. Executar os itens autorizados, registrando novas autorizações quando surgirem serviços adicionais.
6. Concluir o serviço, registrar pagamento e entrega e preservar o histórico do veículo.

Este é o fluxo proposto para validação, descrito com mais detalhe em [processo atual](docs/02-processo-atual.md) e [regras de negócio](docs/06-regras-de-negocio.md). A forma válida de registrar a autorização e a comunicação com o cliente ainda está entre as [questões pendentes](docs/10-questoes-pendentes.md).

## Onde encontrar as informações

- [Índice da documentação](docs/README.md): visão geral dos documentos e versões do piloto.
- [Contexto atual](docs/AI_CONTEXT.md): estado cloud informado, preparações locais e pendências operacionais.
- [Visão do projeto](docs/01-visao-projeto.md): problema, objetivo e usuários conhecidos.
- [Problemas identificados](docs/03-problemas-identificados.md): dificuldades que motivaram o sistema.
- [Proposta de MVP](docs/08-mvp.md): recorte sujeito à validação da oficina.
- [Changelog](CHANGELOG.md): histórico das alterações registradas.

## Próximos passos

1. Validar com a oficina os fluxos, informações, autorizações e regras ainda em aberto.
2. Conferir as pendências de configuração e validação cloud antes de publicar evoluções locais.
3. Ajustar requisitos e escopo com base no que for confirmado.

> O repositório já possui um scaffold gerado pelo Lovable. Sua presença não representa, por si só, aprovação definitiva do MVP ou de todas as decisões técnicas.
