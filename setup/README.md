# Realm de desenvolvimento do Keycloak

`realm.json` é importado automaticamente pelo serviço `keycloak` do `docker-compose.yml`
(`--import-realm`, montado em `/opt/keycloak/data/import/realm.json`). Ele existe só para
desenvolvimento local — não use em produção.

## O que vem pronto

- **Realm**: `Local` (fixo, independente do nome do projeto)
- **Roles** (padrão CIn `sys_<realm>-<perfil>`, iguais às do frontend):
  `sys_sistema-de-iniciativas-cin-admin`, `sys_sistema-de-iniciativas-cin-users`
- **Usuários de teste**:
  | Usuário | Senha | Roles |
  |---|---|---|
  | `admin` | `admin` | `sys_sistema-de-iniciativas-cin-admin`, `sys_sistema-de-iniciativas-cin-users` |
  | `user` | `user` | `sys_sistema-de-iniciativas-cin-users` |
- **Clients**:
  | Client ID | Tipo | Uso |
  |---|---|---|
  | `sistema-de-iniciativas-cin-back` | confidential, service account | API (backend), secret `dev-secret` |
  | `sistema-de-iniciativas-cin-front` | public | SPA/frontend, sem secret |

Os valores de `KEYCLOAK_*` no `.env.example` já apontam para esse realm e para o client
`-back`.

## Console de administração

http://localhost:8080/auth (usuário `admin` / senha `admin`, definidos em
`KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` no `docker-compose.yml`).

## Placeholders

Assim como o resto do boilerplate, `realm.json` é varrido pelo `setup.sh`: toda ocorrência de
`sistema-de-iniciativas-cin` vira o nome do projeto informado na criação — no `id` do realm, nos
`clientId` dos dois clients, nas roles do sistema (`sys_sistema-de-iniciativas-cin-admin`,
`sys_sistema-de-iniciativas-cin-users`) e nas roles padrão (`default-roles-sistema-de-iniciativas-cin`). O campo
`realm` em si **não** é substituído — fica sempre fixo em `Local`.

## Regerando o realm a partir de uma instância real

Se precisar atualizar este arquivo a partir de um export real do Keycloak (`Export` no console,
ou `kc.sh export`), mantenha só o essencial: roles de realm, os dois usuários de teste, os dois
clients e os `defaultClientScopes`/`optionalClientScopes`. Não copie IDs (`uuid`), segredos reais,
nem clients/roles específicos de outros projetos.
