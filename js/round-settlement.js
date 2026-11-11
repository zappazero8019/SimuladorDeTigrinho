/**
 * Liquidação de uma rodada — somente centavos inteiros.
 *
 * Contrato verificado no projeto (js/game-engine.js, js/payout.js,
 * js/experimental-multipliers.js e js/main.js):
 *
 * - playSpin() devolve totalWin em reais, já arredondado a 2 casas.
 * - Esse totalWin já contém o resultado do motor-base: vitórias de linha,
 *   eventual ×10 de tela cheia e, quando config.enforceMaxWin é verdadeiro,
 *   o cap interno do motor (2.500× a aposta, aplicado por payout.capWin).
 * - main.js converte totalWin para centavos inteiros uma única vez (toCents)
 *   antes de aplicar o multiplicador experimental. Portanto, o baseWinCents
 *   recebido aqui JÁ está em centavos inteiros e JÁ inclui o efeito do cap
 *   interno do motor.
 * - O cap experimental final é applyWinCap(winCents, betCents), que limita a
 *   betCents × 2500. Ele é adicional e independente do cap interno.
 *
 * Este módulo não converte reais, não arredonda e não recalcula o prêmio-base.
 * Também não remove nem simula a remoção do cap interno: ao desativar o cap
 * experimental, apenas o limite adicional de 2.500× deixa de ser aplicado
 * sobre o prêmio já limitado pelo motor-base.
 *
 * O app usa settleRoundWin() através de canSettleRoundWin(): quando o domínio
 * estrito não é atendido, main.js recorre à fórmula legada em centavos.
 */

import { applyWinCap, MAX_WIN_MULTIPLIER } from './experimental-multipliers.js';

/**
 * Valida um valor que deve ser inteiro seguro e estar acima de um mínimo.
 *
 * @param {string} name - nome do campo, usado na mensagem de erro.
 * @param {number} value - valor recebido.
 * @param {number} min - valor mínimo permitido (inclusive).
 */
function assertSafeInteger(name, value, min) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve ser um número finito.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} deve ser um inteiro seguro.`);
  }
  if (value < min) {
    throw new RangeError(`${name} deve ser maior ou igual a ${min}.`);
  }
}

/**
 * Verifica, sem lançar exceção, se os valores atendem ao domínio estrito de
 * settleRoundWin(). É uma função pura e sem efeitos colaterais.
 *
 * @param {object} [options]
 * @param {number} options.baseWinCents - inteiro seguro >= 0.
 * @param {number} options.betCents - inteiro seguro >= 1.
 * @param {number} options.multiplier - inteiro seguro >= 1.
 * @returns {boolean} true quando settleRoundWin() aceitaria os valores.
 */
export function canSettleRoundWin(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    return false;
  }

  const { baseWinCents, betCents, multiplier } = options;

  if (!Number.isSafeInteger(baseWinCents) || baseWinCents < 0) return false;
  if (!Number.isSafeInteger(betCents) || betCents < 1) return false;
  if (!Number.isSafeInteger(multiplier) || multiplier < 1) return false;
  if (!Number.isSafeInteger(betCents * MAX_WIN_MULTIPLIER)) return false;
  if (!Number.isSafeInteger(baseWinCents * multiplier)) return false;

  return true;
}

/**
 * Liquida o prêmio de uma rodada em centavos inteiros.
 *
 * @param {object} [options]
 * @param {number} options.baseWinCents - prêmio do motor-base em centavos
 *   inteiros. Já inclui linhas, ×10 de tela cheia e o cap interno do motor.
 * @param {number} options.betCents - aposta da rodada em centavos inteiros (> 0).
 * @param {number} options.multiplier - multiplicador experimental inteiro (>= 1).
 * @param {boolean} [options.applyExperimentalCap=true] - quando true, aplica
 *   exclusivamente o cap experimental final de 2.500× a aposta; quando false,
 *   ignora somente esse cap adicional. O cap interno já está no prêmio-base.
 * @returns {{
 *   baseWinCents: number,
 *   betCents: number,
 *   multiplier: number,
 *   multipliedCents: number,
 *   capCents: number,
 *   finalCents: number,
 *   capApplied: boolean
 * }} Retorna o prêmio antes do cap (multipliedCents), o limite experimental
 *   (capCents), o prêmio final (finalCents) e se o cap reduziu o valor
 *   (capApplied). Na igualdade exata do limite, capApplied é false, pois
 *   applyWinCap() só reduz quando o valor excede o cap.
 */
export function settleRoundWin(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('settleRoundWin: opções inválidas.');
  }

  const {
    baseWinCents,
    betCents,
    multiplier,
    applyExperimentalCap = true,
  } = options;

  assertSafeInteger('baseWinCents', baseWinCents, 0);
  assertSafeInteger('betCents', betCents, 1);
  assertSafeInteger('multiplier', multiplier, 1);

  if (typeof applyExperimentalCap !== 'boolean') {
    throw new TypeError('applyExperimentalCap deve ser booleano.');
  }

  // Multiplicação exata: ambos são inteiros e o produto precisa continuar
  // dentro da faixa segura. Não há conversão para reais nem arredondamento.
  const multipliedCents = baseWinCents * multiplier;
  if (!Number.isSafeInteger(multipliedCents)) {
    throw new RangeError('baseWinCents × multiplier ultrapassa Number.MAX_SAFE_INTEGER.');
  }

  // O limite experimental também precisa ser um inteiro seguro, pois é
  // devolvido no resultado e usado por applyWinCap() quando habilitado.
  const capCents = betCents * MAX_WIN_MULTIPLIER;
  if (!Number.isSafeInteger(capCents)) {
    throw new RangeError('betCents × MAX_WIN_MULTIPLIER ultrapassa Number.MAX_SAFE_INTEGER.');
  }

  // Reutiliza applyWinCap() para não duplicar a lógica do cap existente.
  const finalCents = applyExperimentalCap
    ? applyWinCap(multipliedCents, betCents)
    : multipliedCents;

  return {
    baseWinCents,
    betCents,
    multiplier,
    multipliedCents,
    capCents,
    finalCents,
    capApplied: applyExperimentalCap && multipliedCents > capCents,
  };
}
