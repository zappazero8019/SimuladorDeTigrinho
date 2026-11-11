import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  DEFAULTS,
  Z_95,
  parseCliArgs,
  runAudit,
  serializeBaseRecord,
  serializeBaseRecordCanonical,
  serializeExperimentalMultiplier,
} from '../tools/audit-abc.mjs';
import { MAX_WIN_MULTIPLIER } from '../js/experimental-multipliers.js';

const SIMPLE_GRID = [
  ['WILD', 'ORANGE', 'BAG'],
  ['CHARM', 'WILD', 'INGOT'],
  ['ENVELOPE', 'FIRECRACKER', 'WILD'],
];

function makeBaseResult({
  totalWin = 0,
  featureTriggered = false,
  chosenSymbol = 'ORANGE',
  grid = SIMPLE_GRID,
  fullGrid = false,
} = {}) {
  return {
    totalWin,
    grid,
    featureTriggered,
    feature: featureTriggered ? { chosenSymbol } : null,
    hit: totalWin > 0,
    fullGrid,
  };
}

function makeScriptedPlaySpin(script) {
  let calls = 0;
  const fn = () => {
    const result = script[calls % script.length];
    calls++;
    return result;
  };
  fn.calls = () => calls;
  return fn;
}

function expectedInterval(values) {
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  const standardDeviation = Math.sqrt(variance);
  const standardError = standardDeviation / Math.sqrt(n);
  return {
    mean,
    standardDeviation,
    standardError,
    lower: mean - Z_95 * standardError,
    upper: mean + Z_95 * standardError,
  };
}

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

// ---------------------------------------------------------------------------
// Reprodutibilidade e independência
// ---------------------------------------------------------------------------

test('é reprodutível com as mesmas sementes', () => {
  const options = {
    rounds: 60,
    baseSeed: 123456789,
    expSeed: 987654321,
    betCents: 100,
  };
  const first = runAudit(options);
  const second = runAudit(options);

  assert.deepEqual(first.metrics, second.metrics);
  assert.deepEqual(first.differenceCminusB, second.differenceCminusB);
  assert.deepEqual(first.confidenceIntervals95, second.confidenceIntervals95);
  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.hashes, second.hashes);
  assert.equal(first.execution.playSpinCalls, 60);
  assert.equal(first.execution.experimentalDraws, 60);
});

test('RNG base e RNG experimental são independentes', () => {
  const commonBase = runAudit({
    rounds: 120,
    baseSeed: 111,
    expSeed: 222,
  });
  const otherExp = runAudit({
    rounds: 120,
    baseSeed: 111,
    expSeed: 333,
  });
  const otherBase = runAudit({
    rounds: 120,
    baseSeed: 444,
    expSeed: 222,
  });

  // Trocar apenas a semente experimental não altera a sequência-base.
  assert.equal(otherExp.hashes.baseSequence, commonBase.hashes.baseSequence);
  assert.notEqual(
    otherExp.hashes.experimentalMultiplierSequence,
    commonBase.hashes.experimentalMultiplierSequence,
  );

  // Trocar apenas a semente-base não altera a sequência experimental.
  assert.equal(
    otherBase.hashes.experimentalMultiplierSequence,
    commonBase.hashes.experimentalMultiplierSequence,
  );
  assert.notEqual(otherBase.hashes.baseSequence, commonBase.hashes.baseSequence);
});

test('padrões documentados correspondem ao baseline histórico', () => {
  assert.equal(DEFAULTS.rounds, 10_000_000);
  assert.equal(DEFAULTS.baseSeed, 123456789);
  assert.equal(DEFAULTS.expSeed, 987654321);
  assert.equal(DEFAULTS.betCents, 100);
  assert.deepEqual(DEFAULTS.scenarios, ['A', 'B', 'C']);
});

// ---------------------------------------------------------------------------
// Uma rodada-base, três cenários
// ---------------------------------------------------------------------------

test('chama playSpin uma única vez por rodada', () => {
  const playSpinFn = makeScriptedPlaySpin([makeBaseResult({ totalWin: 1 })]);
  const audit = runAudit({ rounds: 9, playSpinFn });

  assert.equal(playSpinFn.calls(), 9);
  assert.equal(audit.execution.playSpinCalls, 9);
  assert.equal(audit.execution.rounds, 9);
});

test('reutiliza o mesmo resultado-base em A, B e C', () => {
  const seen = [];
  const audit = runAudit({
    rounds: 5,
    playSpinFn: () => makeBaseResult({ totalWin: 10 }),
    drawMultiplierFn: () => 5,
    onRound: (round) => seen.push(round),
  });

  assert.equal(seen.length, 5);
  for (const round of seen) {
    assert.equal(round.baseWinCents, 1000);
    assert.equal(round.settlements.A.baseWinCents, round.baseWinCents);
    assert.equal(round.settlements.B.baseWinCents, round.baseWinCents);
    assert.equal(round.settlements.C.baseWinCents, round.baseWinCents);
    assert.equal(round.settlements.A.finalCents, 1000);
    assert.equal(round.settlements.B.finalCents, 5000);
    assert.equal(round.settlements.C.finalCents, 5000);
  }

  assert.equal(audit.metrics.A.totalWinCents, 5000);
  assert.equal(audit.metrics.B.totalWinCents, 25000);
  assert.equal(audit.metrics.C.totalWinCents, 25000);
});

test('sorteia o multiplicador uma vez por rodada e reutiliza em B e C', () => {
  let draws = 0;
  let roundsSeen = 0;
  const audit = runAudit({
    rounds: 4,
    playSpinFn: () => makeBaseResult({ totalWin: 1 }),
    drawMultiplierFn: () => {
      draws++;
      return 50;
    },
    onRound: ({ multiplier, settlements }) => {
      roundsSeen++;
      assert.equal(multiplier, 50);
      assert.equal(settlements.B.multiplier, 50);
      assert.equal(settlements.C.multiplier, 50);
    },
  });

  assert.equal(draws, 4);
  assert.equal(roundsSeen, 4);
  assert.equal(audit.execution.experimentalDraws, 4);
  assert.equal(audit.metrics.B.capApplications, 0);
});

test('não consome RNG experimental no cenário A isolado', () => {
  const audit = runAudit({
    rounds: 6,
    scenarios: ['A'],
    playSpinFn: () => makeBaseResult({ totalWin: 1 }),
    drawMultiplierFn: () => {
      throw new Error('o cenário A não deveria sortear multiplicador');
    },
  });

  assert.equal(audit.execution.experimentalDraws, 0);
  assert.equal(audit.hashes.experimentalMultiplierSequence, null);
  assert.deepEqual(Object.keys(audit.metrics), ['A']);
  assert.equal(audit.differenceCminusB, null);
  assert.equal(audit.metrics.A.totalWinCents, 600);
});

// ---------------------------------------------------------------------------
// Cap experimental x cap interno
// ---------------------------------------------------------------------------

test('B e C diferem exclusivamente pelo cap experimental final', () => {
  const rounds = [
    makeBaseResult({ totalWin: 10 }), // 1.000 centavos × 50 = 50.000
    makeBaseResult({ totalWin: 100 }), // 10.000 centavos × 50 = 500.000
  ];
  const seen = [];
  const audit = runAudit({
    rounds: 2,
    playSpinFn: makeScriptedPlaySpin(rounds),
    drawMultiplierFn: () => 50,
    onRound: (round) => seen.push(round),
  });

  // Rodada sem cap experimental: B e C idênticos.
  assert.equal(seen[0].settlements.B.capApplied, false);
  assert.equal(
    seen[0].settlements.B.finalCents,
    seen[0].settlements.C.finalCents,
  );

  // Rodada com cap experimental: apenas B é reduzido.
  assert.equal(seen[1].settlements.B.capApplied, true);
  assert.equal(seen[1].settlements.B.finalCents, 250000);
  assert.equal(seen[1].settlements.C.capApplied, false);
  assert.equal(seen[1].settlements.C.finalCents, 500000);
  assert.equal(
    seen[1].settlements.B.baseWinCents,
    seen[1].settlements.C.baseWinCents,
  );
  assert.equal(seen[1].settlements.B.multiplier, 50);
  assert.equal(seen[1].settlements.C.multiplier, 50);

  assert.equal(audit.metrics.B.capApplications, 1);
  assert.equal(audit.metrics.A.capApplications, 0);
  assert.equal(audit.metrics.C.capApplications, 0);
  assert.equal(audit.differenceCminusB.totalCents, 250000);
  assert.equal(audit.differenceCminusB.excessAboveExperimentalCapCents, 250000);
  assert.equal(audit.differenceCminusB.equalsCapExcess, true);
});

test('preserva o cap interno do motor nos três cenários', () => {
  const betCents = 100;
  const seen = [];
  const audit = runAudit({
    rounds: 200,
    baseSeed: 123456789,
    expSeed: 987654321,
    betCents,
    onRound: (round) => seen.push(round),
  });

  assert.equal(audit.parameters.enforceMaxWinBaseEngine, true);
  assert.equal(
    audit.parameters.internalMaxWinMultiplier,
    MAX_WIN_MULTIPLIER,
  );

  for (const round of seen) {
    assert.ok(
      round.baseWinCents <= betCents * MAX_WIN_MULTIPLIER,
      `prêmio-base ${round.baseWinCents} excedeu o cap interno`,
    );
    assert.equal(round.settlements.A.baseWinCents, round.baseWinCents);
    assert.equal(round.settlements.B.baseWinCents, round.baseWinCents);
    assert.equal(round.settlements.C.baseWinCents, round.baseWinCents);
  }
});

// ---------------------------------------------------------------------------
// Métricas e intervalos de confiança
// ---------------------------------------------------------------------------

test('métricas e IC95% seguem as fórmulas documentadas', () => {
  const winsCents = [0, 100, 200, 500];
  const featureFlags = [false, false, false, true];
  let index = 0;

  const audit = runAudit({
    rounds: 4,
    betCents: 100,
    playSpinFn: () => {
      const totalWin = winsCents[index] / 100;
      const featureTriggered = featureFlags[index];
      index++;
      return makeBaseResult({ totalWin, featureTriggered });
    },
    drawMultiplierFn: () => 1,
  });

  for (const scenario of ['A', 'B', 'C']) {
    const metrics = audit.metrics[scenario];

    assert.equal(metrics.totalBetCents, 400);
    assert.equal(metrics.totalWinCents, 800);
    assert.equal(metrics.rtpPercent, 200);

    assert.equal(metrics.baseBetCents, 300);
    assert.equal(metrics.baseWinCents, 300);
    assert.equal(metrics.featureBetCents, 100);
    assert.equal(metrics.featureWinCents, 500);

    // RTP condicional usa a aposta do próprio segmento.
    assert.equal(metrics.baseRtpConditionalPercent, 100);
    assert.equal(metrics.featureRtpConditionalPercent, 500);

    // Contribuição usa a aposta total e soma o RTP total.
    assert.equal(metrics.baseContributionToTotalRtpPercent, 75);
    assert.equal(metrics.featureContributionToTotalRtpPercent, 125);
    assert.equal(
      metrics.baseContributionToTotalRtpPercent +
        metrics.featureContributionToTotalRtpPercent,
      metrics.rtpPercent,
    );

    assert.equal(metrics.hitRounds, 3);
    assert.equal(metrics.hitRatePercent, 75);
    assert.equal(metrics.featureRounds, 1);
    assert.equal(metrics.featureRatePercent, 25);
    assert.equal(metrics.capApplications, 0);
  }

  const expected = expectedInterval([0, 100, 200, 500]);
  for (const scenario of ['A', 'B', 'C']) {
    const interval = audit.confidenceIntervals95[`rtp${scenario}`];
    assert.equal(interval.n, 4);
    assert.equal(interval.z, Z_95);
    assertClose(interval.mean, expected.mean);
    assertClose(interval.standardDeviation, expected.standardDeviation);
    assertClose(interval.standardError, expected.standardError);
    assertClose(interval.lower, expected.lower);
    assertClose(interval.upper, expected.upper);
  }

  const difference = audit.confidenceIntervals95.differenceCminusB;
  assert.equal(difference.n, 4);
  assert.equal(difference.mean, 0);
  assert.equal(difference.standardDeviation, 0);
  assert.equal(difference.standardError, 0);
  assert.equal(difference.lower, 0);
  assert.equal(difference.upper, 0);
});

test('diferença C−B é calculada por rodada e coincide com o excedente do cap', () => {
  const wins = [10, 100, 1, 200];
  const audit = runAudit({
    rounds: 4,
    betCents: 100,
    playSpinFn: makeScriptedPlaySpin(
      wins.map((totalWin) => makeBaseResult({ totalWin })),
    ),
    drawMultiplierFn: () => 50,
  });

  // Rodadas 2 e 4 excedem o cap de 250.000 centavos após o multiplicador ×50.
  const expectedExcess =
    (100 * 100 * 50 - 250000) + (200 * 100 * 50 - 250000);
  assert.equal(expectedExcess, 1000000);

  assert.equal(audit.differenceCminusB.totalCents, expectedExcess);
  assert.equal(
    audit.differenceCminusB.percentagePoints,
    (expectedExcess / 400) * 100,
  );
  assert.equal(
    audit.confidenceIntervals95.differenceCminusB.mean,
    (expectedExcess / 400) * 100,
  );
  assert.equal(audit.metrics.B.capApplications, 2);
  assert.equal(audit.differenceCminusB.equalsCapExcess, true);
});

// ---------------------------------------------------------------------------
// Serialização e hashes
// ---------------------------------------------------------------------------

test('serialização é documentada, determinística e inequívoca', () => {
  const grid = [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
    ['G', 'H', 'I'],
  ];
  const plain = makeBaseResult({ totalWin: 5, grid });
  const feature = makeBaseResult({
    totalWin: 7,
    featureTriggered: true,
    chosenSymbol: 'CHARM',
    grid: [
      ['CHARM', null, 'WILD'],
      [null, 'WILD', null],
      ['CHARM', null, 'WILD'],
    ],
  });

  assert.equal(serializeBaseRecord(plain, 500), 'ABCDEFGHI|-|500\n');
  assert.equal(
    serializeBaseRecord(feature, 700),
    `${['CHARM', '', 'WILD', '', 'WILD', '', 'CHARM', '', 'WILD'].join('')}|CHARM|700\n`,
  );
  assert.ok(serializeBaseRecordCanonical(feature, 700).includes('null'));
  assert.equal(serializeExperimentalMultiplier(5), '5\n');

  const playSpinFn = makeScriptedPlaySpin([plain, feature]);
  const audit = runAudit({
    rounds: 2,
    playSpinFn,
    drawMultiplierFn: () => 5,
  });

  const expectedBase = createHash('sha256')
    .update(serializeBaseRecord(plain, 500))
    .update(serializeBaseRecord(feature, 700))
    .digest('hex');
  assert.equal(audit.hashes.baseSequence, expectedBase);

  const expectedCanonical = createHash('sha256')
    .update(serializeBaseRecordCanonical(plain, 500))
    .update(serializeBaseRecordCanonical(feature, 700))
    .digest('hex');
  assert.equal(audit.hashes.baseSequenceCanonical, expectedCanonical);

  const expectedExperimental = createHash('sha256')
    .update(serializeExperimentalMultiplier(5))
    .update(serializeExperimentalMultiplier(5))
    .digest('hex');
  assert.equal(
    audit.hashes.experimentalMultiplierSequence,
    expectedExperimental,
  );
});

test('hashes são idênticos em execuções repetidas', () => {
  const options = { rounds: 40, baseSeed: 7, expSeed: 8 };
  const first = runAudit(options);
  const second = runAudit(options);

  assert.equal(first.hashes.baseSequence, second.hashes.baseSequence);
  assert.equal(
    first.hashes.baseSequenceCanonical,
    second.hashes.baseSequenceCanonical,
  );
  assert.equal(
    first.hashes.experimentalMultiplierSequence,
    second.hashes.experimentalMultiplierSequence,
  );
});

// ---------------------------------------------------------------------------
// Validação de parâmetros
// ---------------------------------------------------------------------------

test('rejeita parâmetros inválidos', () => {
  const invalidOptions = [
    { rounds: 0 },
    { rounds: -1 },
    { rounds: 1.5 },
    { rounds: NaN },
    { rounds: Infinity },
    { rounds: '10' },
    { rounds: null },
    { baseSeed: 1.5 },
    { baseSeed: NaN },
    { baseSeed: Infinity },
    { expSeed: 1.5 },
    { expSeed: NaN },
    { betCents: 0 },
    { betCents: -1 },
    { betCents: 1.5 },
    { betCents: '100' },
    { scenarios: [] },
    { scenarios: ['D'] },
    { scenarios: ['A', 'A'] },
    { scenarios: 'A' },
    { scenarios: [1] },
    { playSpinFn: 1 },
    { drawMultiplierFn: 1 },
    { onRound: 1 },
    { opcaoDesconhecida: true },
  ];

  for (const options of invalidOptions) {
    assert.throws(
      () => runAudit({ rounds: 2, ...options }),
      `opções inválidas deveriam lançar erro: ${JSON.stringify(options)}`,
    );
  }

  assert.throws(() => runAudit(null), TypeError);
  assert.throws(() => runAudit([]), TypeError);
  assert.throws(() => runAudit('opções'), TypeError);
});

test('rejeita overflow nas apostas acumuladas e no cap experimental', () => {
  assert.throws(
    () =>
      runAudit({
        rounds: Math.floor(Number.MAX_SAFE_INTEGER / 100) + 1,
        betCents: 100,
      }),
    RangeError,
  );

  assert.throws(
    () =>
      runAudit({
        rounds: 1,
        betCents: Math.floor(Number.MAX_SAFE_INTEGER / MAX_WIN_MULTIPLIER) + 1,
      }),
    RangeError,
  );
});

test('CLI interpreta argumentos válidos e rejeita inválidos', () => {
  const parsed = parseCliArgs([
    '--rounds',
    '123',
    '--base-seed',
    '1',
    '--exp-seed',
    '2',
    '--bet-cents',
    '50',
    '--out',
    'relatorio.json',
  ]);
  assert.deepEqual(parsed, {
    help: false,
    options: {
      rounds: 123,
      baseSeed: 1,
      expSeed: 2,
      betCents: 50,
    },
    out: 'relatorio.json',
  });

  assert.deepEqual(parseCliArgs(['--help']), {
    help: true,
    options: null,
    out: null,
  });
  assert.deepEqual(parseCliArgs([]), {
    help: false,
    options: {},
    out: null,
  });

  assert.throws(() => parseCliArgs(['--rounds', 'abc']), RangeError);
  assert.throws(() => parseCliArgs(['--rounds', '1.5']), RangeError);
  assert.throws(() => parseCliArgs(['--nao-existe', '1']));
});

test('harness não usa Math.random e reutiliza os contratos existentes', () => {
  const source = readFileSync(
    new URL('../tools/audit-abc.mjs', import.meta.url),
    'utf8',
  );

  assert.ok(!source.includes('Math.random'));
  assert.ok(source.includes('createRngPair'));
  assert.ok(source.includes('playSpin'));
  assert.ok(source.includes('drawExperimentalMultiplier'));
  assert.ok(source.includes('settleRoundWin'));
  assert.ok(source.includes('createHash'));
});
