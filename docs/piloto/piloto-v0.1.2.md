# Piloto v0.1.2 — validações e integridade dos dados

## Objetivo

Evitar cadastros inconsistentes e comportamentos evidentemente inválidos durante a demonstração, usando somente a camada local do piloto. Não foram adicionados backend, banco, migrations, autenticação, integrações ou decisões de arquitetura.

## Validações adicionadas

- cliente: nome sem espaços excedentes e não vazio; CPF opcional com formato básico; telefone com DDD; e-mail opcional com formato básico;
- veículo: proprietário obrigatório, carro ou moto, placa com sete caracteres, marca, modelo, ano e quilometragem plausíveis;
- OS: veículo e cliente vinculados, relato obrigatório, quilometragem entre zero e 2.000.000 km e identificador sequencial sem colisão;
- orçamento: descrição obrigatória e custo ou preço não negativo;
- execução: somente itens aprovados podem ser marcados como executados;
- pagamento: valor não negativo, valor obrigatório ao confirmar como pago e método limitado a PIX ou Cartão;
- datas: conclusão demonstrativa não pode ser anterior à entrada.

## Campos únicos no piloto

- CPF, quando informado;
- telefone;
- e-mail, quando informado;
- placa;
- número da ordem de serviço.

Quando há duplicidade, o formulário permanece aberto, informa o campo e oferece acesso ao cadastro existente quando aplicável.

## Normalizações

- CPF: somente dígitos;
- telefone: somente dígitos, removendo o prefixo brasileiro `55` quando presente;
- e-mail: espaços externos removidos e letras minúsculas;
- placa: separadores removidos e letras maiúsculas;
- nome: espaços externos e repetições internas removidos.

A busca global usa as mesmas representações normalizadas para telefone, CPF e placa.

## Regras confirmadas ou fortemente baseadas no processo atual

- CPF informado deve identificar corretamente o cliente;
- placa deve identificar corretamente o veículo;
- serviço não autorizado não pode ser executado;
- valores negativos são inválidos;
- uma OS precisa estar vinculada a um veículo e a seu cliente;
- número de OS deve ser único;
- itens recusados permanecem visíveis e não são apagados.

## Regras provisórias do piloto

- telefone único por cliente;
- e-mail único por cliente;
- formato e obrigatoriedade exatos dos campos;
- limite demonstrativo de quilometragem;
- algumas validações simples de datas;
- garantia padrão de 30 dias, calculada a partir da conclusão no piloto.

Essas regras precisam de validação com a oficina antes de serem tratadas como requisitos definitivos.

## Avisos não bloqueantes

Uma quilometragem menor que a última conhecida pede conferência. O usuário pode confirmar novamente e prosseguir, pois correções de registros anteriores ainda não têm regra definida.

## Limitações

- as validações valem apenas para os dados deste navegador;
- CPF recebe validação estrutural básica, sem consulta externa;
- não há tratamento definitivo de pagamentos parciais, estorno ou múltiplas formas;
- não existe versionamento complexo de orçamento; itens anteriores são preservados;
- exceções de garantia e sua data-base continuam pendentes;
- o cadastro não representa uma modelagem definitiva.

## Diferenças em relação à v0.1.1

A v0.1.1 priorizou clareza e repetibilidade da demonstração. A v0.1.2 mantém a mesma experiência e acrescenta prevenção de duplicidades, normalização compartilhada, validações numéricas, bloqueios de execução e mensagens orientativas.

## Próxima tarefa recomendada

Demonstrar o Piloto v0.1.2 à equipe da oficina e registrar quais validações refletem o processo real, principalmente telefone/e-mail únicos, campos obrigatórios, pagamentos, datas e garantia. Não iniciar modelagem permanente antes desse retorno.
