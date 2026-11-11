# Etapa 12.1 — Correção do Auto Apostar e das Animações

**Tipo:** correção de ciclo visual (implementação autorizada após auditoria da Etapa 11).
**Arquivo modificado:** `js/main.js` (apenas).
**Arquivo novo:** `tests/main-auto-visual.test.js` (somente novos testes; nenhum teste existente foi modificado).
**Não modificado:** `js/ui.js`, motor matemático (`game-engine.js`, `payout.js`, `reels.js`, `config.js`, `symbols.js`), RNG (`rng.js`), pagamentos, multiplicadores/caps (`experimental-multipliers.js`), liquidação (`round-settlement.js`), persistência (`storage.js`), histórico, registros antigos.

---

## Causa exata do problema

Em `performSpin` (`js/main.js`), dois procedimentos de encerramento visual eram protegidos por `if (!isAuto)`:

- `ui.clearHighlights()` (limpa `win-cell`, `sticky`, overlay da Feature, pop-up de multiplicador, `linesInfo`).
- `ui.setSpinning(false)` (remove a classe `spinning` dos rolos e encerra o intervalo de 80 ms que troca símbolos e mantém `spinBlur`).

Consequência nos giros automáticos: a animação `spinBlur 0.08s linear infinite` permanecia ativa entre e após giros, o intervalo de 80 ms nunca era limpo (`ui.spinInterval` nunca zerado), e destaques/overlays da rodada anterior eram herdados pelos giros seguintes. Além disso, o loop do Auto não tinha `try/finally` em torno de `performSpin(bet, true)`, então erros/interrupções podiam deixar `autoRunning = true` e o botão GIRAR desabilitado (interface travada).

---

## Alterações realizadas

Todas em `js/main.js`:

1. **`performSpin` — início do giro:** `ui.clearHighlights()`, `els.win.textContent = '0'` e `setStatus('Girando...')` passaram a ser executados para **todo** giro (manual e automático), não apenas manual. Cada giro automático parte de um estado visual limpo.

2. **`performSpin` — encerramento do giro:** `ui.setSpinning(false)` (quando `state.animations`) passou a ser executado para **todo** giro, imediatamente após `playSpin()` e antes de `ui.renderGrid()`, preservando a mesma ordem do fluxo manual (para a animação, exibe o grade final). O trecho foi envolvido em `try/finally` para garantir o encerramento da animação e limpeza do intervalo de 80 ms **mesmo em caso de erro** no motor ou na liquidação.

3. **Loop do Auto apostar (`autoStart`):** envolto em `try/finally` que reseta `autoRunning = false` e reabilita `els.spinBtn.disabled = false` ao sair do loop, incluindo erro/interrupção. As mensagens de status ("Interrompido.", "Concluído.", mensagens de stop-loss/stop-profit/saldo insuficiente) mantêm o comportamento original.

**Não houve alteração de tempo de animação:** cada giro (manual e auto) ainda aguarda 1200 ms (com animação) antes de parar os rolos — nenhuma aceleração, encurtamento, pulo ou simplificação.

---

## Testes executados e resultados

- Suíte existente: `npm.cmd test` → **171 testes aprovados, 0 falhas** (166 originais + 5 novos).
- Novos testes em `tests/main-auto-visual.test.js`:
  1. `performSpin limpa destaques e overlays antes de todo giro (manual e auto)` — aprovado.
  2. `performSpin encerra a animacao de giro em ambos os modos` — aprovado (`setSpinning(false)` sem guarda de `!isAuto`).
  3. `performSpin encerra a animacao mesmo em caso de erro` — aprovado (`playSpin` envolto em `try/finally` com `setSpinning(false)`).
  4. `ui.setSpinning(false) encerra o intervalo de 80 ms e remove a classe spinning` — aprovado (verificação em `js/ui.js`).
  5. `loop do Auto apostar reseta o estado mesmo em erro ou interrupcao` — aprovado (`try/finally` no loop, `autoRunning` e botão resetados).

---

## Comportamento visual validado (por inspeção de código + suíte)

1. Giro manual continua funcionando normalmente — `doSpin` e `performSpin` para `isAuto=false` inalterados.
2. Auto apostar executa vários giros consecutivos — loop mantido, agora com `try/finally`.
3. Cada giro automático apresenta a animação completa (1200 ms de rolos girando, depois parada e exibição do resultado).
4. Nenhum `spinBlur` permanece após o giro — `setSpinning(false)` remove a classe `spinning` e limpa o intervalo de 80 ms.
5. Nenhum intervalo visual fica ativo indevidamente — `ui.spinInterval` é limpo a cada `setSpinning(false)`.
6. Highlights e overlays não são herdados da rodada anterior — `clearHighlights()` roda no início de todo giro.
7. Parar o Auto apostar não deixa a interface travada — `finally` reseta `autoRunning` e reabilita o botão GIRAR.
8. Erros e interrupções encerram corretamente o estado visual — `finally` em `performSpin` e no loop do Auto.

---

## Pendências (fora do escopo desta correção, já identificadas na Etapa 11)

- Corrida Auto × giro manual: `autoStart` não verifica `spinning` (prioridade média; seria tratada em correção separada).
- `balanceBefore` defeituoso nos registros do regime HEAD (dois regimes de histórico misturados) — nenhuma reconstrução automática, conforme decisão da Etapa 11.
- Outras pendências de média/baixa priority listadas no `RELATORIO_ETAPA11_AUDITORIA.md` (label do botão resetBalance, apostas sub-centavo, `rng-provider.js` não integrado, erros silenciosos de `localStorage`, bloqueio da main thread no laboratório, `prefers-reduced-motion` incompleto, `runRisk` com 1 sessão → `NaN`).

---

## Confirmação de integridade do motor matemático

O motor matemático permaneceu **integralmente inalterado** nesta etapa: nenhuma modificação em `game-engine.js`, `payout.js`, `reels.js`, `config.js`, `symbols.js`, `rng.js`, `experimental-multipliers.js` ou `round-settlement.js`. RNG, probabilidades, apostas, pagamentos, multiplicadores e caps foram preservados. Os blocos de liquidação (`round-settlement`) e o campo `balanceBefore` presentes no diff vs. `HEAD` já estavam no working tree antes desta etapa (Etapa 10) e não foram tocados aqui.

**Não foi feito commit, push, pull, pull-request ou publicação.** Nenhuma dependência foi instalada. Nenhum arquivo fora do escopo foi modificado. Os resultados da auditoria ABC de 10 milhões de rodadas permanecem válidos (nenhum parâmetro matemático foi alterado).

Não avanço para a próxima correção automaticamente.
