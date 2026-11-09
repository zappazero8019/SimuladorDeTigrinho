/**
 * Simulação em lote (sem animação). Usa exatamente o motor do jogo.
 */

import { createRng } from './rng.js';
import { playSpin } from './game-engine.js';

export function simulate({ spins, bet, config, seed, onProgress }) {
  if (!Number.isInteger(spins) || spins <= 0) throw new Error('spins inválido');
  if (!Number.isFinite(bet) || bet <= 0) throw new Error('bet inválido');
  if (!config) throw new Error('config inválido');

  const rng = createRng(seed);
  const START = 1e12;
  let balance = START;

  let totalBet = 0;
  let totalWin = 0;
  let hits = 0;
  let features = 0;
  let fullGrids = 0;
  let respinTotal = 0;
  let maxWin = 0;
  let maxLossStreak = 0;
  let maxWinStreak = 0;
  let curLoss = 0;
  let curWin = 0;
  const balanceHistory = [];
  const rtpHistory = [];
  const historyStride = Math.max(1, Math.floor(spins / 2000));

  // decomposição
  let baseBet = 0, baseWin = 0, baseHits = 0;
  let featureBet = 0, featureWin = 0, featureHits = 0;
  let cumBet = 0, cumWin = 0;

  // símbodos e histograma
  const symbolCounts = {};
  const winHistogram = [0,0,0,0,0,0,0,0]; // 0; 0-1x; 1-5; 5-10; 10-50; 50-200; 200-1000; >1000 (em múltiplos da aposta)

  for (let i = 0; i < spins; i++) {
    const res = playSpin({ bet, rng, config, balance });
    balance = res.balanceAfter;
    totalBet += res.bet;
    totalWin += res.totalWin;
    if (res.hit) {
      hits++;
      curWin++;
      curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else {
      curLoss++;
      curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    }
    if (res.featureTriggered) {
      features++;
      featureBet += res.bet;
      featureWin += res.totalWin;
      if (res.totalWin > 0) featureHits++;
      respinTotal += (res.feature?.respins || 0);
    } else {
      baseBet += res.bet;
      baseWin += res.totalWin;
      if (res.totalWin > 0) baseHits++;
    }
    if (res.fullGrid) fullGrids++;
    if (res.totalWin > maxWin) maxWin = res.totalWin;

    // símbodos
    for (const row of res.grid) for (const c of row) {
      if (c !== null) symbolCounts[c] = (symbolCounts[c] || 0) + 1;
    }

    // histograma
    const mult = res.totalWin / res.bet;
    if (mult === 0) winHistogram[0]++;
    else if (mult <= 1) winHistogram[1]++;
    else if (mult <= 5) winHistogram[2]++;
    else if (mult <= 10) winHistogram[3]++;
    else if (mult <= 50) winHistogram[4]++;
    else if (mult <= 200) winHistogram[5]++;
    else if (mult <= 1000) winHistogram[6]++;
    else winHistogram[7]++;

    cumBet = totalBet; cumWin = totalWin;
    if (i % historyStride === 0) {
      balanceHistory.push({ i, value: balance - START });
      rtpHistory.push({ i, rtp: cumBet > 0 ? (cumWin / cumBet) * 100 : 0 });
    }
    if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, spins);
  }
  if (balanceHistory.length === 0 || balanceHistory[balanceHistory.length-1].i !== spins-1) {
    balanceHistory.push({ i: spins - 1, value: balance - START });
    rtpHistory.push({ i: spins - 1, rtp: totalBet > 0 ? (totalWin / totalBet) * 100 : 0 });
  } else if (rtpHistory.length === 0 || rtpHistory[rtpHistory.length-1].i !== spins-1) {
    rtpHistory.push({ i: spins - 1, rtp: totalBet > 0 ? (totalWin / totalBet) * 100 : 0 });
  }

  const rtp = totalBet > 0 ? (totalWin / totalBet) * 100 : 0;
  return {
    spins,
    bet,
    totalBet,
    totalWin,
    profit: totalWin - totalBet,
    rtp,
    hitRate: spins > 0 ? hits / spins : 0,
    featureRate: spins > 0 ? features / spins : 0,
    fullGridRate: spins > 0 ? fullGrids / spins : 0,
    respinTotal,
    maxWin,
    maxWinStreak,
    maxLossStreak,
    balanceHistory,
    rtpHistory,
    baseBet, baseWin, baseHits,
    featureBet, featureWin, featureHits,
    baseRtp: baseBet > 0 ? (baseWin / baseBet) * 100 : 0,
    featureRtp: featureBet > 0 ? (featureWin / featureBet) * 100 : 0,
    featureContribution: totalBet > 0 ? (featureWin / totalBet) * 100 : 0,
    symbolCounts,
    winHistogram,
  };
}
