# Organização e publicação do módulo financeiro

## Pastas

`apps/` contém as aplicações; `packages/`, os contratos e bibliotecas partilhados; `docs/`, a documentação funcional e técnica. O módulo financeiro mantém `domain/`, `application/`, `http/`, `infrastructure/`, `schemas/` e `tests/`.

A documentação do Core foi agrupada em `docs/core/`; os exercícios da Semana 5, em `docs/exercicios/`; a especificação de Manutenção, em `docs/referencias/`. Os documentos e diagramas ligados pelo README conservam os caminhos existentes. O README não foi alterado.

O Core existente permanece no repositório porque a aplicação utiliza as suas rotas, autenticação, utilizadores e auditoria. Consulte o [estado actual do Financeiro](estado-atual-modulo-financeiro.md) para distinguir estas dependências das funcionalidades do módulo.

## Conteúdo destinado ao GitHub

Versionar código, testes, migrações, configuração reproduzível, lockfile e documentação do produto. `.env.example` contém apenas exemplos e campos vazios para credenciais externas; nunca deve receber segredos reais.

Por decisão deste projecto, `.gitignore` e documentos dos agentes não são publicados. As cópias locais são conservadas e excluídas através de `.git/info/exclude`, que não é enviado ao GitHub. O arquivo `docs/exercicio-1.zip` também permanece local: os diagramas e fontes já estão versionados individualmente.

As exclusões locais **não são transportadas para novos clones**. Em cada clone, configurar `.git/info/exclude` antes de preparar commits, incluindo pelo menos:

```gitignore
.gitignore
.env
.env.*
!.env.example
**/.env
**/.env.*
!**/.env.example
AGENT_CONTEXT.md
AGENTS.md
**/AGENTS.md
**/AGENT_CONTEXT.md
.agents/
.codex/
.gemini/
.antigravity/
.planning/
node_modules/
dist/
build/
coverage/
*.log
*.tsbuildinfo
*.pem
*.key
*.p12
*.pfx
*.sql.gz
*.dump
*.sqlite
*.db
docs/exercicio-1.zip
```

## Commits

Usar commits com um propósito identificável: `feat(financial)` para funcionalidades, `fix(financial)` para correcções, `docs(financial)` para documentação e `chore(repo)` para manutenção do repositório. A descrição deve explicar o comportamento ou a organização resultante.

Seleccionar os caminhos explicitamente com `git add <ficheiros>`. Antes do commit, rever `git diff --cached --stat`, `git diff --cached` e `git diff --cached --check`. Ficheiros ignorados que já estavam versionados exigem remoção do índice; ignorá-los por si só não os retira do GitHub.

Retirar um ficheiro do índice elimina-o da versão seguinte, mas preserva-o nos commits anteriores. Esta organização não reescreve o histórico nem altera outras branches.
