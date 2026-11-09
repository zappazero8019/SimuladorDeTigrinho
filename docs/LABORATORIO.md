# Laboratório Estatístico — Fortune Tiger Simulator

## Visão geral

O laboratório executa simulações em massa utilizando exatamente o mesmo motor matemático do jogo manual (`js/game-engine.js` via `js/simulator.js`).

## Funcionalidades

- Seleção de quantidade de rodadas (1k a 10M + personalizado).
- Configuração de aposta, saldo inicial, perfil, semente e número de experimentos.
- Execução em Web Worker (sem bloquear a interface).
- Progresso e cancelamento.
- Indicadores completos (RTP, hit rate, Feature, etc.).
- Gráficos: evolução do saldo, histograma de prêmios, frequência de símbodos.
- Análise de risco por sessões (probabilidade de lucro, ruína, perdas de 25/50/75%).
- Comparação de estratégias.
- Exportação CSV/JSON e salvamento local.

## Reprodutibilidade

Sementes fixas garantem resultados idênticos. Múltiplos experimentos permitem intervalos de confiança.

## Limitações

- RTP teórico é estimativa Monte Carlo quando não calculável analiticamente.
- Intervalos normais aproximados; para caudas pesadas recomenda-se mais experimentos.
- Pesos experimentais não são oficiais.