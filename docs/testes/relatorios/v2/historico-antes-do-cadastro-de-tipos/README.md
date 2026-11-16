# v2: medição anterior (histórico, não é a oficial)

Relatório HTML da v2 (`tests/v2`, 177 testes) rodada no código **antes do cadastro de tipos**
(commit `2c4462f`, 15/11/2026 13:23): 177 de 177 passando, com 80,43% de linhas (411 de 511) e
77,77% de branches (259 de 333). A execução foi reproduzida em 15/11/2026 com os mesmos números;
saída em [`saida-terminal.txt`](saida-terminal.txt).

Esses percentuais vêm só dos 177 testes de `tests/v2`. Os testes de integração
(`test/integration/`, existentes desde a Sprint 2) não entram neles: rodam com outra
configuração e contra o banco.

A **medição oficial** é a de [`../v2.md`](../v2.md), no código da tag `sprint3-parte1-medicao`:
177 / 177, com 66,76% de linhas e 65,27% de branches, no mesmo escopo de 653 linhas da v1.
