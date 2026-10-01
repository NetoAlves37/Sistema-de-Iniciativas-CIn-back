## Descrição da Mudança

Descreva de forma clara e objetiva o que foi implementado ou corrigido nesta Pull Request.

- [ ] Nova funcionalidade (`feat`)
- [ ] Correção de bug (`fix`)
- [ ] Refatoração de código (`refactor`)
- [ ] Atualização de documentação (`docs`)
- [ ] Ajustes de infra / build (`chore` / `ci`)

---

## Motivação e Contexto

Explique por que esta mudança é necessária e qual problema ou requisito ela resolve.

---

## Como Isso Foi Testado?

Descreva os passos manuais e/ou testes automatizados adicionados para validar esta alteração:

- [ ] Testes unitários executados com sucesso (`npm test`)
- [ ] Linter e formatação validados com Biome (`npm run lint`)
- [ ] Testes manuais realizados via Swagger ou cURL/Postman

---

## Checklist de Qualidade

- [ ] O código segue as convenções e padrões descritos no `CONTRIBUTING.md`.
- [ ] Models Prisma possuem migrations geradas e aplicáveis.
- [ ] DTOs utilizam schemas Zod (`createZodDto`).
- [ ] Endpoints novos estão documentados com decorators Swagger (`@ApiOperation`, `@ApiResponse`).
- [ ] Endpoints públicos possuem `@Public()` explícito.
