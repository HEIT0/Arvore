# Classificação v3

## Estrutura

- `arvore_principal_v3.json`: árvore principal de conteúdo.
- `arvore_habilidades_tecnicas.json`: habilidades técnicas principais pedidas na questão.
- `arvore_auxiliar_v3.json`: filtros auxiliares rasos para recurso, operação e natureza da resposta.
- `metadados_classificacao_v3.json`: metadados de prova e revisão.

## Regras de classificação

- Classifique cada questão com o menor número possível de átomos profundos mas que abranja todos os assuntos da questão focando no que o aluno precisaria saber.
- Nunca atribua manualmente um ancestral se um descendente já foi marcado.
- Se a questão for básica, use o átomo raso correto. Não force profundidade artificial.
- Use `aliases` como base para ajudar a entender cada ramo.
- Não use `/` dentro do nome do nó para sinônimos. Use apenas o id canônico.
- Na árvore de habilidades técnicas, marque apenas o maior rank presente na questão e outros nós do mesmo rank.
- Se aparecer uma habilidade de rank mais alto, descarte as de rank mais baixo. Exemplo: se houver `Logaritmo` e `Operações Básicas`, marque apenas `Logaritmo`.
- Os descendentes da árvore técnica herdam o rank do ancestral de primeiro nível logo abaixo da raiz.
- `Operações Básicas` só entra como fallback quando nenhuma habilidade de rank superior se aplica e a questão realmente depende de conta aritmética básica.
- `Conceitual` só entra quando não houver nenhuma habilidade técnica relevante acima e a questão for basicamente conceitual, qualitativa sem envolver números e operações apenas conceitos ou interpretação gráfica e textual.

## Rank de habilidades técnicas

- Rank 1: `Análise de Dados`, `Cálculo`, `Iteração`,`Vetores`
- Rank 2: `Geometria`, `Logaritmo`
- Rank 3: `Aproximações`, `Análise Dimensional`
- Rank 4: `Operações Básicas`
- Rank 5: `Conceitual`

## Level
A classificação de level de questão deve ser feita com base na origem da questão assim:
- OBA no geral é nivel 0
- P1 P2 e P3 no geral é nível 1
- TSA no geral é nível 2
- Treinamentos no geral é nível 3
- Treinamentos mais avançado no geral é nível 4



## Notas de modelagem

- `Análise de Dados` foi promovida para a árvore principal.
- `Física Básica` e `Fundamentos e Métodos Quantitativos` foram promovidos para absorver questões introdutórias sem criar improvisos.
- `Movimento Celeste` foi absorvido por `Movimento Aparente do Céu`.
- `Objetos do Sistema Solar` foi absorvido por `Corpos do Sistema Solar`.
- `Gráfico`, `Tabela`, `Imagem` e `Interpretação` deixam de competir com o assunto principal e passam para a árvore auxiliar.

## Fluxo recomendado

1. Testar a v3 em 100 a 150 questões.
2. Anotar casos de ambiguidade real.
3. Ajustar a árvore principal uma única vez.
4. Só então classificar o banco inteiro.
