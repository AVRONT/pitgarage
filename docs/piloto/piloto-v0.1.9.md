# Piloto v0.1.9 — refinamento do atendimento

## Evolução de UX

- Corrigida a busca da Nova OS: consultas por nome não correspondem mais a todos os clientes por comparação com dígitos vazios.
- Autocomplete com teclado, nome, telefone, CPF e e-mail; seleção mostra os dados do cliente e mantém veículos limitados ao proprietário.
- Cadastro novo aproveita a busca digitada (nome, telefone ou CPF formatado), sem persistência antes da confirmação final.
- Duplicidade identifica o campo e oferece usar o cliente existente. Cadastros excluídos continuam bloqueados, sem reativação automática.
- Placa duplicada informa veículo e proprietário, orientando a seleção correta sem trocar o cliente silenciosamente.
- Resumo financeiro compacto no topo da OS; status duplicado removido e próxima ação com menor repetição visual.
- Inputs e cards com menos elevação, espaçamento consistente no rodapé dos diálogos e fechamento em português. Button, Tabs e badges existentes foram revisados e mantidos.
- Nome visível PitGarage e título da aplicação padronizados; ícone e favicon existentes preservados.

## Preservação

A v0.1.8 já centralizava cadastros na Nova OS e salvava somente na confirmação final. Essa decisão foi mantida; esta versão corrige busca e melhora apresentação, sem substituí-la. A chave de localStorage, `deletedAt`, dados fictícios, histórico, workflow, stepper, confirmações e reversões permanecem inalterados. Nenhuma dependência foi adicionada.

## Validação

Testes em contexto isolado de navegador: três combinações de criação, busca sem resultado, nome reaproveitado, CPF duplicado com reutilização, placa de outro cliente, ausência de cadastros parciais antes da confirmação e tela da OS criada. Conferência de desktop e tablet. Os dados do navegador do usuário não foram usados nem resetados.

## Regras provisórias e próximo passo

Telefone/e-mail únicos, formato básico de CPF, estados e transições, pagamento e garantia de 30 dias continuam provisórios. Não foram aprovadas regras novas. Próximo passo: validar o atendimento guiado com a equipe da oficina e registrar feedback, sem iniciar implementação permanente.
