import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');

test('performSpin limpa destaques e overlays antes de todo giro (manual e auto)', () => {
  assert.ok(mainSource.includes('ui.clearHighlights();'), 'ui.clearHighlights deve ser chamado em performSpin');
});

test('performSpin encerra a animacao de giro em ambos os modos', () => {
  // setSpinning(false) nao deve ficar preso ao guarda !isAuto
  assert.ok(
    mainSource.includes('if (state.animations) ui.setSpinning(false);'),
    'ui.setSpinning(false) deve ser chamado independentemente de isAuto'
  );
  assert.ok(mainSource.includes('ui.setSpinning(true);'), 'ui.setSpinning(true) inicia a animacao');
});

test('performSpin encerra a animacao mesmo em caso de erro', () => {
  const playSpinIdx = mainSource.indexOf('result = playSpin(');
  const finallyIdx = mainSource.indexOf('} finally {', playSpinIdx);
  const setSpinningFalseIdx = mainSource.indexOf('ui.setSpinning(false);', finallyIdx);
  assert.ok(playSpinIdx >= 0 && finallyIdx >= 0 && setSpinningFalseIdx >= 0,
    'playSpin deve estar envolto em try/finally');
  assert.ok(setSpinningFalseIdx > finallyIdx,
    'ui.setSpinning(false) deve estar no finally que fecha playSpin');
});

test('ui.setSpinning(false) encerra o intervalo de 80 ms e remove a classe spinning', () => {
  assert.ok(uiSource.includes('if (this.spinInterval) clearInterval(this.spinInterval);'),
    'ui.setSpinning(false) deve limpar o intervalo de 80 ms');
  assert.ok(uiSource.includes('reel.classList.remove(\'spinning\')'),
    'ui.setSpinning(false) deve remover a classe spinning dos rolos');
});

test('loop do Auto apostar reseta o estado mesmo em erro ou interrupcao', () => {
  const autoStartIdx = mainSource.indexOf('els.autoStart.addEventListener');
  const finallyIdx = mainSource.indexOf('} finally {', autoStartIdx);
  assert.ok(autoStartIdx >= 0 && finallyIdx >= 0, 'loop do Auto apostar deve ter try/finally');
  assert.ok(finallyIdx > autoStartIdx, 'finally deve pertencer ao manipulador do Auto apostar');
  assert.ok(mainSource.includes('autoRunning = false;'), 'autoRunning deve ser resetado');
  assert.ok(mainSource.includes('els.spinBtn.disabled = false;'), 'botao de giro deve ser reabilitado');
});
