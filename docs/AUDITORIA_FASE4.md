# Auditoria da Fase 4 — Laboratório Estatístico

## A. Resumo executivo

Situação geral: laboratório funcional, integrado à aplicação, com simulação reproduzível em Web Worker, gráficos e exportação. Os cálculos centrais de RTP, decomposição principal/Feature e contabilização estão coerentes com o motor.

Principais pontos aprovados:
- RTP observado, total apostado/devolvido e lucro/prejuízo calculados corretamente.
- Decomposição base/Feature soma ao RTP total.
- Multiplicador ×10 aplicado uma única vez na grade final.
- Reprodutibilidade por seed confirmada.
- Web Worker executa o mesmo motor (`simulate`).
- Cancelamento não corrompe resultados anteriores.

Problemas encontrados: IC95% degenerado para 1 experimento e aproximação normal potencialmente inadequada para caudas pesadas; vantagem da casa fixa em 3,19% (referência) mesmo para perfis experimentais; comparação de pesos efetivamente testa apenas o cenário atual; gráfico de RTP usa saldo como proxy; comparação de estratégias usa a mesma seed, mas não a mesma sequência de resultados.

Riscos estatísticos: subestimação da incerteza em amostras pequenas e interpretação enganosa de estratégias como "vencedoras".

## B. Auditoria matemática

Fórmulas verificadas:
- `RTP = totalWin / totalBet * 100` (correto).
- `Lucro = totalWin - totalBet` (correto).
- `baseRtp = baseWin / baseBet * 100` (correto).
- `featureRtp = featureWin / featureBet * 100` (correto).
- `featureContribution = featureWin / totalBet * 100` (correto).

Resultados encontrados (seed 99, 10.000 rodadas): totalBet=100000, totalWin=85238, RTP=85,238%; baseBet+featureBet=totalBet (sem duplicação).

Divergências: nenhuma divergência matemática na contabilização. A diferença entre RTP observado e 96,81% é esperada, pois os pesos são experimentais.

## C. Auditoria estatística

IC95% atual: calculado entre replicações (`mean ± 1,96*sd/√n`) com sd amostral (n-1). Para n=1, o intervalo é degenerado. Para n pequeno e distribuições com caudas extremas, a aproximação normal pode ser inadequada. Recomenda-se exigir n≥2, usar t de Student ou bootstrap, e rotular como "IC da média entre experimentos".

Variância: alta (CV ~18) devido aos prêmios extremos (até 2.500×). Convergência lenta, mas estável.

Adequação dos métodos: experimentos independentes são adequados; o IC deve ser interpretado como incerteza da média dos experimentos, não da simulação única.

## D. Auditoria das estratégias

Funcionamento individual:
- Aposta fixa: correta.
- Martingale: dobra após perda, respeita saldo; pode levar à ruína rápida.
- Progressiva: incrementa aposta; respeita saldo.
- Diminuir após ganhar: aplicada corretamente.
- Percentual do saldo: usa saldo atual.

Risco de ruína: definido como `balance <= 0`; a aposta é ajustada para o saldo restante quando necessário. Limites stop-win/stop-loss verificados antes de cada rodada.

Problema de comparabilidade: mesma seed não garante mesma sequência de resultados, pois estratégias com apostas diferentes consomem quantidades diferentes de RNG. Recomenda-se common random numbers ou deixar explícito.

Não se deve declarar estratégia vencedora apenas por uma amostra.

## E. Auditoria técnica

- Web Worker: usa o mesmo `simulate`; progresso a cada 10k rodadas; cancelamento por terminate.
- RNG: Web Crypto no jogo manual; Mulberry32 determinístico no laboratório.
- Reprodutibilidade: confirmada.
- Persistência: LocalStorage; risco de quota para experimentos grandes.
- Exportação: CSV/JSON refletem o primeiro experimento.
- Gráficos: histograma e frequência corretos; gráfico de RTP usa saldo como proxy (rotulação inadequada).

## F. Testes

Testes existentes: 29 (motor). Nenhum teste específico para laboratório, estratégias, estatísticas ou gráficos.

Testes adicionais executados (temporários):
1. Reprodutibilidade: aprovada.
2. Sessão stop-profit: aprovada.
3. Sessão stop-loss: aprovada.
4. Ruína por saldo insuficiente: aprovada.
5. Decomposição base/Feature: aprovada (soma correta).

Limitações: ausência de testes automatizados para o laboratório.

## G. Classificação dos problemas

- ALTO: IC95% degenerado para n=1 e aproximação normal não verificada para caudas pesadas.
- ALTO: Vantagem da casa fixa em 3,19% (referência) aplicada a perfis experimentais.
- MÉDIO: `runWeightComparison` testa apenas o cenário atual.
- MÉDIO: gráfico de RTP usa saldo como proxy.
- MÉDIO: comparação de estratégias não utiliza common random numbers.
- MÉDIO: persistência pode falhar para resultados grandes.
- BAIXO: imports não utilizados e nomenclatura potencialmente enganosa.

Nenhum problema CRÍTICO foi identificado.

## H. Plano de correção

1. Arquivo: `js/lab.js` (aggregate/formatIndicators)
   - Evidência: IC com n=1 gera intervalo degenerado.
   - Correção: exigir n≥2, usar t de Student ou bootstrap; rotular corretamente.
   - Teste: n=1, n=5, n=10.

2. Arquivo: `js/lab.js` (formatIndicators)
   - Evidência: vantagem fixa em 3,19%.
   - Correção: calcular a partir do RTP teórico configurado ou marcar como não aplicável.
   - Teste: perfis experimental e referência.

3. Arquivo: `js/lab.js` (runWeightComparison)
   - Evidência: apenas cenário "Atual".
   - Correção: incluir uniforme, baixo e alto retorno.
   - Teste: comparação de 4 cenários.

4. Arquivo: `js/lab.js` (drawCharts)
   - Evidência: gráfico de RTP usa saldo.
   - Correção: calcular RTP cumulativo por blocos ou renomear.
   - Teste: visual e valores.

5. Arquivo: `js/strategies.js`
   - Evidência: comparabilidade limitada.
   - Correção: common random numbers ou documentar limitação.
   - Teste: comparação com mesma sequência.

## Conclusão

Classificação: **APROVADA COM RESSALVAS**.

## Correções da Fase 4.1

- IC95% agora exige ≥2 replicações; usa t de Student; exibe indisponível para 1 replicação.
- Vantagem da casa fixa removida; exibe house edge estimado e referência externa.
- Gráfico de RTP usa RTP acumulado (rtpHistory), não saldo.
- Estratégias usam Common Random Numbers (generateSpinSequence/runSessionCRN).
- Comparação de pesos ampliada para 4 cenários.
- Persistência com tratamento de erro.
- runSession/runSessionCRN não apostam com saldo insuficiente.
- Testes adicionados: strategies, statistics, simulator-extra (37 testes no total).

O laboratório é funcional e matematicamente coerente, mas existem limitações estatísticas e de apresentação que devem ser documentadas ou corrigidas antes de uso conclusivo. Nenhuma correção foi implementada nesta etapa.