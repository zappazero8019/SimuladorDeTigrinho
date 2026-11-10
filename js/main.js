import { createRng } from './rng.js';
import { getProfile } from './config.js';
import { playSpin } from './game-engine.js';
import { loadState, saveState } from './storage.js';
import { GameUI } from './ui.js';
import * as audio from './audio.js';
import { LabController } from './lab.js';
import { formatBRL, addCredits, resultCents, resultCentsWithBaseline, resultKind, canPlaceBet, toCents } from './wallet.js';
import * as charts from './charts.js';
import { EffectsController, classifyWin } from './effects.js';

const ui = new GameUI();
const effects = new EffectsController();

const state = Object.assign({
  balance: 100.00,
  bet: 1.00,
  profileId: 'experimental',
  sound: true,
  animations: true,
  history: [],
  transactions: [],
  sessions: [],
}, loadState());

// Contabilidade acumulada de apostas e prêmios (independente do saldo).
// Em estados antigos, deriva a partir do histórico disponível.
if (!state.totals || typeof state.totals !== 'object') {
  const hist = Array.isArray(state.history) ? state.history : [];
  state.totals = {
    bet: hist.reduce((a, r) => a + (Number(r.bet) || 0), 0),
    win: hist.reduce((a, r) => a + (Number(r.win) || 0), 0),
  };
}
state.totals = {
  bet: Number(state.totals.bet) || 0,
  win: Number(state.totals.win) || 0,
};

// Linha de base do resultado operacional.
// Representa os totais no momento do último reset do indicador.
// O resultado exibido considera apenas movimentos posteriores a esta linha.
if (!state.resultBaseline || typeof state.resultBaseline !== 'object') {
  state.resultBaseline = { bet: state.totals.bet, win: state.totals.win };
}
state.resultBaseline = {
  bet: Number(state.resultBaseline.bet) || 0,
  win: Number(state.resultBaseline.win) || 0,
};

let autoRunning = false;
let autoPaused = false;
let autoStopRequested = false;
let currentView = 'game';

let spinning = false;
let zeroInProgress = false;

const els = {
  balance: document.getElementById('balanceValue'),
  bet: document.getElementById('betValue'),
  win: document.getElementById('winValue'),
  betInput: document.getElementById('betInput'),
  spinBtn: document.getElementById('spinBtn'),
  autoBtn: document.getElementById('autoBtn'),
  addFundsBtn: document.getElementById('addFundsBtn'),
  addFundsPanel: document.getElementById('addFundsPanel'),
  fundCustom: document.getElementById('fundCustom'),
  fundConfirm: document.getElementById('fundConfirm'),
  fundCancel: document.getElementById('fundCancel'),
  autoPanel: document.getElementById('autoPanel'),
  autoSpins: document.getElementById('autoSpins'),
  autoBet: document.getElementById('autoBet'),
  autoStopProfit: document.getElementById('autoStopProfit'),
  autoStopLoss: document.getElementById('autoStopLoss'),
  autoStart: document.getElementById('autoStart'),
  autoPause: document.getElementById('autoPause'),
  autoStop: document.getElementById('autoStop'),
  autoStatus: document.getElementById('autoStatus'),
  autoInterval: document.getElementById('autoInterval'),
  autoIntervalCustom: document.getElementById('autoIntervalCustom'),
  statsIndicators: document.getElementById('statsIndicators'),
  statsRefresh: document.getElementById('statsRefresh'),
  statsExport: document.getElementById('statsExport'),
  status: document.getElementById('statusLine'),
  profile: document.getElementById('profileSelect'),
  history: document.getElementById('historyList'),
  soundToggle: document.getElementById('soundToggle'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsPanel: document.getElementById('settingsPanel'),
  soundCheckbox: document.getElementById('soundCheckbox'),
  animCheckbox: document.getElementById('animationsCheckbox'),
  resetBalance: document.getElementById('resetBalance'),
  exportJson: document.getElementById('exportJson'),
  closeSettings: document.getElementById('closeSettings'),
  clearHistory: document.getElementById('clearHistory'),
  betDown: document.getElementById('betDown'),
  betUp: document.getElementById('betUp'),
  zeroBalanceBtn: document.getElementById('zeroBalanceBtn'),
  resultBanner: document.getElementById('resultBanner'),
  resultLabel: document.getElementById('resultLabel'),
  resultValue: document.getElementById('resultValue'),
  resultGainValue: document.getElementById('resultValueGain'),
  resultLossValue: document.getElementById('resultValueLoss'),
  resultNetValue: document.getElementById('resultValueNet'),
  resultResetBtn: document.getElementById('resultResetBtn'),
};

function persist() {
  saveState({
    balance: state.balance,
    bet: state.bet,
    profileId: state.profileId,
    sound: state.sound,
    animations: state.animations,
    history: state.history.slice(0, 200),
    transactions: state.transactions.slice(0, 200),
    sessions: state.sessions.slice(0, 50),
    totals: state.totals,
    resultBaseline: state.resultBaseline,
  });
}

function format(n) { return formatBRL(n); }

function renderState() {
  els.balance.textContent = formatBRL(state.balance);
  els.bet.textContent = formatBRL(state.bet);
  els.betInput.value = state.bet.toFixed(2);
  els.profile.value = state.profileId;
  els.soundToggle.textContent = state.sound ? '🔊' : '🔇';
  els.soundCheckbox.checked = state.sound;
  els.animCheckbox.checked = state.animations;
  renderOperationalResult();
  renderHistory();
  renderStats();
}

function renderOperationalResult() {
  if (!els.resultBanner) return;

  // Ganho = prêmios recebidos após o baseline
  const gainCents = resultCentsWithBaseline(
    0, state.totals.win,
    0, state.resultBaseline.win
  );
  // Perda = apostas realizadas após o baseline (valor positivo)
  const lossCents = toCents(state.totals.bet) - toCents(state.resultBaseline.bet);
  // Lucro/Prejuízo = Ganho − Perda
  const netCents = resultCentsWithBaseline(
    state.totals.bet, state.totals.win,
    state.resultBaseline.bet, state.resultBaseline.win
  );

  const kind = resultKind(netCents);
  els.resultBanner.classList.remove('is-profit', 'is-loss', 'is-even');
  els.resultBanner.classList.add(kind === 'profit' ? 'is-profit' : kind === 'loss' ? 'is-loss' : 'is-even');

  const formatAbs = (c) => formatBRL(Math.abs(c) / 100);

  els.resultGainValue.textContent = `+ ${formatAbs(gainCents)}`;
  els.resultLossValue.textContent = `− ${formatAbs(lossCents)}`;

  els.resultLabel.textContent = kind === 'profit' ? 'LUCRO' : kind === 'loss' ? 'PREJUÍZO' : 'EMPATE';
  els.resultNetValue.textContent = kind === 'profit' ? `+ ${formatAbs(netCents)}` : kind === 'loss' ? `- ${formatAbs(netCents)}` : formatAbs(netCents);
}

function renderHistory() {
  els.history.innerHTML = '';
  for (const h of state.history.slice(0, 20)) {
    const li = document.createElement('li');
    const when = new Date(h.t).toLocaleTimeString('pt-BR');
    li.innerHTML = `<span>${when} • aposta ${formatBRL(h.bet)}</span><span class="win">${h.win > 0 ? '+' + formatBRL(h.win) : formatBRL(h.win)}${h.feature ? ' 🐯' : ''}</span>`;
    els.history.appendChild(li);
  }
}

function setStatus(msg) { els.status.textContent = msg; }

async function performSpin(bet, isAuto = false) {
  effects.clear();
  state.bet = bet;
  state.profileId = els.profile.value;
  const config = getProfile(state.profileId);

  if (!isAuto) {
    ui.clearHighlights();
    els.win.textContent = '0';
    setStatus('Girando...');
  }

  if (state.animations) ui.setSpinning(true);
  if (state.sound) audio.soundSpin();

  const spinMs = state.animations ? 1200 : 100;
  await new Promise((res) => setTimeout(res, spinMs));

  const rng = createRng();
  const result = playSpin({ bet: state.bet, rng, config, balance: state.balance });

  if (state.animations && !isAuto) ui.setSpinning(false);
  ui.renderGrid(result.grid);

  if (result.featureTriggered) {
    if (state.sound) audio.soundFeature();
    ui.showFeature(result.feature.chosenSymbol, result.fullGrid);
    setStatus(`Fortune Tiger! Símbodo escolhido: ${result.feature.chosenSymbol}`);
    await new Promise((res) => setTimeout(res, state.animations ? 900 : 100));
  }

  ui.highlightWins(result.lineWins);
    if (result.fullGrid) {
      if (state.sound) audio.soundWin();
      ui.showMultiplier();
    } else if (result.totalWin > 0) {
      if (state.sound) audio.soundWin();
    } else {
      if (state.sound) audio.soundLose();
    }
    els.win.textContent = format(result.totalWin);
    setStatus(result.totalWin > 0
      ? `Prêmio: ${format(result.totalWin)}${result.fullGrid ? ' (×10!)' : ''}`
      : 'Sem prêmio.');

  state.balance = result.balanceAfter;
  const roundRecord = {
    t: Date.now(),
    n: state.history.length + 1,
    bet: state.bet,
    win: result.totalWin,
    net: result.totalWin - state.bet,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
    feature: result.featureTriggered,
    fullGrid: result.fullGrid,
    auto: isAuto,
  };
  state.history.unshift(roundRecord);
  state.transactions.unshift({ t: roundRecord.t, type: 'round', amount: roundRecord.net });
  state.totals.bet = addCredits(state.totals.bet, state.bet);
  state.totals.win = addCredits(state.totals.win, result.totalWin);

  renderState();
  persist();

  if (result.totalWin > 0) {
    const multiplier = result.totalWin / result.bet;
    const level = classifyWin(multiplier);
    if (state.sound) audio.soundWinLevel(level);
    await effects.celebrate({ level, multiplier, winAmount: result.totalWin, fullGrid: result.fullGrid });
  }

  return result;
}

async function doSpin() {
  if (spinning || autoRunning || zeroInProgress) return;
  const bet = Number(els.betInput.value);
  if (!Number.isFinite(bet) || bet <= 0) { setStatus('Aposta inválida.'); return; }
  if (!canPlaceBet(state.balance, bet)) { setStatus('Saldo insuficiente.'); return; }

  spinning = true;
  els.spinBtn.disabled = true;
  await performSpin(bet, false);
  spinning = false;
  els.spinBtn.disabled = false;
}

// events
els.spinBtn.addEventListener('click', doSpin);
els.betDown.addEventListener('click', () => { state.bet = Math.max(0.25, state.bet - 0.25); els.betInput.value = state.bet.toFixed(2); renderState(); persist(); });
els.betUp.addEventListener('click', () => { state.bet = state.bet + 0.25; els.betInput.value = state.bet.toFixed(2); renderState(); persist(); });
els.betInput.addEventListener('change', () => { state.bet = Number(els.betInput.value) || state.bet; renderState(); persist(); });
els.profile.addEventListener('change', () => { state.profileId = els.profile.value; persist(); });
els.soundToggle.addEventListener('click', () => { state.sound = !state.sound; renderState(); persist(); });
els.settingsToggle.addEventListener('click', () => { els.settingsPanel.hidden = !els.settingsPanel.hidden; });
els.closeSettings.addEventListener('click', () => { els.settingsPanel.hidden = true; });
els.soundCheckbox.addEventListener('change', () => { state.sound = els.soundCheckbox.checked; renderState(); persist(); });
els.animCheckbox.addEventListener('change', () => { state.animations = els.animCheckbox.checked; persist(); });
els.resetBalance.addEventListener('click', () => { state.balance = 100.00; state.history = []; state.transactions = []; state.totals = { bet: 0, win: 0 }; state.resultBaseline = { bet: 0, win: 0 }; renderState(); persist(); setStatus('Saldo reiniciado.'); });
els.clearHistory.addEventListener('click', () => { state.history = []; renderState(); persist(); });
els.exportJson.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'historico-fortune-tiger.json'; a.click();
  URL.revokeObjectURL(url);
});

// Funds handlers
els.addFundsBtn.addEventListener('click', () => els.addFundsPanel.classList.toggle('hidden'));
els.fundCancel.addEventListener('click', () => els.addFundsPanel.classList.add('hidden'));
els.fundConfirm.addEventListener('click', () => {
  const amt = Number(els.fundCustom.value);
  if (amt > 0) {
    state.balance = addCredits(state.balance, amt);
    state.transactions.unshift({ t: Date.now(), type: 'add', amount: amt });
    renderState(); persist();
    els.addFundsPanel.classList.add('hidden');
  }
});
els.addFundsPanel.querySelectorAll('.fund-options button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const amt = Number(btn.dataset.amt);
    state.balance = addCredits(state.balance, amt);
    state.transactions.unshift({ t: Date.now(), type: 'add', amount: amt });
    renderState(); persist();
  });
});

// Zerar saldo (ajuste manual, não é aposta nem prêmio)
function waitForRoundToFinish() {
  return new Promise((resolve) => {
    const check = () => {
      if (!spinning && !autoRunning) resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}

els.zeroBalanceBtn.addEventListener('click', async () => {
  if (zeroInProgress) return;
  if (!confirm('Zerar o saldo da carteira virtual para R$ 0,00?\n\nO histórico de apostas, as estatísticas e o resultado operacional serão preservados.')) return;

  zeroInProgress = true;
  els.zeroBalanceBtn.disabled = true;
  if (autoRunning) {
    autoStopRequested = true;
    setStatus('Auto apostar interrompido. Aguardando a rodada atual terminar...');
  } else if (spinning) {
    setStatus('Aguardando a rodada atual terminar...');
  }

  try {
    await waitForRoundToFinish();
    const previousBalance = state.balance;
    state.balance = 0;
    if (previousBalance !== 0) {
      state.transactions.unshift({
        t: Date.now(),
        type: 'adjust',
        amount: -previousBalance,
        note: 'Saldo zerado manualmente',
      });
    }
    renderState();
    persist();
    setStatus('Saldo zerado manualmente: R$ 0,00.');
  } finally {
    zeroInProgress = false;
    els.zeroBalanceBtn.disabled = false;
  }
});

// Zerar resultado operacional acumulado (apenas o indicador, não afeta saldo/histórico/totais)
let resultResetInProgress = false;

els.resultResetBtn.addEventListener('click', async () => {
  if (resultResetInProgress) return;
  if (!confirm('Zerar o resultado operacional acumulado?\n\nEsta ação reinicia a contagem do indicador de lucro/prejuízo a partir deste momento.\n\nSaldo, histórico, estatísticas e totais totais são preservados.')) return;

  resultResetInProgress = true;
  els.resultResetBtn.disabled = true;

  try {
    state.resultBaseline = { bet: state.totals.bet, win: state.totals.win };
    renderState();
    persist();
    setStatus('Resultado operacional zerado.');
  } finally {
    resultResetInProgress = false;
    els.resultResetBtn.disabled = false;
  }
});

// Auto bet
els.autoBtn.addEventListener('click', () => els.autoPanel.classList.toggle('hidden'));
els.autoPause.addEventListener('click', () => {
  autoPaused = !autoPaused;
  els.autoPause.textContent = autoPaused ? 'Retomar' : 'Pausar';
});
els.autoStop.addEventListener('click', () => { autoStopRequested = true; });
els.autoInterval.addEventListener('change', () => {
  els.autoIntervalCustom.hidden = els.autoInterval.value !== 'custom';
});
els.autoStart.addEventListener('click', async () => {
  if (autoRunning || zeroInProgress) return;
  const spins = Number(els.autoSpins.value) || 100;
  const bet = Number(els.autoBet.value) || 1;
  const intervalSel = els.autoInterval.value;
  const interval = intervalSel === 'custom' ? Number(els.autoIntervalCustom.value) || 1000 : Number(intervalSel);
  const sp = els.autoStopProfit.value;
  const sl = els.autoStopLoss.value;
  const stopProfit = sp === '' ? null : Number(sp);
  const stopLoss = sl === '' ? null : Number(sl);
  if (!canPlaceBet(state.balance, bet)) { setStatus('Saldo insuficiente.'); return; }
  if (!confirm(`Iniciar ${spins} giros automáticos de ${formatBRL(bet)}?`)) return;
  autoRunning = true; autoPaused = false; autoStopRequested = false;
  els.spinBtn.disabled = true;
  els.autoStatus.textContent = 'Executando...';
  const initialBalance = state.balance;
  let count = 0;
  while (count < spins && !autoStopRequested) {
    if (currentView !== 'game') { autoPaused = true; els.autoStatus.textContent = 'Pausado (fora da tela do jogo).'; }
    if (autoPaused) { await new Promise((r) => setTimeout(r, 300)); continue; }
    if (state.balance < bet) { els.autoStatus.textContent = 'Saldo insuficiente.'; break; }
    if (stopProfit !== null && state.balance - initialBalance >= stopProfit) { els.autoStatus.textContent = 'Stop profit atingido.'; break; }
    if (stopLoss !== null && initialBalance - state.balance >= stopLoss) { els.autoStatus.textContent = 'Stop loss atingido.'; break; }
    await performSpin(bet, true);
    count++;
    els.autoStatus.textContent = `Giro ${count}/${spins}`;
    await new Promise((r) => setTimeout(r, interval));
  }
  if (autoStopRequested) els.autoStatus.textContent = 'Interrompido.';
  else if (count >= spins) els.autoStatus.textContent = 'Concluído.';
  autoRunning = false;
  els.spinBtn.disabled = false;
});

// Stats
function renderStats() {
  const rounds = state.history;
  const totalBet = state.totals.bet;
  const totalWin = state.totals.win;
  const net = resultCents(totalBet, totalWin) / 100;
  const added = state.transactions.filter((t) => t.type === 'add').reduce((a, t) => a + t.amount, 0);
  const wins = rounds.filter((r) => r.win > 0).length;
  const losses = rounds.filter((r) => r.win === 0).length;
  const hitRate = rounds.length ? wins / rounds.length : 0;
  const profitRate = rounds.length ? rounds.filter((r) => r.net > 0).length / rounds.length : 0;
  const maxWin = rounds.reduce((a, r) => Math.max(a, r.win), 0);
  const maxLoss = rounds.reduce((a, r) => Math.max(a, r.bet - r.win), 0);
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  for (const r of [...rounds].reverse()) {
    if (r.win > 0) { curW++; curL = 0; maxWinStreak = Math.max(maxWinStreak, curW); }
    else { curL++; curW = 0; maxLossStreak = Math.max(maxLossStreak, curL); }
  }
  const lines = [];
  lines.push(`Saldo atual: ${formatBRL(state.balance)}`);
  lines.push(`Créditos adicionados: ${formatBRL(added)}`);
  lines.push(`Total apostado (acumulado): ${formatBRL(totalBet)}`);
  lines.push(`Total recebido (acumulado): ${formatBRL(totalWin)}`);
  lines.push(`Resultado operacional (acumulado): ${formatBRL(net)}`);
  lines.push(`Rodadas: ${rounds.length}`);
  lines.push(`Rodadas com prêmio: ${wins}`);
  lines.push(`Rodadas sem prêmio: ${losses}`);
  lines.push(`Hit rate: ${(hitRate * 100).toFixed(2)}%`);
  lines.push(`Taxa de rodadas lucrativas: ${(profitRate * 100).toFixed(2)}%`);
  lines.push(`Maior prêmio: ${formatBRL(maxWin)}`);
  lines.push(`Maior perda em rodada: ${formatBRL(maxLoss)}`);
  lines.push(`Maior seq. vitórias: ${maxWinStreak}`);
  lines.push(`Maior seq. derrotas: ${maxLossStreak}`);
  els.statsIndicators.textContent = lines.join('\n');

  const balCanvas = document.getElementById('chartWalletBalance');
  const pnlCanvas = document.getElementById('chartWalletPnl');
  if (balCanvas) {
    const seq = [...rounds].reverse();
    let bal = state.balance - seq.reduce((a, r) => a + r.net, 0);
    const data = seq.map((r) => { bal += r.net; return bal; });
    charts.drawLineChart(balCanvas, [{ data, color: '#f5c542' }], { title: 'Evolução do saldo' });
  }
  if (pnlCanvas) {
    const seq = [...rounds].reverse();
    let cum = 0;
    const data = seq.map((r) => { cum += r.net; return cum; });
    charts.drawLineChart(pnlCanvas, [{ data, color: '#7CFC00' }], { title: 'Lucro/Prejuízo acumulado' });
  }
}
document.getElementById('statsRefresh').addEventListener('click', renderStats);
document.getElementById('statsExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ balance: state.balance, history: state.history, transactions: state.transactions }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'estatisticas.json'; a.click();
  URL.revokeObjectURL(url);
});

// initial render
const initGrid = [
  ['ORANGE','INGOT','CHARM'],
  ['BAG','ENVELOPE','FIRECRACKER'],
  ['ORANGE','INGOT','CHARM'],
];
ui.renderGrid(initGrid);
renderState();
setStatus('Pronto. Pressione GIRAR.');

// Lab
const lab = new LabController();

// View switching
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => {
    const active = v.classList.contains('view-' + name);
    v.classList.toggle('hidden', !active);
    v.hidden = !active;
  });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
}
document.querySelectorAll('.nav-btn').forEach((b) => {
  b.addEventListener('click', () => showView(b.dataset.view));
});
showView('game');
