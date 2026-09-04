# Documentação do PITGARAGE

Esta documentação organiza o levantamento inicial do sistema. Ela distingue fatos informados, propostas sujeitas a validação e questões ainda sem resposta.

## Pontos de entrada

- **Para pessoas:** este índice apresenta a documentação vigente.
- **Para IA:** [`AI_CONTEXT.md`](AI_CONTEXT.md) resume o contexto e as regras obrigatórias de trabalho.
- **Evolução do projeto:** o [`CHANGELOG.md`](../CHANGELOG.md) registra as alterações relevantes em ordem cronológica.

Estado canônico de 03/09/2026: frontend cloud funcional, Auth/base operacional, Agenda, notificações, Chat/Realtime e Edge Functions publicados, conforme confirmação do responsável. As pendências reais estão em [AI_CONTEXT.md](AI_CONTEXT.md#pendências); registros de preparação local/RC são históricos e não indicam reaplicação das bases.

## Documentos

- [Proteção antiabuso](16-protecao-antiabuso.md) — preparação local, limites propostos e dependências remotas.

1. [Visão do projeto](01-visao-projeto.md)
2. [Processo atual](02-processo-atual.md)
3. [Problemas identificados](03-problemas-identificados.md)
4. [Requisitos funcionais](04-requisitos-funcionais.md)
5. [Requisitos não funcionais](05-requisitos-nao-funcionais.md)
6. [Regras de negócio](06-regras-de-negocio.md)
7. [Perfis e permissões](07-perfis-e-permissoes.md)
8. [Proposta de MVP](08-mvp.md)
9. [Roadmap](09-roadmap.md)
10. [Questões pendentes](10-questoes-pendentes.md)
11. [Decisões técnicas futuras](11-decisoes-tecnicas-futuras.md)
12. [Priorização das questões pendentes](12-priorizacao-questoes-pendentes.md)
13. [Autenticação, usuários e permissões](13-proposta-autenticacao-usuarios.md) — Auth e bootstrap aplicados conforme histórico do projeto
14. [Base operacional Supabase](14-base-operacional-supabase.md) — clientes, veículos e OS aplicados em cloud; preparação e revisão local preservadas como histórico
15. [Evolução cloud integrada](15-evolucao-cloud-integrada.md) — Agenda, notificações, Chat/Realtime, Edge Functions e acesso técnico publicados; evolução adicional do Chat e configurações manuais ainda pendentes

## Piloto

- [Pré-release cloud / release candidate](piloto/pre-release-cloud-rc.md): registro histórico da revisão local anterior à publicação cloud; preserva achados e checklist daquela fase, sem indicar estado atual de deploy.

- [`piloto/piloto-v0.1.15.md`](piloto/piloto-v0.1.15.md): snapshot da oficina em documentos fechados, backup local completo e versionamento compatível da persistência.
- [`piloto/piloto-v0.1.14.md`](piloto/piloto-v0.1.14.md): identidade visual da oficina piloto, paleta vigente com base clara, sidebar azul e detalhes vermelhos.
- [`piloto/piloto-v0.1.13-patch-visual.md`](piloto/piloto-v0.1.13-patch-visual.md): registro anterior das superfícies grafite e maior presença da identidade azul/vermelho, sem mudanças funcionais.
- [`piloto/piloto-v0.1.13.md`](piloto/piloto-v0.1.13.md): acabamento de produto, assinatura azul/vermelho, tabelas e mensagens contextuais.
- [`piloto/piloto-v0.1.12.md`](piloto/piloto-v0.1.12.md): refinamento visual profissional, tema operacional escuro/azul e documentos claros.
- [`piloto/piloto-v0.1.11.md`](piloto/piloto-v0.1.11.md): prévia ao vivo dos documentos, razão social/CEP e possibilidades futuras de integração fiscal e snapshots.
- [`piloto/piloto-v0.1.10.md`](piloto/piloto-v0.1.10.md): configurações locais da oficina, visão do cliente integrada e resumo final imprimível.
- [`piloto/piloto-v0.1.9.md`](piloto/piloto-v0.1.9.md): refinamento da Nova OS, mensagens de duplicidade e hierarquia operacional.

- [`piloto/piloto-v0.1.md`](piloto/piloto-v0.1.md): escopo implementado, decisões temporárias e limitações da primeira versão demonstrável.
- [`piloto/piloto-v0.1.1.md`](piloto/piloto-v0.1.1.md): auditoria, polimento e roteiro da versão preparada para demonstração.
- [`piloto/piloto-v0.1.2.md`](piloto/piloto-v0.1.2.md): validações locais, normalização e regras de integridade adicionadas ao piloto.
- [`piloto/piloto-v0.1.3.md`](piloto/piloto-v0.1.3.md): fluxo operacional sincronizado, atividades e visão rápida da ordem de serviço.
- [`piloto/piloto-v0.1.4.md`](piloto/piloto-v0.1.4.md): progresso visual contínuo e visualização local do orçamento como cliente.
- [`piloto/piloto-v0.1.5.md`](piloto/piloto-v0.1.5.md): workflow funcional orientado por ações, bloqueios e correção de inconsistências.
- [`piloto/piloto-v0.1.6.md`](piloto/piloto-v0.1.6.md): identidade visual profissional, maior densidade e redesign global do piloto.
- [`piloto/piloto-v0.1.7.md`](piloto/piloto-v0.1.7.md): confirmações contextuais e reversão segura do workflow da OS.
- [`piloto/piloto-v0.1.8.md`](piloto/piloto-v0.1.8.md): entrada operacional concentrada na Nova OS e exclusão lógica segura.

## Histórico e versionamento

- [`historico/README.md`](historico/README.md): política de preservação e índice dos registros históricos.
- [`historico/v1-documentacao-inicial.md`](historico/v1-documentacao-inicial.md): composição da primeira versão formal.
- [`historico/v2-entrada-fase-piloto.md`](historico/v2-entrada-fase-piloto.md): mudança de estratégia e entrada na fase Piloto v0.1.
- [`versoes/README.md`](versoes/README.md): critérios para criar versões documentais futuras.

Os documentos numerados acima representam o estado atual. Eles não devem ser apagados ou silenciosamente reescritos quando uma decisão mudar; a evolução deve ser registrada conforme a política de histórico e versionamento.

## Consultas rápidas

- **Questões pendentes:** [`10-questoes-pendentes.md`](10-questoes-pendentes.md)
- **Priorização e roteiro da próxima conversa:** [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md)
- **Decisões técnicas futuras:** [`11-decisoes-tecnicas-futuras.md`](11-decisoes-tecnicas-futuras.md)

## Convenções

- **Confirmado:** informação relatada sobre a operação atual ou necessidade expressa.
- **Proposta:** recorte sugerido, que ainda depende de validação.
- **Pendente:** dúvida que não deve ser resolvida por suposição.
