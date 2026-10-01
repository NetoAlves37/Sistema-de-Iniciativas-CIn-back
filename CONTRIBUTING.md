# Guia de Contribuição

Obrigado por contribuir com o **sistema-de-iniciativas-cin**! Este documento orienta o processo de desenvolvimento, padrões de código, testes e abertura de Pull Requests / Merge Requests.

---

## 🚀 Fluxo de Trabalho (Branching & PRs)

1. **Crie uma branch a partir de `main`**:
   - Para novas funcionalidades: `feat/nome-da-feature`
   - Para correções de bugs: `fix/nome-do-bug`
   - Para refatorações: `refactor/nome-da-refatoracao`
   - Para documentação ou infra: `docs/nome-do-topico` ou `chore/nome-da-tarefa`

2. **Faça commits atômicos e padronizados** seguindo a especificação do [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(module): adiciona endpoint de busca paginada`
   - `fix(auth): corrige validacao de expiracao do token jwks`
   - `docs(readme): atualiza instrucoes de setup local`
   - `test(task): adiciona testes unitarios para remocao`

3. **Verifique a qualidade localmente antes de abrir a PR**:
   ```bash
   # 1. Lint e Formatação com Biome
   npm run lint

   # 2. Testes unitários com Vitest
   npm test
   ```

4. **Abra um Pull Request (GitHub) ou Merge Request (GitLab)**:
   - Preencha o template padrão detalhando as mudanças realizadas, motivação e passos de teste.
   - Aguarde a aprovação do revisor e a passagem do pipeline de CI.

---

## 📐 Padrões de Código

### 1. Nomenclatura
- **Arquivos**: `kebab-case` (`user.service.ts`, `create-user.dto.ts`)
- **Classes**: `PascalCase` (`UserService`, `CreateUserDto`)
- **Métodos e variáveis**: `camelCase` (`findAll()`, `activeUser`)
- **Models Prisma**: `PascalCase` singular (`User`, `Task`)
- **Tabelas do Banco**: `snake_case` plural (`users`, `tasks`)
- **Colunas do Banco**: `snake_case` (`created_at`, `is_active`)

### 2. Validação & DTOs
- Declare **todos os DTOs usando schemas Zod** e a função `createZodDto` do pacote `nestjs-zod`.
- Para DTOs de atualização parcial, utilize `.partial()` no schema de criação base.

### 3. Tratamento de Erros
- Nunca retorne exceções cruas do banco de dados ou mensagens técnicas de infraestrutura diretamente para o cliente.
- Utilize as exceções de domínio do boilerplate (`ResourceNotFoundException`, `AccessDeniedException`) ou crie novas estendendo `AppException`.

### 4. Segurança Fail-Closed
- Endpoints são protegidos por padrão. Se um endpoint for deliberadamente público (ex: health check), adicione o decorator `@Public()`.
- Se o endpoint exigir permissões específicas, adicione `@Roles(AccessRole.ADMIN)`.

---

## 🧪 Testes Automatizados

- Todo novo `Service` deve possuir um arquivo correspondente `*.service.spec.ts`.
- Mocks do `PrismaService` devem ser isolados com `vi.fn()`.
- Teste sempre o caminho de sucesso (*happy path*) e os fluxos de exceção (*error cases*).
