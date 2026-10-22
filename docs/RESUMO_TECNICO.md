# Resumo Técnico — Sistema de Iniciativas CIn

Levantamento do que existe hoje nos repositórios clonados em `backend/` e `frontend/`.
Ambos partem de boilerplates do CIn/Cincoders, e o domínio de **iniciativas ainda não foi implementado**: o que existe é um módulo de exemplo (`task` no back, `todos` e `team` no front).

| | Backend | Frontend |
|---|---|---|
| Repositório | `NetoAlves37/Sistema-de-Iniciativas-CIn-back` | `NetoAlves37/Sistema-de-Iniciativas-CIn-front` |
| Pasta | `backend/` | `frontend/` |
| Runtime | Node 22 | Node 24 |
| Framework | NestJS 11 | React 18 + Vite 7 + TypeScript |
| Dados | PostgreSQL 14 via Prisma 5 | Consome a API REST do back |
| Autenticação | Valida JWT do Keycloak (`jose`) | Login OIDC no Keycloak (`react-oidc-context`) |
| Validação | Zod + `nestjs-zod` | Zod + react-hook-form |
| UI / Docs | Swagger em `/api/docs` | Tailwind 4, shadcn, lib interna `@cincoders/cinnamon` |
| Testes | Vitest | Vitest + Testing Library |
| Qualidade | Biome, Husky, commitlint | ESLint |
| Deploy | Dockerfile multi-stage, porta 3000 | Dockerfile (build + nginx), porta 80 |

---

# 1. Backend

## 1.1 Fluxo de uma requisição

```
Request → AuthGuard (valida JWT) → RolesGuard (@Roles) → ZodValidationPipe
        → Controller → Service → Prisma → PostgreSQL
        → TransformInterceptor (envelope) / HttpExceptionFilter (erros)
```

- **Prefixo global:** `API_PREFIX` (padrão do `.env.example`: `sistema-de-iniciativas-cin/api`).
- **Versionamento por URI:** versão padrão `1`, então o endereço fica `/sistema-de-iniciativas-cin/api/v1/tasks`.
- **CORS** aberto (`app.enableCors()` sem restrição de origem).
- **Resposta de sucesso** (envelope do `TransformInterceptor`):
  ```json
  { "statusCode": 200, "timestamp": "...", "path": "...", "data": { } }
  ```
- **Resposta de erro** (RFC 7807, `application/problem+json`): `type`, `title`, `status`, `detail`, `instance`, `code`, `timestamp` e, em erro de validação, `errors` por campo (HTTP 422).

## 1.2 Estrutura por pasta

### `src/main.ts` e `src/app.module.ts`
- `main.ts`: sobe o Nest, aplica prefixo, versionamento, CORS, filtro de exceção e interceptor globais. Monta o Swagger (Bearer e OAuth2 password flow apontando para o Keycloak, quando configurado).
- `app.module.ts`: importa `ConfigModule` (global, com validação de env), `PrismaModule`, `AuthModule`, `HealthModule`, `TaskModule`. Registra o `ZodValidationPipe` como pipe global.

### `src/config/`
| Arquivo | Função |
|---|---|
| `env.validation.ts` | Falha no boot se o Keycloak estiver parcialmente configurado (`KEYCLOAK_AUTH_SERVER_URL` sem `KEYCLOAK_REALM`, ou o inverso) ou se os timeouts do JWKS não forem numéricos. |
| `database.config.ts` | Usa `DATABASE_URL` se existir. Senão monta a URL a partir de `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` e a exporta para o Prisma. |
| `keycloak.config.ts` | `authServerUrl`, `realm`, `clientId`, `jwksCacheMaxAge` (600000 ms) e `jwksTimeout` (5000 ms). |
| `swagger.config.ts` | Título, descrição, versão e caminho do Swagger. |

### `src/database/`
`PrismaModule` e `PrismaService` (estende `PrismaClient`, conecta em `onModuleInit` e desconecta em `onModuleDestroy`).

### `src/common/auth/`
Autenticação e autorização **stateless**, com `AuthGuard` e `RolesGuard` registrados como `APP_GUARD` (valem para todas as rotas).

- **`AuthGuard`**: ignora rotas marcadas com `@Public()`. Nas demais, delega ao `IdentitySource` e injeta `request.user = { userId, role }`. Sem identidade válida, retorna 401.
- **`KeycloakIdentitySource`** (implementa a interface `IdentitySource`):
  1. Lê o header `Authorization: Bearer`.
  2. Valida assinatura, `issuer` e `exp` com `jose` contra o JWKS do realm (`.../realms/{realm}/protocol/openid-connect/certs`, com cache e timeout). O issuer e o JWKS são inicializados na primeira requisição (lazy).
  3. Valida a audiência manualmente: o `clientId` configurado precisa estar em `aud` ou em `azp`. Se `KEYCLOAK_CLIENT_ID` estiver vazio, a audiência não é validada.
  4. Converte as roles de realm em `AccessRole`:

     | Role no Keycloak | `AccessRole` |
     |---|---|
     | `sys_sistema-de-iniciativas-cin-admin` | `ADMIN` |
     | `sys_sistema-de-iniciativas-cin-users` | `USER` |

     Se o usuário tiver as duas, `ADMIN` prevalece. Se não tiver nenhuma, retorna 403.
- **`RolesGuard`** + decorator `@Roles(...)`: só barra a rota se ela declarar roles. Sem `@Roles`, qualquer usuário autenticado passa.
- **Decorators:** `@GetCurrentUser()` (injeta o usuário no handler) e `@Public()` (em `common/decorators/`).

### `src/common/exceptions/` e `src/common/filters/`
- `AppException` é a base das exceções de domínio. Carrega um `ErrorCode` (`NOT_FOUND`, `VALIDATION_FAILED`, `ACCESS_DENIED`, `CONFLICT`, `EXTERNAL_SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`).
- Derivadas: `ResourceNotFoundException` e `AccessDeniedException`.
- `HttpExceptionFilter` traduz qualquer exceção (Zod, `AppException`, `HttpException`, erro desconhecido) para o formato Problem Details. Erros 5xx são logados com stack.

### `src/common/pagination/`
- `PaginationQueryDto`: `page` (≥ 1, padrão 1) e `limit` (1 a 500, padrão 20), com os getters `skip` e `take`.
- `PaginatedResponseDto.of(items, total, query)` devolve `{ items, meta: { page, limit, total, totalPages } }`.

### `src/common/interceptors/`
`TransformInterceptor` aplica o envelope `{ statusCode, timestamp, path, data }` em todas as respostas de sucesso.

### `src/modules/health/`
- `GET /health`, **público** e `VERSION_NEUTRAL` (sem `/v1`).
- Faz `pingCheck` no banco via Terminus. Responde 200 se estiver saudável e 503 se não estiver.

### `src/modules/task/` (módulo de exemplo / gabarito)
CRUD de tarefas, protegido por Bearer. Rotas em `/v1/tasks`:

| Método | Rota | Ação |
|---|---|---|
| POST | `/tasks` | Cria. O `ownerId` vem do `sub` do token. |
| GET | `/tasks?page=&limit=` | Lista paginada, ordenada por `createdAt` desc. |
| GET | `/tasks/:id` | Busca por UUID (404 se não existir). |
| PATCH | `/tasks/:id` | Atualização parcial. |
| DELETE | `/tasks/:id` | Remove (404 se não existir). |

- **DTO de criação:** `title` (3 a 200 caracteres), `description?`, `priority?`, `status?`, `dueDate?` (`YYYY-MM-DD`). O de atualização é `CreateTaskSchema.partial()`.
- **Padrões:** `status` e `priority` são enviados por `code` (ex.: `PENDING`, `HIGH`) e ligados às tabelas de lookup via `connect`. Os padrões são `PENDING` e `MEDIUM`. O serviço serializa para o tipo `Task`, com `dueDate` em `YYYY-MM-DD`.
- **Testes:** `task.service.spec.ts` (Vitest, unitário) e `http-exception.filter.spec.ts`.

### `prisma/`
Modelo de dados atual (única migration: `20260921031059_init_prisma_schema`):

| Tabela | Campos principais |
|---|---|
| `task_statuses` | `id`, `code` (único), `label` |
| `task_priorities` | `id`, `code` (único), `label` |
| `tasks` | `id` (uuid), `title`, `description?`, `statusId`, `priorityId`, `dueDate?`, `ownerId?` (uuid), `createdAt`, `updatedAt` |

`tasks` tem índices em `ownerId`, `statusId` e `priorityId`.

`seed.mjs` faz upsert dos lookups:

| Status (`code` → label) | Prioridade (`code` → label) |
|---|---|
| `PENDING` → Pendente | `LOW` → Baixa |
| `IN_PROGRESS` → Em andamento | `MEDIUM` → Média |
| `COMPLETED` → Concluída | `HIGH` → Alta |
| `CANCELLED` → Cancelada | `URGENT` → Urgente |

### `setup/` e infraestrutura local
- `setup/realm.json`: realm `Local` do Keycloak, importado automaticamente pelo `docker-compose`. Define as duas roles `sys_*` e os clients `sistema-de-iniciativas-cin-back` e `sistema-de-iniciativas-cin-front`.
- `docker-compose.yml`:

  | Serviço | Imagem | Porta |
  |---|---|---|
  | `postgres` (banco `BD-SICIN`) | `postgres:14.2` | 5432 |
  | `keycloak-db` | `postgres:14.4-alpine` | interna |
  | `keycloak` | `keycloak:18.0.0` em `start-dev`, com path `/auth` | 8080 |
  | `app` (profile `app`, opcional) | build local | 3000 |
- `Dockerfile`: estágios `development`, `build` e `production` (`npm ci --omit=dev`, `prisma generate`, `node dist/main`).
- `test/app.e2e-spec.ts`: teste e2e (health e tasks).
- `docs-site/`: site de documentação (Next.js + Fumadocs) com arquitetura, autenticação, tratamento de erros, scaffolding de módulos e testes. **Não é parte da API**, e não precisa subir junto com ela.

---

# 2. Frontend

## 2.1 Bootstrap e providers

`main.tsx` → `App.tsx` → `AppProvider` → `RouteMap` (`routes.tsx`).

`AppProvider` (`src/app/provider.tsx`), de fora para dentro:
1. `ErrorBoundary` global.
2. `AuthProvider` (OIDC/Keycloak). Config em `utils/auth.ts`: silent renew automático, monitor de sessão e renovação 30 s antes de expirar.
3. `ToastContainer` da cinnamon (canto superior direito).

## 2.2 Configuração (`src/config/env.ts`)

Variáveis obrigatórias (o app lança erro no boot se faltar):

| Variável | Uso |
|---|---|
| `VITE_API_URL` | URL base da API (o `.env.example` já inclui `/v1`) |
| `VITE_KEYCLOAK_JSON` | JSON do client Keycloak (`auth-server-url`, `realm`, `resource`) |
| `VITE_BASE_URL` | base path público (`/sistema-de-iniciativas-cin`) |

Em produção, o `docker-entrypoint.sh` troca os placeholders do bundle por `BASEURL`, `API_URL` e `KEYCLOAK_PUBLIC_JSON` em tempo de execução. Assim a mesma imagem serve para qualquer ambiente.

## 2.3 Mapa de rotas (`src/routes.tsx`)

| Rota | Tela | Acesso |
|---|---|---|
| `/` | `LoginPage`. Se já autenticado, redireciona para `/todos`. | Pública |
| `/forbidden` | `ForbiddenPageCin` | Autenticado, sem a role exigida |
| `/todos` | `TodosPage` | `USERS` ou `ADMIN` |
| `/team` | `TeamPage` | Só `ADMIN` |
| `*` | 404 (`ErrorScreen` da cinnamon) | Dentro do layout autenticado |

Comportamentos do `RouteMap`:
- Ao carregar com sessão existente, faz `signinSilent()`. Se falhar, limpa o usuário e o estado.
- Sincroniza o token com o cliente HTTP (`setAuthToken`) e registra as funções de refresh e logout.
- Escuta os eventos de token expirado, falha no silent renew e logout em outra aba.
- Cada grupo de rotas protegidas fica em um `RouteErrorBoundary` com `resetKey={pathname}`, que isola o erro de renderização numa página e se recupera ao navegar.

## 2.4 Páginas

### `pages/login` — Login
- Cartão central com o logo do CIn e o botão **Entrar**, que chama `auth.signinRedirect()` (redireciona ao Keycloak).
- Mostra `auth.error` e desabilita o botão enquanto há carregamento ou navegação de auth em andamento.
- Tem teste (`index.test.tsx`).

### `pages/todos` — Tarefas de Exemplo (gabarito)
- **Lista** de tarefas em tabela da cinnamon (com skeleton de carregamento, linha de mensagem e estado vazio), mais um botão de recarregar.
- **Busca** por título ou descrição e **filtro de status**, ambos **no cliente**. Isso funciona porque `todoService.getAll()` pega só a primeira página da API (20 itens por padrão).
- **Criar e editar** por `TodoModal` (react-hook-form + zod).
- **Excluir** com `ConfirmDialog`.
- O botão "Nova Tarefa" fica dentro de `<Can roles={WRITE_ROLES}>`. `WRITE_ROLES` hoje é só `ADMIN`.
- **Camadas do módulo** (`modules/todos/`):

  | Arquivo | Papel |
  |---|---|
  | `todo.service.ts` | HTTP em `/tasks`, via `fetchApi`, desembrulha o envelope `{ data }` |
  | `useTodos.ts` | `useAsync` mais `create`, `update` e `remove`, que recarregam a lista |
  | `todo.types.ts` | Tipos, enums e labels (status e prioridade, espelham o back) |
  | `components/` | `TodoModal`, `TodoRow`, `TodoBadges` |

### `pages/team` — Gerenciamento de Equipe (só ADMIN)
- Lista de membros com ações de **convidar**, **editar nome e papel**, **ativar e desativar** e **remover**.
- Exibe os avisos "Só ADMIN" e "Dados mockados". Não usa `<Can>`, porque a rota já exige `ADMIN`.
- **Hoje funciona só com mock em memória** (Ana, Bruno e Carla). Não existe módulo `members` no back. `getAll` tenta `GET /members` e cai no mock se falhar. `create`, `update` e `remove` nunca vão à rede.
- Papéis do front (`admin`, `editor`, `viewer`) **não batem** com as roles reais (`ADMIN` e `USERS`).
- **Camadas** (`modules/team/`): `team.service.ts`, `useTeam.ts`, `team.types.ts` (schema zod do formulário) e `components/` (`MemberModal`, `MemberRow`, `TeamBadges`).

### Páginas de apoio
- **`ForbiddenPageCin`**: tela "acesso negado", destino do redirect do `RequireAuth` da cinnamon.
- **404**: `ErrorScreen` pronta da cinnamon.

## 2.5 Código compartilhado

| Pasta / arquivo | Função |
|---|---|
| `components/PageCin` | Layout autenticado: navbar, sidebar em drawer, footer "cin" com a versão do app, spinner de carregamento, redirecionamento para `/` se não autenticado, e filtro do menu (esconde links de admin de quem não é admin). |
| `components/auth/Can.tsx` | Gate de UI por role em botões e ações (`mode="hide"` ou `"disable"`). Só UX. |
| `components/` (outros) | `ErrorBoundary`, `ConfirmDialog`, `EmptyState`, `FormModal`. |
| `hooks/useAsync.ts` | `data`, `isLoading`, `error` e `reload`, com proteção contra resposta obsoleta e setState após unmount. |
| `hooks/useAuthorization.ts` | Decodifica o JWT, extrai `realm_access.roles` e expõe `hasRole`, `isAdmin` e `isReadOnly`. |
| `services/api.ts` | `fetchApi`: injeta o Bearer, **renova o token antes** de expirar (com compartilhamento do refresh em voo), faz retry após 401 e **desloga** se a sessão morreu. Também tem `getApiErrorMessage`. |
| `utils/enums.ts` | `Links`, `Roles`, `ALL_ROLES`, `WRITE_ROLES` e `ADMIN_ONLY_LINKS`. |
| `utils/sidebar.ts` | Itens do menu: "Tarefas de Exemplo" e "Gerenciar Equipe". |
| `utils/systemsList.tsx` | Lista de sistemas do CIn (Allocation, FrequenCIn etc.). Hoje **não está plugada** em nenhuma tela. |
| `docs-site/`, `docs/` | Documentação do boilerplate. |

---

# 3. Pontos de atenção

Divergências e riscos encontrados na leitura do código. Todos valem confirmar antes de construir em cima.

1. **Autorização de escrita não bate entre front e back.** No front só `ADMIN` vê os botões de escrita (`WRITE_ROLES`). No back, o `TaskController` não usa `@Roles`, então qualquer usuário autenticado consegue criar, editar e excluir pela API. O front é só UX, então a regra precisa existir no back (`@Roles(AccessRole.ADMIN)`).
2. **`TeamService.getAll` lê o formato errado.** Faz `data.items`, mas toda resposta do back vem no envelope `{ data: { items } }`. Quando o endpoint existir, a lista virá `undefined`. O `TodoService` já trata isso corretamente.
3. **Enum de papéis divergente no módulo `team`.** `admin/editor/viewer` no front contra `ADMIN/USER` no back e no Keycloak.
4. **`VITE_API_URL` inconsistente.** O README do front diz que o `.env.example` aponta para `.../api`, mas o arquivo real termina em `.../api/v1`. Vale conferir qual valor vai em produção.
5. **Keycloak "opcional" só no papel.** O `.env.example` diz "deixe em branco para desabilitar auth", mas o `AuthGuard` é global e sempre exige token. Sem a configuração, a primeira requisição falha com erro genérico (500 em vez de 401).
6. **Keycloak de dev não serve para produção.** O compose usa Keycloak 18 em `start-dev` com `admin/admin`. A produção precisa de um Keycloak real, com realm e clients próprios (`redirect URIs`, `webOrigins`).
7. **CORS aberto** (`enableCors()` sem origens). Restringir ao domínio do front na hospedagem.
8. **Teste e2e provavelmente desatualizado.** `test/app.e2e-spec.ts` usa prefixo `api`, `ValidationPipe` do Nest (o app usa Zod) e chama `/api/v1/tasks` sem token, mas a rota exige autenticação.
9. **Status ou prioridade inexistente em PATCH.** O `connect` por `code` com valor fora do enum passa pelo Zod, mas o Prisma pode lançar erro se a tabela de lookup não tiver sido populada com o seed. Rodar `node prisma/seed.mjs` em todo ambiente novo.
10. **Paginação do front.** A tela de tarefas busca só a primeira página (20 itens) e filtra no cliente. Com volume real isso esconde dados. As telas de iniciativas devem filtrar e paginar no servidor.

---

# 4. O que falta para virar o Sistema de Iniciativas

- Modelar o domínio de iniciativas em `prisma/schema.prisma` (hoje só existem `Task` e lookups).
- Criar o(s) módulo(s) correspondentes em `backend/src/modules/` (a doc `module-scaffolding.mdx` do `docs-site` descreve o passo a passo).
- Criar os módulos e as páginas no front (copiando `todos/` como gabarito), registrar rotas em `routes.tsx` e itens em `utils/sidebar.ts`.
- Decidir as roles do sistema. Hoje só existem `admin` e `users`.
- Remover ou substituir os módulos de exemplo (`task`, `todos`, `team`) quando o domínio real entrar.
- Definir a infraestrutura de produção: Postgres, Keycloak, variáveis de ambiente e domínio.
