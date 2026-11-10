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

test('nao existe secao view-game solta sem fechamento', () => {
  // Deve existir exatamente uma <section class="game-panel view view-game">
  // e uma <section class="info-panel view view-game">, nao uma tag <section class="view view-game"> solta
  const gamePanelMatches = html.match(/<section class="game-panel view view-game"/g) || [];
  const infoPanelMatches = html.match(/<section class="info-panel view view-game"/g) || [];
  const bareViewGameMatches = html.match(/<section class="view view-game"(?!\s+game-panel|\s+info-panel)/g) || [];
  assert.equal(gamePanelMatches.length, 1, 'deve existir exatamente uma section game-panel view-game');
  assert.equal(infoPanelMatches.length, 1, 'deve existir exatamente uma section info-panel view-game');
  assert.equal(bareViewGameMatches.length, 0, 'nao deve existir tag section view-view-game solta (sem fechar)');
});

test('cada view tem exatamente uma classe de view', () => {
  const viewSections = html.match(/<section[^>]*class="[^"]*view[^"]*"/g);
  assert.ok(viewSections, 'deve existir pelo menos uma section com classe view');
  for (const section of viewSections) {
    const viewClasses = section.match(/view-\w+/g);
    assert.ok(viewClasses, 'secao deve ter uma classe view-*');
    assert.equal(viewClasses.length, 1, 'secao deve ter exatamente uma classe view-*: ' + section);
  }
});

test('doSpin usa try/finally para garantir liberacao do botao', () => {
  const mainJs = readFileSync(join(root, 'js', 'main.js'), 'utf8');
  // Verifica que doSpin tem try/finally para re-habilitar o botao mesmo em caso de erro
  assert.match(mainJs, /async function doSpin\(\)/);
  assert.match(mainJs, /try\s*\{[\s\S]*await performSpin\(bet, false\)/);
  assert.match(mainJs, /\}\s*finally\s*\{[\s\S]*spinning\s*=\s*false[\s\S]*els\.spinBtn\.disabled\s*=\s*false/);
});
