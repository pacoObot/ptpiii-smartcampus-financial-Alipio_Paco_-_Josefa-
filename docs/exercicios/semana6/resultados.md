# Resultados — actividade da Semana 6

> **Âmbito desta publicação:** documentação e evidências da execução local de 6 de Outubro de 2026. Os 109 testes validam o estado local completo identificado pelo SHA-256 em `resumo-validacao.json`, incluindo alterações de segurança ainda não publicadas neste commit. Não representam uma execução de CI nem a validação do código actualmente publicado. Os comandos de reprodução descritos abaixo dependem desses ficheiros locais e ainda não estão disponíveis num clone apenas deste commit.

## Testes e compilação

A execução isolada compilou os pacotes partilhados, API e frontend, aplicou as cinco migrações numa base PostgreSQL 15 descartável e executou a suite Jest:

- **109 testes aprovados, 0 falhas, 5 suites aprovadas.**
- **20 testes** pertencem ao novo ficheiro `financial-semana6.test.ts`.
- Base habitual do projecto não utilizada.
- YAML validado e comparado com o documento servido pelo Swagger através de `npm run docs:check`.

Evidências: [resumo da execução](evidencias/resumo-validacao.json) e [relatório Jest completo](evidencias/resultado-testes.json). O resumo inclui data, versão do Node e impressão SHA-256 dos ficheiros de código testados.

## Leitura da cobertura

Âmbito medido: `src/modules/financial/{http,application}/**/*.ts`. Estes números não representam a cobertura de todo o monorepo.

| Ficheiro/âmbito | Instruções | Ramos | Funções | Linhas |
|---|---:|---:|---:|---:|
| Total do âmbito financeiro medido | 86,30% | 84,09% | 86,53% | 88,43% |
| financialService.ts | 94,52% | 83,09% | 96,29% | 97,10% |
| financialRouter.ts | 82,85% | 86,20% | 85,71% | 82,85% |
| notificationDeliveryService.ts | 73,01% | 84,37% | 63,63% | 76,47% |

Abrir o [relatório HTML](evidencias/coverage/lcov-report/index.html) no browser e seleccionar um ficheiro. Linhas assinaladas a vermelho não foram executadas; os indicadores de ramos mostram decisões ainda sem todos os caminhos cobertos.

No endpoint escolhido, os testes percorrem sucesso, rejeição por posse e recurso inexistente; autenticação e autorização também têm cenários negativos. As lacunas restantes abrangem outras operações do módulo: por exemplo, consulta bem-sucedida de notificações, resolução de contestação inexistente e ciclo periódico de envio de notificações. No router, continuam por cobrir caminhos de algumas operações administrativas e tratamento de certas falhas. A ficha pede documentar/testar um endpoint completo, não atingir 100% em todo o módulo.

## Repetir a actividade

```bash
cd "SMART CAMPUS"
npm run docs:check
npm run test:semana6:isolated
```

Para repetir também a prova de mutação: acrescentar `-- --mutations`. Para as capturas, definir `PLAYWRIGHT_MODULE` e, se necessário, `CHROME_PATH`, conforme o [passo a passo](../documentacao-exercicios-semana6.md).

## Swagger UI — evidências de 6 de Outubro de 2026

Os pedidos foram executados pelo botão **Execute** do Swagger UI numa API local ligada à base descartável. Os tokens foram obtidos por login HTTP real. A porta temporária e os identificadores variam entre execuções.

| Cenário | Obtido | Captura |
|---|---|---|
| FINANCE consulta dívida existente | 200, `data` e `meta` | [Sucesso](evidencias/swagger-200.png) |
| Pedido sem token | 401, `UNAUTHORIZED` | [Sem autenticação](evidencias/swagger-401.png) |
| TEACHER tenta consultar dívida | 403, `FORBIDDEN` | [Sem permissão](evidencias/swagger-403.png) |
| FINANCE consulta identificador inexistente | 404, `DEBT_NOT_FOUND` | [Dívida inexistente](evidencias/swagger-404.png) |

[Respostas efectivas em JSON](evidencias/swagger-resultados.json). Os exemplos da documentação usam valores ilustrativos; as respostas reais mantêm os campos e tipos documentados. `description` é opcional e não é devolvida quando a dívida não a possui. As capturas mostram a resposta e omitem o comando curl que conteria o token.

## Prova anti-BOLA

| Alteração temporária | Resultado indevido | Resultado do teste |
|---|---|---|
| Desactivar a comparação do proprietário no detalhe da dívida | 200 em vez de 403 | Falhou como esperado |
| Desactivar a comparação do proprietário ao criar contestação | 201 em vez de 403 | Falhou como esperado |

As duas guardas foram restauradas exactamente ao conteúdo original. [Resumo da prova](evidencias/mutacoes-resumo.json). As falhas nos ficheiros `mutacao-*.json` são evidências intencionais, não falhas da suite normal.

## Tabela do endpoint pedida na ficha

| Campo | Preenchimento |
|---|---|
| Endpoint escolhido | `GET /api/v1/financial/debts/{id}` |
| Documentado em openapi.yaml? | S |
| Validado no Swagger UI? | S — quatro cenários, com capturas |
| Testes 200/201, 401 e 403 escritos? | S — sucesso deste GET é 200; inclui também 400, 404 e BOLA |
| npm test a passar? | S — o runner executou o script `test` da API com Jest, em base descartável, 109/109 aprovados |

A ficha está documentada no [relatório passo a passo](../documentacao-exercicios-semana6.md). Os nomes do grupo foram recolhidos da configuração existente e devem ser conferidos antes de entregar.

## Conteúdo publicado e limites

Esta entrega inclui o relatório da actividade, resultados Jest, cobertura, prova de mutação e quatro capturas Swagger. O [OpenAPI validado](evidencias/openapi-validado.yaml) é uma fotografia da especificação local testada; não altera a especificação servida pela versão de código publicada.

Os ficheiros HTML de cobertura contêm o código instrumentado da execução local e devem ser lidos como evidência dessa execução. No GitHub, a tabela Markdown acima permite consultar os números; para explorar o HTML, descarregar a pasta de cobertura e abrir `lcov-report/index.html`.

Ficaram fora deste push as alterações de autenticação, sessões, migrações, serviços, dependências npm, scripts e testes executáveis ainda misturadas com trabalho anterior. A publicação dessas alterações requer uma entrega de código com âmbito e validação próprios.
