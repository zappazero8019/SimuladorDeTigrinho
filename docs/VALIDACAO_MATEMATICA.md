# Validação Matemática — Fortune Tiger Simulator

## 1. Métricas principais

- RTP observado = (Total pago em prêmios / Total apostado) × 100.
- Vantagem da casa = 100% − RTP teórico configurado.
- Taxa de acerto = rodadas com prêmio > 0 / total de rodadas.
- Erro estatístico da simulação ≈ σ / √N (onde σ é o desvio padrão do pagamento por rodada em unidades de aposta).
- Intervalo de confiança (95%) para o RTP observado: RTP_obs ± 1,96 × (σ/√N) × 100.

## 2. Invariantes a verificar

I1. **Contabilização única da aposta**: cada rodada desconta a aposta exatamente uma vez, mesmo com respins do Feature.
I2. **Contabilização única do prêmio**: o prêmio de uma rodada é creditado uma única vez (pagamento final), sem duplicação por respins intermediários.
I3. **Conservação de saldo**: saldo_final = saldo_inicial − total_apostado + total_pago (desconsiderando reinícios).
I4. **RTP por simulação**: com N grande, RTP observado deve convergir para o RTP teórico configurado dentro do intervalo de confiança.
I5. **Reprodutibilidade**: mesma semente + mesmos parâmetros → sequência idêntica de resultados.
I6. **Max win**: nenhum prêmio excede 2.500× (se cap configurado) ou o máximo teórico da mecânica.
I7. **Não-negatividade**: prêmios ≥ 0; saldo pode ser negativo apenas se permitido (ruína).

## 3. Testes obrigatórios

### 3.1 Combinações vencedoras
- 3 Wilds em uma linha → 50× aposta total (por linha).
- 3 do mesmo símbodo regular em uma linha → valor da tabela.
- Linhas com Wild substituindo → vitória.
- Múltiplas linhas vencedoras → soma.

### 3.2 Combinações perdedoras
- 2 símbodos iguais + 1 diferente → sem prêmio.
- Símbodos não alinhados → sem prêmio.
- Blanks no Feature → sem prêmio naquela linha.

### 3.3 Pagamentos
- Pagamento por linha = multiplicador × aposta por linha.
- Pagamento total = soma das linhas.
- ×10 aplicado quando tela cheia.

### 3.4 Multiplicadores
- Tela cheia de qualquer símbodo (incluindo Wild) → ×10.
- Sem tela cheia → sem ×10.

### 3.5 Respins (Feature)
- Acionamento marca a rodada como Feature.
- Sticky acumula símbodoos escolhidos/Wilds.
- Termina quando não há novos símbodos ou tela cheia.
- Avaliação final única.

### 3.6 Saldo
- Desconto da aposta uma vez.
- Crédito do prêmio uma vez.
- Reinício restaura 10.000 créditos.

### 3.7 Consistência de simulações
- Total apostado = N × aposta (para aposta fixa).
- Total pago = soma dos prêmios.
- RTP calculado corretamente.

### 3.8 Reprodutibilidade com semente
- Executar duas vezes com mesma semente → resultados idênticos (bit-a-bit).

## 4. Laboratório estatístico — métricas de saída

Para cada experimento: N, total apostado, total pago, lucro/prejuízo, RTP observado,
RTP teórico configurado, vantagem da casa, taxa de acerto, frequência de cada símbodo,
frequência do Feature, maior prêmio, maior sequência de perdas, maior sequência de vitórias,
evolução do saldo.

Gráficos: evolução do saldo; RTP observado por quantidade de rodadas; distribuição de
prêmios; frequência de resultados.

## 5. Laboratório de estratégias

Estratégias testadas: aposta fixa; aumentar após perdas; diminuir após vitórias;
stop-profit; stop-loss; % do saldo. Métrica-chave: expectativa matemática (RTP) não muda
com a estratégia; apenas variância e duração da sessão. Documentar explicitamente.

## 6. Auditoria matemática

- Diferença RTP teórico vs. observado.
- Erro estatístico.
- Intervalos de confiança.
- Efeito da volatilidade.
- Probabilidade de terminar sessão com lucro (via simulação).
- Probabilidade de perder X% do saldo.
- Risco de ruína para diferentes saldos e apostas.

## 7. Aviso obrigatório na UI

"RTP não representa garantia de retorno individual. Resultados de simulações são
estatísticos e podem variar. Parâmetros do simulador são aproximações experimentais,
não reproduzem exatamente o jogo original."

## 8. Auditoria complementar (Fase 2)

### 8.1 Auditoria do RTP (N=200.000, semente 7)

- RTP total: 99,42%.
- Jogo principal: 197.984 rodadas, RTP 48,96%, hit rate 21,89%.
- Feature Fortune Tiger: 2.016 rodadas, RTP 5.055,11%, hit rate 79,66%, prêmio médio 50,55× a aposta.
- Taxa de acionamento da Feature: 1,008% (alvo documentado 0,99%).
- Tela cheia na Feature: 17,31%.
- Média de respins por Feature: 2,99 (distribuição 1–7).
- Contribuição do multiplicador ×10: 39,41% do total pago.
- Linhas envolvendo Wild: 463.276 créditos (pré-multiplicador, soma das linhas vencedoras que contêm ao menos um Wild).
- Contribuição por símbodo (aprox., pré-multiplicador, com ×10 aplicado no nível da rodada quando tela cheia):
  - INGOT 843.200; CHARM 426.750; ENVELOPE 272.208; ORANGE 157.782; BAG 134.200; FIRECRACKER 69.790; WILD 84.500.

### 8.2 Auditoria da Feature

- Acionamento: probabilidade configurável (0,0099), independente da rodada base.
- Escolha do símbodo: uniforme entre os 6 regulares (quando pesos não definidos).
- Distribuição durante o Feature: pesos configuráveis (chosen/wild/blank).
- Sticky: posições com chosen ou Wild travam e persistem; respins continuam até não haver novos símbodoos ou tela cheia.
- Encerramento: ausência de novos símbodoos travados OU tela cheia (limite de segurança 100 iterações).
- Avaliação: grade final avaliada uma única vez (sem acúmulo de vitórias intermediárias).
- Multiplicador ×10: aplicado quando `isFullGridWin` (todas as 9 posições ocupadas por chosen/Wild).
- Limite máximo: cap de 2.500× aplicado quando `enforceMaxWin`.
- Pagamentos duplicados: não encontrados — uma aposta descontada e um prêmio creditado por rodada (invariante I1/I2 verificada).

### 8.3 Análise de sensibilidade (N=100.000, semente 7)

| Configuração | RTP | Hit rate | Feature rate | Full-grid | sd (créditos/rodada) |
|---|---|---|---|---|---|
| Atual (calibrado) | 101,26% | 22,61% | 1,03% | 0,179% | 183,51 |
| Original (alto RTP) | 143,27% | 28,27% | 0,98% | 0,384% | 269,85 |
| Uniforme | 432,14% | 44,40% | 1,03% | 0,181% | 206,67 |
| Baixo wild | 72,83% | 20,58% | 0,98% | 0,130% | 136,40 |

Observação: encontrar pesos que produzam ~96,81% não comprova que sejam os pesos da PG Soft.

### 8.4 Validação estatística (convergência)

- 5 sementes × 100.000: RTP médio 102,77% (sd 4,25), IC95 [99,04; 106,49].
- 5 sementes × 1.000.000: RTP médio 101,18% (sd 2,56), IC95 [98,94; 103,42].
- 5.000.000 (semente 42): RTP 102,33%, hit 22,50%, feature 1,00%.
- 10.000.000 (semente 42): RTP 101,92%, hit 22,49%, feature 1,00%.
- Convergência estável em torno de 101–102%; não há tendência de afastamento.

### 8.5 Alterações realizadas e testes

- Corrigida contagem de símbodoos: 7 (6 regulares + Wild), não 8.
- Pesos iniciais (ORANGE 14 etc.) geravam RTP ~160%; substituídos por pesos calibrados (documentados como experimentais).
- `runFeature` passou a retornar `respins` (contagem) para auditoria.
- Testes: 29/29 aprovados após alterações.

### 8.6 Limitações restantes

- Pesos oficiais desconhecidos; calibração não é prova.
- Mecânica exata do Feature (acúmulo de prêmios intermediários) não confirmada.
- RTP teórico não é calculado analiticamente (apenas observado por simulação).
- Volatilidade reportada é estimativa empírica (desvio padrão por rodada), não classificação oficial.

## 9. Investigação direcionada (auditoria final da Fase 2)

### 9.1 Jogo principal — validação de pagamentos

Cálculo exato por enumeração completa (7^9 grades) confirmou:
- EV do jogo principal = 4,9146 créditos/rodada para aposta de 10.
- RTP do jogo principal = 49,15%, coerente com a simulação (48,96%).

Exemplos concretos (aposta total 10, aposta/linha 2):
- 3 Wilds em uma linha: 250×2 = 500 créditos (50× a aposta).
- Tela cheia de Oranges: 5 linhas × (3×2) = 30, ×10 = 300 créditos.
- Wild substituindo (WILD ORANGE WILD): 3×2 = 6 créditos.
- Duas linhas de Oranges: 12 créditos.

Conclusão: multiplicações por linha, avaliação das 5 linhas, vitórias simultâneas e Wild estão corretas. Nenhum pagamento descartado.

### 9.2 Feature Fortune Tiger — decomposição

Para 200.000 acionamentos (semente 7):
- EV por acionamento (com ×10): 539,45 créditos = 53,945× a aposta.
- EV por acionamento (sem ×10): 125,75 créditos = 12,575× a aposta.
- Contribuição do ×10: 76,69% do prêmio da Feature.
- Taxa de tela cheia: 16,99%.
- Distribuição de respins: 0–8, pico em 3.
- Contribuição da Feature ao RTP total (0,99% de frequência): 53,41%.
- Jogo principal contribui 48,66%.
- Total: 102,07% (coerente com observado).

Experimento comparativo sem ×10: RTP total cairia para ~61,1%, confirmando o peso do multiplicador.

### 9.3 Decomposição matemática

- RTP_principal = (prêmios do jogo principal / apostas) × 100 ≈ 49,15%.
- Contribuição_Feature = P(acionamento) × E[prêmio|Feature] / aposta × 100 ≈ 0,0099 × 53,945 × 100 ≈ 53,41%.
- RTP_total = RTP_principal × (1 − 0,0099) + Contribuição_Feature ≈ 48,66% + 53,41% ≈ 102,07%.
- Retorno médio condicionado ao acionamento: 53,945× a aposta.

Denominadores: apostas contabilizadas uma única vez por rodada (inclusive nas que acionam a Feature, que substituem a rodada base). Prêmio creditado uma única vez (grade final).

### 9.4 Precisão estatística

- 10 experimentos × 1.000.000: média 101,79%, sd 3,01, IC95 [99,93; 103,65], min 98,18, max 107,77.
- 3 experimentos × 10.000.000: 101,20%, 101,06%, 101,92% (média 101,39%).
- Sensibilidade a prêmios extremos: presente (CV ~18); intervalos de confiança capturam a variabilidade.
- Conclusão: convergência estável; precisão compatível com o teorema central do limite.

### 9.5 Conclusão

Os resultados são **matematicamente coerentes com a implementação atual**, mesmo não correspondendo ao Fortune Tiger original (96,81%). A diferença decorre dos pesos experimentais e da mecânica implementada, não de erro de contabilização. Nenhuma alteração de lógica foi necessária nesta etapa.
