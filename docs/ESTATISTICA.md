# Métodos Estatísticos — Fortune Tiger Simulator

## Métricas

- RTP observado = (Total pago / Total apostado) × 100.
- Vantagem da casa = 100% − RTP teórico configurado.
- Hit rate = rodadas com prêmio / total.
- Erro padrão = σ / √N.
- IC 95% = média ± 1,96 × EP (quando aplicável).

## Análise de risco

Probabilidades empíricas obtidas por simulação de sessões independentes:
- P(lucro), P(ruína), P(perda ≥ 25/50/75%).

## Estratégias

A estratégia não altera a vantagem matemática por unidade apostada; altera variância, duração e probabilidade de encerrar uma sessão com lucro.

## Limitações

- Pagamentos extremos (até 2.500×) geram caudas pesadas.
- Intervalos normais podem ser inadequados para amostras pequenas.
- Resultados dependem dos pesos experimentais.
## Corre��es da Fase 4.1

- IC95% utiliza t de Student entre replica��es independentes; para 1 replica��o � exibido como indispon�vel.
- Estrat�gias comparadas com Common Random Numbers.
- RTP acumulado utilizado nos gr�ficos.
- House edge experimental calculado como 100 - RTP estimado.
