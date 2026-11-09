import { simulate } from './simulator.js';
import { runSessionsBatch } from './strategies.js';

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (type === 'run-simulation') {
    const { spins, bet, config, seed, experiments } = payload;
    const results = [];
    for (let exp = 0; exp < experiments; exp++) {
      const expSeed = seed + exp * 999983;
      const rep = simulate({
        spins, bet, config, seed: expSeed,
        onProgress: (done, total) => {
          self.postMessage({ type: 'progress', exp, done, total, experiments });
        },
      });
      results.push({ seed: expSeed, ...rep });
      self.postMessage({ type: 'experiment-done', exp, result: results[results.length - 1] });
    }
    self.postMessage({ type: 'done', results });
  } else if (type === 'run-sessions') {
    const { count, initialBalance, baseBet, config, seed, maxRounds, stopProfit, stopLoss, strategyName, strategyParams } = payload;
    const results = runSessionsBatch({ count, initialBalance, baseBet, config, seed, maxRounds, stopProfit, stopLoss, strategyName, strategyParams });
    self.postMessage({ type: 'sessions-done', results });
  }
};
