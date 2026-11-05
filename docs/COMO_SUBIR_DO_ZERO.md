# Como subir tudo do zero (Windows, PowerShell)

Pré-requisitos: Docker Desktop **rodando**, Node 22 ou superior (testado com Node 24) e Git.

> **Postgres na porta 5433.** O `docker-compose` publica o Postgres na porta `DB_PORT` (padrão 5432). Se você já tem um Postgres instalado no Windows usando a 5432, use a 5433, como abaixo. Se a 5432 estiver livre, pode deixar o padrão.

## 1. Infraestrutura e backend (`backend/`)

```powershell
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\backend"

# configuração local (já com a porta 5433)
Copy-Item .env.example .env
(Get-Content .env) -replace '^DB_PORT=5432','DB_PORT=5433' -replace 'localhost:5432/BD-SICIN','localhost:5433/BD-SICIN' | Set-Content .env

# containers: Postgres, Keycloak e o banco do Keycloak
docker compose up -d postgres keycloak-db keycloak

# dependências e Prisma Client
npm ci
npm run prisma:generate

# banco: cria (se faltar) e aplica as migrations
node scripts/prepare-database.mjs BD-SICIN

# dados de demonstração (13 iniciativas e os 7 usuários de teste); idempotente
npm run seed

# API em http://localhost:3000 (Swagger em http://localhost:3000/api/docs)
npm run dev
```

O Keycloak leva 1 a 2 minutos na primeira subida. Confirme antes de logar:
`Invoke-WebRequest http://localhost:8080/auth/realms/Local/.well-known/openid-configuration -UseBasicParsing | Select-Object StatusCode` (deve dar 200).

Para começar com **tudo zerado** (sem o seed), pule o `npm run seed`. Para apagar o banco e recomeçar: `node scripts/prepare-database.mjs BD-SICIN --reset`.

## 2. Frontend (`frontend/`), em outro terminal

```powershell
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\frontend"
Copy-Item .env.example .env
npm ci
npm run dev
```

Abra **http://localhost:5173/sistema-de-iniciativas-cin/** e entre com um dos usuários abaixo.

## 3. Usuários de teste (senha = nome de usuário)

| Usuário | Perfil | Role |
|---|---|---|
| `ana` | Aluno | `-users` |
| `bruno` | Professor | `-users` |
| `diego` | Aluno | `-users` |
| `carla` | Comitê avaliador | `-users`, `-comite` |
| `elisa` | Comitê avaliador | `-users`, `-comite` |
| `admin` | Administrador (participa e decide como o comitê) | `-admin`, `-users` |

Console do Keycloak: http://localhost:8080/auth (`admin` / `admin`).

## 4. Ver as transições de prazo rápido (≈ 5 minutos)

Pare a API e suba de novo com prazos curtos:

```powershell
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\backend"
$env:PRAZO_REFINAMENTO_DIAS = '0.0035'   # ≈ 5 min de refinamento
$env:PRAZO_VOTACAO_DIAS = '0.0035'       # ≈ 5 min de votação
$env:TRANSICOES_CRON = '*/10 * * * * *'  # job a cada 10 s
npm run dev
```

Só vale para iniciativas **novas** (o prazo é gravado na submissão).

## 5. Rodar os testes

```powershell
# backend (precisa do Postgres de pé)
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\backend"
npm run lint:ci; npx tsc --noEmit; npm run build
npm test; npm run test:int; npm run test:e2e; npm run test:cov

# frontend
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\frontend"
npm run lint; npx tsc -b; npm test; npm run build

# smoke no navegador (precisa do Postgres e do Keycloak de pé; sobe a API e o front sozinho)
npx playwright install chromium   # só na primeira vez
npm run e2e
```

O `npm run e2e` usa o banco `BD-SICIN-SMOKE`, recriado a cada execução, e prazos de ≈ 52 s: não mexe no banco de desenvolvimento. Não deixe a API de desenvolvimento rodando na porta 3000 (ele sobe a sua própria); o servidor do front (5173) ele reaproveita se já estiver no ar.

## 6. Parar tudo

```powershell
cd "C:\Users\maria\SISTEMA DE INICIATIVAS\backend"
docker compose down          # mantém os dados; use `down -v` para apagá-los
```
