/**
 * Definições de símbodos e paytable do Fortune Tiger.
 *
 * Multiplicadores são expressos em unidades de "aposta por linha"
 * (conforme documentação de engenharia reversa). O pagamento de uma linha
 * vencedora = multiplicador * apostaPorLinha.
 *
 * PARÂMETROS CONFIRMADOS (fontes: Bigwinboard, SlotCatalog):
 * - conjunto de símbodos e ordem de pagamento.
 * PARÂMETROS NÃO CONFIRMADOS:
 * - pesos de distribuição (ver reels.js / config.js).
 */

export const SYMBOLS = Object.freeze([
  { id: 'WILD', name: 'Wild (Tigre)', isWild: true, lineMultiplier: 250 },
  { id: 'INGOT', name: 'Golden Ingot', isWild: false, lineMultiplier: 100 },
  { id: 'CHARM', name: 'Lucky Charm', isWild: false, lineMultiplier: 25 },
  { id: 'BAG', name: 'Bag of Coins', isWild: false, lineMultiplier: 10 },
  { id: 'ENVELOPE', name: 'Red Envelope', isWild: false, lineMultiplier: 8 },
  { id: 'FIRECRACKER', name: 'Firecrackers', isWild: false, lineMultiplier: 5 },
  { id: 'ORANGE', name: 'Oranges', isWild: false, lineMultiplier: 3 },
]);

export const WILD_SYMBOL = SYMBOLS[0];
export const REGULAR_SYMBOLS = SYMBOLS.filter((s) => !s.isWild);

export function getSymbol(id) {
  const s = SYMBOLS.find((x) => x.id === id);
  if (!s) throw new Error(`Símbodo desconhecido: ${id}`);
  return s;
}

export function isWild(symbolOrId) {
  const s = typeof symbolOrId === 'string' ? getSymbol(symbolOrId) : symbolOrId;
  return !!s && s.isWild === true;
}

export const BLANK = null; // posição vazia (apenas durante o Feature)
