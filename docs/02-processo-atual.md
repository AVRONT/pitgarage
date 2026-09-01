# Processo atual da oficina

## Fluxo observado

1. O cliente chega com um carro ou uma moto e relata o problema que acredita existir.
2. Clientes antigos costumam ser reconhecidos por telefone, WhatsApp, rosto, veículo ou modelo.
3. O veículo entra na oficina e um mecânico realiza o diagnóstico.
4. Problemas encontrados podem ser registrados em fotos ou vídeos e enviados ao cliente pelo WhatsApp.
5. A oficina prepara um orçamento com peças e mão de obra. Normalmente, o valor da peça corresponde ao custo acrescido de aproximadamente 30%.
6. O orçamento é enviado pelo WhatsApp.
7. O cliente pode aprovar tudo, recusar tudo ou decidir item a item.
8. Durante a execução, um novo problema pode ser identificado. O cliente é avisado e o serviço adicional só é executado após nova autorização.
9. Peças disponíveis na oficina podem ser usadas. Quando uma peça não está disponível, ela é solicitada e o serviço relacionado aguarda sua chegada.
10. Após a conclusão, o pagamento costuma ocorrer por PIX para o CNPJ ou por cartão. O registro também pode ser anotado em caderno.
11. A oficina normalmente oferece cerca de 30 dias de garantia e hoje consulta a data do serviço para verificá-la.

## Fluxo de ordem de serviço proposto para validação

Cliente e veículo → problema relatado → ordem de serviço → diagnóstico e mídias → recomendações → orçamento → aprovação total ou parcial → execução dos itens aprovados → eventuais novas autorizações → conclusão → pagamento → entrega → histórico e garantia.

## Estados propostos para validação

- Recebido
- Em diagnóstico
- Aguardando aprovação
- Aguardando peça
- Em manutenção
- Serviço concluído
- Aguardando retirada
- Entregue

Esses estados não são definitivos e não devem orientar uma implementação antes de serem validados.
