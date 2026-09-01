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

O projeto está na fase **Piloto v0.1**, registrada como **v2 — Entrada na fase piloto**. Uma aplicação local, navegável e com dados fictícios foi construída para validar fluxo, experiência e necessidades com a oficina. As questões pendentes continuam válidas. O piloto não é o MVP aprovado e não define arquitetura, banco ou infraestrutura de produção.

# Documentação atual

- [Visão e processo atual](README.md#documentos)
- [Requisitos funcionais](04-requisitos-funcionais.md)
- [Requisitos não funcionais](05-requisitos-nao-funcionais.md)
- [Regras de negócio](06-regras-de-negocio.md)
- [Perfis e permissões](07-perfis-e-permissoes.md)
- [Proposta de MVP](08-mvp.md)
- [Roadmap proposto](09-roadmap.md)
- [Priorização das questões pendentes](12-priorizacao-questoes-pendentes.md)
- [Escopo e limitações do Piloto v0.1](piloto/piloto-v0.1.md)

# Decisões atuais importantes

- O histórico rastreável do veículo e da ordem de serviço é o núcleo proposto do MVP.
- Aprovações podem ser parciais e serviços adicionais exigem nova autorização.
- Fotos e vídeos de diagnóstico têm prioridade operacional.
- O controle quantitativo completo de estoque está proposto para a V1 pós-MVP, sujeito a validação.
- O scaffold existente não confirma arquitetura ou stack para o produto.
- O Piloto v0.1 usa dados mockados, estado React e `localStorage` apenas como decisões temporárias de demonstração.
- Os estados da ordem de serviço e a garantia padrão de 30 dias são representados no piloto, mas permanecem sujeitos a validação.

# Pendências

Consultar as perguntas originais em [`10-questoes-pendentes.md`](10-questoes-pendentes.md) e sua classificação em [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md). Nenhuma pendência deve ser resolvida por suposição.

# Próxima etapa

Demonstrar o Piloto v0.1 aos responsáveis pela oficina usando o roteiro de validação em [`piloto/piloto-v0.1.md`](piloto/piloto-v0.1.md). Registrar separadamente o que funcionou, o que não funcionou, lacunas e mudanças solicitadas. Somente depois atualizar requisitos, MVP e próximos incrementos.

# Histórico

Consultar [`historico/README.md`](historico/README.md), [`versoes/README.md`](versoes/README.md) e o [`CHANGELOG.md`](../CHANGELOG.md).
