# sistema-de-iniciativas-cin

Sistema de Iniciativas - CIn

API REST em Node.js com [NestJS 11](https://nestjs.com/), [Prisma](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/), [Keycloak](https://www.keycloak.org/) e [Zod](https://zod.dev/). Gerado a partir do `cincoders-nestjs-boilerplate`.

---

## ⚡ Stack Tecnológica

| Ferramenta | Versão | Propósito |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 LTS | Runtime JavaScript/TypeScript |
| [NestJS](https://nestjs.com/) | 11.x | Framework backend modular |
| [Prisma](https://www.prisma.io/) | 5.x | ORM e gerenciamento de migrations |
| [PostgreSQL](https://www.postgresql.org/) | 14+ | Banco de dados relacional |
| [Keycloak](https://www.keycloak.org/) + [jose](https://github.com/panva/jose) | 26.x / 6.x | Autenticação OIDC / JWT stateless (fail-closed) |
| [Zod](https://zod.dev/) + [nestjs-zod](https://www.npmjs.com/package/nestjs-zod) | 3.x / 5.x | Schemas de validação e OpenAPI |
| [Swagger / OpenAPI](https://swagger.io/) | 11.x | Documentação interativa em `/api/docs` |
| [Vitest](https://vitest.dev/) | 4.x | Testes unitários de alta velocidade |
| [Biome](https://biomejs.dev/) | 2.x | Linter e formatador de código |
| [Husky](https://typicode.github.io/husky/) + [commitlint](https://commitlint.js.org/) | 9.x / 21.x | Git hooks e Conventional Commits |

---

## 🚀 Setup Rápido

Pré-requisitos: Node.js 22 LTS, npm 11+, Docker + Docker Compose.

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar os serviços de infraestrutura localmente
docker compose up -d

# 3. Gerar o Prisma Client e executar migrations pendentes
npm run prisma:generate
npm run migration:run

# 4. (Opcional) Popular tabelas de lookup (roles, status, priority)
node prisma/seed.mjs

# 5. Iniciar a API em modo watch
npm run dev
```

O arquivo `.env` já foi criado pelo gerador a partir do `.env.example`. Ajuste as variáveis conforme o seu ambiente.

- **API Base**: `http://localhost:3000/sistema-de-iniciativas-cin/api` (recursos versionados em `/sistema-de-iniciativas-cin/api/v1/...`)
- **Health Check**: `http://localhost:3000/sistema-de-iniciativas-cin/api/health` (público, sem versionamento)
- **Documentação Swagger**: `http://localhost:3000/api/docs`
- **Keycloak Admin**: `http://localhost:8080/auth` (admin/admin, realm: `Local`)
- **Usuários de teste**: `admin`/`admin` (roles `sys_sistema-de-iniciativas-cin-admin` e `sys_sistema-de-iniciativas-cin-users`) e `user`/`user` (role `sys_sistema-de-iniciativas-cin-users`)

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor NestJS em modo de desenvolvimento (watch) |
| `npm run build` | Compila o projeto TypeScript para `dist/` |
| `npm run start:prod` | Inicia a aplicação a partir da pasta compilada `dist/` |
| `npm run lint` | Executa o linter Biome e aplica correções automáticas |
| `npm run format` | Formata o código com Biome |
| `npm test` | Executa a suíte de testes unitários com Vitest |
| `npm run test:watch` | Executa os testes unitários em modo watch |
| `npm run test:cov` | Executa os testes e gera relatório de cobertura |
| `npm run prisma:generate` | Gera o Prisma Client a partir de `prisma/schema.prisma` |
| `npm run migration:generate` | Cria e aplica uma nova migration a partir de mudanças no `schema.prisma` (`prisma migrate dev`) |
| `npm run migration:run` | Aplica todas as migrations pendentes no PostgreSQL (`prisma migrate deploy`) |

---

## 🤝 Contribuição

Para padrões de código, fluxo de branches, convenções de commits e abertura de Pull Requests, consulte o **[CONTRIBUTING.md](CONTRIBUTING.md)**.
