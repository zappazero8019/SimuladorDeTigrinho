import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resultCentsWithBaseline,
  resultCents,
  resultKind,
  addCredits,
} from '../js/wallet.js';

test('resultado positivo antes do reset (sem baseline)', () => {
  assert.equal(resultCentsWithBaseline(10, 15, 0, 0), 500);
  assert.equal(resultKind(resultCentsWithBaseline(10, 15, 0, 0)), 'profit');
});

test('resultado negativo antes do reset (sem baseline)', () => {
  assert.equal(resultCentsWithBaseline(10, 4, 0, 0), -600);
  assert.equal(resultKind(resultCentsWithBaseline(10, 4, 0, 0)), 'loss');
});

test('resultado igual a zero quando totais são iguais à baseline', () => {
  assert.equal(resultCentsWithBaseline(10, 10, 10, 10), 0);
  assert.equal(resultKind(resultCentsWithBaseline(10, 10, 10, 10)), 'even');
});

test('resultado após reset considera apenas movimentos posteriores', () => {
  // Totais acumulados: apostou 100, recebeu 80 (prejuízo de 20)
  // Reset feito quando totais eram: apostou 60, recebeu 50 (prejuízo de 10)
  // Resultado pós-reset: (80-50) - (100-60) = 30 - 40 = -10
  const result = resultCentsWithBaseline(100, 80, 60, 50);
  assert.equal(result, -1000);
  assert.equal(resultKind(result), 'loss');
});

test('resultado após reset com lucro posterior', () => {
  // Totais acumulados: apostou 100, recebeu 150 (lucro de 50)
  // Reset feito quando totais eram: apostou 60, recebeu 70 (lucro de 10)
  // Resultado pós-reset: (150-70) - (100-60) = 80 - 40 = 40
  const result = resultCentsWithBaseline(100, 150, 60, 70);
  assert.equal(result, 4000);
  assert.equal(resultKind(result), 'profit');
});

test('resultado pós-reset começa em zero quando baseline igual a totais atuais', () => {
  const bet = 25;
  const win = 10;
  assert.equal(resultCentsWithBaseline(bet, win, bet, win), 0);
  assert.equal(resultKind(resultCentsWithBaseline(bet, win, bet, win)), 'even');
});

test('nova aposta atualiza corretamente o resultado pós-reset', () => {
  // Baseline: apostou 60, recebeu 50
  // Nova rodada: aposta +10, prêmio +15
  const antes = resultCentsWithBaseline(60, 50, 60, 50); // 0
  const depois = resultCentsWithBaseline(70, 65, 60, 50); // (65-50) - (70-60) = 15 - 10 = 5
  assert.equal(antes, 0);
  assert.equal(depois, 500);
  assert.equal(resultKind(depois), 'profit');
});

test('adicao de creditos nao afeta o resultado operacional', () => {
  const baseline = { bet: 60, win: 50 };
  const before = resultCentsWithBaseline(60, 50, baseline.bet, baseline.win);
  addCredits(100, 50);
  const after = resultCentsWithBaseline(60, 50, baseline.bet, baseline.win);
  assert.equal(before, after);
  assert.equal(after, 0);
});

test('baseline nao altera totais historicos', () => {
  const totalsBet = 100;
  const totalsWin = 80;
  const baselineBet = 60;
  const baselineWin = 50;
  const displayed = resultCentsWithBaseline(totalsBet, totalsWin, baselineBet, baselineWin);
  // Totais originais permanecem inalterados
  assert.equal(resultCents(totalsBet, totalsWin), -2000);
  assert.equal(resultCents(baselineBet, baselineWin), -1000);
  // Resultado exibido considera apenas o diferencial
  assert.equal(displayed, -1000);
});
