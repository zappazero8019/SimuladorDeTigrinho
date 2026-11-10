/**
 * Sistema experimental de multiplicadores de vitória.
 *
 * Este módulo é independente do motor matemático (game-engine.js, payout.js,
 * reels.js, config.js). Não altera probabilidades, paytable, símbolos ou
 * comportamento do Fortune Tiger original.
 *
 * Os multiplicadores experimentais (×2, ×5, ×10, ×50) são sorteados
 * independentemente antes de cada rodada, aplicados ao prêmio efetivamente
 * recebido e descartados ao final da rodada. Não persistem entre rodadas.
 */

// Limite máximo de vitória: 2.500 vezes a aposta (conforme GAME_CONSTANTS).
export const MAX_WIN_MULTIPLIER = 2500;

// Multiplicadores experimentais disponíveis.
export const EXPERIMENTAL_MULTIPLIERS = Object.freeze({
  X2:  { value: 2,  label: '×2',  color: '#7CFC00' },
  X5:  { value: 5,  label: '×5',  color: '#ffd700' },
  X10: { value: 10, label: '×10', color: '#ff8c00' },
  X50: { value: 50, label: '×50', color: '#ff1a1a' },
});

// Configuração do sorteio experimental.
export const EXPERIMENTAL_MULTIPLIER_CONFIG = Object.freeze({
  // Probabilidade de ativação por rodada (fixa, independente de histórico).
  activationProbability: 0.05,
  // Pesos para sorteio entre os multiplicadores disponíveis.
  multiplierWeights: Object.freeze({ 2: 40, 5: 30, 10: 20, 50: 10 }),
});

/**
 * Sorteia um multiplicador experimental para a rodada atual.
 *
 * @param {object} rng - Gerador aleatório independente com métodos random() e pickWeighted().
 * @param {object} config - Configuração de ativação e pesos.
 * @returns {number} Valor do multiplicador (1 = sem multiplicador experimental).
 */
export function drawExperimentalMultiplier(rng, config = EXPERIMENTAL_MULTIPLIER_CONFIG) {
  const shouldActivate = rng.random() < config.activationProbability;
  if (!shouldActivate) return 1;

  const values = Object.keys(EXPERIMENTAL_MULTIPLIERS)
    .map((k) => EXPERIMENTAL_MULTIPLIERS[k].value);
  const weights = values.map((v) => config.multiplierWeights[v] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let threshold = rng.random() * totalWeight;
  for (let i = 0; i < values.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return values[i];
  }
  return values[values.length - 1];
}

/**
 * Aplica o limite máximo de vitória (2.500× a aposta) sobre o valor em centavos.
 *
 * @param {number} winCents - Valor do prêmio em centavos.
 * @param {number} betCents - Valor da aposta em centavos.
 * @returns {number} Valor limitado ao máximo permitido, em centavos.
 */
export function applyWinCap(winCents, betCents) {
  const capCents = betCents * MAX_WIN_MULTIPLIER;
  return winCents > capCents ? capCents : winCents;
}

/**
 * Converte um valor monetário em reais para centavos inteiros.
 *
 * @param {number} value - Valor em reais (ex: 1.50).
 * @returns {number} Valor em centavos (ex: 150).
 */
export function toCents(value) {
  return Math.round(Number(value) * 100);
}

/**
 * Converte centavos inteiros para valor em reais.
 *
 * @param {number} cents - Valor em centavos.
 * @returns {number} Valor em reais.
 */
export function fromCents(cents) {
  return Math.round(Number(cents)) / 100;
}
