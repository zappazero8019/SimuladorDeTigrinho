# Arquitetura do Fortune Tiger Simulator

## 1. Visão geral

Aplicação web 100% offline, modular e sem build step obrigatório. A interface é
executada no navegador a partir de `index.html`; a lógica matemática fica em módulos
ES independentes do DOM. O projeto também inclui um laboratório estatístico no próprio
navegador e um harness de auditoria A/B/C executado por linha de comando com Node.js.

Há quatro camadas distintas:

1. **Aplicação de jogo** — `index.html`, `js/main.js` e módulos de interface. Mantém a
   carteira fictícia, o histórico e a persistência local.
2. **Motor matemático** — geração da grade, avaliação de linhas, Feature, multiplicador
   ×10 de tela cheia e cap interno do motor.
3. **Simulador e laboratório** — simulação em lote sem interface e painéis estatísticos
   executados no navegador, inclusive em Web Worker.
4. **Ferramenta de auditoria** — `tools/audit-abc.mjs`, executado por Node.js, que lê os
   contratos do motor sem alterar a aplicação.

## 2. Stack e execução

- HTML5, CSS3 e JavaScript com ES Modules, sem transpilação.
- Canvas 2D para os gráficos do laboratório e da carteira.
- Persistência exclusivamente local via `localStorage`.
- Nenhuma dependência externa em tempo de execução.
- Testes com o runner nativo do Node.js (`node:test`).
- Servidor estático opcional de desenvolvimento: `server.cjs`, na porta 8080.

Para executar a aplicação:

```bash
node server.cjs
# http://localhost:8080/
```

Abrir `index.html` diretamente também funciona em navegadores que permitem módulos ES
a partir de `file://`; servir a pasta evita restrições de CORS de alguns navegadores.

## 3. Estrutura real de diretórios

```
.
├── index.html                 # interface da aplicação
├── css/
│   ├── style.css
│   └── game.css
├── js/
│   ├── audio.js
│   ├── charts.js
│   ├── config.js
│   ├── effects.js
│   ├── experimental-multipliers.js
│   ├── game-engine.js
│   ├── lab.js
│   ├── lab-worker.js
│   ├── main.js
│   ├── payout.js
│   ├── reels.js
│   ├── rng.js
│   ├── rng-provider.js
│   ├── round-settlement.js
│   ├── simulator.js
│   ├── statistics.js
│   ├── storage.js
│   ├── strategies.js
│   ├── symbols.js
│   ├── ui.js
│   └── wallet.js
├── assets/symbols/            # SVGs dos símbolos
├── tests/                     # 22 arquivos de teste
├── tools/
│   └── audit-abc.mjs          # harness independente de auditoria A/B/C
├── docs/
├── server.cjs
├── package.json
├── LICENSE
└── README.md
```

Não existem, na implementação atual, diretórios `js/ui/`, `vendor/`, `assets/images/`
ou `assets/sounds/`. A interface está concentrada em `js/ui.js` e nos módulos de
efeitos, áudio, gráficos e laboratório.

## 4. Módulos e responsabilidades

### 4.1 Configuração e motor matemático

#### `config.js`
- `GAME_CONSTANTS`: 3 rolos, 3 linhas, 5 paylines, 10.000 créditos iniciais,
  `MAX_WIN_MULTIPLIER = 2500` e `FULL_GRID_MULTIPLIER = 10`.
- `PAYLINES`: as 5 linhas de uma grade 3×3 (três horizontais e duas diagonais).
- `DEFAULT_EXPERIMENTAL_WEIGHTS` e `DEFAULT_FEATURE_CONFIG`: pesos e probabilidade de
  acionamento da Feature marcados como experimentais.
- `EXPERIMENTAL_PROFILE` e `REFERENCE_PROFILE`, ambos com `enforceMaxWin: true`.
- `getProfile(id)`: devolve o perfil `experimental` ou `reference`; erro para id inválido.

Os pesos não são oficiais. A probabilidade de acionamento da Feature é `0,0099`
(0,99%) por rodada nos dois perfis.

#### `symbols.js`
- `SYMBOLS`: Wild, Ingot, Charm, Bag, Envelope, Firecracker e Orange, com os
  multiplicadores de linha da paytable.
- `REGULAR_SYMBOLS`: todos os símbolos exceto Wild.
- `BLANK = null`: posição vazia usada apenas durante a Feature.
- `getSymbol(id)` e `isWild(symbolOrId)`.

Os pagamentos de linha são expressos em unidades da aposta por linha. A paytable e a
mecânica são parâmetros do simulador; os pesos de distribuição são experimentais.

#### `reels.js`
- `spinGrid(rng, weights)`: gera a grade 3×3 do jogo principal por sorteio ponderado.
- `chooseFeatureSymbol(rng, weights)`: escolhe um símbolo regular para a Feature.
- `spinFeatureCell(rng, chosenSymbolId, cellWeights)`: sorteia `chosen`, `WILD` ou
  `null` (blank) para uma célula da Feature.
- `spinFeatureGrid(rng, chosenSymbolId, cellWeights)`: monta a grade inicial da Feature.

#### `payout.js`
- `evaluateLine(grid, line, betPerLine)`: avalia uma linha; Wild substitui o símbolo
  base e blanks invalidam a linha.
- `evaluateGrid(grid, betPerLine)`: devolve `lineWins`, `totalWin` e `fullGrid`.
- `isFullGridWin(grid)`: tela cheia quando não há blanks e todas as células são o mesmo
  símbolo ou Wild.
- `applyFullGridMultiplier(totalWin, isFullGrid, multiplier)`: aplica ×10 quando a grade
  está completa.
- `capWin(totalWin, bet, maxMultiplier)`: cap interno do motor, limitado a
  2.500× a aposta.

#### `game-engine.js`
- `runFeature(rng, config)`: executa a Feature completa com símbolo escolhido, grade
  restrita a `chosen`/Wild/blank, respins sticky e trava de segurança de 100 respins.
  Retorna `{ chosenSymbol, grid, respins }`.
- `playSpin({ bet, rng, config, balance })`: executa uma rodada e devolve o resultado
  completo (grade, Feature, vitórias de linha, tela cheia, `totalWin`, `hit`, saldos).

O motor não debita nem credita a carteira. A aplicação calcula o saldo; quando
`balance` é fornecido, `playSpin()` também devolve `balanceAfter` como referência.

#### `rng.js`
- `createRng(seed)`: sem semente, usa `crypto.getRandomValues` (Web Crypto API); com
  semente, usa Mulberry32 determinístico.
- Interface comum: `random()`, `nextInt(n)`, `pick(items)` e
  `pickWeighted(entries, weightFn)`.
- `createSeededRng(seed)` e `createCryptoRng()` são atalhos.

O RNG de produção não é semeável pela interface. Sementes fixas são usadas em testes,
simulações e auditorias.

### 4.2 Multiplicadores experimentais e liquidação

#### `experimental-multipliers.js`
- `EXPERIMENTAL_MULTIPLIERS`: ×2, ×5, ×10 e ×50.
- `EXPERIMENTAL_MULTIPLIER_CONFIG`: ativação com probabilidade `0,05` e pesos
  `{ 2: 40, 5: 30, 10: 20, 50: 10 }`.
- `drawExperimentalMultiplier(rng, config)`: sorteia a ativação e, se ativa, o
  multiplicador. Retorna `1` quando não há ativação.
- `applyWinCap(winCents, betCents)`: cap experimental final de 2.500× a aposta, em
  centavos.
- `toCents(value)` e `fromCents(cents)`: conversões monetárias.

Esse módulo é independente do motor. Não altera símbolos, paytable, pesos, Feature ou
probabilidades do jogo-base.

#### `rng-provider.js`
- `createRngPair({ baseSeed, expSeed })`: cria duas instâncias separadas de `createRng`,
  uma para o motor-base e outra para os multiplicadores experimentais.

A independência é garantida por instâncias distintas: consumir o RNG experimental não
altera a sequência do RNG base. O módulo é usado pelo harness de auditoria e pelos
testes; **ainda não está integrado ao `main.js`**.

#### `round-settlement.js`
- `settleRoundWin({ baseWinCents, betCents, multiplier, applyExperimentalCap })`:
  liquida uma rodada exclusivamente em centavos inteiros.
- `canSettleRoundWin({ baseWinCents, betCents, multiplier })`: verifica, sem lançar
  exceção, se os valores atendem ao domínio estrito — inteiros seguros,
  `baseWinCents >= 0`, `betCents >= 1`, `multiplier >= 1`, `betCents × 2500` e
  `baseWinCents × multiplier` dentro de `Number.MAX_SAFE_INTEGER`.

O prêmio recebido como `baseWinCents` já contém linhas, ×10 de tela cheia e o cap interno
do motor. A função multiplica pelo multiplicador experimental e, quando
`applyExperimentalCap` é `true`, aplica somente o cap experimental final de 2.500×.
Quando é `false`, o cap experimental final é ignorado, mas o cap interno permanece no
prêmio-base. Retorna `multipliedCents`, `capCents`, `finalCents` e `capApplied`.

Desde a Etapa 9, o `main.js` usa `canSettleRoundWin()` antes de `settleRoundWin()`.
Quando o domínio é válido, a liquidação é feita pela função; fora dele — apostas
sub-centavo ou valores acima da faixa segura — o fluxo usa a fórmula legada
`applyWinCap(baseWinCents × multiplier, betCents)`, preservando o comportamento anterior
sem lançar exceção. O harness de auditoria continua usando apenas o caminho estrito.

### 4.3 Aplicação, carteira e interface

#### `main.js`
- Inicializa o estado, a interface, os eventos, o Auto apostar e o laboratório.
- Mantém `state` com saldo, aposta, perfil, preferências, histórico, transações,
  sessões, totais e linha de base do resultado operacional.
- `performSpin(bet, isAuto)` executa uma rodada completa:
  1. lê o perfil selecionado;
  2. sorteia o multiplicador experimental antes do giro, com um adaptador local baseado
     em `Math.random()` (portanto independente do RNG do motor);
  3. cria o RNG do motor com `createRng()` e chama `playSpin()`;
  4. renderiza grade, Feature e animações;
  5. converte `result.totalWin` e a aposta para centavos;
  6. verifica o domínio com `canSettleRoundWin()`;
  7. quando válido, liquida com `settleRoundWin()`; caso contrário, usa
     `applyWinCap(baseWinCents × multiplier, betCents)` como fallback legado;
  8. converte o prêmio final para reais e captura `balanceBefore` antes de atualizar o
     saldo;
  9. calcula o saldo, registra a rodada, atualiza totais e persiste;
  10. descarta o multiplicador ao final da rodada.
- `doSpin()` valida aposta e saldo e controla o botão GIRAR com `try/finally`.
- O Auto apostar usa o mesmo `performSpin`, com pausa, parada manual, stop-profit,
  stop-loss e intervalo configurável.

O `main.js` ainda usa um adaptador de RNG baseado em `Math.random()` para o sorteio
experimental, em vez de `rng-provider.js`. A separação em relação ao RNG do motor é
mantida, mas o sorteio experimental da aplicação não é reproduzível por semente.

#### `wallet.js`
- `formatBRL`, `toCents`, `fromCents`, `addCredits`, `subtractCredits`.
- `resultCents(totalBet, totalWin)`: resultado operacional em centavos.
- `resultKind(cents)`: `profit`, `loss` ou `even`.
- `canPlaceBet(balance, bet)`.
- `resultCentsWithBaseline(...)`: resultado considerando a linha de base do indicador.

#### `storage.js`
- `loadState()`: lê a chave `fts_state` do `localStorage`.
- `saveState(state)`: grava a mesma chave.
- `clearState()`: remove a chave.
- Toda leitura e escrita é protegida por `try/catch`.

#### `ui.js`
- `GameUI`: renderiza grade, destaques de linhas, overlay da Feature, popup de prêmio,
  multiplicador ×10 e estado de giro.
- `SYMBOL_DISPLAY` e `symbolCell(sym)`: mapeamento visual dos símbolos.

#### `effects.js`
- `WIN_LEVELS`, `WIN_TIERS`, `classifyWin(multiplier)` e `levelName(level)`.
- `EffectsController`: comemorações por faixa de prêmio e respeito a
  `prefers-reduced-motion`.

#### `audio.js`
- Tons e efeitos sonoros sintetizados com Web Audio API; não usa arquivos de áudio.

#### `charts.js`
- `drawLineChart(canvas, series, options)` e `drawBarChart(canvas, labels, values,
  options)` em Canvas 2D.
- `clearCanvas(canvas)`.

### 4.4 Simulação, estatística e laboratório

#### `simulator.js`
- `simulate({ spins, bet, config, seed, onProgress })`: executa N rodadas sem animação,
  usando exatamente `playSpin()`.
- Mantém saldo inicial interno de `1e12`, acumula apostas, prêmios, hits, Features,
  telas cheias, sequências, histograma e contagem de símbolos.
- Retorna totais, RTP, taxas, decomposição base/Feature e séries para gráficos.
- Não aplica o multiplicador experimental; simula o motor-base.

#### `strategies.js`
- `STRATEGY_LIST` e `nextBet(strategy, ctx)` com as estratégias `fixed`, `martingale`,
  `progressive`, `decrease-after-win` e `percent-balance`.
- `runSession(...)` e `runSessionsBatch(...)`: sessões de aposta com stop-profit,
  stop-loss e ruína.
- `generateSpinSequence(...)` e `runSessionCRN(...)`: sequências compartilhadas para
  comparação de estratégias com números aleatórios comuns (CRN).

As estratégias `stop-profit` e `stop-loss` aparecem em `STRATEGY_LIST`, mas são aplicadas
como parâmetros de sessão em `runSession`, não como ramos de `nextBet`.

#### `statistics.js`
- `mean(arr)`, `stddev(arr)` e `confidenceInterval95(meanVal, sd, n)`.
- Usado como utilitário estatístico; o laboratório possui cálculos próprios para
  intervalos com t de Student.

#### `lab.js`
- `LabController`: controla a tela do laboratório.
- Executa simulações em Web Worker (`lab-worker.js`) com progresso e cancelamento.
- Executa análise de risco, comparação de estratégias por CRN e comparação de pesos.
- Desenha gráficos e exporta JSON/CSV.
- Salva até 20 experimentos na chave `fts_experiments` do `localStorage`.

#### `lab-worker.js`
- Web Worker de módulo.
- Recebe `run-simulation` ou `run-sessions`, executa `simulate()` ou
  `runSessionsBatch()` e devolve progresso e resultados por `postMessage`.

### 4.5 Ferramenta de auditoria

#### `tools/audit-abc.mjs`
- Harness independente executado por Node.js; não usa DOM nem `localStorage`.
- Importa `EXPERIMENTAL_PROFILE`, `playSpin`, `drawExperimentalMultiplier`,
  `createRngPair` e `settleRoundWin`.
- Chama `playSpin()` uma única vez por rodada e reutiliza o mesmo resultado-base nos
  cenários A, B e C.
- Sorteia o multiplicador experimental uma única vez por rodada e o reutiliza em B e C.
- Mantém RNGs base e experimental independentes e não sorteia o RNG experimental quando
  apenas o cenário A é solicitado.
- Calcula hashes SHA-256 em streaming, sem armazenar arrays de 10 milhões de elementos.
- Emite JSON no `stdout` e só grava arquivo com `--out`.
- Não altera pesos, probabilidades, caps, paytable ou qualquer módulo da aplicação.

## 5. Fluxo de uma rodada

### 5.1 Fluxo da aplicação (`main.js`)

1. O jogador informa a aposta; `canPlaceBet()` valida valor e saldo.
2. `performSpin()` lê o perfil e sorteia o multiplicador experimental da rodada.
3. O RNG do motor é criado com `createRng()`; sem semente, usa Web Crypto.
4. `playSpin()` decide se a Feature aciona:
   - **sem Feature:** gera a grade 3×3 com os pesos do perfil;
   - **com Feature:** escolhe um símbolo regular, gera a grade restrita e processa
     respins sticky até completar a grade ou não surgirem novas células travadas.
5. `evaluateGrid()` avalia as 5 linhas. Wild substitui o símbolo base; blanks invalidam
   a linha.
6. Se a grade estiver completa, `applyFullGridMultiplier()` aplica ×10.
7. Se `config.enforceMaxWin` for `true`, `capWin()` aplica o cap interno de 2.500× a
   aposta.
8. `playSpin()` arredonda `totalWin` para 2 casas e devolve o resultado.
9. `main.js` converte o prêmio-base e a aposta para centavos inteiros.
10. `canSettleRoundWin()` verifica o domínio seguro.
11. Quando válido, `settleRoundWin()` aplica o multiplicador experimental e o cap
    experimental final em centavos. Fora do domínio estrito, é usada a fórmula legada
    equivalente.
12. `balanceBefore` é capturado antes da atualização do saldo; o prêmio final é
    convertido de volta para reais, o saldo é atualizado e a rodada é registrada no
    histórico.
13. Totais, indicadores, gráficos e `localStorage` são atualizados.
14. O multiplicador experimental é descartado; ele não persiste entre rodadas.

### 5.2 Contrato de `playSpin()`

Entrada:

```js
playSpin({ bet, rng, config, balance })
```

- `bet`: aposta total da rodada, em reais, finita e maior que zero.
- `rng`: objeto com `random()`.
- `config`: perfil com `weights`, `feature` e `enforceMaxWin`.
- `balance`: saldo inicial opcional, usado apenas para calcular `balanceAfter`.

Saída:

- `bet`, `balanceBefore`, `balanceAfter`;
- `grid`, `featureTriggered`, `feature` (`chosenSymbol`, `grid`, `respins`);
- `lineWins`, `fullGrid`;
- `totalWin` (em reais, já com ×10 e cap interno quando aplicável);
- `hit` (`totalWin > 0`).

O motor não mantém estado entre rodadas. A aposta é debitada conceitualmente uma única
vez pela aplicação, mesmo quando a Feature executa vários respins.

## 6. Separação entre RNG base e experimental

Há duas sequências aleatórias distintas:

- **RNG base:** usado por `playSpin()` para decidir Feature, símbolos, células e respins.
- **RNG experimental:** usado por `drawExperimentalMultiplier()` para decidir a ativação
  e o valor do multiplicador.

Na aplicação, o RNG base vem de `createRng()` e o experimental usa um adaptador local
com `Math.random()`. Consumir o multiplicador não desloca a sequência do motor.

No harness, `createRngPair({ baseSeed, expSeed })` cria duas instâncias independentes de
`createRng`; cada uma tem sua própria semente. O multiplicador é sorteado uma vez por
rodada e reutilizado em B e C. Quando apenas A é selecionado, nenhum sorteio experimental
é feito.

## 7. Liquidação em centavos

A liquidação evita acumular erros de ponto flutuante:

- `playSpin()` devolve `totalWin` em reais, arredondado a 2 casas.
- A aplicação converte para centavos inteiros uma única vez com `toCents()`.
- O multiplicador experimental é aplicado em centavos inteiros por `settleRoundWin()`;
  fora do domínio estrito, o fluxo usa a fórmula legada.
- `applyWinCap()` compara o valor com `betCents × 2500` e só reduz quando o valor excede
  o limite; é reutilizado por `settleRoundWin()` e pelo fallback.
- O resultado final é convertido para reais com `fromCents()` apenas para exibição e
  crédito na carteira.

O harness usa `settleRoundWin()`, que recebe o prêmio-base já em centavos e devolve
`multipliedCents`, `capCents`, `finalCents` e `capApplied`. Não há conversão para reais
nem arredondamento dentro da liquidação. Desde a Etapa 9, a aplicação também usa a mesma
função, precedida por `canSettleRoundWin()` no fluxo de `main.js`.

### 7.1 Cap interno do motor

- Implementado por `payout.capWin()`.
- Aplicado dentro de `playSpin()` quando `config.enforceMaxWin` é `true`.
- Limite: `bet × 2500`.
- Incide sobre o prêmio do motor-base, antes do multiplicador experimental.
- Está ativo nos perfis `experimental` e `reference` e nos três cenários da auditoria.

### 7.2 Cap experimental final

- Implementado por `experimental-multipliers.applyWinCap()`.
- Aplicado depois do multiplicador experimental.
- Limite: `betCents × 2500`, em centavos.
- É adicional e independente do cap interno.
- Na aplicação, é sempre aplicado no fluxo de `main.js`.
- No harness, é aplicado em B e desativado apenas em C; o cap interno continua ativo
  em A, B e C.

### 7.3 Saldo anterior (`balanceBefore`)

- `main.js` captura `balanceBefore` antes de atualizar `state.balance` (correção da
  Etapa 8).
- Registros novos armazenam corretamente o saldo anterior à rodada, além de
  `balanceAfter` e `net`.
- Registros antigos do histórico não são reconstruídos automaticamente: permanecem com
  o valor gravado pela versão anterior e não são normalizados na leitura nem na
  persistência.

## 8. Persistência real

A persistência é exclusivamente local, via `localStorage`. Não há IndexedDB, banco de
dados, backend, API externa ou sincronização remota.

### Chave `fts_state`

Gravada por `storage.js` a partir de `main.js`:

- `balance`, `bet`, `profileId`;
- `sound`, `animations`;
- `history` (até 200 rodadas);
- `transactions` (até 200 lançamentos);
- `sessions` (até 50);
- `totals` (apostas e prêmios acumulados);
- `resultBaseline` (linha de base do indicador operacional).

### Chave `fts_experiments`

Gravada diretamente por `lab.js`:

- até 20 experimentos do laboratório;
- cada item contém data e o último conjunto de resultados.

Exportações de histórico, estatísticas e experimentos são feitas por download de
arquivos JSON/CSV gerados no navegador; elas não são persistidas automaticamente.

## 9. Aplicação, simulador, laboratório e auditoria

| Camada | Arquivos principais | Persistência | Usa interface | Multiplicador experimental |
|---|---|---|---|---|
| Aplicação de jogo | `main.js`, `ui.js`, `effects.js`, `audio.js` | `fts_state` | Sim | Sim, sorteado por rodada |
| Simulador em lote | `simulator.js` | Nenhuma | Não | Não |
| Laboratório | `lab.js`, `lab-worker.js` | `fts_experiments` | Sim | Não |
| Auditoria A/B/C | `tools/audit-abc.mjs` | Nenhuma | Não | Sim, nos cenários B e C |

O simulador e o laboratório reutilizam o mesmo `playSpin()` da aplicação, mas não
aplicam o multiplicador experimental. O harness de auditoria também reutiliza
`playSpin()`, porém liquida os cenários separadamente com `settleRoundWin()` e não
integra seus resultados à aplicação.

## 10. Testes

Os testes usam `node:test` e não dependem de navegador nem de dependências externas.
A suíte completa é executada com:

```bash
npm.cmd test
# equivalente a: node --test "tests/**/*.test.js"
```

Arquivos atuais em `tests/`:

- `accounting.test.js`
- `audit-abc.test.js`
- `effects.test.js`
- `effects-extra.test.js`
- `experimental-multipliers.test.js`
- `game-engine.test.js`
- `main-balance-before.test.js`
- `operational-result.test.js`
- `operational-result-detail.test.js`
- `payout.test.js`
- `reels.test.js`
- `rng.test.js`
- `rng-provider.test.js`
- `round-settlement.test.js`
- `settlement-integration.test.js`
- `simulator.test.js`
- `simulator-extra.test.js`
- `statistics.test.js`
- `strategies.test.js`
- `symbols.test.js`
- `ui-structure.test.js`
- `wallet.test.js`

A suíte cobre módulos puros, contratos do motor, multiplicadores, liquidação em
centavos, independência de RNGs, o harness A/B/C e a estrutura mínima da interface.
Referência atual: **166 testes aprovados**, confirmados em 2026-11-10, incluindo a
correção de `balanceBefore` (Etapa 8) e a integração de `settleRoundWin()` com fallback
legado (Etapa 9).

Evidências de equivalência da integração:

- corpus de **455 combinações** da auditoria: zero divergências de centavos, com 70 casos
  atendidos pelo fallback legado;
- fluxo CRN real de **550.000 rodadas** (11 apostas × 50.000): zero divergências;
- **auditoria ABC de 10.000.000 de rodadas**: hashes das sequências e métricas RTP
  idênticos ao baseline registrado em `docs/AUDITORIA_ABC.md`.

## 11. Limitações e natureza experimental

- Os pesos, a probabilidade de Feature e a distribuição dos multiplicadores são
  parâmetros experimentais do simulador; não são valores oficiais confirmados.
- O RTP emerge desses parâmetros e pode ficar acima ou abaixo de 100%.
- Os cenários da auditoria são reproduzíveis apenas para as sementes e a implementação
  auditadas.
- A aplicação não usa semente fixa para o RNG do motor nem para o multiplicador
  experimental; cada sessão no navegador é não determinística.
- `rng-provider.js` não está integrado ao fluxo da aplicação; é usado pelo harness e
  pelos testes. `round-settlement.js` está integrado ao `main.js` desde a Etapa 9, com
  fallback legado fora do domínio estrito.
- Registros antigos do histórico mantêm o `balanceBefore` gravado pela versão anterior e
  não são reconstruídos nem normalizados automaticamente; apenas as rodadas novas usam a
  captura corrigida da Etapa 8.
- Não há serviço de backend, conta de usuário, pagamento, premiação real ou telemetria.

## 12. Segurança e integridade

- Nenhum servidor ou API externa em tempo de execução.
- RNG de produção via Web Crypto API, sem semente controlável pela interface.
- Sementes fixas apenas em testes, simulações e auditorias.
- Nenhum código proprietário de terceiros.
- Parâmetros experimentais separados dos parâmetros de mecânica confirmada.
- A auditoria não modifica o motor nem os parâmetros; apenas observa os contratos
  existentes e registra os resultados.
