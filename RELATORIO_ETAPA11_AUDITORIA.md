# Etapa 11 — Auditoria Histórica e Diagnóstico de Conclusão
## Projeto Tigrinho (Fortune Tiger Simulator)

**Tipo:** exclusivamente auditoria read-only (diagnóstico). Nenhum arquivo, dado, registro, RNG, probabilidade, pagamento, cap ou histórico foi modificado, normalizado, corrigido ou refatorado. Nenhuma operação Git destrutiva, commit, push ou publicação foi executada.

**Estado de referência:** 166 testes aprovados (`npm.cmd test`); 550.000 rodadas CRN sem divergência; Auditoria ABC de 10 milhões de rodadas com hashes idênticos ao baseline.

**Branch/commit:** `main`, `HEAD == origin/main == 410c3d862469b282eb48b3831ace3f8c2267b8d8`. Sem commits/push.

**Alterações não commitadas preservadas:** `M README.md`, `M docs/ARQUITETURA.md`, `M js/main.js`, `M package.json`; untracked `docs/AUDITORIA_ABC.md`, `js/rng-provider.js`, `js/round-settlement.js`, `tests/audit-abc.test.js`, `tests/main-balance-before.test.js`, `tests/rng-provider.test.js`, `tests/round-settlement.test.js`, `tests/settlement-integration.test.js`, `tools/`.

---

## 1. Resultado da Auditoria Histórica

### 1.1 Estrutura dos registros de histórico

O histórico é mantido em `state.history` (array) e persistido em `localStorage` (`fts_state`), fatido a **200** registros (`slice(0, 200)`) tanto em `persist()` (main.js:132) quanto em `renderHistory()` (main.js:186). Cada rodada insere no topo via `state.history.unshift(roundRecord)` (mais recente primeiro).

Campos de um registro (regime atual, commit `410c3d8`):

| Campo | Origem / preenchimento |
|---|---|
| `t` | `Date.now()` (timestamp da rodada) |
| `n` | `state.history.length + 1` (sequencial) |
| `bet` | `state.bet` (aposta da rodada) |
| `win` | `finalWin` (prêmio após multiplicador experimental e caps) |
| `net` | `finalWin - state.bet` |
| `balanceBefore` | `state.balance` capturado na linha 286 |
| `balanceAfter` | `Math.round((state.balance - bet + finalWin) * 100) / 100` (linha 290) |
| `feature` | `result.featureTriggered` |
| `fullGrid` | `result.fullGrid` |
| `auto` | `isAuto` (booleano) |
| `experimentalMultiplier` | `currentMultiplier > 1 ? currentMultiplier : null` (apenas no regime `410c3d8`) |

Transações associadas (`state.transactions`, também limitado a 200): `{ t, type: 'round', amount: net }`.

### 1.2 Dois regimes de `balanceBefore` (registros misturados)

Investigação do Git (`git log -S balanceBefore -- js/main.js`):

- **Commits `322ba32`, `0bd258d`, `b2a7740` (anteriores a `410c3d8`):** `balanceBefore: result.balanceBefore`, onde `result.balanceBefore` vem de `playSpin()` e é capturado **antes** da atualização do saldo. Correto.
- **Commit `410c3d8` (HEAD):** `state.balance = balanceAfter;` executo na **linha 282**, e apenas depois `balanceBefore: state.balance` na **linha 289**. Resultado: `balanceBefore === balanceAfter` para todos os registros gravados por este regime (defeito).

O comentário do código (linha 285) afirma que `balanceBefore` é "capturado antes da atualização", mas a ordem das instruções na prática inverte isso. Logo, o histórico contém registros de **dois regimes misturados**: uns com `balanceBefore` correto, outros com `balanceBefore == balanceAfter`.

### 1.3 Relação entre `balanceBefore`, `balanceAfter`, `bet` e `net`

Para registros do regime correto e para o cálculo do saldo em `renderStats`:

```
balanceAfter = balanceBefore - bet + win   (ou finalWin)
net          = win - bet
balanceAfter = balanceBefore + net
```

A invariante contábil `balanceAfter = balanceBefore + net` é coberta por `tests/main-balance-before.test.js` para valores cent-alinhados (ex: 100/1/0, 100/1/2.5, 99.99/10.01/0, etc.) e aprovada.

### 1.4 Registros incompletos ou inconsistentes

- **Nenhum campo faltante** no schema atual; todos os campos estão presentes em cada registro.
- **Inconsistência de regime:** registros do HEAD têm `balanceBefore == balanceAfter` (sem significado de "saldo antes") enquanto `net` permanece correto.
- **Histórico truncado:** apenas os últimos 200 registros são preservados; registros mais antigos são descartados pelo `slice(0, 200)` e **não são reconstruíveis**.
- `clearHistory()` (main.js:363) esvazia todo o histórico sem distinção.
- Ajustes manuais (`zerar saldo`, `adicionar saldo`) geram transações de tipo `adjust`/`add`, mas **não geram registros de rodada**; afetam o saldo sem entrar no `history` de rodadas.
- `state.sessions` é inicializado e persistido (limite 50), mas **nunca é preenchido** no fluxo principal (aparece apenas em `lab-worker.js` para `run-sessions`). Array "morto" na UI principal.

### 1.5 Possibilidade de reconstrução inequívoca

**Não é globalmente inequívoca nem segura para reconstrução automática.** Motivos:

1. **Mistura de regimes:** sem `schemaVersion` ou marcador por registro, não se sabe qual registro pertence a qual regime sem inspeção linha a linha.
2. **Apostas sub-centavo / float:** `toCents(0.001) === 0`; apostas como 0.001, 0.33 etc. quebram a reconstrução exata por `balanceAfter - net`.
3. **Truncamento a 200:** registros antigos já foram perdidos; não há o que reconstruir neles.
4. **`clearHistory` e ajustes manuais:** apagam ou alteram o saldo sem registro de rodada correspondente.
5. **Ausência de `schemaVersion`:** não há como versionar o schema de histórico para distinguir regimes.

**Detecção pontual sim é possível:** um registro é defeituoso quando `balanceBefore === balanceAfter && net !== 0`. Para esses, `balanceBefore` verdadeiro ≈ `balanceAfter - net` é seguro apenas se aposta e valores forem cent-alinhados (inteiros seguros de centavos).

**Conclusão da Etapa 11 (decisão a manter):** não realizar reconstrução automática nem migração de registros históricos. A etapa se limita a diagnosticar.

### 1.6 Impactos de uma eventual reconstrução

Se feita no futuro:
- Corrigiria o campo `balanceBefore` dos registros defeituosos do regime HEAD.
- Não afetaria `renderStats`, que reconstrói a evolução do saldo a partir de `r.net` (não de `balanceBefore`).
- Afectaria qualquer auditoria/exportação que consuma `balanceBefore` diretamente.
- Exige regra clara para apostas sub-centavo e tratamento do truncamento a 200.
- **Não executar na Etapa 11** (read-only).

---

## 2. Auditoria Geral do Projeto

### 2.1 Módulos JavaScript mapeados

| Módulo | Responsabilidade | Status |
|---|---|---|
| `js/rng.js` | RNG (crypto em produção; Mulberry32 com seed em testes) | Integrado |
| `js/config.js` | Perfis `experimental` / `reference`, constantes, paylines, pesos | Integrado |
| `js/symbols.js` | Símbolos e paytable (multiplicadores por linha) | Integrado |
| `js/reels.js` | `spinGrid`, `spinFeatureGrid`, Feature cells | Integrado |
| `js/payout.js` | Avaliação de 5 linhas, full grid ×10, `capWin` (2500×) | Integrado |
| `js/game-engine.js` | `playSpin`, `runFeature`, orquestra motor-base | Integrado |
| `js/experimental-multipliers.js` | Multiplicadores ×2/×5/×10/×50, `applyWinCap` (2500×) | Integrado |
| `js/round-settlement.js` | `canSettleRoundWin` / `settleRoundWin` (centavos inteiros) | Integrado (desde Etapa 9) com fallback legado |
| `js/wallet.js` | `formatBRL`, `toCents`/`fromCents`, `addCredits`, `canPlaceBet`, resultado operacional | Integrado |
| `js/storage.js` | `loadState`/`saveState`/`clearState` (localStorage `fts_state`) | Integrado |
| `js/ui.js` | `GameUI`: `setSpinning`, `renderGrid`, `clearHighlights`, `showFeature`, `highlightWins` | Integrado |
| `js/effects.js` | `EffectsController`, `classifyWin`, comemorações proporcionais | Integrado |
| `js/audio.js` | Tons de giro/vitória/feature/derrota por nível | Integrado |
| `js/charts.js` | Desenho de gráficos em canvas | Integrado |
| `js/statistics.js` | `mean`, `stddev`, `confidenceInterval95` | Integrado |
| `js/simulator.js` | Simulação em lote (batch) usando o motor do jogo | Integrado |
| `js/strategies.js` | Estratégias de aposta, `runSession`, `runSessionCRN`, `generateSpinSequence` | Integrado |
| `js/lab.js` | `LabController`: simulação, risco, estratégias, comparação de pesos, salvamento/exportação | Integrado |
| `js/lab-worker.js` | Worker do laboratório (não bloqueia main thread para simulação) | Integrado |
| `js/main.js` | Orquestração da UI: giro, Auto, persistência, histórico, exportação, carteira | Integrado (contém bugs) |
| `js/rng-provider.js` | `createRngPair` (par de RNGs independentes) | **NÃO integrado** |
| `server.cjs` | Servidor estático local (porta 8080) | Integrado |
| `tools/audit-abc.mjs` | Harness A/B/C independente (10M rodadas) | Ferramenta separada |

### 2.2 Integrações entre módulos

- `main.js` importa e orquestra: `rng`, `config`, `game-engine`, `storage`, `ui`, `audio`, `lab`, `wallet`, `charts`, `effects`, `experimental-multipliers`, `round-settlement`.
- `main.js` **não usa** `js/rng-provider.js` (`createRngPair`). Usa `createRng()` (crypto) para o motor-base e um `expRng` ad-hoc baseado em `Math.random()` para o sorteio experimental (linhas 205-216). Isso contraria o contrato documentado em `rng-provider.js` (par independente por sessão). O RNG experimental não é o mesmo que seria obtido por `createRngPair`.
- `round-settlement.js` é integrado em `main.js` (linhas 280-282) com fallback legado para domínio não estrito (apostas sub-centavo / multiplicação insegura). Coberto por `settlement-integration.test.js` (455 combinações).
- `game-engine.js` recebe `balance` opcional e devolve `balanceBefore`/`balanceAfter`; `main.js` não usa `result.balanceAfter` (usa próprio cálculo com `finalWin`).

### 2.3 Persistência e recuperação de dados

- `storage.js`: `loadState` retorna `{}` em caso de erro (JSON inválido); `saveState` engole exceções de `localStorage` (try/catch vazio) → **erros silenciosos**.
- Estado restaurado ao recarregar: `balance`, `bet`, `profileId`, `sound`, `animations`, `history` (≤200), `transactions` (≤200), `sessions` (≤50), `totals`, `resultBaseline`.
- `currentMultiplier` **não persiste** entre recargas (descartado por rodada — intencional, documentado).
- `autoRunning` não persiste (se recarregar durante Auto, o Auto para — aceitável).
- `totals` e `resultBaseline` são derivados do histórico disponível ao carregar (main.js:37-58).
- Sem validação de integridade do JSON carregado; `localStorage` corrompido resulta em estado vazio silenciosamente.

### 2.4 Histórico e exportação

- `renderHistory` mostra últimos 20 do `history` (ordenados mais recente primeiro).
- `exportJson` (main.js:364) exporta **apenas** `state.history` (não `transactions`, não `sessions`).
- `statsExport` (main.js:555) exporta `{ balance, history, transactions }`.
- `LabController.saveExperiment` grava `fts_experiments` em `localStorage` (últimos 20), mas **não há UI de leitura** desses experimentos salvos (conforme checkpoint e leitura de `lab.js:261-271`).
- `LabController.exportJson` / `exportCsv` exportam resultados do laboratório em memória.

### 2.5 Estatísticas

- `renderStats` (main.js:505) calcula a partir de `state.history` + `state.totals`: total apostado/recebido, resultado operacional, hit rate, taxa de rodadas lucrativas, maior prêmio, maior perda em rodada, sequências de vitórias/derrotas, e reconstrói evolução do saldo a partir de `r.net`.
- Gráficos via `charts.js` (canvas): `chartWalletBalance`, `chartWalletPnl`.
- O laboratório tem estatísticas próprias (simulador, risco, estratégias, comparação de pesos).

### 2.6 Sistema de apostas e pagamentos

- `canPlaceBet(balance, bet)`: valida finito, positivo e coberto pelo saldo em centavos (`toCents`).
- Aposta mínima do input HTML: `0.01`, step `0.01`. Porém, via código/apostas sub-centavo (ex: `0.001`) são aceitas por `canPlaceBet` (`toCents(0.001) === 0 <= toCents(balance)`) e liquidadas como `0` pelo fallback legado de `round-settlement` → comportamento inconsistente.
- Pagamento: `payout.evaluateGrid` (5 linhas, Wild substitui, full grid ×10), `capWin` (cap interno 2500×), `totalWin` arredondado a 2 casas.
- Multiplicador experimental aplicado sobre `baseWinCents` com `settleRoundWin` + cap experimental final 2500×.

### 2.7 RNG e liquidação

- Produção: `crypto.getRandomValues`; testes: `mulberry32` determinístico por seed.
- `playSpin` usa seu próprio `createRng()` (crypto, sem seed) — não depende do sorteio experimental.
- `round-settlement.js`: `canSettleRoundWin` (puro, não lança), `settleRoundWin` (lança `TypeError`/`RangeError` fora do domínio). `main.js` recorre ao legado `applyWinCap(baseWinCents * multiplier, betCents)` quando fora do domínio estrito.
- 550.000 rodadas CRN sem divergência (estado de referência).

### 2.8 Multiplicadores e caps

- Cap interno do motor: 2500× a aposta (`payout.capWin`, `enforceMaxWin: true` em ambos perfis).
- Cap experimental final: 2500× a aposta (`applyWinCap`), adicional e independente do interno.
- Multiplicadores experimentais: ×2 (40), ×5 (30), ×10 (20), ×50 (10); ativação 5% por rodada; sorteado antes de cada giro, descartado após; não persiste.
- Ambos os caps preservados em todos os cenários A/B/C da auditoria ABC (10M rodadas, hashes idênticos ao baseline).

### 2.9 Tratamento de erros

- `storage.js`: erros de `localStorage` silenciosos (sem aviso ao usuário).
- `settleRoundWin`: lança `TypeError`/`RangeError` fora do domínio; `main.js` evita via `canSettleRoundWin` + fallback legado (não lança no fluxo normal).
- `doSpin`: `try/finally` garante reabilitação do botão GIRAR mesmo em erro (coberto por `ui-structure.test.js`).
- `performSpin`: **não envolto em `try/catch`**; um erro no motor ou na liquidação interromperia o giro sem reabilitar estado de forma controlada (embora `doSpin` reabilite o botão).
- `lab.js`: `saveExperiment` mostra erro na UI; `runSimulation` trata `worker.onerror`.
- `runSession` / `runSessionCRN`: guardam `bet > balance` e `!Number.isFinite(bet)`.
- `runRisk` com 1 sessão: `sd` divide por `(n-1)` → `NaN` quando `n === 1` (confirmação do checkpoint). Não há proteção contra `n < 2` na exibição de IC/desvio.

### 2.10 Dependências e configurações

- `package.json`: sem dependências de runtime, `type: module`, scripts `test`/`test:watch` via `node --test`.
- Zero dependências externas (NPM). Servidor estático `server.cjs` opcional (porta 8080).
- `config.js` separa rigorosamente parâmetros CONFIRMADOS (rolos, linhas, paytable, feature, ×10, cap 2500×) e EXPERIMENTAIS (pesos, probabilidades estimadas, multiplicadores experimentais).
- Nenhum `package-lock.json`.
- `.gitignore` presente.
- `docs/ARQUITETURA.md` e `README.md` sincronizados na Etapa 10 (hashes conhecidos).

---

## 3. Auditoria Funcional

### 3.1 Giro manual

`doSpin()` (main.js:335) verifica `spinning || autoRunning || zeroInProgress`, valida aposta (`canPlaceBet`), define `spinning = true`, chama `performSpin(bet, false)`, e em `finally` libera `spinning` e o botão. Fluxo correto para giro manual. `performSpin` chama `ui.setSpinning(true)`, timeout de animação (1200 ms com animação / 100 ms sem), `playSpin`, `ui.setSpinning(false)` (somente quando `!isAuto`), `ui.renderGrid`, `ui.highlightWins`, sons, celebração, registro no histórico, `persist()`, `renderState()`.

### 3.2 Auto apostar — PROBLEMA CRÍTICO CONFIRMADO

Loop em `main.js:470-502`: chama `performSpin(bet, true)` repetidamente com intervalo selecionável (500/1000/2000/custom ms), verifica stop profit/stop loss, saldo insuficiente, pausa, mudança de view.

**Defeitos confirmados (violam o requisito obrigatório):**

1. **`ui.setSpinning(false)` nunca é chamado no Auto** (main.js:246 está dentro de `if (state.animations && !isAuto)`). A classe CSS `spinning` permanece nos rolos após cada giro automático e o interval de 80 ms de `ui.setSpinning(true)` (main.js:56-69) **não é limpo** (`clearInterval` só ocorre no `setSpinning(false)`, que não roda no Auto). Resultado: rolos ficam com animação `spinBlur 0.08s linear infinite` + blur perpétua entre e após giros automáticos.
2. **`ui.clearHighlights()` não é chamado no Auto** (main.js:231 está dentro de `if (!isAuto)`). Highlights de vitórias (`win-cell`), overlays da Feature e pop-ups de multiplicador de giros anteriores persistem entre giros automáticos.
3. **Ao terminar o Auto** (loop completa, `autoRunning = false`), o último giro automático deixa `setSpinning(true)` ativo e o interval rodando; não há limpeza final.
4. **Corrida com giro manual:** `autoStart` **não verifica `spinning`** (main.js:470: `if (autoRunning || zeroInProgress) return;`). Se o usuário disparar GIRAR manual enquanto o Auto está no intervalo, ou o Auto disparar durante um giro manual, `performSpin` é executado concorrentemente sobre o mesmo `state.balance` → corrompimento de saldo e registros intercalados/duplicados. `doSpin` bloqueia quando `autoRunning`, mas o loop do Auto não bloqueia quando `spinning`.

Esses itens são a principal não-conformidade funcional/visual do projeto.

### 3.3 Stop-loss e stop-profit

- **UI (Auto):** implementados no loop (main.js:491-492), comparando `state.balance - initialBalance` (profit) e `initialBalance - state.balance` (loss). Funcionais.
- **Laboratório:** `runSession` e `runSessionsBatch` recebem `stopProfit`/`stopLoss` (strategies.js:36-62, 74-83). Coberto por testes (`strategies.test.js`: stop-loss interrompe, etc.).
- Não há stop-loss/stop-profit para giro manual (apenas para Auto e lab — aceitável).

### 3.4 Depósitos e retiradas

- **Depósitos (adicionar créditos):** painel `addFundsPanel` com botões rápidos (10/25/50/100) e valor customizado; gera transação tipo `add`. Funcional. Não é dinheiro real (documentado).
- **Zerar saldo:** botão `ZERAR SALDO` (main.js:404) com confirmação, espera término de rodadas, grava transação tipo `adjust`, preserva histórico/estatísticas/resultado operacional. Funcional.
- **Retirada/saque:** **não existe** (por design: simulador educacional sem dinheiro real). Documentado em `FASE9.md`, `REGRAS_ORIGINAIS.md` e `README.md`. Não é uma lacuna, é uma delimitação de escopo.
- **Inconsistência label/comportamento:** botão `resetBalance` no settings tem label **"Reiniciar saldo (10.000)"** (index.html:176) mas reseta para **R$ 100,00** (main.js:362: `state.balance = 100.00`). Documentado em `FASE8.2.md`. Confusão para o usuário.

### 3.5 Multiplicadores

- Sorteio experimental antes de cada giro (também em giro manual), aplicado ao prêmio base, descartado ao final da rodada (`currentMultiplier = 1`, main.js:327). Não persiste entre rodadas nem recargas.
- Exibição acima da roleta (`experimentalMultiplierDisplay`) quando `> 1`.
- Não altera probabilidades/paytable (documentado em `experimental-multipliers.js`).

### 3.6 Pagamentos

- Linhas, Wild, full grid ×10, cap interno 2500×, arredondamento a 2 casas. Conforme `payout.js` e `game-engine.js`. Coberto por `payout.test.js` e `game-engine.test.js`.

### 3.7 Histórico

- Registros com `balanceBefore` defeituoso no regime HEAD (ver Seção 1). Exibição dos últimos 20. Limite de 200 no persist. `clearHistory` apaga tudo. Sem visualização de `balanceBefore` na UI (não é exibido ao usuário, apenas exportado).

### 3.8 Estatísticas

- `renderStats` funcional a partir do histórico/totais. Gráficos de carteira via canvas. Lab com estatísticas avançadas (RTP, IC95, distribuição, frequência de símbolos).

### 3.9 Exportação

- Histórico (JSON), estatísticas (JSON), laboratório (JSON/CSV). Não há exportação de `sessions` (array morto). Não há exportação de `transactions` isolada (só dentro de `statsExport`).

### 3.10 Recuperação após recarregar a página

- `loadState` restaura o estado; `totals`/`resultBaseline` derivados do histórico. Animações/som restauradas. `currentMultiplier` resetado (intencional). Auto não persiste (para na recarga — aceitável). `localStorage` corrompido → estado vazio silenciosamente (sem aviso).

---

## 4. Auditoria Visual e Responsiva

### 4.1 Animação dos rolos

- CSS: `.reel.spinning .cell { animation: spinBlur 0.08s linear infinite; filter: blur(1px); }` (style.css:431-434). Controlado por `ui.setSpinning`.
- Giro manual: `setSpinning(true)`/`false` corretos → animação normal, parada após o resultado.
- **Auto:** `setSpinning(false)` não chamado → animação `spinBlur` perpétua e interval de 80 ms nunca limpo (ver Seção 3.2). **Não preserva a animação normal de cada giro.** Viola requisito obrigatório.

### 4.2 Auto apostar

- Painel completo (giros, aposta, stop profit/loss, intervalo, iniciar/pausar/parar, status, fechar).
- Defeitos: rolos não param de girar (classe `spinning` perpétua), highlights não limpos, corrida com giro manual, sem limpeza ao finalizar.

### 4.3 Efeitos proporcionais ao prêmio

- `effects.js`: `classifyWin(multiplier)` → NONE/SMALL/MEDIUM/BIG/EPIC por thresholds (×2, ×10, ×50). Duração da comemoração 700/1100/1600/2600 ms. Partículas (12 + level×10), moedas (nível 2+), fogos (nível 3+), overlay MEGA WIN (nível 4), winPopup com contagem animada, fullgrid-flash.
- Proporcional ao nível do prêmio. ✓ Conforme o requisito de comemoração proporcional (quando o giro chega a celebrar; no Auto o efeito ainda roda, mas o estado dos rolos fica quebrado).

### 4.4 Responsividade e resoluções

- `.app { max-width: 480px; margin: 0 auto; }` → centralizado, faixa móvel.
- `main-nav`: grid de 5 colunas.
- `reels`: grid 3×3, gap fixo.
- `lab-charts`: grid 1 coluna.
- **Não há `@media` de viewport** (apenas `prefers-reduced-motion` em style.css:466). Não se adapta a tablets/desktops grandes além do `max-width: 480px` (fica estreito centralizado). Funcional em mobile; não otimizado para telas grandes.

### 4.5 `prefers-reduced-motion`

- `EffectsController` lê `matchMedia('(prefers-reduced-motion: reduce)')`; reduz partículas/moedas/fogos.
- CSS `@media (prefers-reduced-motion: reduce)` desativa animações de `.particle, .coin, .spark, .firework, .feature-overlay, .win-text, .win-popup, .win-popup-content`.
- **Não cobre:** `.reel.spinning .cell` (spinBlur) e `.cell.win-cell` (winPulse). Animações de rolo e destaque de vitória persistem mesmo com reduced-motion. O `animCheckbox` controla `state.animations` (setSpinning) mas não desabilita o CSS `spinBlur` diretamente.

### 4.6 Desempenho

- Simulação de laboratório roda em **Worker** (`lab-worker.js`) → não bloqueia main thread para simulações (10M rodadas viáveis).
- **`runRisk`, `runStrategies`, `runWeightComparison` rodam na MAIN THREAD** de forma síncrona (`runSessionsBatch`, `generateSpinSequence` sem Worker). `runWeightComparison` executa 4 × 50.000 spins síncronos → **bloqueia a main thread** (conforme checkpoint). Operações pesadas do laboratório travam a UI.
- `persist()` a cada rodada (localStorage) — aceitável para volumes normais.
- Sem throttling/debounce de eventos de UI.

---

## 5. Problemas Encontrados (Confirmados vs Opcionais)

### 5.1 Problemas confirmados (não são melhorias opcionais)

**Prioridade ALTA:**

| # | Problema | Local | Evidência | Impacto |
|---|---|---|---|---|
| A1 | Auto não chama `ui.setSpinning(false)` nem `ui.clearHighlights()` quando `isAuto`; interval de 80 ms nunca limpo | `js/main.js:230-231,246`; `js/ui.js:48-73` | Leitura de código | Rolos ficam em `spinBlur` perpétuo; highlights/overlays antigos persistem entre giros automáticos. **Viola requisito obrigatório do Auto.** |
| A2 | `autoStart` não verifica `spinning` → corrida Auto × giro manual; `performSpin` concorrente sobre `state.balance` | `js/main.js:470` | Leitura de código | Corrompimento de saldo e registros intercalados/duplicados. |
| A3 | `balanceBefore` gravado **depois** de `state.balance = balanceAfter` → `balanceBefore === balanceAfter` (regime HEAD) | `js/main.js:282,289` | `git log -S balanceBefore`; diff `HEAD~1` vs `HEAD` | Registros de histórico inconsistentes (dois regimes misturados). |

**Prioridade MÉDIA:**

| # | Problema | Local | Evidência | Impacto |
|---|---|---|---|---|
| B1 | Reconstrução de `balanceBefore` não é globalmente inequívoca (mistura regimes, apostas sub-centavo/float, truncamento a 200, `clearHistory`, ajustes manuais, ausência de `schemaVersion`) | `js/main.js` (histórico) | Análise histórica (Seção 1) | Não fazer migração automática; dados históricos permanecem inconsistentes. |
| B2 | Label "Reiniciar saldo (10.000)" reseta para R$ 100,00 | `index.html:176`; `js/main.js:362` | Leitura de código + `FASE8.2.md` | Confusão do usuário (documentado, mas inconsistente). |
| B3 | Apostas sub-centavo (ex: 0.001) aceitas por `canPlaceBet` (`toCents === 0`) e liquidadas como 0 pelo fallback legado | `js/wallet.js:38-42`; `js/round-settlement.js` | Leitura de código | Comportamento estranho de aposta/prêmio líquido. |
| B4 | `rng-provider.js` (`createRngPair`) **não integrado**; `main.js` usa `createRng()` (crypto) para motor e `Math.random` ad-hoc para experimental | `js/rng-provider.js`; `js/main.js:205-216` | Leitura de código | Inconsistência com o contrato de par de RNGs independentes. |
| B5 | Erros de `localStorage` silenciosos (try/catch vazio) | `js/storage.js:1-14` | Leitura de código | Falha silenciosa de persistência/recuperação; sem aviso ao usuário. |
| B6 | `runRisk`/`runStrategies`/`runWeightComparison` bloqueiam a main thread (síncronos) | `js/lab.js:169-259`; `js/strategies.js` | Leitura de código | UI trava durante operações pesadas do laboratório. |
| B7 | `prefers-reduced-motion` não cobre `.reel.spinning` (spinBlur) nem `.cell.win-cell` (winPulse) | `css/style.css:431,466` | Leitura de CSS | Animações de rolo persistem com movimento reduzido. |
| B8 | Histórico/transações limitados a 200; `sessions` limitado a 50 e nunca preenchido (morto); exportação só de `history` (não `transactions`/`sessions`) | `js/main.js:132-134,186,364` | Leitura de código | Perda de registros antigos; exportação incompleta. |
| B9 | `runRisk` com 1 sessão gera `NaN` no desvio-padrão/IC (divisão por `n-1`) | `js/lab.js:186-191`; `js/lab.js:96-105` | Leitura de código | Exibição `NaN` em análise de risco com 1 sessão. |

**Prioridade BAIXA:**

| # | Problema | Local | Impacto |
|---|---|---|---|
| C1 | `symbolCell` exportado em `ui.js`, nunca utilizado (código morto) | `js/ui.js:11` | Nenhum funcional; só poluição de API. |
| C2 | `docs/AUDITORIA_ABC.md` cita "147 testes aprovados" mas a suíte real é 166 | `docs/AUDITORIA_ABC.md` | Documento defasado (não modificar na Etapa 11). |
| C3 | Não existe retirada/saque | Escopo do simulador (documentado em `FASE9`, `REGRAS_ORIGINAIS`, `README`) | Delimitação de escopo, não bug. |

### 5.2 Melhorias opcionais (não são correções obrigatórias)

- Exibir `balanceBefore`/`balanceAfter` na UI do histórico.
- Adicionar `schemaVersion` aos registros de histórico para futuras migrações.
- Adicionar UI de leitura dos experimentos salvos em `fts_experiments`.
- Adicionar `try/catch` em `performSpin` com recuperação de estado.
- Adicionar Worker para `runRisk`/`runStrategies`/`runWeightComparison`.
- Adicionar breakpoints de viewport (tablet/desktop) ao CSS.
- Adicionar validação de aposta mínima em centavos (`toCents(bet) >= 1`).
- Corrigir label do botão `resetBalance` para "Reiniciar saldo (100,00)".

---

## 6. Lacunas de Testes (sem alterar os testes)

**Módulos sem testes de comportamento/UI:**
- `js/main.js`: fluxo de giro, Auto apostar, persistência, exportação, zeragem de saldo, recuperação, stop-loss/stop-profit da UI.
- `js/lab.js`: `LabController` (simulação, risco, estratégias, comparação, salvamento/exportação de experimentos).
- `js/charts.js`: renderização de gráficos.
- `js/audio.js`: tons e níveis de vitória.
- `js/storage.js`: comportamento de `localStorage` (erros silenciosos, corrompimento).
- `js/rng-provider.js`: `createRngPair` (apenas importado em `rng-provider.test.js` junto com `rng.js`, mas sem teste de independência do par).

**Cenários importantes não verificados:**
- Requisito obrigatório: **Auto preservar animação normal de cada giro** (chamada de `setSpinning(false)`/`clearHighlights()` no Auto, limpeza do interval de 80 ms, limpeza ao finalizar).
- Corrida Auto × giro manual (`spinning` não verificado em `autoStart`).
- Registros históricos com `balanceBefore` defeituoso (`balanceBefore === balanceAfter && net !== 0`).
- Apostas sub-centavo e comportamento do fallback legado.
- Falha/corrompimento de `localStorage`.
- Recuperação após recarregar a página (estado restaurado, Auto parado).
- Responsividade real em diferentes resoluções/viewports.
- `prefers-reduced-motion` sobre animações de rolo (`spinBlur`).
- `runRisk` com 1 sessão (`NaN` de desvio-padrão).

**Cobertura existente (166 testes, todos aprovados):** `wallet` (accounting, operational-result, operational-result-detail, wallet), `game-engine`, `reels`, `payout`, `symbols`, `rng`, `statistics`, `experimental-multipliers`, `round-settlement`, `settlement-integration` (455 combinações), `rng-provider`, `audit-abc`, `simulator`, `simulator-extra`, `strategies`, `effects`, `effects-extra`, `ui-structure` (HTML/CSS/main.js estrutura).

**Não há testes redundantes óbvios:** cada módulo tem suíte própria; `audit-abc.test` valida o harness. Os testes de UI são estruturais (leitura de arquivos), não comportamentais (não executam navegador).

---

## 7. Pendências para Conclusão

1. Corrigir `performSpin` para chamar `ui.setSpinning(false)` e `ui.clearHighlights()` também quando `isAuto`, limpar o interval de 80 ms ao finalizar o Auto, e evitar corrida com giro manual (verificar `spinning` em `autoStart` ou serializar giros).
2. Avaliar (não executar na Etapa 11) se alguma reconstrução de `balanceBefore` é segura para registros defeituosos (apenas cent-alinhados; sem migração automática).
3. Decidir sobre label do botão `resetBalance` (10.000 vs 100,00) e comportamento de apostas sub-centavo.
4. Decidir sobre integração de `rng-provider.js` (`createRngPair`) no lugar do `Math.random` ad-hoc para o multiplicador experimental.
5. Decidir sobre tratamento de erros de `localStorage` (aviso ao usuário) e bloqueio da main thread no laboratório (Worker para `runRisk`/`runStrategies`/`runWeightComparison`).
6. Completar testes nas lacunas listadas na Seção 6 (sem modificar testes existentes — adicionar novos).
7. Revisar `docs/AUDITORIA_ABC.md` (contagem de testes defasada) — fora do escopo de modificação da Etapa 11.

---

## 8. Classificação por Prioridade

| Prioridade | Itens | Quantidade |
|---|---|---|
| **ALTA** | A1 (Auto não para rolos/limpa highlights — requisito obrigatório violado), A2 (corrida Auto × giro manual), A3 (`balanceBefore` defeituoso regime HEAD) | 3 |
| **MÉDIA** | B1 (reconstrução não inequívoca), B2 (label resetBalance), B3 (apostas sub-centavo), B4 (`rng-provider` não integrado), B5 (erros `localStorage` silenciosos), B6 (main thread bloqueada no lab), B7 (reduced-motion incompleto), B8 (limite 200 / sessions morto / exportação incompleta), B9 (`runRisk` 1 sessão → `NaN`) | 9 |
| **BAIXA** | C1 (`symbolCell` morto), C2 (docs defasados), C3 (sem saque, por design) | 3 |

**Itens bloqueadores para conclusão (funcional/visual obrigatório):** A1 e A2 (Auto apostar deve preservar animação normal de cada giro e não correr com giro manual).

---

## 9. Plano de Implementação Incremental (somente diagnóstico — não executar na Etapa 11)

**Incremento 1 — Alta prioridade (funcional/visual obrigatório):**
- Ajustar `performSpin` para aplicar `ui.setSpinning(false)` / `ui.clearHighlights()` independentemente de `isAuto`, e limpar o interval de 80 ms ao terminar cada giro e ao finalizar o Auto.
- Bloquear `autoStart` quando `spinning === true` (ou serializar `performSpin`) para eliminar a corrida.
- Manter 166 testes aprovados; adicionar testes de Auto (sem modificar existentes).

**Incremento 2 — Média prioridade (histórico, robustez, desempenho):**
- Documentar os dois regimes de `balanceBefore` e a regra de detecção (`balanceBefore === balanceAfter && net !== 0`); não reconstruir automaticamente.
- Revisar label `resetBalance` e validação de aposta mínima (centavos).
- Integrar `rng-provider.js`/`createRngPair` para o multiplicador experimental (ou remover módulo não integrado).
- Tratamento de erros de `localStorage` com feedback ao usuário.
- Mover `runRisk`/`runStrategies`/`runWeightComparison` para Worker (ou chunkar) para não bloquear a main thread.
- Proteger `runRisk` contra `n < 2` (`NaN` de desvio/IC).
- Completar testes nas lacunas da Seção 6.

**Incremento 3 — Baixa prioridade (opcional):**
- Exibir `balanceBefore`/`balanceAfter` no histórico; adicionar `schemaVersion`.
- UI de leitura de `fts_experiments`; exportação de `transactions`/`sessions`.
- Breakpoints de viewport (tablet/desktop).
- Remover `symbolCell` morto (opcional).

---

## 10. Critérios Objetivos de Conclusão

O projeto estará concluído quando todos os itens abaixo forem atendidos (sem modificar dados históricos, RNG, probabilidades, pagamentos ou caps):

1. **Testes:** 166 testes mantidos aprovados (não reduzir cobertura); novos testes adicionados para as lacunas da Seção 6 (sem alterar testes existentes).
2. **Auditoria ABC:** 10 milhões de rodadas com hashes idênticos ao baseline (nenhuma alteração matemática).
3. **Funcional obrigatório:** Auto apostar chama `ui.setSpinning(false)` e `ui.clearHighlights()` em cada giro (inclusive `isAuto`), limpa o interval de 80 ms, e não inicia durante um giro manual (sem corrida).
4. **Visual obrigatório:** Animação normal de cada giro preservada no Auto (sem `spinBlur` perpétuo); comemoração proporcional ao prêmio mantida (`effects.js` `classifyWin` por nível).
5. **Histórico:** não há modificação de registros antigos; os dois regimes de `balanceBefore` estão documentados; nenhuma reconstrução automática executada.
6. **Persistência:** recuperação após recarregar a página restaura saldo, preferências e histórico (últimos 200); `localStorage` não falha silenciosamente sem tratamento.
7. **Desempenho:** operações pesadas do laboratório não bloqueiam a main thread (Worker ou chunking).
8. **Sem regressões:** `git diff --check` sem novos avisos críticos; manifesto de 46 arquivos com hash inalterado (`2B98E257CBE56234D6AE3E6738A83156CC87C00D84F75BAAB9BE31E0E16D0C0D`).

---

**Assinatura do diagnóstico:** Etapa 11 concluída como leitura/apenas-diagnóstico. Nenhum arquivo foi modificado. Todas as alterações não commitadas das Etapas 1–10 permanecem intactas.
