#!/usr/bin/env node
/**
 * Harness independente de auditoria matemática A/B/C.
 *
 * Cenários:
 * - A: motor-base puro (sem multiplicador experimental e sem cap experimental).
 * - B: motor-base + multiplicador experimental + cap experimental final 2.500×.
 * - C: motor-base + multiplicador experimental sem o cap experimental final.
 *
 * O cap interno do motor permanece ativo nos três cenários, pois playSpin() é
 * chamado com EXPERIMENTAL_PROFILE (enforceMaxWin: true) e o prêmio-base já
 * chega em centavos com esse limite incorporado.
 *
 * O harness não altera o motor, os pesos, o paytable, a Feature, os caps ou
 * qualquer módulo da aplicação. Ele apenas lê os contratos existentes.
 *
 * Uso:
 *   node tools/audit-abc.mjs --rounds 10000000 \
 *     --base-seed 123456789 --exp-seed 987654321
 *
 * O JSON é sempre escrito no stdout. Um arquivo só é criado quando --out é
 * fornecido explicitamente.
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { EXPERIMENTAL_PROFILE, GAME_CONSTANTS } from '../js/config.js';
import { playSpin } from '../js/game-engine.js';
import {
  drawExperimentalMultiplier,
  EXPERIMENTAL_MULTIPLIER_CONFIG,
  MAX_WIN_MULTIPLIER,
  toCents,
} from '../js/experimental-multipliers.js';
import { createRngPair } from '../js/rng-provider.js';
import { settleRoundWin } from '../js/round-settlement.js';

/** Quantil 97,5% da normal padrão, usado no IC95%. */
export const Z_95 = 1.959963984540054;

export const DEFAULTS = Object.freeze({
  rounds: 10_000_000,
  baseSeed: 123456789,
  expSeed: 987654321,
  betCents: 100,
  scenarios: Object.freeze(['A', 'B', 'C']),
});

const SCENARIO_ORDER = Object.freeze(['A', 'B', 'C']);

export const SCENARIO_DEFINITIONS = Object.freeze({
  A: 'motor-base puro, sem multiplicador experimental',
  B: 'motor-base + multiplicador experimental + cap experimental final 2500x (cap interno do motor mantido)',
  C: 'motor-base + multiplicador experimental sem cap experimental final (cap interno do motor mantido)',
});

const USAGE = `Uso:
  node tools/audit-abc.mjs [--rounds N] [--base-seed N] [--exp-seed N]
                           [--bet-cents N] [--out CAMINHO]

Padrões:
  --rounds      ${DEFAULTS.rounds}
  --base-seed   ${DEFAULTS.baseSeed}
  --exp-seed    ${DEFAULTS.expSeed}
  --bet-cents   ${DEFAULTS.betCents}

O JSON é sempre impresso no stdout. Use --out para também salvar em arquivo.
`;

// ---------------------------------------------------------------------------
// Validação de parâmetros
// ---------------------------------------------------------------------------

function assertSafeInteger(name, value, min, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve ser um número finito.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} deve ser um inteiro seguro.`);
  }
  if (value < min || value > max) {
    throw new RangeError(`${name} deve estar entre ${min} e ${max}.`);
  }
}

function normalizeScenarios(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('scenarios deve ser um array não vazio.');
  }

  const selected = new Set();
  for (const scenario of value) {
    if (typeof scenario !== 'string' || !SCENARIO_ORDER.includes(scenario)) {
      throw new RangeError(`cenário inválido: ${String(scenario)}.`);
    }
    if (selected.has(scenario)) {
      throw new RangeError(`cenário duplicado: ${scenario}.`);
    }
    selected.add(scenario);
  }

  return SCENARIO_ORDER.filter((scenario) => selected.has(scenario));
}

function normalizeOptions(options) {
  if (options === undefined) options = {};
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('runAudit: opções inválidas.');
  }

  const allowed = new Set([
    'rounds',
    'baseSeed',
    'expSeed',
    'betCents',
    'scenarios',
    'playSpinFn',
    'drawMultiplierFn',
    'onRound',
  ]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`opção desconhecida: ${key}.`);
  }

  const {
    rounds = DEFAULTS.rounds,
    baseSeed = DEFAULTS.baseSeed,
    expSeed = DEFAULTS.expSeed,
    betCents = DEFAULTS.betCents,
    scenarios = DEFAULTS.scenarios,
    playSpinFn = playSpin,
    drawMultiplierFn = drawExperimentalMultiplier,
    onRound = null,
  } = options;

  assertSafeInteger('rounds', rounds, 1);
  assertSafeInteger(
    'baseSeed',
    baseSeed,
    Number.MIN_SAFE_INTEGER,
  );
  assertSafeInteger(
    'expSeed',
    expSeed,
    Number.MIN_SAFE_INTEGER,
  );
  assertSafeInteger('betCents', betCents, 1);

  const totalBetCents = rounds * betCents;
  if (!Number.isSafeInteger(totalBetCents)) {
    throw new RangeError('rounds × betCents ultrapassa Number.MAX_SAFE_INTEGER.');
  }
  if (!Number.isSafeInteger(betCents * MAX_WIN_MULTIPLIER)) {
    throw new RangeError('betCents × 2500 ultrapassa Number.MAX_SAFE_INTEGER.');
  }

  if (typeof playSpinFn !== 'function') {
    throw new TypeError('playSpinFn deve ser uma função.');
  }
  if (typeof drawMultiplierFn !== 'function') {
    throw new TypeError('drawMultiplierFn deve ser uma função.');
  }
  if (onRound !== null && typeof onRound !== 'function') {
    throw new TypeError('onRound deve ser uma função ou null.');
  }

  return {
    rounds,
    baseSeed,
    expSeed,
    betCents,
    scenarios: normalizeScenarios(scenarios),
    playSpinFn,
    drawMultiplierFn,
    onRound,
  };
}

// ---------------------------------------------------------------------------
// Serialização e hashes
// ---------------------------------------------------------------------------

/**
 * Serialização histórica/compatível do resultado-base:
 *
 *   ${grid.flat().join("")}|${featureToken}|${baseCents}\n
 *
 * - grid: 3×3 em ordem row-major; símbolos concatenados; blank/null vira "".
 * - featureToken: chosenSymbol quando a Feature foi acionada, senão "-".
 * - baseCents: inteiro sem casas decimais.
 * - Registros separados por "\n"; campos por "|".
 *
 * Essa é a serialização usada na auditoria histórica e é mantida para que o
 * hash base coincida com o baseline. Como blanks são omitidos, ela não é
 * injetiva; por isso o harness também calcula a versão canônica abaixo.
 */
export function serializeBaseRecord(baseResult, baseWinCents) {
  const grid = baseResult.grid.flat().join('');
  const featureToken = baseResult.featureTriggered
    ? baseResult.feature.chosenSymbol
    : '-';
  return `${grid}|${featureToken}|${baseWinCents}\n`;
}

/**
 * Serialização canônica e inequívoca do resultado-base:
 *
 *   ${JSON.stringify(grid)}|${featureToken}|${baseCents}\n
 *
 * - grid: JSON de arrays 3×3, com null explícito para blanks.
 * - featureToken: chosenSymbol ou "-".
 * - baseCents: inteiro.
 * - Registros separados por "\n"; campos por "|". JSON não contém "|".
 *
 * Essa serialização não substitui a histórica; é um hash adicional que
 * preserva posições de blanks e elimina ambiguidades.
 */
export function serializeBaseRecordCanonical(baseResult, baseWinCents) {
  const grid = baseResult.grid.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? null : cell)),
  );
  const featureToken = baseResult.featureTriggered
    ? baseResult.feature.chosenSymbol
    : '-';
  return `${JSON.stringify(grid)}|${featureToken}|${baseWinCents}\n`;
}

/** Serialização do multiplicador experimental: um inteiro por linha. */
export function serializeExperimentalMultiplier(multiplier) {
  return `${multiplier}\n`;
}

// ---------------------------------------------------------------------------
// Estatística descritiva e IC95%
// ---------------------------------------------------------------------------

function createStats() {
  return { n: 0, mean: 0, m2: 0 };
}

function updateStats(stats, value) {
  stats.n += 1;
  const delta = value - stats.mean;
  stats.mean += delta / stats.n;
  stats.m2 += delta * (value - stats.mean);
}

/**
 * IC95% pela aproximação normal:
 *
 *   média = (1/n) Σ x_i
 *   s²    = (1/(n-1)) Σ (x_i - média)²
 *   EP    = s / √n
 *   IC95% = média ± 1,959963984540054 × EP
 *
 * Para RTP, x_i é o prêmio final da rodada dividido pela aposta da rodada,
 * multiplicado por 100. A média é o RTP em pontos percentuais e o intervalo
 * descreve a incerteza amostral desse RTP.
 *
 * Para a diferença C−B, x_i é a diferença pareada por rodada
 * (finalC−finalB)/aposta×100, usando a mesma rodada-base e o mesmo
 * multiplicador experimental. A média é a diferença C−B em pontos percentuais
 * e o intervalo descreve a incerteza amostral dessa diferença média.
 */
function summarizeStats(stats, exactMean) {
  const n = stats.n;
  const sampleVariance = n > 1 ? stats.m2 / (n - 1) : 0;
  const standardDeviation = Math.sqrt(sampleVariance);
  const standardError = n > 0 ? standardDeviation / Math.sqrt(n) : null;

  return {
    n,
    mean: exactMean,
    standardDeviation,
    standardError,
    z: Z_95,
    lower: standardError === null ? null : exactMean - Z_95 * standardError,
    upper: standardError === null ? null : exactMean + Z_95 * standardError,
    unit: 'percentage points',
  };
}

// ---------------------------------------------------------------------------
// Núcleo da auditoria
// ---------------------------------------------------------------------------

function createScenarioAccumulator() {
  return {
    totalWinCents: 0,
    baseWinCents: 0,
    featureWinCents: 0,
    capApplications: 0,
  };
}

function centsToBRL(cents) {
  return cents / 100;
}

function buildScenarioMetrics({
  scenario,
  accumulator,
  totalBetCents,
  baseBetCents,
  featureBetCents,
  rounds,
  hits,
  features,
  fullGrids,
}) {
  const baseRtpConditionalPercent = baseBetCents > 0
    ? (accumulator.baseWinCents / baseBetCents) * 100
    : null;
  const featureRtpConditionalPercent = featureBetCents > 0
    ? (accumulator.featureWinCents / featureBetCents) * 100
    : null;

  return {
    scenario,
    description: SCENARIO_DEFINITIONS[scenario],
    totalBetCents,
    totalBetBRL: centsToBRL(totalBetCents),
    totalWinCents: accumulator.totalWinCents,
    totalWinBRL: centsToBRL(accumulator.totalWinCents),
    rtpPercent: (accumulator.totalWinCents / totalBetCents) * 100,
    baseBetCents,
    baseBetBRL: centsToBRL(baseBetCents),
    baseWinCents: accumulator.baseWinCents,
    baseWinBRL: centsToBRL(accumulator.baseWinCents),
    featureBetCents,
    featureBetBRL: centsToBRL(featureBetCents),
    featureWinCents: accumulator.featureWinCents,
    featureWinBRL: centsToBRL(accumulator.featureWinCents),
    baseRtpConditionalPercent,
    featureRtpConditionalPercent,
    baseContributionToTotalRtpPercent:
      (accumulator.baseWinCents / totalBetCents) * 100,
    featureContributionToTotalRtpPercent:
      (accumulator.featureWinCents / totalBetCents) * 100,
    hitRatePercent: (hits / rounds) * 100,
    featureRatePercent: (features / rounds) * 100,
    capApplications: accumulator.capApplications,
    hitRounds: hits,
    featureRounds: features,
    fullGrids,
  };
}

/**
 * Executa a auditoria A/B/C.
 *
 * Opções públicas:
 * - rounds, baseSeed, expSeed, betCents, scenarios.
 *
 * Opções de instrumentação (usadas pelos testes; não alteram o padrão):
 * - playSpinFn, drawMultiplierFn, onRound.
 *
 * O loop chama playSpinFn uma única vez por rodada e cria os três cenários a
 * partir do mesmo resultado-base. O sorteio experimental é feito uma única vez
 * por rodada e reutilizado em B e C. Se apenas A for selecionado, nenhum
 * sorteio experimental é realizado.
 */
export function runAudit(options = {}) {
  const opts = normalizeOptions(options);
  const {
    rounds,
    baseSeed,
    expSeed,
    betCents,
    scenarios,
    playSpinFn,
    drawMultiplierFn,
    onRound,
  } = opts;

  if (EXPERIMENTAL_PROFILE.enforceMaxWin !== true) {
    throw new Error('EXPERIMENTAL_PROFILE precisa manter enforceMaxWin=true.');
  }

  const includeA = scenarios.includes('A');
  const includeB = scenarios.includes('B');
  const includeC = scenarios.includes('C');
  const includeExperimental = includeB || includeC;

  const betBRL = centsToBRL(betCents);
  const totalBetCents = rounds * betCents;

  const { base: baseRng, experimental: expRng } = createRngPair({
    baseSeed,
    expSeed,
  });

  const hashBase = createHash('sha256');
  const hashBaseCanonical = createHash('sha256');
  const hashExperimental = includeExperimental ? createHash('sha256') : null;

  const accumulators = {
    A: createScenarioAccumulator(),
    B: createScenarioAccumulator(),
    C: createScenarioAccumulator(),
  };
  const rtpStats = {
    A: createStats(),
    B: createStats(),
    C: createStats(),
  };
  const differenceStats = createStats();

  let hits = 0;
  let features = 0;
  let fullGrids = 0;
  let baseRounds = 0;
  let featureRounds = 0;
  let playSpinCalls = 0;
  let experimentalDraws = 0;
  let differenceCents = 0;
  let capExcessCents = 0;

  const startedAt = process.hrtime.bigint();

  for (let index = 0; index < rounds; index++) {
    const baseResult = playSpinFn({
      bet: betBRL,
      rng: baseRng,
      config: EXPERIMENTAL_PROFILE,
    });
    playSpinCalls++;

    const baseWinCents = toCents(baseResult.totalWin);
    if (!Number.isSafeInteger(baseWinCents) || baseWinCents < 0) {
      throw new RangeError('playSpin retornou totalWin inválido para centavos.');
    }

    hashBase.update(serializeBaseRecord(baseResult, baseWinCents));
    hashBaseCanonical.update(
      serializeBaseRecordCanonical(baseResult, baseWinCents),
    );

    if (baseResult.hit) hits++;
    if (baseResult.featureTriggered) {
      features++;
      featureRounds++;
    } else {
      baseRounds++;
    }
    if (baseResult.fullGrid) fullGrids++;

    let multiplier = 1;
    if (includeExperimental) {
      multiplier = drawMultiplierFn(
        expRng,
        EXPERIMENTAL_MULTIPLIER_CONFIG,
      );
      experimentalDraws++;
      if (!Number.isSafeInteger(multiplier) || multiplier < 1) {
        throw new RangeError('multiplicador experimental inválido.');
      }
      hashExperimental.update(serializeExperimentalMultiplier(multiplier));
    }

    const settlements = {};

    if (includeA) {
      const settlement = settleRoundWin({
        baseWinCents,
        betCents,
        multiplier: 1,
        applyExperimentalCap: false,
      });
      settlements.A = settlement;
      const accumulator = accumulators.A;
      accumulator.totalWinCents += settlement.finalCents;
      if (baseResult.featureTriggered) {
        accumulator.featureWinCents += settlement.finalCents;
      } else {
        accumulator.baseWinCents += settlement.finalCents;
      }
      if (settlement.capApplied) accumulator.capApplications++;
      updateStats(rtpStats.A, (settlement.finalCents / betCents) * 100);
    }

    if (includeB) {
      const settlement = settleRoundWin({
        baseWinCents,
        betCents,
        multiplier,
        applyExperimentalCap: true,
      });
      settlements.B = settlement;
      const accumulator = accumulators.B;
      accumulator.totalWinCents += settlement.finalCents;
      if (baseResult.featureTriggered) {
        accumulator.featureWinCents += settlement.finalCents;
      } else {
        accumulator.baseWinCents += settlement.finalCents;
      }
      if (settlement.capApplied) accumulator.capApplications++;
      updateStats(rtpStats.B, (settlement.finalCents / betCents) * 100);
    }

    if (includeC) {
      const settlement = settleRoundWin({
        baseWinCents,
        betCents,
        multiplier,
        applyExperimentalCap: false,
      });
      settlements.C = settlement;
      const accumulator = accumulators.C;
      accumulator.totalWinCents += settlement.finalCents;
      if (baseResult.featureTriggered) {
        accumulator.featureWinCents += settlement.finalCents;
      } else {
        accumulator.baseWinCents += settlement.finalCents;
      }
      if (settlement.capApplied) accumulator.capApplications++;
      updateStats(rtpStats.C, (settlement.finalCents / betCents) * 100);
    }

    if (includeB && includeC) {
      differenceCents +=
        settlements.C.finalCents - settlements.B.finalCents;
      if (settlements.B.capApplied) {
        capExcessCents +=
          settlements.B.multipliedCents - settlements.B.finalCents;
      }
      updateStats(
        differenceStats,
        ((settlements.C.finalCents - settlements.B.finalCents) / betCents) *
          100,
      );
    }

    if (onRound) {
      onRound({
        index,
        baseResult,
        baseWinCents,
        multiplier,
        settlements,
      });
    }
  }

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  for (const scenario of ['A', 'B', 'C']) {
    const accumulator = accumulators[scenario];
    for (const key of ['totalWinCents', 'baseWinCents', 'featureWinCents']) {
      if (!Number.isSafeInteger(accumulator[key])) {
        throw new RangeError(
          `acumulador ${scenario}.${key} ultrapassa Number.MAX_SAFE_INTEGER.`,
        );
      }
    }
  }

  const baseBetCents = baseRounds * betCents;
  const featureBetCents = featureRounds * betCents;
  if (
    !Number.isSafeInteger(baseBetCents) ||
    !Number.isSafeInteger(featureBetCents)
  ) {
    throw new RangeError('apostas acumuladas ultrapassam Number.MAX_SAFE_INTEGER.');
  }

  const metrics = {};
  const confidenceIntervals95 = {};
  for (const scenario of scenarios) {
    metrics[scenario] = buildScenarioMetrics({
      scenario,
      accumulator: accumulators[scenario],
      totalBetCents,
      baseBetCents,
      featureBetCents,
      rounds,
      hits,
      features,
      fullGrids,
    });
    confidenceIntervals95[`rtp${scenario}`] = summarizeStats(
      rtpStats[scenario],
      metrics[scenario].rtpPercent,
    );
  }

  let differenceCminusB = null;
  if (includeB && includeC) {
    const differencePercentagePoints =
      (differenceCents / totalBetCents) * 100;
    confidenceIntervals95.differenceCminusB = summarizeStats(
      differenceStats,
      differencePercentagePoints,
    );
    differenceCminusB = {
      totalCents: differenceCents,
      totalBRL: centsToBRL(differenceCents),
      percentagePoints: differencePercentagePoints,
      excessAboveExperimentalCapCents: capExcessCents,
      equalsCapExcess: differenceCents === capExcessCents,
      capApplicationsB: accumulators.B.capApplications,
    };
  }

  const hashes = {
    algorithm: 'sha256',
    baseSequence: hashBase.digest('hex'),
    baseSequenceCanonical: hashBaseCanonical.digest('hex'),
    experimentalMultiplierSequence: includeExperimental
      ? hashExperimental.digest('hex')
      : null,
    serialization: {
      baseSequence:
        "grid.flat().join('') + '|' + (featureTriggered ? chosenSymbol : '-') + '|' + baseWinCents + '\\n'",
      baseSequenceCanonical:
        "JSON.stringify(grid) + '|' + (featureTriggered ? chosenSymbol : '-') + '|' + baseWinCents + '\\n'",
      experimentalMultiplierSequence: "multiplier + '\\n'",
    },
  };

  const scenarioDefinitions = {};
  for (const scenario of scenarios) {
    scenarioDefinitions[scenario] = SCENARIO_DEFINITIONS[scenario];
  }

  return {
    parameters: {
      rounds,
      betCents,
      betBRL,
      baseSeed,
      expSeed,
      profile: EXPERIMENTAL_PROFILE.id,
      enforceMaxWinBaseEngine:
        EXPERIMENTAL_PROFILE.enforceMaxWin === true,
      internalMaxWinMultiplier: GAME_CONSTANTS.MAX_WIN_MULTIPLIER,
      experimentalMaxWinMultiplier: MAX_WIN_MULTIPLIER,
      experimentalActivationProbability:
        EXPERIMENTAL_MULTIPLIER_CONFIG.activationProbability,
      experimentalWeights: {
        ...EXPERIMENTAL_MULTIPLIER_CONFIG.multiplierWeights,
      },
      scenarios: [...scenarios],
    },
    scenarioDefinitions,
    metrics,
    differenceCminusB,
    confidenceIntervals95: {
      method:
        'normal approximation; z=1.959963984540054; sample variance with n-1; unit = percentage points',
      z: Z_95,
      ...confidenceIntervals95,
    },
    events: {
      hits,
      hitRatePercent: (hits / rounds) * 100,
      features,
      featureRatePercent: (features / rounds) * 100,
      fullGrids,
      baseRounds,
      featureRounds,
    },
    hashes,
    execution: {
      rounds,
      playSpinCalls,
      experimentalDraws,
      elapsedMs,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseIntegerArg(name, value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`${name} deve ser um inteiro seguro.`);
  }
  return parsed;
}

/**
 * Converte argumentos CLI em opções de runAudit.
 * Exportado para permitir testes sem executar a CLI.
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      rounds: { type: 'string' },
      'base-seed': { type: 'string' },
      'exp-seed': { type: 'string' },
      'bet-cents': { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) return { help: true, options: null, out: null };

  const options = {};
  if (values.rounds !== undefined) {
    options.rounds = parseIntegerArg('--rounds', values.rounds);
  }
  if (values['base-seed'] !== undefined) {
    options.baseSeed = parseIntegerArg('--base-seed', values['base-seed']);
  }
  if (values['exp-seed'] !== undefined) {
    options.expSeed = parseIntegerArg('--exp-seed', values['exp-seed']);
  }
  if (values['bet-cents'] !== undefined) {
    options.betCents = parseIntegerArg(
      '--bet-cents',
      values['bet-cents'],
    );
  }

  return {
    help: false,
    options,
    out: values.out ?? null,
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
      process.stdout.write(USAGE);
      return;
    }

    const result = runAudit(parsed.options);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    process.stdout.write(json);

    if (parsed.out) {
      writeFileSync(resolve(parsed.out), json, 'utf8');
    }
  } catch (error) {
    process.stderr.write(`audit-abc: ${error.message}\n`);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
