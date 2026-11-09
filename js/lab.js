import { getProfile } from './config.js';
import { createSeededRng } from './rng.js';
import * as charts from './charts.js';
import { runSessionsBatch, generateSpinSequence, runSessionCRN } from './strategies.js';
import { loadState, saveState } from './storage.js';

export class LabController {
  constructor() {
    this.worker = null;
    this.lastResults = null;
    this.cancelled = false;
    this.bind();
  }

  bind() {
    const spinsSel = document.getElementById('labSpins');
    const custom = document.getElementById('labCustomSpins');
    spinsSel.addEventListener('change', () => {
      custom.hidden = spinsSel.value !== 'custom';
    });

    document.getElementById('labRun').addEventListener('click', () => this.runSimulation());
    document.getElementById('labCancel').addEventListener('click', () => this.cancel());
    document.getElementById('riskRun').addEventListener('click', () => this.runRisk());
    document.getElementById('stratRun').addEventListener('click', () => this.runStrategies());
    document.getElementById('expRun').addEventListener('click', () => this.runWeightComparison());
    document.getElementById('labSave').addEventListener('click', () => this.saveExperiment());
    document.getElementById('labExportJson').addEventListener('click', () => this.exportJson());
    document.getElementById('labExportCsv').addEventListener('click', () => this.exportCsv());
  }

  getSpins() {
    const sel = document.getElementById('labSpins').value;
    if (sel === 'custom') return Number(document.getElementById('labCustomSpins').value) || 100000;
    return Number(sel);
  }

  getConfig() {
    const profileId = document.getElementById('labProfile').value;
    return getProfile(profileId);
  }

  setStatus(msg) { document.getElementById('labStatus').textContent = msg; }

  runSimulation() {
    if (this.worker) { this.setStatus('Já em execução.'); return; }
    this.cancelled = false;
    const spins = this.getSpins();
    const bet = Number(document.getElementById('labBet').value) || 10;
    const seed = Number(document.getElementById('labSeed').value) || 42;
    const experiments = Number(document.getElementById('labExperiments').value) || 1;
    const config = this.getConfig();
    const progress = document.getElementById('labProgress');
    progress.value = 0; progress.max = experiments * spins;

    this.worker = new Worker('js/lab-worker.js', { type: 'module' });
    this.worker.onmessage = (ev) => {
      const { type, ...rest } = ev.data;
      if (type === 'progress') {
        progress.value = rest.exp * spins + rest.done;
        this.setStatus(`Experimento ${rest.exp + 1}/${rest.experiments}: ${rest.done}/${rest.total}`);
      } else if (type === 'experiment-done') {
        // accumulate
      } else if (type === 'done') {
        this.lastResults = rest.results;
        this.worker = null;
        this.setStatus('Concluído.');
        this.renderResults(rest.results);
        this.drawCharts(rest.results);
      }
    };
    this.worker.onerror = (err) => {
      this.setStatus('Erro: ' + err.message);
      this.worker = null;
    };
    this.worker.postMessage({
      type: 'run-simulation',
      payload: { spins, bet, config, seed, experiments },
    });
  }

  cancel() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.setStatus('Cancelado.');
    }
  }

  renderResults(results) {
    const agg = this.aggregate(results);
    const el = document.getElementById('labIndicators');
    el.textContent = this.formatIndicators(agg, results);
  }

  tCritical(df) {
    // valores aproximados de t para 95% bicaudal
    const table = {1:12.706,2:4.303,3:3.182,4:2.776,5:2.571,6:2.447,7:2.365,8:2.306,9:2.262,10:2.228,15:2.131,20:2.086,30:2.042};
    if (table[df]) return table[df];
    if (df > 30) return 1.96;
    // interpolação simples
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let prev = keys[0];
    for (const k of keys) { if (df <= k) { return table[k]; } prev = k; }
    return table[prev];
  }

  aggregate(results) {
    const n = results.length;
    const rtps = results.map(r => r.rtp);
    const mean = rtps.reduce((a,b)=>a+b,0)/n;
    const sd = n > 1 ? Math.sqrt(rtps.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)) : 0;
    const se = n > 1 ? sd / Math.sqrt(n) : 0;
    const tc = n > 1 ? this.tCritical(n - 1) : null;
    const ci = n > 1 ? [mean - tc*se, mean + tc*se] : null;
    const totalSpins = results.reduce((a,r)=>a+r.spins,0);
    const totalBet = results.reduce((a,r)=>a+r.totalBet,0);
    const totalWin = results.reduce((a,r)=>a+r.totalWin,0);
    const avgHit = results.reduce((a,r)=>a+r.hitRate,0)/n;
    const avgFeat = results.reduce((a,r)=>a+r.featureRate,0)/n;
    const maxWin = Math.max(...results.map(r=>r.maxWin));
    const maxLossStreak = Math.max(...results.map(r=>r.maxLossStreak));
    const maxWinStreak = Math.max(...results.map(r=>r.maxWinStreak));
    return { n, mean, sd, se, tc, ci, totalSpins, totalBet, totalWin, rtp: totalBet? totalWin/totalBet*100:0, avgHit, avgFeat, maxWin, maxLossStreak, maxWinStreak };
  }

  formatIndicators(agg, results) {
    const lines = [];
    lines.push(`Experimentos: ${agg.n}`);
    lines.push(`Rodadas totais: ${agg.totalSpins.toLocaleString()}`);
    lines.push(`Total apostado: ${agg.totalBet.toLocaleString()}`);
    lines.push(`Total devolvido: ${agg.totalWin.toLocaleString()}`);
    lines.push(`Lucro/Prejuízo: ${(agg.totalWin-agg.totalBet).toLocaleString()}`);
    lines.push(`RTP observado: ${agg.rtp.toFixed(4)}%`);
    lines.push(`RTP médio (por exp): ${agg.mean.toFixed(4)}% (sd ${agg.sd.toFixed(4)})`);
    if (agg.ci) {
      lines.push(`IC95 (t-Student, ${agg.n-1} gl): [${agg.ci[0].toFixed(4)}, ${agg.ci[1].toFixed(4)}] (SE=${agg.se.toFixed(4)})`);
    } else {
      lines.push(`IC95: indisponível (necessário ≥2 replicações independentes)`);
    }
    lines.push(`House edge estimado: ${(100 - agg.rtp).toFixed(4)}% (configuração atual)`);
    lines.push(`House edge original (referência externa): 3.19%`);
    lines.push(`Taxa de acertos: ${(agg.avgHit*100).toFixed(3)}%`);
    lines.push(`Taxa de Feature: ${(agg.avgFeat*100).toFixed(3)}%`);
    lines.push(`Maior prêmio: ${agg.maxWin}`);
    lines.push(`Maior seq. perdas: ${agg.maxLossStreak}`);
    lines.push(`Maior seq. vitórias: ${agg.maxWinStreak}`);
    if (results && results[0]) {
      lines.push(`RTP jogo principal (exp1): ${results[0].baseRtp.toFixed(4)}%`);
      lines.push(`RTP Feature (exp1): ${results[0].featureRtp.toFixed(4)}%`);
      lines.push(`Contribuição Feature (exp1): ${results[0].featureContribution.toFixed(4)}%`);
    }
    return lines.join('\n');
  }

  drawCharts(results) {
    const r = results[0];
    if (!r) return;
    const balCanvas = document.getElementById('chartBalance');
    charts.drawLineChart(balCanvas, [{ data: r.balanceHistory.map(p=>p.value), color: '#f5c542' }], { title: 'Evolução do saldo' });
    const rtpData = (r.rtpHistory || []).map(p => p.rtp);
    charts.drawLineChart(document.getElementById('chartRtp'), [{ data: rtpData, color: '#7CFC00' }], { title: 'RTP acumulado' });
    charts.drawBarChart(document.getElementById('chartHist'), ['0','0-1x','1-5','5-10','10-50','50-200','200-1k','>1k'], r.winHistogram, { title: 'Distribuição de prêmios', color: '#f5c542' });
    const symLabels = Object.keys(r.symbolCounts);
    const symVals = symLabels.map(k => r.symbolCounts[k]);
    charts.drawBarChart(document.getElementById('chartFreq'), symLabels, symVals, { title: 'Frequência de símbodos', color: '#d4a017' });
  }

  runRisk() {
    const count = Number(document.getElementById('riskSessions').value) || 1000;
    const maxRounds = Number(document.getElementById('riskRounds').value) || 100;
    const sp = document.getElementById('riskStopProfit').value;
    const sl = document.getElementById('riskStopLoss').value;
    const stopProfit = sp === '' ? null : Number(sp);
    const stopLoss = sl === '' ? null : Number(sl);
    const strategyName = document.getElementById('riskStrategy').value;
    const bet = Number(document.getElementById('labBet').value) || 10;
    const initialBalance = Number(document.getElementById('labBalance').value) || 10000;
    const seed = Number(document.getElementById('labSeed').value) || 42;
    const config = this.getConfig();
    const results = runSessionsBatch({ count, initialBalance, baseBet: bet, config, seed, maxRounds, stopProfit, stopLoss, strategyName, strategyParams: {} });
    this.renderRisk(results, initialBalance);
  }

  renderRisk(results, initialBalance) {
    const profits = results.map(r => r.profit);
    const wins = results.filter(r => r.profit > 0).length;
    const ruins = results.filter(r => r.ruined).length;
    const mean = profits.reduce((a,b)=>a+b,0)/profits.length;
    const sd = Math.sqrt(profits.reduce((a,b)=>a+(b-mean)**2,0)/(profits.length-1));
    const sorted = [...profits].sort((a,b)=>a-b);
    const median = sorted[Math.floor(sorted.length/2)];
    const lose25 = results.filter(r => r.finalBalance <= initialBalance*0.75).length;
    const lose50 = results.filter(r => r.finalBalance <= initialBalance*0.5).length;
    const lose75 = results.filter(r => r.finalBalance <= initialBalance*0.25).length;
    const lines = [];
    lines.push(`Sessões: ${results.length}`);
    lines.push(`Prob. lucro: ${(wins/results.length*100).toFixed(2)}%`);
    lines.push(`Prob. ruína: ${(ruins/results.length*100).toFixed(2)}%`);
    lines.push(`Perder 25%: ${(lose25/results.length*100).toFixed(2)}%`);
    lines.push(`Perder 50%: ${(lose50/results.length*100).toFixed(2)}%`);
    lines.push(`Perder 75%: ${(lose75/results.length*100).toFixed(2)}%`);
    lines.push(`Lucro médio: ${mean.toFixed(2)}`);
    lines.push(`Mediana: ${median.toFixed(2)}`);
    lines.push(`Melhor: ${Math.max(...profits).toFixed(2)}`);
    lines.push(`Pior: ${Math.min(...profits).toFixed(2)}`);
    lines.push(`Desvio-padrão: ${sd.toFixed(2)}`);
    document.getElementById('riskResults').textContent = lines.join('\n');
  }

  runStrategies() {
    const bet = Number(document.getElementById('labBet').value) || 10;
    const initialBalance = Number(document.getElementById('labBalance').value) || 10000;
    const maxRounds = Number(document.getElementById('riskRounds').value) || 100;
    const seed = Number(document.getElementById('labSeed').value) || 42;
    const config = this.getConfig();
    const names = ['fixed','martingale','progressive','decrease-after-win','percent-balance'];
    const repl = 100;
    const agg = {};
    for (const name of names) agg[name] = { profits: [], ruins: 0, wins: 0 };
    for (let i = 0; i < repl; i++) {
      const seq = generateSpinSequence(seed + i * 7919, maxRounds, config);
      for (const name of names) {
        const r = runSessionCRN({ sequence: seq, initialBalance, baseBet: bet, config, maxRounds, stopProfit: null, stopLoss: null, strategyName: name, strategyParams: { factor:2, step: bet, percent:5 } });
        agg[name].profits.push(r.profit);
        if (r.profit > 0) agg[name].wins++;
        if (r.ruined) agg[name].ruins++;
      }
    }
    const rows = [];
    for (const name of names) {
      const a = agg[name];
      const mean = a.profits.reduce((x,y)=>x+y,0)/a.profits.length;
      rows.push(`${name}: lucro médio ${mean.toFixed(2)}, positivas ${(a.wins/repl*100).toFixed(1)}%, ruína ${(a.ruins/repl*100).toFixed(1)}% (CRN, ${repl} repl.)`);
    }
    document.getElementById('stratResults').textContent = rows.join('\n');
  }

  runWeightComparison() {
    const spins = 50000;
    const bet = Number(document.getElementById('labBet').value) || 10;
    const seed = Number(document.getElementById('labSeed').value) || 42;
    const base = this.getConfig();
    const scenarios = [
      { name: 'Atual', weights: base.weights, cell: base.feature.cellWeights },
      { name: 'Uniforme', weights: { WILD:1, INGOT:1, CHARM:1, BAG:1, ENVELOPE:1, FIRECRACKER:1, ORANGE:1 }, cell: { chosen:4, wild:1, blank:11 } },
      { name: 'Baixo retorno', weights: { WILD:0.2, INGOT:2, CHARM:3, BAG:3, ENVELOPE:5, FIRECRACKER:3, ORANGE:6 }, cell: { chosen:4, wild:0.5, blank:11 } },
      { name: 'Alto retorno', weights: { WILD:1, INGOT:2, CHARM:4, BAG:6, ENVELOPE:8, FIRECRACKER:10, ORANGE:14 }, cell: { chosen:4, wild:1, blank:6 } },
    ];
    import('./simulator.js').then(({ simulate }) => {
      const lines = [];
      for (const c of scenarios) {
        const cfg = { weights: c.weights, feature: { triggerProbability: 0.0099, cellWeights: c.cell, symbolChoiceWeights: null }, enforceMaxWin: true };
        const rep = simulate({ spins, bet, config: cfg, seed });
        lines.push(`${c.name}: RTP ${rep.rtp.toFixed(2)}%, hit ${(rep.hitRate*100).toFixed(2)}%, feature ${(rep.featureRate*100).toFixed(2)}%, full ${ (rep.fullGridRate*100).toFixed(3)}%`);
      }
      document.getElementById('expResults').textContent = lines.join('\n');
    });
  }

  saveExperiment() {
    const key = 'fts_experiments';
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift({ t: Date.now(), results: this.lastResults });
      localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
      this.setStatus('Experimento salvo.');
    } catch (e) {
      this.setStatus('Falha ao salvar: ' + e.message);
    }
  }

  exportJson() {
    if (!this.lastResults) { this.setStatus('Nada para exportar.'); return; }
    const blob = new Blob([JSON.stringify(this.lastResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'experimento.json'; a.click();
    URL.revokeObjectURL(url);
  }

  exportCsv() {
    if (!this.lastResults) { this.setStatus('Nada para exportar.'); return; }
    const r = this.lastResults[0];
    const rows = ['metric,value', `spins,${r.spins}`, `totalBet,${r.totalBet}`, `totalWin,${r.totalWin}`, `rtp,${r.rtp}`, `hitRate,${r.hitRate}`, `featureRate,${r.featureRate}`];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'experimento.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
