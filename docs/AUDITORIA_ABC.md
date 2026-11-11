# Auditoria A/B/C — Relatório Técnico

## 1. Objetivo

Este relatório consolida a auditoria matemática independente dos cenários A, B e C do
Fortune Tiger Simulator. O objetivo é medir o efeito isolado de duas camadas
experimentais sobre o mesmo motor-base:

- **A:** motor-base puro, sem multiplicador experimental.
- **B:** motor-base com multiplicador experimental e cap experimental final de 2.500×.
- **C:** motor-base com multiplicador experimental, mas sem o cap experimental final.

A auditoria foi executada por `tools/audit-abc.mjs`, uma ferramenta separada da
aplicação. Ela não altera pesos, probabilidades, paytable, Feature, caps, motor ou
interface. Apenas lê os contratos existentes e registra os resultados.

Os valores deste relatório são os resultados confirmados da Etapa 5 e foram
reproduzidos novamente em 2026-11-10 com os mesmos parâmetros padrão.

## 2. Metodologia

### 2.1 Parâmetros

| Parâmetro | Valor |
|---|---:|
| Rodadas | 10.000.000 |
| Aposta por rodada | R$ 1,00 (100 centavos) |
| Total apostado | R$ 10.000.000,00 |
| Semente do RNG base | 123456789 |
| Semente do RNG experimental | 987654321 |
| Perfil do motor | `experimental` |
| `enforceMaxWin` do motor | `true` |
| Cap interno do motor | 2.500× a aposta |
| Cap experimental final | 2.500× a aposta |
| Ativação do multiplicador experimental | 5% por rodada |
| Pesos do multiplicador | ×2: 40; ×5: 30; ×10: 20; ×50: 10 |

### 2.2 Independência dos RNGs

O harness cria duas instâncias separadas com `createRngPair({ baseSeed, expSeed })`:

- `base`: usado exclusivamente por `playSpin()` para Feature, símbolos, células e
  respins;
- `experimental`: usado exclusivamente por `drawExperimentalMultiplier()`.

Consumir um gerador não desloca a sequência do outro. Quando apenas o cenário A é
selecionado, o RNG experimental não é sorteado.

### 2.3 Mesma rodada-base em A/B/C

Para cada uma das 10 milhões de rodadas:

1. `playSpin()` é chamado **uma única vez**;
2. o prêmio-base é convertido para centavos inteiros;
3. o mesmo `baseWinCents` alimenta os três cenários;
4. o mesmo resultado-base também alimenta os hashes.

Assim, diferenças entre A, B e C vêm apenas do multiplicador experimental e do cap
experimental final, nunca de sequências aleatórias diferentes.

### 2.4 Mesmo multiplicador em B e C

O multiplicador experimental é sorteado **uma única vez por rodada** e reutilizado em B
e C. Ele não é resortado entre os cenários. Em A, o multiplicador efetivo é sempre `1`
e nenhum cap experimental é aplicado.

### 2.5 Liquidação centralizada

Os três cenários são liquidados por `settleRoundWin()`:

- A: `{ baseWinCents, betCents, multiplier: 1, applyExperimentalCap: false }`;
- B: `{ baseWinCents, betCents, multiplier, applyExperimentalCap: true }`;
- C: `{ baseWinCents, betCents, multiplier, applyExperimentalCap: false }`.

A função trabalha somente com centavos inteiros. Ela não converte reais, não arredonda e
não recalcula o prêmio-base.

## 3. Definição dos cenários

| Cenário | Multiplicador experimental | Cap experimental final |
|---|---|---|
| A | Não | Não |
| B | Sim | Sim |
| C | Sim | Não |

O **cap interno do motor** permanece ativo nos três cenários. Ele é aplicado dentro de
`playSpin()` por `capWin()`, porque o perfil `experimental` tem `enforceMaxWin: true`.
O prêmio-base já chega à liquidação com esse limite incorporado.

O cenário C desativa **somente** o cap experimental final. Ele não desativa, remove ou
contorna o cap interno do motor.

## 4. Resultados

### 4.1 Totais e RTP

| Cenário | Total apostado | Prêmios | RTP |
|---|---:|---:|---:|
| A | R$ 10.000.000,00 | R$ 10.246.175,20 | 102,461752% |
| B | R$ 10.000.000,00 | R$ 13.221.141,00 | 132,211410% |
| C | R$ 10.000.000,00 | R$ 14.476.911,00 | 144,769110% |

Em centavos:

| Cenário | Total apostado | Prêmios |
|---|---:|---:|
| A | 1.000.000.000 | 1.024.617.520 |
| B | 1.000.000.000 | 1.322.114.100 |
| C | 1.000.000.000 | 1.447.691.100 |

### 4.2 Diferença C−B

| Métrica | Valor |
|---|---:|
| Diferença em centavos | 125.577.000 |
| Diferença em reais | R$ 1.255.770,00 |
| Diferença em pontos percentuais | 12,557700 pp |
| Caps experimentais aplicados em B | 175 |
| Caps experimentais aplicados em A | 0 |
| Caps experimentais aplicados em C | 0 |

A diferença C−B é exatamente igual ao valor excedente que o cap experimental removeu em
B: `125.577.000` centavos. O harness verifica essa identidade
(`excessAboveExperimentalCapCents`) e registra `equalsCapExcess: true`.

### 4.3 Eventos

| Evento | Valor |
|---|---:|
| Hits | 2.246.182 |
| Hit rate | 22,461820% |
| Features acionadas | 99.371 |
| Feature rate | 0,993710% |
| Full grids | 17.183 |
| Rodadas sem Feature | 9.900.629 |
| Rodadas com Feature | 99.371 |

Os eventos são idênticos nos três cenários, pois todos partem da mesma rodada-base.

## 5. Decomposição base e Feature

### 5.1 Definições

- **RTP condicional base:** prêmios de rodadas sem Feature divididos pelas apostas
  dessas mesmas rodadas.
- **RTP condicional Feature:** prêmios de rodadas com Feature divididos pelas apostas
  dessas mesmas rodadas.
- **Contribuição ao RTP total:** prêmios da categoria divididos pelo total apostado de
  todas as rodadas.

O RTP condicional da Feature é muito alto porque apenas 0,993710% das rodadas acionam a
Feature. Ele **não** deve ser somado diretamente ao RTP base. A soma correta é feita
pelas contribuições ao RTP total.

### 5.2 Cenário A

| Componente | Apostas (centavos) | Apostas (R$) | Prêmios (centavos) | Prêmios (R$) | RTP condicional | Contribuição ao RTP total |
|---|---:|---:|---:|---:|---:|---:|
| Base | 990.062.900 | 9.900.629,00 | 486.738.000 | 4.867.380,00 | 49,162331% | 48,673800% |
| Feature | 9.937.100 | 99.371,00 | 537.879.520 | 5.378.795,20 | 5.412,841976% | 53,787952% |
| **Total** | **1.000.000.000** | **10.000.000,00** | **1.024.617.520** | **10.246.175,20** | — | **102,461752%** |

Verificação: `48,673800% + 53,787952% = 102,461752%`.

### 5.3 Cenário B

| Componente | Apostas (centavos) | Apostas (R$) | Prêmios (centavos) | Prêmios (R$) | RTP condicional | Contribuição ao RTP total |
|---|---:|---:|---:|---:|---:|---:|
| Base | 990.062.900 | 9.900.629,00 | 687.800.780 | 6.878.007,80 | 69,470412% | 68,780078% |
| Feature | 9.937.100 | 99.371,00 | 634.313.320 | 6.343.133,20 | 6.383,284057% | 63,431332% |
| **Total** | **1.000.000.000** | **10.000.000,00** | **1.322.114.100** | **13.221.141,00** | — | **132,211410%** |

Verificação: `68,780078% + 63,431332% = 132,211410%`.

### 5.4 Cenário C

| Componente | Apostas (centavos) | Apostas (R$) | Prêmios (centavos) | Prêmios (R$) | RTP condicional | Contribuição ao RTP total |
|---|---:|---:|---:|---:|---:|---:|
| Base | 990.062.900 | 9.900.629,00 | 687.950.780 | 6.879.507,80 | 69,485563% | 68,795078% |
| Feature | 9.937.100 | 99.371,00 | 759.740.320 | 7.597.403,20 | 7.645,493353% | 75,974032% |
| **Total** | **1.000.000.000** | **10.000.000,00** | **1.447.691.100** | **14.476.911,00** | — | **144,769110%** |

Verificação: `68,795078% + 75,974032% = 144,769110%`.

### 5.5 Leitura dos resultados

- Em A, a Feature responde por 53,787952% do RTP total, superando a contribuição base
  de 48,673800%.
- Em B, a contribuição base sobe para 68,780078% e a da Feature fica em 63,431332%.
- Em C, sem o cap experimental final, a contribuição da Feature sobe para 75,974032%,
  enquanto a base fica praticamente estável em relação a B.
- O cap experimental final reduz apenas os prêmios que ultrapassam 2.500× a aposta;
  por isso a diferença C−B se concentra nos prêmios maiores.

## 6. Intervalos de confiança

### 6.1 Fórmula

O IC95% foi calculado pela aproximação normal:

```
média = (1/n) Σ xᵢ
s²    = (1/(n−1)) Σ (xᵢ − média)²
EP    = s / √n
IC95% = média ± 1,959963984540054 × EP
```

- `n = 10.000.000`.
- Para o RTP, `xᵢ = (prêmio final da rodada / aposta da rodada) × 100`, em pontos
  percentuais.
- Para C−B, `xᵢ` é a diferença pareada por rodada
  `((finalC − finalB) / aposta) × 100`, usando a mesma rodada-base e o mesmo
  multiplicador.
- A variância amostral usa `n−1`.

### 6.2 Resultados

| Métrica | Média | Desvio-padrão amostral | Erro-padrão | IC95% |
|---|---:|---:|---:|---:|
| RTP A | 102,461752% | 1.847,843276 | 0,584339 | [101,316468%; 103,607036%] |
| RTP B | 132,211410% | 2.403,740528 | 0,760129 | [130,721584%; 133,701236%] |
| RTP C | 144,769110% | 6.881,650089 | 2,176169 | [140,503897%; 149,034323%] |
| Diferença C−B | 12,557700 pp | 5.941,684049 | 1,878925 | [8,875074; 16,240326] pp |

### 6.3 Interpretação

Os intervalos descrevem a incerteza amostral do RTP médio e da diferença média C−B para
o processo gerador auditado. Eles não são uma probabilidade de que o "RTP verdadeiro"
esteja dentro do intervalo e não representam garantia de retorno futuro.

O intervalo de C é bem mais largo que os de A e B porque o cap experimental final
remove prêmios extremos em B; sem esse cap, C mantém caudas mais pesadas. A diferença
C−B é pareada por rodada, o que reduz a variância em relação a comparar médias
independentes.

## 7. Hashes SHA-256

Os hashes foram calculados em streaming com `node:crypto`, atualizando o hash a cada
rodada. Nenhum array de 10 milhões de elementos é mantido em memória.

| Sequência | Hash SHA-256 |
|---|---|
| Base | `4367726b727e455d73f323a03ff962aee10b9fab091b7e9efcea4eb34cd506e3` |
| Multiplicadores experimentais | `61264583c395bdf33cd9a855e8c1209fe9a2f274a9f039cba4609c78d70012e5` |
| Base canônico adicional | `093231148878d8a17ae926775b103e71936579e8fdf99fed4d83d8ff732548c1` |

### 7.1 Serialização base histórica

```
${grid.flat().join('')}|${featureTriggered ? feature.chosenSymbol : '-'}|${baseWinCents}\n
```

- `grid`: 3×3 em ordem row-major.
- Símbolos concatenados; blank/`null` vira string vazia.
- `featureToken`: símbolo escolhido quando há Feature; `-` caso contrário.
- `baseWinCents`: inteiro sem casas decimais.
- Registros separados por `\n`; campos por `|`.

Essa serialização é mantida por compatibilidade histórica. Como blanks são omitidos,
ela não é injetiva.

### 7.2 Serialização base canônica adicional

```
${JSON.stringify(grid)}|${featureToken}|${baseWinCents}\n
```

- `grid`: JSON de arrays 3×3, com `null` explícito para blanks.
- Preserva posições vazias e elimina ambiguidades da serialização histórica.
- O JSON não contém `|`, portanto o separador de campos permanece inequívoco.

### 7.3 Serialização dos multiplicadores

```
${multiplier}\n
```

Um inteiro por linha, na ordem das rodadas. O multiplicador `1` é registrado quando não
há ativação.

## 8. Reprodutibilidade

### 8.1 Auditoria completa com os padrões

```bash
node tools/audit-abc.mjs
```

Equivale a:

```bash
node tools/audit-abc.mjs --rounds 10000000 --base-seed 123456789 --exp-seed 987654321 --bet-cents 100
```

O JSON é sempre impresso no `stdout`. O tempo de execução varia conforme a máquina;
neste ambiente, a execução de 10 milhões de rodadas levou aproximadamente 132 segundos.

### 8.2 Salvar o resultado em arquivo

```bash
node tools/audit-abc.mjs --rounds 10000000 --base-seed 123456789 --exp-seed 987654321 --bet-cents 100 --out auditoria-abc.json
```

O arquivo só é criado quando `--out` é informado explicitamente.

### 8.3 Ajuda da CLI

```bash
node tools/audit-abc.mjs --help
```

### 8.4 Testes

Teste específico do harness:

```bash
node --test tests/audit-abc.test.js
```

Testes dos módulos usados pelo harness:

```bash
node --test tests/rng-provider.test.js tests/round-settlement.test.js
```

Suíte completa:

```bash
npm.cmd test
# equivalente a: node --test "tests/**/*.test.js"
```

Referência atual: **147 testes aprovados**.

### 8.5 Campos do JSON para conferência

- `parameters`: rodadas, aposta, sementes, perfil, caps e pesos experimentais.
- `metrics.A`, `metrics.B`, `metrics.C`: totais, RTP, decomposição, eventos e caps.
- `differenceCminusB`: diferença C−B, excesso acima do cap e identidade verificada.
- `confidenceIntervals95`: médias, desvios, erros-padrão e limites.
- `events`: hits, Features, full grids e contagens de rodadas.
- `hashes`: hashes das três sequências e descrição das serializações.
- `execution`: chamadas de `playSpin()`, sorteios experimentais, tempo e ambiente.

## 9. Ressalvas técnicas

- Os pesos, a probabilidade de Feature e a distribuição dos multiplicadores são
  **parâmetros do simulador**, não valores oficiais confirmados do jogo comercial.
- Os resultados são reproduzíveis para as sementes e a implementação auditadas. Mudanças
  de código, pesos, ordem de consumo dos RNGs ou parâmetros alteram os resultados.
- Uma simulação de dez milhões de rodadas **não prova** que o jogo comercial original
  tenha essas mesmas probabilidades.
- O RTP observado **não é garantia de retorno futuro**. Ele descreve o comportamento
  agregado da amostra auditada.
- O cap interno do motor e o cap experimental final são mecanismos distintos:
  - o cap interno atua dentro de `playSpin()`, antes do multiplicador experimental;
  - o cap experimental final atua depois do multiplicador, apenas em B.
- O cenário C desativa **somente** o cap experimental final. O cap interno permanece
  ativo em A, B e C.
- O RTP acima de 100% nos cenários auditados é consequência dos parâmetros experimentais
  atuais. Ele não deve ser interpretado como RTP oficial nem como promessa de lucro.
- Nenhum valor foi ajustado, arredondado ou preenchido por suposição para forçar
  igualdade com o baseline.
