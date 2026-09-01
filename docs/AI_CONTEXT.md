# Projeto

**PITGARAGE** é um projeto de sistema de gestão para uma oficina real de carros e motos. Seu objetivo é centralizar informações hoje distribuídas entre WhatsApp, papéis, planilhas, cadernos e memória, com simplicidade e rastreabilidade.

# Como uma IA deve trabalhar neste repositório

Qualquer ChatGPT, Codex ou outra IA deve:

1. ler este arquivo antes de trabalhar;
2. consultar os documentos relacionados à tarefa no [índice da documentação](README.md);
3. preservar todo o histórico e nunca apagar ou substituir informações silenciosamente;
4. nunca assumir que o scaffold ou qualquer código existente representa uma decisão técnica aprovada;
5. não inventar requisitos, regras, permissões ou decisões;
6. registrar dúvidas em [questões pendentes](10-questoes-pendentes.md) em vez de inventar respostas;
7. atualizar o contexto documental correspondente ao terminar qualquer tarefa relevante.

Antes de encerrar uma tarefa que altere requisitos, regras de negócio, MVP, roadmap, arquitetura, banco, interface, código, decisões técnicas ou processos da oficina, verificar:

- Este `AI_CONTEXT.md` continua correto?
- Alguma decisão mudou?
- O [`CHANGELOG.md`](../CHANGELOG.md) precisa ser atualizado?
- A alteração exige uma nova versão documental?
- Alguma informação anterior corre risco de ser perdida?

Se alguma resposta for sim, a documentação deve ser atualizada antes do encerramento.

# Estado atual

O projeto está em descoberta e validação de requisitos. A documentação inicial foi organizada como **v1 — Descoberta e documentação inicial**, mas o fluxo, as permissões e o escopo do MVP ainda dependem de validação. Modelagem, arquitetura e implementação não foram aprovadas.

# Documentação atual

- [Visão e processo atual](README.md#documentos)
- [Requisitos funcionais](04-requisitos-funcionais.md)
- [Requisitos não funcionais](05-requisitos-nao-funcionais.md)
- [Regras de negócio](06-regras-de-negocio.md)
- [Perfis e permissões](07-perfis-e-permissoes.md)
- [Proposta de MVP](08-mvp.md)
- [Roadmap proposto](09-roadmap.md)
- [Priorização das questões pendentes](12-priorizacao-questoes-pendentes.md)

# Decisões atuais importantes

- O histórico rastreável do veículo e da ordem de serviço é o núcleo proposto do MVP.
- Aprovações podem ser parciais e serviços adicionais exigem nova autorização.
- Fotos e vídeos de diagnóstico têm prioridade operacional.
- O controle quantitativo completo de estoque está proposto para a V1 pós-MVP, sujeito a validação.
- O scaffold existente não confirma arquitetura ou stack para o produto.

# Pendências

Consultar as perguntas originais em [`10-questoes-pendentes.md`](10-questoes-pendentes.md) e sua classificação em [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md). Nenhuma pendência deve ser resolvida por suposição.

# Próxima etapa

Realizar uma conversa curta com os responsáveis pela oficina usando somente o roteiro P0 de [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md). Depois, registrar as respostas validadas e reavaliar a prontidão do MVP. Não iniciar modelagem ou implementação antes dessa validação.

# Histórico

Consultar [`historico/README.md`](historico/README.md), [`versoes/README.md`](versoes/README.md) e o [`CHANGELOG.md`](../CHANGELOG.md).
