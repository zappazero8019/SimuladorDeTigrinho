import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canSettleRoundWin, settleRoundWin } from '../js/round-settlement.js';
import {
  applyWinCap,
  toCents,
  fromCents,
  MAX_WIN_MULTIPLIER,
} from '../js/experimental-multipliers.js';
import { canPlaceBet } from '../js/wallet.js';

const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

/**
 * Fórmula legada de main.js antes da integração (comportamento de referência).
 */
function legacyCents(baseWinCents, betCents, multiplier) {
  return applyWinCap(baseWinCents * multiplier, betCents);
}

/**
 * Espelho exato do bloco de liquidação integrado em main.js.
 */
function integrate(baseWinCents, betCents, multiplier) {
  const options = {
    baseWinCents,
    betCents,
    multiplier,
    applyExperimentalCap: true,
  };
  return canSettleRoundWin(options)
    ? settleRoundWin(options).finalCents
    : legacyCents(baseWinCents, betCents, multiplier);
}

// Corpus idêntico ao da auditoria da Fase 1.
const BETS_BRL = [0.001, 0.004, 0.005, 0.009, 0.01, 0.25, 0.33, 1, 1.01, 2.5, 10, 33.33, 1000000];
const BASE_WINS_BRL = [0, 0.01, 0.05, 0.99, 2.5, 25, 2500];
const MULTIPLIERS = [1, 2, 5, 10, 50];

test('caminho normal usa settleRoundWin e mantém o valor em centavos', () => {
  const options = {
    baseWinCents: 500,
    betCents: 100,
    multiplier: 5,
    applyExperimentalCap: true,
  };

  assert.equal(canSettleRoundWin(options), true);
  assert.equal(settleRoundWin(options).finalCents, 2500);
  assert.equal(integrate(500, 100, 5), 2500);
  assert.equal(integrate(0, 100, 50), 0);
  assert.equal(integrate(1, 100, 1), 1);
});

test('fallback para aposta sub-centavo preserva o comportamento legado', () => {
  for (const bet of [0.001, 0.004]) {
    const betCents = toCents(bet);
    assert.equal(betCents, 0);

    for (const baseWinBRL of BASE_WINS_BRL) {
      for (const multiplier of MULTIPLIERS) {
        const baseWinCents = toCents(baseWinBRL);

        assert.equal(
          canSettleRoundWin({ baseWinCents, betCents, multiplier }),
          false,
        );
        assert.equal(
          integrate(baseWinCents, betCents, multiplier),
          legacyCents(baseWinCents, betCents, multiplier),
        );
        // A fórmula legada sempre liquida em 0 quando betCents = 0.
        assert.equal(integrate(baseWinCents, betCents, multiplier), 0);
      }
    }
  }
});

test('fallback para multiplicação insegura usa exatamente a fórmula legada', () => {
  const baseWinCents = Number.MAX_SAFE_INTEGER;
  const betCents = 1;
  const multiplier = 2;

  assert.equal(canSettleRoundWin({ baseWinCents, betCents, multiplier }), false);
  assert.doesNotThrow(() => integrate(baseWinCents, betCents, multiplier));
  assert.equal(
    integrate(baseWinCents, betCents, multiplier),
    legacyCents(baseWinCents, betCents, multiplier),
  );
});

test('fallback para cap inseguro usa exatamente a fórmula legada', () => {
  const betCents = Math.floor(Number.MAX_SAFE_INTEGER / MAX_WIN_MULTIPLIER) + 1;
  const baseWinCents = 0;
  const multiplier = 1;

  assert.equal(canSettleRoundWin({ baseWinCents, betCents, multiplier }), false);
  assert.doesNotThrow(() => integrate(baseWinCents, betCents, multiplier));
  assert.equal(
    integrate(baseWinCents, betCents, multiplier),
    legacyCents(baseWinCents, betCents, multiplier),
  );
});

test('equivalência com a fórmula legada nas 455 combinações da auditoria', () => {
  let total = 0;
  let divergences = 0;
  let fallbacks = 0;

  for (const bet of BETS_BRL) {
    for (const baseWinBRL of BASE_WINS_BRL) {
      for (const multiplier of MULTIPLIERS) {
        const betCents = toCents(bet);
        const baseWinCents = toCents(baseWinBRL);
        const options = { baseWinCents, betCents, multiplier };

        const settled = integrate(baseWinCents, betCents, multiplier);
        const legacy = legacyCents(baseWinCents, betCents, multiplier);

        total++;
        if (!canSettleRoundWin(options)) fallbacks++;
        if (settled !== legacy) divergences++;
      }
    }
  }

  assert.equal(total, 455);
  assert.equal(fallbacks, 70);
  assert.equal(divergences, 0);
});

test('multiplicadores experimentais e limites do cap', () => {
  const betCents = 100;
  const capCents = betCents * MAX_WIN_MULTIPLIER;

  for (const multiplier of MULTIPLIERS) {
    assert.equal(integrate(123, betCents, multiplier), 123 * multiplier);
  }

  // Igualdade exata no limite não reduz nem lança.
  assert.equal(integrate(capCents, betCents, 1), capCents);

  // Acima do limite, o cap experimental atua.
  assert.equal(integrate(200000, betCents, 5), capCents);

  // O cap interno já embutido no prêmio-base é preservado.
  assert.equal(integrate(capCents, betCents, 50), capCents);
});

test('nenhuma divergência de centavos e conversão ida-e-volta exata', () => {
  for (const bet of BETS_BRL) {
    for (const baseWinBRL of BASE_WINS_BRL) {
      for (const multiplier of MULTIPLIERS) {
        const betCents = toCents(bet);
        const baseWinCents = toCents(baseWinBRL);
        const finalCents = integrate(baseWinCents, betCents, multiplier);

        assert.ok(Number.isInteger(finalCents));
        assert.equal(finalCents, legacyCents(baseWinCents, betCents, multiplier));
        assert.equal(toCents(fromCents(finalCents)), finalCents);
      }
    }
  }
});

test('preserva balanceBefore, balanceAfter e net do fluxo de main.js', () => {
  const balances = [0, 0.01, 1, 100, 1234.56];
  const bets = [0.001, 0.01, 0.25, 1, 10.01, 100];
  const wins = [0, 0.01, 2.5, 99.99, 2500];

  for (const balanceBefore of balances) {
    for (const bet of bets) {
      for (const win of wins) {
        for (const multiplier of MULTIPLIERS) {
          const finalCents = integrate(toCents(win), toCents(bet), multiplier);
          const finalWin = fromCents(finalCents);
          const balanceAfter = Math.round((balanceBefore - bet + finalWin) * 100) / 100;
          const net = finalWin - bet;

          assert.equal(toCents(balanceAfter) - toCents(balanceBefore + net), 0);
          assert.equal(finalWin, fromCents(finalCents));
        }
      }
    }
  }
});

test('liquidação é pura, determinística e sem efeitos colaterais', () => {
  const options = Object.freeze({
    baseWinCents: 12345,
    betCents: 333,
    multiplier: 10,
    applyExperimentalCap: true,
  });

  const first = settleRoundWin(options);
  const second = settleRoundWin(options);

  assert.deepEqual(first, second);
  assert.deepEqual(options, {
    baseWinCents: 12345,
    betCents: 333,
    multiplier: 10,
    applyExperimentalCap: true,
  });

  const source = readFileSync(
    new URL('../js/round-settlement.js', import.meta.url),
    'utf8',
  );
  assert.ok(!source.includes('Math.random'));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('window.'));
});

test('regras atuais de saldo continuam protegendo o giro', () => {
  assert.equal(canPlaceBet(0, 1), false);
  assert.equal(canPlaceBet(0.5, 1), false);
  assert.equal(canPlaceBet(1, 1), true);
  assert.equal(canPlaceBet(2, 1), true);

  const guards = mainSource.match(/if \(!canPlaceBet\(state\.balance, bet\)\)/g) || [];
  assert.ok(guards.length >= 2, 'main.js deve manter as guardas de saldo no giro manual e no auto');
});

test('main.js integra canSettleRoundWin antes de settleRoundWin e mantém o fallback', () => {
  const start = mainSource.indexOf('async function performSpin');
  const end = mainSource.indexOf('async function doSpin');
  assert.ok(start >= 0 && end > start);

  const body = mainSource.slice(start, end);

  assert.ok(body.includes('const baseWinCents = multToCents(result.totalWin);'));
  assert.ok(body.includes('const betCents = multToCents(bet);'));
  assert.ok(body.includes('canSettleRoundWin(settlementOptions)'));
  assert.ok(body.includes('settleRoundWin(settlementOptions).finalCents'));
  assert.ok(body.includes('applyWinCap(baseWinCents * currentMultiplier, betCents)'));
  assert.ok(
    body.indexOf('canSettleRoundWin(settlementOptions)') <
      body.indexOf('settleRoundWin(settlementOptions).finalCents'),
  );

  // Etapa 8 preservada.
  assert.ok(body.includes('const balanceBefore = state.balance;'));
  assert.ok(body.includes('balanceBefore,'));
});
