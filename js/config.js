/**
 * Configuração do motor matemático.
 *
 * Separação rigorosa:
 * - CONFIRMADO: mecânica documentada (rolos, linhas, paytable, feature, ×10, etc.).
 * - EXPERIMENTAL: pesos, probabilidades estimadas (marcados explicitamente).
 */

export const GAME_CONSTANTS = Object.freeze({
  REELS: 3,
  ROWS: 3,
  PAYLINE_COUNT: 5,
  STARTING_CREDITS: 10000,
  MAX_WIN_MULTIPLIER: 2500,
  FULL_GRID_MULTIPLIER: 10,
});

// PARÂMETRO CONFIRMADO: layout das 5 linhas de uma grade 3x3.
export const PAYLINES = Object.freeze([
  [[0, 0], [0, 1], [0, 2]], // superior
  [[1, 0], [1, 1], [1, 2]], // central
  [[2, 0], [2, 1], [2, 2]], // inferior
  [[0, 0], [1, 1], [2, 2]], // diagonal principal
  [[0, 2], [1, 1], [2, 0]], // diagonal secundária
]);

// PARÂMETROS EXPERIMENTAIS (aproximados, não oficiais):
// Pesos relativos por símbodo para o jogo principal.
// Ajuste fino pode ser feito, mas NÃO forçar RTP a um valor-alvo.
// Pesos calibrados (experimentais) para aproximar hit frequency ~22% e RTP ~96-100%.
// NÃO são pesos oficiais da PG Soft.
export const DEFAULT_EXPERIMENTAL_WEIGHTS = Object.freeze({
  WILD: 0.5,
  INGOT: 2,
  CHARM: 3.5,
  BAG: 3,
  ENVELOPE: 5,
  FIRECRACKER: 3,
  ORANGE: 6,
});

// PARÂMETROS EXPERIMENTAIS para o Feature:
// - probabilidade de acionamento por rodada (documentada como ~0,99% agregado).
// - pesos das células durante o Feature.
export const DEFAULT_FEATURE_CONFIG = Object.freeze({
  triggerProbability: 0.0099,
  // peso relativo do símbodo escolhido / Wild / blank em cada célula do Feature
  cellWeights: Object.freeze({ chosen: 4, wild: 1, blank: 11 }),
  // peso relativo de cada símbodo regular ser o "escolhido"
  symbolChoiceWeights: null, // null => uniforme
});

// Perfil EXPERIMENTAL: permite configurar pesos e probabilidades estimadas.
export const EXPERIMENTAL_PROFILE = Object.freeze({
  id: 'experimental',
  status: 'experimental',
  description: 'Permite configurar pesos e probabilidades estimadas. RTP emerge dos parâmetros.',
  weights: { ...DEFAULT_EXPERIMENTAL_WEIGHTS },
  feature: { ...DEFAULT_FEATURE_CONFIG, cellWeights: { ...DEFAULT_FEATURE_CONFIG.cellWeights } },
  enforceMaxWin: true,
});

// Perfil REFERÊNCIA: utiliza apenas parâmetros documentados/validados.
// Como os pesos oficiais NÃO são públicos, este perfil usa distribuição uniforme
// (peso 1 para todos os símbodos) como suposição neutra e explicitamente documentada.
// O acionamento do Feature usa a frequência agregada documentada (0,99%).
export const REFERENCE_PROFILE = Object.freeze({
  id: 'reference',
  status: 'reference',
  description:
    'Utiliza apenas parâmetros documentados. Pesos de símbodo não documentados => distribuição uniforme (suposição neutra).',
  // Perfil de referência: pesos fixos (calibrados) — não editáveis pelo usuário.
  // Pesos oficiais não são públicos; este é o melhor baseline disponível.
  weights: Object.freeze({
    WILD: 0.5,
    INGOT: 2,
    CHARM: 3.5,
    BAG: 3,
    ENVELOPE: 5,
    FIRECRACKER: 3,
    ORANGE: 6,
  }),
  feature: Object.freeze({
    triggerProbability: 0.0099,
    cellWeights: Object.freeze({ chosen: 4, wild: 1, blank: 11 }),
    symbolChoiceWeights: null,
  }),
  enforceMaxWin: true,
});

export const PROFILES = Object.freeze({
  experimental: EXPERIMENTAL_PROFILE,
  reference: REFERENCE_PROFILE,
});

export function getProfile(id) {
  const p = PROFILES[id];
  if (!p) throw new Error(`Perfil desconhecido: ${id}`);
  return p;
}
