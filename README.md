# Fortune Tiger Simulator — Simulador Offline

Simulador educacional/recreativo inspirado no Fortune Tiger, com créditos fictícios,
carteira virtual, Auto apostar, laboratório estatístico e um harness independente de
auditoria matemática A/B/C. Funciona 100% no navegador, sem backend, sem APIs externas
e sem dinheiro real.

> **Descrição sugerida do repositório:** Simulador offline inspirado no Fortune Tiger,
> com créditos fictícios, laboratório estatístico e auditoria A/B/C reproduzível.

## Aviso importante

- **Este é um projeto experimental e não oficial.** Não é afiliado, associado,
  patrocinado ou endossado pela PG Soft ou por qualquer detentor da marca Fortune Tiger.
  "Fortune Tiger" e demais marcas citadas pertencem aos seus respectivos proprietários.
- **Não realiza apostas com dinheiro real.** Não há depósitos, saques, PIX, pagamentos,
  prêmios reais ou qualquer transação financeira.
- **Todos os créditos são fictícios.** O saldo existe apenas no `localStorage` do
  navegador e não tem valor monetário.
- **As probabilidades não reproduzem necessariamente as do jogo original.** Pesos,
  paytable, Feature e demais parâmetros são aproximações experimentais e podem divergir
  do produto oficial.
- **O RTP é experimental.** Ele emerge dos pesos configurados e não representa garantia
  de retorno individual nem promessa de resultado. Os valores dos cenários A/B/C da
  auditoria não são RTP oficial de um jogo comercial.
- **Os recursos matemáticos são implementações próprias.** O motor, o RNG, o laboratório,
  as estatísticas e o harness de auditoria foram escritos para este projeto, sem código
  proprietário de terceiros.
- **Licença:** este repositório é distribuído sob a [MIT License](./LICENSE).

## Funcionalidades

- Grade 3×3, 5 linhas de pagamento, Wild e Feature com respins sticky e multiplicador ×10
  em tela cheia.
- Carteira de créditos fictícios em reais (BRL), com adição, zeragem e reinício de saldo.
- Contador de resultado operacional acumulado (lucro, prejuízo ou empate), com linha de
  base zerável.
- Multiplicador experimental sorteado antes de cada rodada (×2, ×5, ×10 ou ×50), aplicado
  ao prêmio-base em centavos, com cap experimental final de 2.500× a aposta.
- Liquidação em centavos inteiros via `settleRoundWin()`, com verificação de domínio por
  `canSettleRoundWin()` e fallback legado para apostas sub-centavo ou valores fora da
  faixa segura.
- Auto apostar sequencial, com pausa, parada manual, stop-profit e stop-loss.
- Histórico de rodadas, estatísticas e gráficos em Canvas.
- Laboratório estatístico com simulações em Web Worker, RTP, análise de risco e
  comparação de estratégias.
- Animações e comemorações por faixa de prêmio, com suporte a `prefers-reduced-motion`.
- Interface responsiva, pensada primeiro para telas de celular.
- Persistência local via `localStorage`; nenhum dado sai do navegador.

## Como executar

O projeto é estático e não possui build step. O modo recomendado é servir a pasta
localmente, pois os módulos JavaScript são carregados via `import`:

```bash
node server.cjs
# http://localhost:8080/
```

`server.cjs` é apenas um servidor estático de desenvolvimento; a aplicação não depende
dele para funcionar no GitHub Pages. Abrir `index.html` diretamente também funciona em
navegadores que permitem módulos ES a partir de `file://`, mas o servidor local evita
restrições de CORS de alguns navegadores.

## Testes

Requer apenas Node.js, sem dependências externas:

```bash
npm.cmd test
```

No PowerShell, `npm.cmd` contorna a política que bloqueia `npm.ps1`. O comando executado
por esse script é:

```bash
node --test "tests/**/*.test.js"
```

Referência atual: **166 testes aprovados**, confirmados em 2026-11-10. A suíte inclui a
correção de `balanceBefore` (Etapa 8) e a integração de `settleRoundWin()` (Etapa 9).
Para acompanhar alterações durante o desenvolvimento:

```bash
npm.cmd run test:watch
```

## Harness de auditoria A/B/C

O harness é uma ferramenta exclusiva de auditoria, separada da aplicação. Ele não abre
interface, não usa `localStorage` e não altera o motor, os pesos, o paytable, a Feature
ou os caps. Reutiliza `playSpin()` uma vez por rodada e liquida os cenários A/B/C em
centavos inteiros com `settleRoundWin()`.

```bash
# Parâmetros padrão: 10.000.000 de rodadas, sementes 123456789 e 987654321
node tools/audit-abc.mjs
```

O JSON é sempre impresso no `stdout`. Para salvar também em arquivo, informe `--out`:

```bash
node tools/audit-abc.mjs --rounds 10000000 --base-seed 123456789 --exp-seed 987654321 --bet-cents 100 --out auditoria-abc.json
```

Opções disponíveis:

| Opção | Padrão | Descrição |
|---|---:|---|
| `--rounds` | `10000000` | Número de rodadas simuladas. |
| `--base-seed` | `123456789` | Semente do RNG do motor-base. |
| `--exp-seed` | `987654321` | Semente do RNG dos multiplicadores experimentais. |
| `--bet-cents` | `100` | Aposta por rodada, em centavos. |
| `--out` | — | Caminho opcional para salvar o JSON. |
| `--help`, `-h` | — | Exibe o uso da CLI. |

Os resultados históricos, a metodologia, as decomposições, os intervalos de confiança e
os hashes SHA-256 estão em [`docs/AUDITORIA_ABC.md`](./docs/AUDITORIA_ABC.md).

## Estrutura

```
.
├── index.html                 # interface da aplicação
├── css/
│   ├── style.css
│   └── game.css
├── js/                        # módulos ES da aplicação e do laboratório
├── assets/symbols/            # SVGs dos símbolos
├── tests/                     # 22 arquivos de teste (node:test)
├── tools/audit-abc.mjs        # harness independente de auditoria A/B/C
├── docs/                      # arquitetura, regras, validações e auditorias
├── server.cjs                 # servidor estático de desenvolvimento
├── package.json               # scripts de teste; sem dependências
├── LICENSE
└── README.md
```

Principais grupos de módulos em `js/`:

- **Motor matemático:** `config.js`, `symbols.js`, `reels.js`, `payout.js`,
  `game-engine.js`, `rng.js`.
- **Multiplicadores experimentais:** `experimental-multipliers.js`.
- **Liquidação e RNGs independentes:** `rng-provider.js` (usado pelo harness e pelos
  testes; não integrado ao `main.js`) e `round-settlement.js` (integrado ao `main.js`
  desde a Etapa 9, com fallback legado fora do domínio estrito).
- **Aplicação e interface:** `main.js`, `ui.js`, `effects.js`, `audio.js`, `charts.js`,
  `storage.js`, `wallet.js`.
- **Simulação e laboratório:** `simulator.js`, `strategies.js`, `statistics.js`,
  `lab.js`, `lab-worker.js`.

## Documentação

- [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) — arquitetura, módulos, fluxo da rodada,
  RNGs, liquidação, caps e persistência.
- [`docs/AUDITORIA_ABC.md`](./docs/AUDITORIA_ABC.md) — relatório técnico reproduzível da
  auditoria A/B/C de 10 milhões de rodadas.
- `docs/REGRAS_ORIGINAIS.md` — regras pesquisadas, confirmadas e hipóteses.
- `docs/VALIDACAO_MATEMATICA.md` — validação matemática.
- `docs/ESTATISTICA.md` — métricas e conceitos estatísticos.
- `docs/LABORATORIO.md` — laboratório estatístico.
- `docs/` também contém relatórios históricos das fases de desenvolvimento e auditorias
  anteriores.

## Publicação

O projeto foi preparado para o GitHub Pages em subdiretório
(`https://USUARIO.github.io/Tigrinho/`). Consulte `docs/PUBLICACAO_GITHUB_PAGES.md`.

Nenhuma publicação é feita automaticamente. O envio ao GitHub depende de autorização
expressa.
