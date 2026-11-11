import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

test('giro manual normal adquire e libera a protecao de exclusao mutua', () => {
  const doSpinIdx = mainSource.indexOf('async function doSpin()');
  assert.ok(doSpinIdx >= 0, 'doSpin deve existir');
  const body = mainSource.slice(doSpinIdx);
  assert.ok(body.includes('if (spinning || autoRunning || zeroInProgress) return;'),
    'doSpin deve bloquear quando outro giro ou o Auto estiver em andamento');
  assert.ok(body.includes('spinning = true;'), 'doSpin deve marcar o giro em andamento');
  assert.ok(body.includes('} finally {'), 'doSpin deve usar try/finally');
  const finallyIdx = body.indexOf('} finally {');
  const spinningFalseIdx = body.indexOf('spinning = false;', finallyIdx);
  assert.ok(spinningFalseIdx > finallyIdx,
    'spinning deve ser liberado no finally do giro manual');
});

test('Auto apostar nao inicia durante um giro manual em andamento', () => {
  const autoStartIdx = mainSource.indexOf('els.autoStart.addEventListener');
  const body = mainSource.slice(autoStartIdx);
  assert.ok(body.includes('if (autoRunning || spinning || zeroInProgress) return;'),
    'autoStart deve bloquear quando houver giro manual (spinning) em andamento');
});

test('giro manual nao inicia durante o Auto apostar', () => {
  const doSpinIdx = mainSource.indexOf('async function doSpin()');
  const body = mainSource.slice(doSpinIdx);
  assert.ok(body.includes('if (spinning || autoRunning || zeroInProgress) return;'),
    'doSpin deve bloquear quando o Auto estiver executando (autoRunning)');
});

test('performSpin protege seu proprio ponto de entrada contra entrada duplicada', () => {
  const fnIdx = mainSource.indexOf('async function performSpin(');
  const body = mainSource.slice(fnIdx);
  assert.ok(body.includes('if (roundInProgress) return;'),
    'performSpin deve rejeitar entrada enquanto outro giro estiver em andamento');
  assert.ok(body.includes('roundInProgress = true;'),
    'performSpin deve adquirir a protecao antes de qualquer operacao assincrona');
});

test('performSpin libera a protecao apos erro ou conclusao (try/finally)', () => {
  const fnIdx = mainSource.indexOf('async function performSpin(');
  const body = mainSource.slice(fnIdx);
  const tryIdx = body.indexOf('try {');
  const finallyIdx = body.indexOf('} finally {', tryIdx);
  const releaseIdx = body.indexOf('roundInProgress = false;', finallyIdx);
  assert.ok(tryIdx >= 0 && finallyIdx >= 0 && releaseIdx >= 0,
    'performSpin deve envolver o corpo em try/finally');
  assert.ok(releaseIdx > finallyIdx,
    'roundInProgress deve ser liberado no finally, apos qualquer saida');
  const closingFnIdx = body.indexOf('}', releaseIdx);
  assert.ok(closingFnIdx > releaseIdx, 'o finally deve fechar antes do fim da funcao');
});

test('o loop do Auto apostar executa giros sequenciais via performSpin', () => {
  const autoStartIdx = mainSource.indexOf('els.autoStart.addEventListener');
  const body = mainSource.slice(autoStartIdx);
  const finallyIdx = body.indexOf('} finally {', autoStartIdx - mainSource.indexOf('els.autoStart.addEventListener'));
  const loopBody = body.slice(0, finallyIdx);
  assert.ok(loopBody.includes('await performSpin(bet, true);'),
    'o loop do Auto deve chamar performSpin para cada giro');
  assert.ok(loopBody.includes('count++;'), 'o loop deve avançar o contador de giros');
  assert.ok(loopBody.includes('while (count < spins && !autoStopRequested) {'),
    'o loop deve executar giros sequenciais até o limite ou parada');
});

test('o Auto apostar reseta o estado e libera o botao ao parar normalmente', () => {
  const autoStartIdx = mainSource.indexOf('els.autoStart.addEventListener');
  const body = mainSource.slice(autoStartIdx);
  const finallyIdx = body.indexOf('} finally {');
  const finallyPart = body.slice(finallyIdx);
  assert.ok(finallyPart.includes('autoRunning = false;'),
    'autoRunning deve ser resetado no finally do Auto');
  assert.ok(finallyPart.includes('els.spinBtn.disabled = false;'),
    'o botao de giro deve ser reabilitado ao parar o Auto');
});

test('duas chamadas simultaneas a performSpin nao executam liquidações concorrentes', () => {
  const fnIdx = mainSource.indexOf('async function performSpin(');
  const body = mainSource.slice(fnIdx);
  const firstAwaitIdx = body.indexOf('await new Promise', 0);
  const setFlagIdx = body.indexOf('roundInProgress = true;');
  const guardIdx = body.indexOf('if (roundInProgress) return;');
  const releaseIdx = body.indexOf('roundInProgress = false;');
  // A protecao deve ser adquirida (flag setada) ANTES da primeira operacao assincrona
  assert.ok(setFlagIdx >= 0 && firstAwaitIdx >= 0 && setFlagIdx < firstAwaitIdx,
    'roundInProgress deve ser true antes do primeiro await (liquidacao)');
  // A entrada duplicada e rejeitada enquanto a flag estiver ativa
  assert.ok(guardIdx >= 0 && guardIdx < firstAwaitIdx,
    'o guarda de entrada deve preceder a primeira operacao assincrona');
  // A flag e liberada apos a conclusao/erro, permitindo um novo giro
  assert.ok(releaseIdx >= 0 && releaseIdx > firstAwaitIdx,
    'roundInProgress deve ser liberado apenas depois da liquidacao');
  // Nenhuma outra funcao de main.js redefine roundInProgress (unico ponto de controle)
  // Conta apenas linhas que sao exclusivamente a liberacao (nao a declaracao 'let ... = false').
  const releaseLines = (mainSource.match(/^\s*roundInProgress = false;\s*$/gm) || []).length;
  assert.equal(releaseLines, 1, 'deve existir exatamente um ponto de liberacao da protecao');
});
