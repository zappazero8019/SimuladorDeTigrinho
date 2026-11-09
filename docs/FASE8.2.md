# Fase 8.2 — Ajustes de interface e controle de saldo

## 1. Resumo das alterações

1. **Título e frases reposicionados**: o texto "FORTUNE TIGER!" e a frase do sinal escolhido saíram de cima da grade e passaram para uma área própria acima da roleta. A grade 3×3 ficou livre de textos fixos.
2. **Contador de lucro/prejuízo**: novo indicador permanente "Resultado operacional acumulado", com estados LUCRO, PREJUÍZO e EMPATE.
3. **Zerar saldo**: novo botão "ZERAR SALDO", com confirmação, que leva a carteira a R$ 0,00 sem apagar histórico, estatísticas ou resultado operacional.
4. **Correção comprovada**: o overlay da Feature ignorava o atributo `hidden` porque a regra `.feature-overlay { display: flex }` sobrepunha o padrão do navegador. Por isso o texto "FORTUNE TIGER!" ficava permanentemente sobre a grade. Agora `.feature-overlay[hidden]` força `display: none`.

Nenhuma alteração foi feita no motor matemático, nos pesos, probabilidades, pagamentos, RTP ou no funcionamento dos giros/Feature.

## 2. Problemas comprovados antes da correção

| Problema | Evidência | Correção |
|---|---|---|
| Texto "FORTUNE TIGER!" sobre a grade com `hidden=true` | `getComputedStyle(featureOverlay).display === 'flex'` e o elemento ocupava toda a área de `#reels` | Regra `.feature-overlay[hidden] { display: none; }`; texto movido para `.game-messages` |
| Frases informativas dentro da região da roleta | "FORTUNE TIGER!" e "Símbolo escolhido" renderizados dentro de `.reels-wrap` | `#featureText`, `#featureChosen` e `#linesInfo` movidos para `.game-messages`, acima da grade |
| Ausência de indicador operacional | Não existia elemento de lucro/prejuízo na tela do jogo | Novo `#resultBanner` |
| Ausência de zeragem manual | Só existia "Reiniciar saldo (10.000)" | Novo `#zeroBalanceBtn` |

## 3. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `index.html` | Área `.game-head`/`.game-messages` acima da grade; overlay da Feature sem texto; contador `#resultBanner`; botão `#zeroBalanceBtn` |
| `css/style.css` | Correção de `[hidden]`, estilos da área de mensagens, cores do contador, grade de botões da carteira, `prefers-reduced-motion` para o overlay |
| `js/ui.js` | `showFeature`/`clearHighlights` passam a controlar os textos na área acima da grade |
| `js/wallet.js` | Funções puras `resultCents`, `resultKind` e `canPlaceBet` (centavos inteiros) |
| `js/main.js` | Contabilidade acumulada (`state.totals`), renderização do contador, zeragem segura, bloqueio de apostas sem saldo |
| `README.md` | Apenas a linha de status (fases 1–8.2) |
| `tests/accounting.test.js` | Novo: 8 testes |
| `tests/ui-structure.test.js` | Novo: 8 testes de estrutura/DOM |
| `docs/FASE8.2.md` | Este relatório |

Motor matemático intocado: `js/game-engine.js`, `js/config.js`, `js/reels.js`, `js/payout.js`, `js/simulator.js` e `js/lab.js` não foram modificados.

## 4. Backups

Criados em `backups/fase8.2/`:

- `index.html`
- `js_main.js`
- `js_ui.js`
- `js_wallet.js`
- `css_style.css`
- `css_game.css`
- `tests_wallet.test.js`

## 5. Funcionamento do contador

- **Fórmula**: `resultado = total de prêmios recebidos − total apostado`, calculado em centavos inteiros.
- **Fonte**: `state.totals = { bet, win }`, persistido em `localStorage` junto do estado.
- **Apresentação**: `LUCRO + R$ x,xx` (verde), `PREJUÍZO - R$ x,xx` (vermelho) ou `EMPATE R$ 0,00` (neutro).
- **Atualização**: imediata ao final de cada rodada, antes da comemoração.
- **Não entram no cálculo**: saldo disponível, créditos adicionados e ajustes manuais de saldo.
- **Escopo**: o rótulo diz explicitamente "acumulado"; é o resultado de todas as rodadas registradas nas estatísticas, não o saldo da carteira.
- **Compatibilidade**: estados antigos sem `totals` derivam os totais do histórico disponível no primeiro carregamento.

## 6. Funcionamento da zeragem

1. Clique em **ZERAR SALDO**.
2. Confirmação nativa informa que o saldo será alterado para R$ 0,00 e que histórico/estatísticas serão preservados.
3. Cancelar não altera nada.
4. Confirmar:
   - Se houver Auto apostar ativo, a sequência é sinalizada para parar e a rodada atual é aguardada.
   - Se houver giro manual em andamento, ele é concluído antes da zeragem.
   - O saldo vira exatamente R$ 0,00.
   - É registrada uma transação `type: 'adjust'` com o valor negativo do saldo anterior (quando diferente de zero).
   - Histórico, estatísticas e `totals` permanecem inalterados.
5. Com saldo zero, novos giros e novos Auto apostar são recusados ("Saldo insuficiente."); não há saldo negativo.

O botão antigo **Reiniciar saldo (10.000)** continua com o comportamento anterior (saldo R$ 100,00, limpa histórico e transações) e também zera `totals` para manter o contador coerente.

## 7. Regras contábeis

| Evento | Altera saldo | Altera resultado operacional |
|---|---:|---:|
| Rodada (aposta + prêmio) | sim | sim (`+prêmio −aposta`) |
| Adicionar créditos fictícios | sim | **não** |
| Zerar saldo | sim (→ R$ 0,00) | **não** |
| Reiniciar saldo (antigo) | sim (→ R$ 100,00) | sim (zera o histórico e `totals`) |

O resultado operacional nunca é inferido do saldo. Isso fica comprovado no teste de zeragem: saldo R$ 109,60 → R$ 0,00 com o contador permanecendo `LUCRO + R$ 9,60`.

## 8. Testes automatizados

Comando: `node --test "tests/**/*.test.js"`.

```
tests 61
pass 61
fail 0
cancelled 0
skipped 0
```

Distribuição: 45 testes anteriores preservados + 8 de contabilidade + 8 de estrutura de interface.

### Contador (8)

- Lucro: 10 apostado / 15 recebido → 500 centavos, `profit`.
- Prejuízo: 10 / 4 → −600 centavos, `loss`.
- Empate: 10 / 10 → 0, `even`.
- Precisão em centavos: `0.1 + 0.2` vs `0.3` → 0.
- Adição de créditos não altera o resultado.
- Zeragem do saldo não altera o resultado.
- O resultado não deriva do saldo disponível.
- `canPlaceBet`: aceita saldo igual, recusa saldo menor, zero, negativo, `NaN` e `Infinity`.

### Interface (8, estruturais)

- Título antes da roleta.
- `game-messages` (frases) antes da roleta.
- `featureText`, `featureChosen` e `linesInfo` fora de `.reels-wrap`.
- Nenhum texto de título/frase dentro da grade; overlay da Feature vazio.
- Contador `resultBanner`/`resultLabel`/`resultValue` presente.
- Botão `ZERAR SALDO` dentro de `.wallet-actions`.
- CSS com `.feature-overlay[hidden] { display: none; }`.
- CSS com os três estados visuais do contador.

## 9. Validação manual no navegador

Ambiente: Chromium do OpenCode Browser, `http://localhost:8080/`, janela de 800×535; largura de conteúdo simulada em 340 px para o teste responsivo.

| Verificação | Resultado |
|---|---|
| Overlay da Feature parado | `display: none`, texto vazio |
| Grade 3×3 parada | sem textos próprios (apenas o marcador `·` de células blanks da Feature) |
| Título e frases | banner em `top 107–173`, mensagens em `179–213`, grade começa em `221` — sem sobreposição |
| Layout estreito (340 px) | banner/mensagens acima da grade; sem rolagem horizontal |
| Contador: empate inicial | `EMPATE R$ 0,00` |
| Contador: sequência de perdas | `PREJUÍZO`, atualizado a cada giro |
| Contador: rodada com prêmio | `LUCRO + R$ 9,60` após prêmio de R$ 15,00 |
| Adicionar R$ 50 | saldo R$ 50,00; contador inalterado |
| Zerar: cancelar | saldo e histórico inalterados |
| Zerar: confirmar | saldo R$ 0,00; histórico 8→8; `totals` inalterados; transação `adjust` criada |
| Giro com saldo zero | "Saldo insuficiente." |
| Auto apostar + zerar | 2 rodadas concluídas, sequência interrompida, nenhuma rodada extra, saldo R$ 0,00 |
| Persistência após recarregar | saldo 0, contador e histórico preservados; ajuste preservado |
| Reiniciar saldo antigo | saldo R$ 100,00, histórico 0, contador `EMPATE` |
| Feature real (rodada vencedora) | "FORTUNE TIGER!" e "Símbolo escolhido" na área acima; overlay sem texto; grade sem frases |
| Laboratório (1.000 rodadas, semente 42) | "Concluído.", indicadores e 6 canvas desenhados |
| Áudio ligado/desligado | alterna 🔊/🔇, persiste, sem erros |
| Console | nenhum erro durante os fluxos testados |
| GitHub Pages em subdiretório | `/Tigrinho/index.html` carrega CSS, JS, 9 imagens, giro e contador; sem erros |

## 10. Testes de estresse

Sequência de **500 giros automáticos** a R$ 0,01, animações desligadas, intervalo curto:

- Segmento 1: 380 giros concluídos até a sessão do navegador ser reiniciada pelo ambiente.
- Segmento 2: 120 giros concluídos sem intercorrência.
- Total acumulado: 500 rodadas (`totals.bet = 5,00`).
- Nós DOM: 282 antes do segmento 2 e 282 depois — sem crescimento.
- `#effectsLayer` com 0 elementos ao final.
- Nenhum erro no console.
- Contador final: `PREJUÍZO - R$ 1,77`.

A reinicialização do navegador no primeiro segmento foi externa ao aplicativo (a sessão inteira do navegador foi recriada, inclusive outra aba), não um travamento da página. Por isso o teste foi dividido em dois segmentos e registrado como tal.

## 11. Regressão

- 61/61 testes automatizados aprovados.
- Giro manual: OK.
- Auto apostar: OK (inclusive interrupção por zeragem).
- Feature: OK (acionada naturalmente em giro manual).
- Carteira e adição de créditos: OK.
- Histórico e persistência após recarregar: OK.
- Laboratório estatístico e gráficos: OK.
- Animações e comemorações: OK.
- GitHub Pages em subdiretório: OK.
- Nenhum arquivo de motor matemático alterado; nenhum commit, remoto ou push.

## 12. Limitações encontradas

1. **Histórico persistido limitado a 200 rodadas**: `saveState` grava `history.slice(0, 200)`. O contador e as estatísticas acumuladas usam `totals`, que é persistido separadamente e permanece correto; porém, contagens por rodada (sequências, maior prêmio, taxa de acerto) consideram apenas o histórico retido após recarregar. Limitação pré-existente, agora documentada.
2. **Testes visuais não automatizados**: os testes de interface são estruturais (HTML/CSS) e a verificação visual foi manual via geometria do DOM. Não há ferramenta de regressão visual instalada; nenhuma dependência foi adicionada.
3. **Interrupção da zeragem durante comemorações de 10×/50×**: o fluxo de espera foi validado em rodada real de Auto apostar, mas não foi possível forçar deterministicamente cada um dos quatro níveis sem alterar o motor. As comemorações em si foram validadas nas fases 7–7.3.
4. **`prefers-reduced-motion`**: a regra CSS existe e inclui o overlay da Feature, mas o ambiente de teste não permitiu emular a preferência (`matches = false`). Não foi validado em tempo de execução.
5. **Largura móvel**: testada por simulação de container em 340 px, não em dispositivo físico.
6. **Multiplicador épico** exibe `×50.00` (ponto decimal) — comportamento herdado da Fase 7, fora do escopo desta fase.

## Classificação

**APROVADA COM RESSALVAS**

As três melhorias foram implementadas, o problema real de sobreposição foi corrigido, a zeragem é segura durante o Auto apostar e a contabilidade não se confunde com o saldo. As ressalvas são de cobertura de testes (visual/emulação) e de limites preexistentes de persistência do histórico, não de funcionamento.
