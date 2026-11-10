export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function toCents(value) {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents) {
  return Math.round(cents) / 100;
}

export function addCredits(balance, amount) {
  return fromCents(toCents(balance) + toCents(amount));
}

export function subtractCredits(balance, amount) {
  return fromCents(toCents(balance) - toCents(amount));
}

/**
 * Resultado operacional em centavos: prêmios recebidos - total apostado.
 * Não considera saldo disponível, créditos adicionados nem ajustes manuais.
 */
export function resultCents(totalBet, totalWin) {
  return toCents(totalWin) - toCents(totalBet);
}

/** Classifica o resultado operacional: 'profit', 'loss' ou 'even'. */
export function resultKind(cents) {
  const c = Math.round(Number(cents) || 0);
  if (c > 0) return 'profit';
  if (c < 0) return 'loss';
  return 'even';
}

/** Uma aposta só é válida com valor finito, positivo e coberto pelo saldo. */
export function canPlaceBet(balance, bet) {
  const b = Number(bet);
  if (!Number.isFinite(b) || b <= 0) return false;
  return toCents(b) <= toCents(balance);
}

/**
 * Resultado operacional considerando uma linha de base (baseline).
 * Retorna apenas as movimentações posteriores ao último reset.
 * Não afeta totais históricos; afeta apenas a apresentação do indicador.
 */
export function resultCentsWithBaseline(totalBet, totalWin, baselineBet, baselineWin) {
  const current = resultCents(totalBet, totalWin);
  const base = resultCents(baselineBet, baselineWin);
  return current - base;
}
