# Arquitetura do Fortune Tiger Simulator

## 1. Visão geral

Aplicação web 100% offline, modular, sem build step obrigatório, executável abrindo
`index.html` em navegador moderno (prioridade: Android). Lógica matemática totalmente
separada da interface gráfica.

## 2. Stack

- HTML5 + CSS3 + JavaScript (ES Modules, sem transpilação).
- Canvas 2D para gráficos do laboratório (ou Chart.js vendido localmente, opcional).
- Persistência: LocalStorage (configurações/saldo) + IndexedDB (histórico/simulações).
- Testes: Node.js built-in test runner (`node:test`) sobre módulos puros de lógica.
- Sem dependências em tempo de execução; bibliotecas opcionais armazenadas em `vendor/`.

## 3. Estrutura de diretórios

```
fortune-tiger-simulator/
├── index.html
├── css/
│   ├── style.css
│   └── game.css
├── js/
│   ├── main.js              # bootstrap e roteamento de telas
│   ├── config.js            # parâmetros experimentais e constantes
│   ├── rng.js               # gerador aleatório (crypto + seeded)
│   ├── symbols.js           # símbodos e paytable
│   ├── reels.js             # distribuição/pesos dos rolos
│   ├── payout.js            # avaliação de linhas e pagamentos
│   ├── game-engine.js       # orquestra rodada, feature, saldo
│   ├── statistics.js        # agregações estatísticas
│   ├── simulator.js         # simulação em lote
│   ├── strategies.js        # estratégias de aposta
│   ├── storage.js           # LocalStorage/IndexedDB
│   ├── charts.js            # gráficos (Canvas)
│   └── ui/
│       ├── game-ui.js
│       ├── lab-ui.js
│       └── audit-ui.js
├── assets/
│   ├── images/
│   └── sounds/
├── vendor/                  # libs locais (ex.: chart.js) — opcional
├── docs/
│   ├── REGRAS_ORIGINAIS.md
│   ├── ARQUITETURA.md
│   └── VALIDACAO_MATEMATICA.md
└── tests/
    ├── rng.test.js
    ├── payout.test.js
    ├── game-engine.test.js
    ├── statistics.test.js
    └── simulator.test.js
```

## 4. Módulos e responsabilidades

### rng.js
- Interface `RNG`: `random()` → [0,1), `nextInt(n)`, `pick(array)`, `seed(value)`.
- Produção: usa `crypto.getRandomValues` (Web Crypto API) — sem semente fixa.
- Testes: Mulberry32/xoshiro128** determinístico por semente, para reprodutibilidade.
- Nunca usar `Math.random()` em produção (baixa qualidade e não auditável).

### symbols.js
- Enumeração de símbodos, paytable (multiplicador por linha).
- Função `isWild(symbol)`.

### reels.js
- Pesos configuráveis por símbodo (`SYMBOL_WEIGHTS`), marcados como experimentais.
- `spinReel(rng)` → símbodo conforme pesos.
- `spinGrid(rng)` → grade 3×3 do jogo principal.
- Durante o Feature: `spinFeatureCell(rng, chosenSymbol)` → chosenSymbol | Wild | blank, com pesos configuráveis.

### payout.js
- `evaluateLines(grid, betPerLine)` → lista de linhas vencedoras e valor total.
- `isFullGridWin(grid)` → boolean (tela cheia).
- `applyFullGridMultiplier(win, isFullGrid)` → win ×10 se aplicável.
- Wild substitui qualquer símbodo.

### game-engine.js
- `playSpin({bet, rng})` → resultado completo: grade, vitórias, pagamento, se acionou Feature, respins, saldo delta.
- Gerencia estado sticky no Feature.
- Garante contabilização única da aposta (desconta uma vez por rodada, inclusive com respins).

### statistics.js
- Agregadores: total apostado, total pago, contagem de rodadas, hits, features, frequência por símbodo, maior prêmio, sequências de vitórias/derrotas, evolução do saldo.

### simulator.js
- Executa N rodadas sem animação, usando exatamente `game-engine.js`.
- Suporta semente, estratégia, callback de progresso.
- Retorna relatório completo.

### strategies.js
- Estratégias: aposta fixa, Martingale (aumentar após perdas), diminuir após vitórias, stop-profit, stop-loss, % do saldo.
- Interface comum `nextBet(state)`.

### storage.js
- Saldo, configurações, histórico, experimentos.
- Exportação CSV/JSON.

### charts.js
- Gráficos em Canvas: evolução do saldo, RTP por quantidade, distribuição de prêmios, frequência.

## 5. Fluxo de uma rodada

1. Desconta a aposta do saldo (uma vez).
2. Gera grade 3×3 do jogo principal (RNG).
3. Avalia se o Feature aciona (probabilidade configurável).
   - Se não: avalia linhas; aplica ×10 se tela cheia; credita prêmio.
   - Se sim: escolhe símbodo regular; substitui a grade por conjunto restrito (chosen/Wild/blank); processa respins sticky; avalia estado final; aplica ×10 se tela cheia; credita prêmio.
4. Registra rodada (grade, aposta, prêmio, feature, saldo).
5. Atualiza estatísticas e UI.

## 6. Persistência

- LocalStorage: saldo, configurações, preferências (som, tema).
- IndexedDB: histórico de rodadas, experimentos de simulação, séries temporais.
- Exportação: CSV (resumo por rodada) e JSON (experimento completo).

## 7. Testabilidade

- Módulos de lógica (`rng`, `symbols`, `reels`, `payout`, `game-engine`, `statistics`, `simulator`, `strategies`) não dependem do DOM.
- Testes unitários com sementes fixas.
- Invariantes verificadas: contabilização de aposta/prêmio, RTP por simulação, reprodutibilidade.

## 8. Segurança e integridade

- Nenhum servidor/API externa em tempo de execução.
- RNG de produção via Web Crypto (não manipulável por sequência artificial).
- Semente fixa apenas em modo de teste/simulação, claramente identificado.
- Código documentado; parâmetros experimentais marcados.

## 9. Laborat�rio (Fase 4)

- js/lab.js: controlador da UI do laborat�rio.
- js/lab-worker.js: Web Worker para simula��es em segundo plano.
- js/charts.js: gr�ficos em Canvas.
- js/strategies.js: estrat�gias e simula��o de sess�es.
- Persist�ncia de experimentos via LocalStorage.
