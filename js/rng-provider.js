/**
 * Provedor de RNGs independentes para o jogo.
 *
 * Cria um gerador exclusivo para o motor-base e outro exclusivo para os
 * multiplicadores experimentais. A independência é garantida por duas
 * instâncias separadas de createRng(); consumir uma não afeta a outra.
 *
 * Sem semente, createRng() usa a Web Crypto API (crypto.getRandomValues).
 * Com semente, usa o Mulberry32 determinístico já existente em rng.js.
 *
 * O par deve ser criado uma única vez por sessão/execução e reutilizado;
 * não deve ser recriado a cada rodada.
 */

import { createRng } from './rng.js';

/**
 * Cria um par de geradores independentes.
 *
 * @param {object} [options]
 * @param {number} [options.baseSeed] - semente do motor-base; ausente => Web Crypto
 * @param {number} [options.expSeed] - semente dos multiplicadores experimentais; ausente => Web Crypto
 * @returns {{ base: object, experimental: object }}
 */
export function createRngPair({ baseSeed, expSeed } = {}) {
  return {
    base: createRng(baseSeed),
    experimental: createRng(expSeed),
  };
}
