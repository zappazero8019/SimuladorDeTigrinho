/**
 * Gerador de números aleatórios.
 *
 * - Produção: usa Web Crypto API (crypto.getRandomValues), sem semente fixa.
 * - Testes/simulação reprodutível: Mulberry32 determinístico por semente.
 *
 * Interface comum: { random(), nextInt(n), pickWeighted(items, weightFn) }.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cria um RNG.
 * @param {number|undefined} seed - se fornecido, RNG determinístico (Mulberry32).
 */
export function createRng(seed) {
  const hasSeed = seed !== undefined && seed !== null;
  const rawFn = hasSeed
    ? mulberry32(Number(seed))
    : () => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] / 4294967296;
      };

  const rng = {
    seed: hasSeed ? Number(seed) : null,
    random() {
      return rawFn();
    },
    nextInt(n) {
      if (!Number.isInteger(n) || n <= 0) throw new Error('nextInt requer inteiro positivo');
      return Math.floor(rng.random() * n);
    },
    pick(items) {
      if (!Array.isArray(items) || items.length === 0) throw new Error('pick requer array não vazio');
      return items[rng.nextInt(items.length)];
    },
    pickWeighted(entries, weightFn) {
      // entries: array de itens; weightFn(item) -> peso >=0
      let total = 0;
      const weights = entries.map((e) => {
        const w = Number(weightFn(e));
        if (!Number.isFinite(w) || w < 0) throw new Error('peso inválido');
        total += w;
        return w;
      });
      if (total <= 0) throw new Error('soma de pesos deve ser > 0');
      let r = rng.random() * total;
      for (let i = 0; i < entries.length; i++) {
        r -= weights[i];
        if (r < 0) return entries[i];
      }
      return entries[entries.length - 1];
    },
  };
  return rng;
}

export function createSeededRng(seed) {
  return createRng(seed);
}

export function createCryptoRng() {
  return createRng();
}
