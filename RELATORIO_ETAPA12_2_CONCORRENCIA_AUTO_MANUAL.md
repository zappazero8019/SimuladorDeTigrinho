# Etapa 12.2 — Correção da Concorrência entre Auto Apostar e Giro Manual

**Tipo:** correção de exclusão mútua (implementação autorizada após auditoria da Etapa 11 e correção visual da Etapa 12.1).
**Arquivo modificado:** `js/main.js` (apenas).
**Arquivo novo:** `tests/main-auto-concurrency.test.js` (8 novos testes; nenhum teste existente modificado).
**Não modificado:** motor matemático (`game-engine.js`, `payout.js`, `reels.js`, `config.js`, `symbols.js`), RNG (`rng.js`), pagamentos, multiplicadores/caps (`experimental-multipliers.js`), liquidação (`round-settlement.js`), persistência (`storage.js`), UI (`ui.js`), histórico, registros antigos.
**Não houve commit, push, pull ou publicação.**

---

## Causa exata do problema

Dois caminhos podiam chamar `performSpin` concorrentemente sobre o mesmo `state.balance`/`state.history`:

1. `doSpin` (giro manual) já bloqueava quando `autoRunning` (linha 348), mas **`autoStart` não bloqueava quando `spinning`** (linha 483 antes da correção: só checava `autoRunning || zeroInProgress`). Resultado: um giro manual em andamento não impedia o início do Auto.
2. `performSpin` **não protegia seu próprio ponto de entrada**; dependia exclusivamente da desativação dos botões, que não cobre a janela entre a verificação de disponibilidade e o início efetivo do giro assíncrono.

Com isso, `performSpin` podia ser executado duas vezes ao mesmo tempo, lendo/gravando `state.balance`, `state.history`, `state.totals` e `currentMultiplier` de forma intercalada, gerando inconsistências de saldo, apostas, liquidação e histórico.

---

## Mecanismo utilizado para impedir concorrência

Uma flag de ocupação única `let roundInProgress = false;` (adicionada ao lado de `spinning` e `zeroInProgress`), verificada e adquirida **sincronicamente no ponto de entrada** de `performSpin`, antes de qualquer operação assíncrona, e liberada em `finally` em **todos** os caminhos de saída (sucesso, erro, interrupção).

- **Entrada:** `if (roundInProgress) return;` — rejeita uma segunda chamada enquanto um giro estiver em andamento.
- **Aquisição:** `roundInProgress = true;` imediatamente após a guarda, antes de `effects.clear()` e de qualquer `await`.
- **Liberação:** `} finally { roundInProgress = false; }` envolvendo todo o corpo de `performSpin`, incluindo o `try/finally` interno existente (que encerra `ui.setSpinning(false)`).
- **Chamadores:**
  - `doSpin` (manual): já checava `spinning || autoRunning || zeroInProgress` e define/libera `spinning` em `try/finally` — mantido.
  - `autoStart` (automático): agora checa `autoRunning || spinning || zeroInProgress` — **não inicia durante giro manual**.
  - O loop do Auto continua chamando `performSpin(bet, true)` sequencialmente, um giro por vez.

Garantias atendidas:
- Um único giro em execução por vez.
- Proteção adquirida antes de qualquer operação assíncrona.
- `performSpin` protege sua própria entrada (não depende apenas dos botões).
- `autoStart` não inicia durante giro manual (`spinning`).
- Giro manual não inicia durante Auto (`autoRunning`).
- Loop automático segue sequencial e normal.
- Proteção liberada em todos os caminhos, inclusive erros (`finally`).
- O encerramento de um giro não libera proteção de outro (cada chamada adquire/libera sua própria flag).
- Parada do Auto continua funcionando (`autoStopRequested`, `finally` reseta `autoRunning` e reabilita botão).
- Nenhum bloqueio permanente após erros/interrupções.

---

## Alterações realizadas (apenas `js/main.js`)

1. Adicionada `let roundInProgress = false;` ao lado dos demais flags de estado.
2. `performSpin`: guarda de entrada `if (roundInProgress) return;`, `roundInProgress = true;`, corpo envolvido em `try { ... }`, e `} finally { roundInProgress = false; }` ao final (liberando a exclusão mútua em sucesso e erro).
3. `autoStart`: condição de guarda alterada de `if (autoRunning || zeroInProgress) return;` para `if (autoRunning || spinning || zeroInProgress) return;`.

As correções visuais da Etapa 12.1 (`ui.clearHighlights()` e `ui.setSpinning(false)` para todo giro, `try/finally` no loop do Auto) foram preservadas integralmente.

---

## Testes adicionados e resultados

Novo arquivo `tests/main-auto-concurrency.test.js` com 8 testes (inspeção de fonte, padrão dos testes existentes, pois `main.js` não pode ser importado no Node sem DOM):

1. Giro manual normal adquire e libera a proteção de exclusão mútua (`spinning = true`/`false` em `try/finally`). ✅
2. Auto apostar não inicia durante giro manual em andamento (`autoStart` checa `spinning`). ✅
3. Giro manual não inicia durante Auto apostar (`doSpin` checa `autoRunning`). ✅
4. `performSpin` protege seu próprio ponto de entrada contra entrada duplicada (`roundInProgress`). ✅
5. `performSpin` libera a proteção após erro ou conclusão (`try/finally` com `roundInProgress = false`). ✅
6. Loop do Auto executa giros sequenciais via `performSpin(bet, true)` com contador. ✅
7. Auto reseta o estado e libera o botão ao parar normalmente (`finally`: `autoRunning = false`, `spinBtn.disabled = false`). ✅
8. Duas chamadas simultâneas não executam liquidações concorrentes (flag adquirida antes do primeiro `await` e liberada somente depois; único ponto de liberação). ✅

**Resultado da suíte:** `npm.cmd test` → **179 testes aprovados, 0 falhas** (171 originais + 8 novos).

---

## Confirmações

- **Não existem giros simultâneos:** a flag `roundInProgress` garante exclusão mútua no ponto de entrada de `performSpin`, e os chamadores (`doSpin`, `autoStart`) bloqueiam mutuamente via `spinning`/`autoRunning`.
- **Etapa 12.1 continua funcionando:** `ui.clearHighlights()` e `ui.setSpinning(false)` executam para todo giro (manual e automático), com `try/finally` encerrando a animação mesmo em erro; o loop do Auto mantém seu `try/finally`. A animação de 1200 ms não foi acelerada, encurtada, pular ou simplificada.
- **Motor matemático e registros históricos inalterados:** nenhuma modificação em `game-engine.js`, `payout.js`, `reels.js`, `config.js`, `symbols.js`, `rng.js`, `experimental-multipliers.js`, `round-settlement.js` ou nos registros de histórico. RNG, probabilidades, apostas, pagamentos, multiplicadores e caps preservados. (Os blocos `round-settlement`/`balanceBefore` visíveis no `git diff` já estavam no working tree desde a Etapa 10 e não foram tocados nesta etapa.)
- `git diff --check` → exit 0 (apenas avisos CRLF pré-existentes).
- Nenhuma dependência instalada. Nenhum arquivo fora do escopo modificado. Nenhuma alteração existente descartada.

Não avanço para a próxima etapa automaticamente.
