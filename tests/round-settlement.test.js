import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canSettleRoundWin, settleRoundWin } from '../js/round-settlement.js';

const CAP_MULTIPLIER = 2500;

test('retorna o prêmio antes e depois do cap e o limite experimental', () => {
  const result = settleRoundWin({
    baseWinCents: 500,
    betCents: 100,
    multiplier: 2,
    applyExperimentalCap: true,
  });

  assert.deepEqual(Object.keys(result).sort(), [
    'baseWinCents',
    'betCents',
    'capApplied',
    'capCents',
    'finalCents',
    'multipliedCents',
    'multiplier',
  ]);
  assert.equal(result.baseWinCents, 500);
  assert.equal(result.betCents, 100);
  assert.equal(result.multiplier, 2);
  assert.equal(result.multipliedCents, 1000);
  assert.equal(result.capCents, 100 * CAP_MULTIPLIER);
  assert.equal(result.finalCents, 1000);
  assert.equal(result.capApplied, false);
});

test('multiplicador 1× mantém o prêmio-base intacto', () => {
  const result = settleRoundWin({
    baseWinCents: 12345,
    betCents: 1000,
    multiplier: 1,
  });

  assert.equal(result.multipliedCents, 12345);
  assert.equal(result.finalCents, 12345);
  assert.equal(result.capApplied, false);
});

test('multiplicador 2× dobra o prêmio em centavos', () => {
  const result = settleRoundWin({
    baseWinCents: 500,
    betCents: 100,
    multiplier: 2,
  });

  assert.equal(result.multipliedCents, 1000);
  assert.equal(result.finalCents, 1000);
  assert.equal(result.capApplied, false);
});

test('multiplicador 5× aplica ao prêmio em centavos', () => {
  const result = settleRoundWin({
    baseWinCents: 500,
    betCents: 100,
    multiplier: 5,
  });

  assert.equal(result.multipliedCents, 2500);
  assert.equal(result.finalCents, 2500);
  assert.equal(result.capApplied, false);
});

test('multiplicador 10× aplica ao prêmio em centavos', () => {
  const result = settleRoundWin({
    baseWinCents: 500,
    betCents: 100,
    multiplier: 10,
  });

  assert.equal(result.multipliedCents, 5000);
  assert.equal(result.finalCents, 5000);
  assert.equal(result.capApplied, false);
});

test('multiplicador 50× aplica ao prêmio em centavos', () => {
  const result = settleRoundWin({
    baseWinCents: 500,
    betCents: 100,
    multiplier: 50,
  });

  assert.equal(result.multipliedCents, 25000);
  assert.equal(result.finalCents, 25000);
  assert.equal(result.capApplied, false);
});

test('cálculo permanece em centavos inteiros, sem arredondamento', () => {
  const result = settleRoundWin({
    baseWinCents: 12345,
    betCents: 777,
    multiplier: 7,
  });

  assert.equal(result.multipliedCents, 86415);
  assert.equal(result.finalCents, 86415);
  assert.ok(Number.isInteger(result.multipliedCents));
  assert.ok(Number.isInteger(result.finalCents));
  assert.equal(result.multipliedCents, result.baseWinCents * result.multiplier);
});

test('cap experimental de 2.500× é aplicado sobre o valor multiplicado', () => {
  // Aposta de 100 centavos => cap = 100 × 2500 = 250.000 centavos.
  const result = settleRoundWin({
    baseWinCents: 200000,
    betCents: 100,
    multiplier: 5,
  });

  assert.equal(result.multipliedCents, 1000000);
  assert.equal(result.capCents, 250000);
  assert.equal(result.finalCents, 250000);
  assert.equal(result.capApplied, true);
});

test('cap experimental não reduz quando o valor fica abaixo do limite', () => {
  const result = settleRoundWin({
    baseWinCents: 100000,
    betCents: 100,
    multiplier: 2,
  });

  assert.equal(result.multipliedCents, 200000);
  assert.equal(result.capCents, 250000);
  assert.equal(result.finalCents, 200000);
  assert.equal(result.capApplied, false);
});

test('igualdade exata no limite não marca capApplied', () => {
  const result = settleRoundWin({
    baseWinCents: 250000,
    betCents: 100,
    multiplier: 1,
  });

  assert.equal(result.multipliedCents, 250000);
  assert.equal(result.capCents, 250000);
  assert.equal(result.finalCents, 250000);
  assert.equal(result.capApplied, false);
});

test('com o cap experimental desativado, somente o limite final é ignorado', () => {
  const result = settleRoundWin({
    baseWinCents: 200000,
    betCents: 100,
    multiplier: 5,
    applyExperimentalCap: false,
  });

  assert.equal(result.multipliedCents, 1000000);
  assert.equal(result.capCents, 250000);
  assert.equal(result.finalCents, 1000000);
  assert.equal(result.finalCents, result.multipliedCents);
  assert.equal(result.capApplied, false);
});

test('diferença entre antes e depois do cap é exatamente o excedente', () => {
  const result = settleRoundWin({
    baseWinCents: 200000,
    betCents: 100,
    multiplier: 5,
  });

  assert.equal(result.multipliedCents - result.finalCents, 750000);
  assert.equal(result.multipliedCents - result.finalCents, result.multipliedCents - result.capCents);
});

test('preserva o cap interno do motor já embutido no prêmio-base', () => {
  // O prêmio-base de 250.000 centavos já saiu do motor limitado a 2.500×
  // uma aposta de 100 centavos. A liquidação não o recalcula nem o remove.
  const internallyCappedCents = 100 * CAP_MULTIPLIER;

  for (const applyExperimentalCap of [true, false]) {
    const result = settleRoundWin({
      baseWinCents: internallyCappedCents,
      betCents: 100,
      multiplier: 1,
      applyExperimentalCap,
    });

    assert.equal(result.baseWinCents, internallyCappedCents);
    assert.equal(result.baseWinCents, result.betCents * CAP_MULTIPLIER);
    assert.equal(result.finalCents, internallyCappedCents);
    assert.equal(result.capApplied, false);
  }
});

test('cenário C desativa apenas o cap experimental final', () => {
  // Aposta de 1.000 centavos. O motor-base já limitou o prêmio bruto a
  // 2.500× a aposta => baseWinCents = 2.500.000.
  const betCents = 1000;
  const internallyCappedCents = betCents * CAP_MULTIPLIER; // 2.500.000
  const multiplier = 50;

  const scenarioC = settleRoundWin({
    baseWinCents: internallyCappedCents,
    betCents,
    multiplier,
    applyExperimentalCap: false,
  });

  const scenarioB = settleRoundWin({
    baseWinCents: internallyCappedCents,
    betCents,
    multiplier,
    applyExperimentalCap: true,
  });

  // C: sem o cap experimental final, mas com o cap interno preservado.
  assert.equal(scenarioC.baseWinCents, internallyCappedCents);
  assert.equal(scenarioC.multipliedCents, 125000000);
  assert.equal(scenarioC.finalCents, 125000000);
  assert.equal(scenarioC.capApplied, false);

  // B: mesmo prêmio-base, com o cap experimental final.
  assert.equal(scenarioB.finalCents, internallyCappedCents);
  assert.equal(scenarioB.capApplied, true);

  // Se o cap interno tivesse sido removido, o bruto de 10.000× a aposta
  // (10.000.000 centavos) × 50 chegaria a 500.000.000. C não faz isso.
  assert.notEqual(scenarioC.finalCents, 500000000);
  assert.equal(scenarioC.finalCents, internallyCappedCents * multiplier);
});

test('prêmio zero permanece zero com qualquer multiplicador válido', () => {
  const result = settleRoundWin({
    baseWinCents: 0,
    betCents: 100,
    multiplier: 50,
  });

  assert.equal(result.multipliedCents, 0);
  assert.equal(result.finalCents, 0);
  assert.equal(result.capApplied, false);
});

test('rejeita apostas inválidas', () => {
  const invalidBets = [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '100',
    null,
    undefined,
  ];

  for (const betCents of invalidBets) {
    assert.throws(
      () => settleRoundWin({ baseWinCents: 100, betCents, multiplier: 1 }),
      `betCents inválido deveria lançar erro: ${String(betCents)}`,
    );
  }
});

test('rejeita prêmios negativos, não inteiros ou inseguros', () => {
  const invalidWins = [
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '100',
    null,
    undefined,
  ];

  for (const baseWinCents of invalidWins) {
    assert.throws(
      () => settleRoundWin({ baseWinCents, betCents: 100, multiplier: 1 }),
      `baseWinCents inválido deveria lançar erro: ${String(baseWinCents)}`,
    );
  }
});

test('rejeita multiplicadores inválidos', () => {
  const invalidMultipliers = [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
    undefined,
  ];

  for (const multiplier of invalidMultipliers) {
    assert.throws(
      () => settleRoundWin({ baseWinCents: 100, betCents: 100, multiplier }),
      `multiplier inválido deveria lançar erro: ${String(multiplier)}`,
    );
  }
});

test('rejeita opções inválidas e a opção de cap não booleana', () => {
  assert.throws(() => settleRoundWin(null), TypeError);
  assert.throws(() => settleRoundWin([]), TypeError);
  assert.throws(() => settleRoundWin('opções'), TypeError);
  assert.throws(() => settleRoundWin(42), TypeError);
  assert.throws(() => settleRoundWin({}), TypeError);
  assert.throws(() => settleRoundWin({ baseWinCents: 100 }), TypeError);
  assert.throws(
    () => settleRoundWin({
      baseWinCents: 100,
      betCents: 100,
      multiplier: 1,
      applyExperimentalCap: 'true',
    }),
    TypeError,
  );
});

test('rejeita overflow em baseWinCents × multiplier', () => {
  assert.throws(
    () => settleRoundWin({
      baseWinCents: Number.MAX_SAFE_INTEGER,
      betCents: 1,
      multiplier: 2,
    }),
    RangeError,
  );

  assert.throws(
    () => settleRoundWin({
      baseWinCents: Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1,
      betCents: 1,
      multiplier: 2,
    }),
    RangeError,
  );
});

test('rejeita overflow em betCents × 2.500', () => {
  assert.throws(
    () => settleRoundWin({
      baseWinCents: 0,
      betCents: Math.floor(Number.MAX_SAFE_INTEGER / CAP_MULTIPLIER) + 1,
      multiplier: 1,
    }),
    RangeError,
  );
});

test('aceita o maior betCents cujo cap ainda é inteiro seguro', () => {
  const betCents = Math.floor(Number.MAX_SAFE_INTEGER / CAP_MULTIPLIER);
  const result = settleRoundWin({ baseWinCents: 0, betCents, multiplier: 1 });

  assert.equal(result.capCents, betCents * CAP_MULTIPLIER);
  assert.ok(Number.isSafeInteger(result.capCents));
  assert.equal(result.finalCents, 0);
});

test('round-settlement reutiliza applyWinCap e não usa Math.random', () => {
  const source = readFileSync(
    new URL('../js/round-settlement.js', import.meta.url),
    'utf8',
  );

  assert.ok(!source.includes('Math.random'));
  assert.ok(source.includes('applyWinCap'));
  assert.ok(source.includes('MAX_WIN_MULTIPLIER'));
  assert.match(source, /from '\.\/experimental-multipliers\.js'/);
});

test('canSettleRoundWin aceita o domínio normal, inclusive prêmio zero', () => {
  assert.equal(canSettleRoundWin({ baseWinCents: 0, betCents: 1, multiplier: 1 }), true);
  assert.equal(canSettleRoundWin({ baseWinCents: 500, betCents: 100, multiplier: 50 }), true);
  assert.equal(canSettleRoundWin({ baseWinCents: 250000, betCents: 100, multiplier: 2 }), true);
  assert.equal(
    canSettleRoundWin({ baseWinCents: 0, betCents: 100, multiplier: 1, applyExperimentalCap: true }),
    true,
  );
});

test('canSettleRoundWin rejeita entradas fora do contrato sem lançar', () => {
  assert.equal(canSettleRoundWin(), false);
  assert.equal(canSettleRoundWin(null), false);
  assert.equal(canSettleRoundWin([]), false);
  assert.equal(canSettleRoundWin('opções'), false);
  assert.equal(canSettleRoundWin(42), false);
  assert.equal(canSettleRoundWin(false), false);
  assert.equal(canSettleRoundWin({}), false);

  for (const baseWinCents of [-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null]) {
    assert.equal(
      canSettleRoundWin({ baseWinCents, betCents: 100, multiplier: 1 }),
      false,
      `baseWinCents inválido deveria ser recusado: ${String(baseWinCents)}`,
    );
  }

  for (const betCents of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null]) {
    assert.equal(
      canSettleRoundWin({ baseWinCents: 100, betCents, multiplier: 1 }),
      false,
      `betCents inválido deveria ser recusado: ${String(betCents)}`,
    );
  }

  for (const multiplier of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
    assert.equal(
      canSettleRoundWin({ baseWinCents: 100, betCents: 100, multiplier }),
      false,
      `multiplier inválido deveria ser recusado: ${String(multiplier)}`,
    );
  }
});

test('canSettleRoundWin rejeita overflow de cap e de multiplicação', () => {
  const betOverflow = Math.floor(Number.MAX_SAFE_INTEGER / CAP_MULTIPLIER) + 1;
  assert.equal(
    canSettleRoundWin({ baseWinCents: 0, betCents: betOverflow, multiplier: 1 }),
    false,
  );

  const baseOverflow = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
  assert.equal(
    canSettleRoundWin({ baseWinCents: baseOverflow, betCents: 1, multiplier: 2 }),
    false,
  );
});

test('canSettleRoundWin não muta a entrada e aceita objeto congelado', () => {
  const input = Object.freeze({ baseWinCents: 500, betCents: 100, multiplier: 5 });
  assert.equal(canSettleRoundWin(input), true);
  assert.deepEqual(input, { baseWinCents: 500, betCents: 100, multiplier: 5 });
});

test('quando canSettleRoundWin aceita, settleRoundWin não lança', () => {
  const bets = [1, 2, 5, 100, 333, 1000, 12345];
  const wins = [0, 1, 99, 2500, 250000, 999999];
  const multipliers = [1, 2, 5, 10, 50];

  for (const betCents of bets) {
    for (const baseWinCents of wins) {
      for (const multiplier of multipliers) {
        const options = { baseWinCents, betCents, multiplier };
        if (!canSettleRoundWin(options)) continue;
        assert.doesNotThrow(() => settleRoundWin(options));
      }
    }
  }
});
