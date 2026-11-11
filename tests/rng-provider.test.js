import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRng } from '../js/rng.js';
import { createRngPair } from '../js/rng-provider.js';

function take(rng, count) {
  return Array.from({ length: count }, () => rng.random());
}

function withStubCrypto(value, callback) {
  const original = globalThis.crypto.getRandomValues;
  let calls = 0;
  globalThis.crypto.getRandomValues = (buffer) => {
    calls++;
    buffer[0] = value;
    return buffer;
  };
  try {
    return callback(() => calls);
  } finally {
    globalThis.crypto.getRandomValues = original;
  }
}

test('createRngPair retorna dois geradores com a interface de createRng', () => {
  const pair = createRngPair({ baseSeed: 101, expSeed: 202 });

  assert.notStrictEqual(pair.base, pair.experimental);
  assert.equal(pair.base.seed, 101);
  assert.equal(pair.experimental.seed, 202);

  for (const rng of [pair.base, pair.experimental]) {
    assert.equal(typeof rng.random, 'function');
    assert.equal(typeof rng.nextInt, 'function');
    assert.equal(typeof rng.pick, 'function');
    assert.equal(typeof rng.pickWeighted, 'function');
  }
});

test('cada gerador preserva a sequência de createRng para sua semente', () => {
  const pair = createRngPair({ baseSeed: 101, expSeed: 202 });

  assert.deepEqual(take(pair.base, 25), take(createRng(101), 25));
  assert.deepEqual(take(pair.experimental, 25), take(createRng(202), 25));
});

test('gerador-base é reprodutível com a mesma semente', () => {
  const a = createRngPair({ baseSeed: 777, expSeed: 1 });
  const b = createRngPair({ baseSeed: 777, expSeed: 2 });

  assert.deepEqual(take(a.base, 50), take(b.base, 50));
});

test('gerador experimental é reprodutível com a mesma semente', () => {
  const a = createRngPair({ baseSeed: 1, expSeed: 888 });
  const b = createRngPair({ baseSeed: 2, expSeed: 888 });

  assert.deepEqual(take(a.experimental, 50), take(b.experimental, 50));
});

test('sementes diferentes produzem sequências diferentes', () => {
  const a = createRngPair({ baseSeed: 11, expSeed: 22 });
  const b = createRngPair({ baseSeed: 33, expSeed: 44 });

  assert.notDeepEqual(take(a.base, 20), take(b.base, 20));
  assert.notDeepEqual(take(a.experimental, 20), take(b.experimental, 20));
});

test('consumir apenas o gerador-base não altera a sequência experimental', () => {
  const a = createRngPair({ baseSeed: 111, expSeed: 222 });
  const b = createRngPair({ baseSeed: 111, expSeed: 222 });

  take(a.base, 137);
  assert.deepEqual(take(a.experimental, 30), take(b.experimental, 30));
});

test('consumir apenas o gerador experimental não altera a sequência-base', () => {
  const a = createRngPair({ baseSeed: 111, expSeed: 222 });
  const b = createRngPair({ baseSeed: 111, expSeed: 222 });

  take(a.experimental, 137);
  assert.deepEqual(take(a.base, 30), take(b.base, 30));
});

test('sem sementes, ambos os geradores usam a Web Crypto existente', () => {
  withStubCrypto(0x80000000, (getCalls) => {
    const pair = createRngPair();

    assert.equal(pair.base.seed, null);
    assert.equal(pair.experimental.seed, null);
    assert.equal(pair.base.random(), 0x80000000 / 4294967296);
    assert.equal(pair.experimental.random(), 0x80000000 / 4294967296);
    assert.equal(getCalls(), 2);
  });
});

test('apenas baseSeed fornecida: base é semeado e experimental usa Web Crypto', () => {
  withStubCrypto(0xffffffff, (getCalls) => {
    const pair = createRngPair({ baseSeed: 555 });

    assert.equal(pair.base.seed, 555);
    assert.equal(pair.experimental.seed, null);
    assert.deepEqual(take(pair.base, 10), take(createRng(555), 10));
    assert.equal(pair.experimental.random(), 0xffffffff / 4294967296);
    assert.equal(getCalls(), 1);
  });
});

test('apenas expSeed fornecida: experimental é semeado e base usa Web Crypto', () => {
  withStubCrypto(0x80000000, (getCalls) => {
    const pair = createRngPair({ expSeed: 666 });

    assert.equal(pair.base.seed, null);
    assert.equal(pair.experimental.seed, 666);
    assert.deepEqual(take(pair.experimental, 10), take(createRng(666), 10));
    assert.equal(pair.base.random(), 0x80000000 / 4294967296);
    assert.equal(getCalls(), 1);
  });
});

test('rng-provider não depende de Math.random', () => {
  const source = readFileSync(new URL('../js/rng-provider.js', import.meta.url), 'utf8');

  assert.ok(!source.includes('Math.random'));
  assert.match(source, /import\s*\{\s*createRng\s*\}\s*from\s*'\.\/rng\.js'/);
});
