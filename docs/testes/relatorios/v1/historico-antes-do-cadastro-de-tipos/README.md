# v1: medição anterior (histórico, não é a oficial)

Relatório HTML da v1 rodada no código **antes do cadastro de tipos** (commit `2c4462f`, 15/11/2026
13:23): 80 testes, 76 passando e 4 falhando, com 46,37% de linhas (237 de 511) e 40,84% de
branches (136 de 333). Saída do terminal: [`saida-terminal.txt`](saida-terminal.txt).

Fica guardado porque mostra a origem da 5ª falha da medição oficial: o teste do tipo "OUTRO"
passava antes do cadastro de tipos e passou a falhar depois dele, sem nenhuma mudança na v1.

A **medição oficial** é a de [`../v1.md`](../v1.md), no código da tag `sprint3-parte1-medicao`:
80 / 75 / 5 / 0, com 39,35% de linhas e 34,72% de branches. Os percentuais caem porque o escopo
medido cresceu de 511 para 653 linhas (cadastro de tipos e alteração de datas), não porque a v1
mudou.
