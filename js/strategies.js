import { playSpin } from './game-engine.js';
import { createRng } from './rng.js';

export const STRATEGY_LIST = [
  'fixed',
  'martingale',
  'progressive',
  'decrease-after-win',
  'percent-balance',
  'stop-profit',
  'stop-loss',
];

export function nextBet(strategy, ctx) {
  const p = strategy.params || {};
  const initial = ctx.initialBet;
  switch (strategy.name) {
    case 'fixed':
      return initial;
    case 'martingale':
      if (ctx.won) return initial;
      return Math.min(ctx.lastBet * (p.factor || 2), ctx.balance);
    case 'progressive':
      if (ctx.won) return initial;
      return Math.min(ctx.lastBet + (p.step || 1), ctx.balance);
    case 'decrease-after-win':
      if (ctx.won) return Math.max(initial, ctx.lastBet * (p.factor || 0.5));
      return ctx.lastBet;
    case 'percent-balance':
      return Math.max(1, ctx.balance * ((p.percent || 5) / 100));
    default:
      return initial;
  }
}

export function runSession({ initialBalance, baseBet, config, seed, maxRounds, stopProfit, stopLoss, strategyName, strategyParams }) {
  const rng = createRng(seed);
  let balance = initialBalance;
  let bet = baseBet;
  let rounds = 0;
  let peak = balance;
  let maxDrawdown = 0;
  let wonLast = false;
  let lastBet = baseBet;

  while (rounds < maxRounds && balance >= bet && bet >= 1) {
    if (stopProfit != null && balance - initialBalance >= stopProfit) break;
    if (stopLoss != null && initialBalance - balance >= stopLoss) break;
    const res = playSpin({ bet, rng, config, balance });
    balance = res.balanceAfter;
    rounds++;
    wonLast = res.totalWin > 0;
    lastBet = bet;
    bet = nextBet({ name: strategyName, params: strategyParams || {} }, {
      balance, lastBet, initialBet: baseBet, won: wonLast,
    });
    if (!Number.isFinite(bet) || bet <= 0) bet = baseBet;
    if (bet > balance) bet = Math.max(1, balance);
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  }

  return {
    initialBalance,
    finalBalance: balance,
    profit: balance - initialBalance,
    rounds,
    ruined: balance <= 0,
    maxDrawdown,
    hitProfit: balance > initialBalance,
  };
}

export function runSessionsBatch({ count, initialBalance, baseBet, config, seed, maxRounds, stopProfit, stopLoss, strategyName, strategyParams }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(runSession({
      initialBalance, baseBet, config, seed: seed + i * 7919,
      maxRounds, stopProfit, stopLoss, strategyName, strategyParams,
    }));
  }
  return out;
}

// Common Random Numbers: sequência determinística de resultados (independente do tamanho da aposta)
export function generateSpinSequence(seed, count, config) {
  const rng = createRng(seed);
  const seq = [];
  for (let i = 0; i < count; i++) {
    const res = playSpin({ bet: 1, rng, config });
    seq.push({
      grid: res.grid,
      featureTriggered: res.featureTriggered,
      feature: res.feature,
      fullGrid: res.fullGrid,
      multiplier: res.totalWin, // totalWin para aposta 1
    });
  }
  return seq;
}

export function runSessionCRN({ sequence, initialBalance, baseBet, config, maxRounds, stopProfit, stopLoss, strategyName, strategyParams }) {
  let balance = initialBalance;
  let bet = baseBet;
  let rounds = 0;
  let peak = balance;
  let maxDrawdown = 0;
  let lastBet = baseBet;
  const limit = Math.min(maxRounds, sequence.length);

  while (rounds < limit && balance >= bet && bet >= 1) {
    if (stopProfit != null && balance - initialBalance >= stopProfit) break;
    if (stopLoss != null && initialBalance - balance >= stopLoss) break;
    const spin = sequence[rounds];
    let win = spin.multiplier * bet;
    if (config.enforceMaxWin) {
      const cap = bet * 2500;
      if (win > cap) win = cap;
    }
    win = Math.round(win * 100) / 100;
    balance = Math.round((balance - bet + win) * 100) / 100;
    rounds++;
    const won = win > 0;
    lastBet = bet;
    bet = nextBet({ name: strategyName, params: strategyParams || {} }, {
      balance, lastBet, initialBet: baseBet, won,
    });
    if (!Number.isFinite(bet) || bet <= 0) bet = baseBet;
    if (bet > balance) bet = Math.max(1, balance);
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  }

  return {
    initialBalance,
    finalBalance: balance,
    profit: balance - initialBalance,
    rounds,
    ruined: balance <= 0,
    maxDrawdown,
    hitProfit: balance > initialBalance,
  };
}
