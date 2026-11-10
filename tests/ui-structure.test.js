import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css', 'style.css'), 'utf8');

function indexOfOrFail(needle) {
  const i = html.indexOf(needle);
  assert.notEqual(i, -1, `elemento ausente: ${needle}`);
  return i;
}

test('titulo fica acima da grade 3x3', () => {
  const title = indexOfOrFail('class="banner-title"');
  const reels = indexOfOrFail('class="reels-wrap"');
  assert.ok(title < reels, 'titulo deve vir antes da roleta');
});

test('frases informativas ficam em area propria acima da grade', () => {
  const messages = indexOfOrFail('class="game-messages"');
  const reels = indexOfOrFail('class="reels-wrap"');
  assert.ok(messages < reels, 'game-messages deve vir antes da roleta');
  assert.ok(indexOfOrFail('id="featureText"') < reels);
  assert.ok(indexOfOrFail('id="featureChosen"') < reels);
  assert.ok(indexOfOrFail('id="linesInfo"') < reels);
});

test('grade nao contem textos de titulo ou frases', () => {
  const start = indexOfOrFail('class="reels-wrap"');
  const end = indexOfOrFail('class="info-panel');
  const block = html.slice(start, end);
  assert.ok(!block.includes('FORTUNE TIGER!'));
  assert.ok(!block.includes('Símbodo escolhido'));
  assert.ok(!block.includes('Simulador offline'));
  assert.match(block, /<div class="feature-overlay" id="featureOverlay" hidden aria-hidden="true"><\/div>/);
});

test('contador operacional visivel e identificado', () => {
  assert.ok(indexOfOrFail('id="resultBanner"') > -1);
  assert.ok(indexOfOrFail('id="resultLabel"') > -1);
  assert.ok(indexOfOrFail('id="resultValueNet"') > -1);
  assert.ok(indexOfOrFail('id="resultValueGain"') > -1);
  assert.ok(indexOfOrFail('id="resultValueLoss"') > -1);
  assert.match(html, /Resultado operacional acumulado/);
});

test('botao ZERAR SALDO existe e fica na area da carteira', () => {
  const actions = indexOfOrFail('class="wallet-actions"');
  const zero = indexOfOrFail('id="zeroBalanceBtn"');
  const panelEnd = indexOfOrFail('class="bet-controls"');
  assert.ok(zero > actions && zero < panelEnd);
  assert.match(html, />ZERAR SALDO</);
});

test('overlay da Feature respeita o atributo hidden', () => {
  assert.match(css, /\.feature-overlay\[hidden\]\s*\{\s*display:\s*none/);
});

test('contador possui estados visuais distintos', () => {
  assert.match(css, /\.result-banner\.is-profit/);
  assert.match(css, /\.result-banner\.is-loss/);
  assert.match(css, /\.result-banner\.is-even/);
});

test('area de mensagens tem espacamento responsivo sem overlay na grade', () => {
  assert.match(css, /\.game-messages\s*\{[^}]*min-height/);
  assert.match(css, /\.game-head\s*\{[^}]*margin-bottom/);
});
