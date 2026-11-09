| Requisito / critério de aceitação | Variável | Partição ou limite | Caso de teste esperado | Coberto pela v1? | Coberto pela v2? |
| submeter uma iniciativa completa | carateristicas da iniciativa ( mudança: proposta = título, ...) | Algum criterio nao preenchido | criterio nao preenchido -> erro (preencha todos os campos) | | |
| submeter uma iniciativa com data invalida | data da iniciativa | data anterior a data prevista de analize da iniciativa | data anterior a prevista para analise -.> erro (coloque uma data valida) | | |
| submeter uma iniciativa com local invalido | local | local nao pertencente ao CIn | local nao pertencente ao CIn -> erro (coloque um local valido) | | |
| submeter uma iniciativa com tipo invalido | tipo de iniciativa | tipo incoerrente | tipo incoerrente -> erro (coloque um tipo valido) | | |
| Após submissão, iniciativa atualiza no painel de status das propostas | submeter proposta | algum critério não preenchido ou submeter proposta não apertado | submeter proposta -> atualiza status no painel das propostas | | |
| Aprovação da iniciativa mediante aprovação do avaliador | análise do avaliador | avaliação positiva | aprovação positiva -> aparece aprovado para todos | | |
| Após aprovação da iniciativa, atualiza no calendário das iniciativas na data determinada | aprovação | reprovação/ avaliação negativa | aprovação positiva -> atualiza calendário das iniciativas | | |
| Iniciativa entrar em edição para criador após ser reprovada | análise do avaliador | avaliação negativa | aprovação negativa -> aparece para ser editado e ajustado pelo criador | | |
| Recusa edições de propostas sem modificações | carateristicas da iniciativa ( mudança: proposta = título, ...) | proposta igual à anterior | edição de proposta sem modificações -> erro "proposta identica" | | |
| Após edição, submete proposta | carateristicas da iniciativa ( mudança: proposta = título, ...) | Algum criterio nao preenchido | submeter proposta -> "Proposta submetida" | | |
| Após avaliada, iniciativa atualiza no painel de status da proposta | análise do avaliador | Se não existir análise | avaliação -> atualiza status no painel de propostas | | |
| A iniciativa não ficar mais disponivel para avaliação após ter sido avaliada | análise do avaliador | Se existir análise | análise de iniciativa -> a iniciativa não pode mais ser avaliada | | |
| comentario vazio em uma iniciativa | comentario | comentario vazio | comentario vazio -> erro (escreva algo) | | |
| comentario em uma iniciativa | comentario | comentario valido | comentario valido -> aparece na aba de comentarios | | |
| comentar em uma iniciativa fora do periodo valido | fase atual da iniciativa | fase nao permite comentarios | tentativa de comentario -> erro (nao e possivel comentar) | | |
| comentar em uma iniciativa que nao permite comentarios | caracteristica da iniciativa: poder ter comentarios publicos | Se existir comentario | tentativa de comentario -> erro (nao e possivel comentar) | | |	
