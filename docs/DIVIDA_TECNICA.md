# Dívida técnica (IT-04)

Itens conhecidos, em ordem de importância. Nenhum impede o uso local.

## Verificação e CI
1. **CI nunca executado.** Os workflows de GitHub Actions (`.github/workflows/ci.yml` em cada repositório) foram escritos e cada passo foi rodado à mão, mas nada foi enviado. O padrão de hospedagem do CIn é GitLab (`ci-templates`); o `backend/.gitlab-ci.yml` atual é o do template e só publica o `docs-site`.
2. **O CI não cobre tudo.** O do back não roda `test:int` nem `test:cov`; o do front não roda o Playwright. Foi mantido como está por decisão da Maria.
3. **Acessibilidade (RNF-02) sem auditoria em navegador real.** O `vitest-axe` roda em jsdom, que não calcula contraste. Falta rodar o axe num navegador (por exemplo, dentro do Playwright), conferir o contraste nos temas claro e escuro e testar com leitor de tela e só com teclado.
4. **Cobertura do front não medida.** Não há provider de cobertura configurado no front.
5. **O smoke test depende de tempo.** Usa prazos de ~52 s e leva ~2 min. Em máquina muito lenta pode precisar de `E2E_PRAZO_DIAS` maior.

## Produção (fora do escopo desta entrega)
6. Sem `DEPLOY.md`, sem `prisma migrate deploy` no start, sem healthcheck no Dockerfile, sem plano de backup (SCRUM-149) e sem monitoramento.
7. Federação do Keycloak com o login institucional da UFPE (SCRUM-118) e role/atributo `perfil` mapeados do IdP.
8. Keycloak 18 em `start-dev` e Postgres 14.2 no `docker-compose` são só de desenvolvimento.
9. Os usuários de teste do realm **não podem** existir em produção.

## Código
10. **Exceção à regra de dono das tabelas** (ADR-002): a ordenação por relevância junta `votacao_placar` em SQL. Alternativa sem exceção: colunas desnormalizadas em `iniciativas`.
11. **Ciclo entre módulos** resolvido com `ModuleRef` preguiçoso (ADR-013). Um barramento de eventos (já há `DomainEventPublisher`) poderia desfazer o ciclo.
12. **Lookups em vez de enums** (ADR-001) obrigam o código a manter as constantes TypeScript em sincronia com as migrations (`status`, `tipos`, `periodicidades`, `perfis`).
13. **Atualização de listas por polling** (60 s no início, 30 s no detalhe). Poderia ser SSE ou WebSocket.
14. **Job em todo processo.** Com várias instâncias o `@Cron` roda em todas; é seguro (concorrência otimista), mas redundante.
15. **Bundle do front** acima de 500 kB (FullCalendar e cinnamon). Dividir com `import()` dinâmico nas rotas `/calendario` e no detalhe.
16. **`PageCin`**: o `Footer` da cinnamon abre links em nova aba, então "Privacidade" recarrega a aplicação.
17. **Dependências com versões novas disponíveis:** Prisma 5.22 (existe 8.x), Vitest e outras. Não atualizadas de propósito.

## Documentação e boilerplate
18. `docs-site/` (back e front) é documentação do boilerplate e ainda descreve os módulos de exemplo `task`, `todos` e `team`, já removidos.
19. `docs/RESUMO_TECNICO.md` descreve o estado inicial dos repositórios (boilerplate), não o atual.
20. O banco de testes `BD-SICIN-TEST` não é limpo entre execuções (os testes usam marcadores únicos para não colidir).
