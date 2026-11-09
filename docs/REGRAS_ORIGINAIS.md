# Regras do Fortune Tiger (PG Soft) — Documento de Engenharia Reversa

> Projeto: Fortune Tiger Simulator (simulador offline, uso recreativo/educacional).
> Este documento separa informações confirmadas, não confirmadas, hipóteses técnicas,
> parâmetros a estimar e diferenças em relação ao original, conforme solicitado.

## 0. Fontes utilizadas

- Documentação oficial PG Soft: `Fortune_Tiger_Gameinformation_EN.pdf` (PG Soft, atualização 08/07/2025, gerado por jsPDF 1.5.3). O arquivo obtido é composto majoritariamente por imagens (sem texto selecionável), portanto não foi possível extrair o texto completo automaticamente nesta fase.
- SlotCatalog: página do jogo "Fortune Tiger (PG Soft)" (atributos: RTP, volatilidade, hit frequency, max win, paytable).
- Bigwinboard: review "Fortune Tiger (PG Soft) Slot Review" (regras do feature, paytable por linha).
- Betconstruct client zone, demoslot.com, gamesville.com, outros (corroboração de mecânicas).

> Limitação: por não ter sido possível OCR do PDF oficial, todos os detalhes de regra
> abaixo que não puderam ser verificados diretamente na fonte oficial estão marcados
> como "não confirmado" ou "hipótese".

---

## 1. Informações confirmadas

### 1.1 Identidade do jogo
- Nome: Fortune Tiger.
- Provedor: PG Soft (Pocket Games Soft).
- Lançamento: 20/03/2022.
- Temática asiática (tigre da fortuna).

### 1.2 Grade e linhas
- Grade: 3 rolos × 3 linhas (3×3).
- Linhas de pagamento: 5 (fixas).
- Pagamentos ocorrem com 3 símbolos iguais da esquerda para a direita em uma linha.
- Não há scatters, free spins ou bônus tradicionais.

### 1.3 Símbolos
Conjunto de 7 tipos (1 Wild + 6 regulares):
1. Wild (Tigre) — substitui todos os símbolos e é o de maior pagamento.
2. Golden Ingot (Lingote de ouro)
3. Lucky Charm (Amuleto da sorte)
4. Bag of Coins (Saco de moedas)
5. Red Envelope (Envelope vermelho)
6. Firecrackers (Pacote de fogos)
7. Oranges (Laranjas)

> Observação: a ordem de pagamento (do maior para o menor) é a listada acima.

### 1.4 Paytable (multiplicadores por linha, em unidades de aposta por linha)
Fonte: Bigwinboard (expresso por aposta por linha). Convertendo para múltiplos da aposta total
(aposta total = 5 × aposta por linha, pois há 5 linhas fixas):

| Símbodo | Multiplicador por linha (× aposta/linha) | Multiplicador equivalente (× aposta total) |
|---|---|---|
| Wild | 250× | 50× |
| Golden Ingot | 100× | 20× |
| Lucky Charm | 25× | 5× |
| Bag of Coins | 10× | 2× |
| Red Envelope | 8× | 1,6× |
| Firecrackers | 5× | 1× |
| Oranges | 3× | 0,6× |

Fonte corroborante: SlotCatalog informa "pay symbols award between 0.6 and 20× your stake
for 3 of a kind, Wild pays 50×" — consistente com a tabela acima.

### 1.5 Wild
- O Wild substitui todos os símbolos de pagamento.
- Paga o maior valor da tabela (50× a aposta total por linha vencedora).
- Pode participar de vitórias "full screen" (tela cheia) e do multiplicador ×10.

### 1.6 Recurso especial — "Fortune Tiger Feature"
- Aciona de forma aleatória em qualquer rodada.
- Frequência divulgada: 0,99% das rodadas (SlotCatalog: "Main Game: 22,16%, Fortune Tiger Feature: 0,99%").
- Quando aciona:
  1. Um símbodo regular (excluindo Wild) é escolhido aleatoriamente.
  2. Os rolos passam a conter apenas: o símbodo escolhido, Wilds e espaços vazios (blanks).
  3. A rodada de acionamento já exibe apenas esses símbodoos.
  4. Símbodos escolhidos e Wilds que caírem ficam "colados" (sticky) e concedem um novo respin.
  5. O processo se repete até que uma rodada não traga novos símbodos (apenas blanks) ou até que a tela seja preenchida.
  6. Se a tela inteira for preenchida com o símbodo escolhido (com Wilds substituindo, conforme SlotCatalog), o pagamento total recebe multiplicador ×10.

### 1.7 Multiplicador full screen ×10
- Qualquer vitória com tela cheia (todos os 9 posições ocupadas por símbodos vencedores, incluindo Wilds substituindo) recebe multiplicador ×10 sobre o pagamento total da rodada.
- Aplica-se tanto a rodadas normais quanto ao resultado final do Feature.
- Exemplo: tela cheia de Wilds = 5 linhas × 50× = 250× aposta total, ×10 = 2.500× (ganho máximo divulgado).

### 1.8 RTP, volatilidade e frequência
- RTP divulgado: 96,81% (sem faixas/RTP ranges).
- Vantagem da casa: 3,19%.
- Volatilidade: média (Medium).
- Frequência geral de acerto: 23,15% (22,16% jogo principal + 0,99% Feature).
- Ganho máximo divulgado: 2.500× a aposta.

### 1.9 Apostas
- Aposta mínima: 0,25 (em moeda do jogo).
- Aposta máxima: 250.
- 5 linhas fixas (não ajustáveis pelo jogador).
- Para o simulador, as apostas serão expressas em créditos fictícios.

---

## 2. Informações não confirmadas

1. **Pesos dos símbodos nos rolos** (reel strips / distribuição por posição): não divulgados. Sem eles não é possível reproduzir a distribuição exata.
2. **Probabilidade exata de acionamento do Feature** além da frequência agregada de 0,99%: desconhecida (pode depender de estado do rolo).
3. **Distribuição de blanks vs. símbodos durante o Feature** (quantos blanks esperados por respin): não divulgada.
4. **Probabilidade de o símbodo escolhido no Feature ser cada um dos 7 símbodos regulares**: não divulgada (assumida uniforme como hipótese, a validar).
5. **Regras exatas de avaliação do Feature**: se o pagamento é calculado apenas no estado final ou também acumula vitórias intermediárias; se Wild conta para "tela cheia do símbodo escolhido".
6. **Teto de ganho (cap) de 2.500×**: se é imposto como limite superior explícito ou emerge naturalmente da matemática.
7. **Arredondamento de pagamentos** e precisão de créditos.
8. **Se o Feature pode acionar em rodadas que já contêm vitória no jogo principal** (assumido sim, aleatório independente).
9. **Se existe animação/ordem de rolos que afete o resultado** (irrelevante para a matemática).
10. **Valores discretos de aposta** disponíveis no jogo original (a lista exata de botões).

---

## 3. Hipóteses técnicas

H1. **5 linhas padrão de uma grade 3×3**:
   - Linha superior, linha central, linha inferior;
   - Diagonal principal (↘);
   - Diagonal secundária (↙).

H2. **O pagamento de uma rodada é a soma dos pagamentos de todas as linhas vencedoras**, aplicando o multiplicador ×10 se houver tela cheia.

H3. **Wild substitui qualquer símbodo em qualquer linha**, inclusive para formar tela cheia.

H4. **No Feature**, o resultado final é avaliado uma única vez (estado final dos 9 posições), não acumulando vitórias de respins intermediários. (Alternativa a testar: acumular.)

H5. **Tela cheia no Feature** ocorre quando as 9 posições estão ocupadas (sem blanks) por símbodo escolhido e/ou Wild, ativando ×10.

H6. **A escolha do símbodo no Feature é uniforme** entre os 7 símbodoos regulares.

H7. **O Feature não altera a aposta** da rodada; o pagamento é calculado sobre a aposta da rodada de acionamento.

H8. **A rodada de acionamento do Feature não paga vitórias normais** do jogo principal (os rolos são substituídos pelo conjunto restrito). (A validar; alternativa: avalia normalmente e depois aplica feature.)

H9. **Gerador aleatório**: resultados independentes e identicamente distribuídos; sem "memória" ou sequências artificiais.

H10. **Hit frequency do jogo principal (22,16%)** inclui rodadas com pelo menos uma linha vencedora, incluindo tela cheia.

---

## 4. Parâmetros que precisam ser estimados

Para aproximar RTP 96,81% e hit frequency 23,15% com a mecânica descrita, é necessário estimar/calibrar:

- `weight[symbol]` para cada símbodo (6 regulares + Wild) na distribuição base do jogo principal.
- `p_feature` (probabilidade de acionamento por rodada), alvo ~0,0099.
- Durante o Feature: probabilidade de cada posição revelar o símbodo escolhido, Wild ou blank a cada respin, calibrada para que a frequência do Feature e o RTP resultante se aproximem dos valores divulgados.
- Possível parâmetro de "densidade" de símbodos nos rolos (strips) para reproduzir hit frequency 22,16%.
- Fator de calibração para atingir RTP 96,81% (ajuste fino dos pesos).

> Importante: esses parâmetros serão marcados no código como **experimentais/aproximados**,
> nunca como valores oficiais. O simulador deve exibir claramente que a reprodução é
> aproximada e não matematicamente exata.

---

## 5. Diferenças entre o simulador e o jogo original

1. **Pesos e probabilidades não oficiais**: o simulador usará parâmetros calibrados/experimentais, não os reel strips reais da PG Soft.
2. **Ausência de ativos oficiais**: gráficos, sons e animações serão próprios ou devidamente licenciados, não os da PG Soft.
3. **Sem dinheiro real**: créditos fictícios, sem depósito/saque.
4. **Sem servidor/API/banco remoto**: persistência local (LocalStorage/IndexedDB).
5. **RTP aproximado**: o RTP observado convergirá para o RTP teórico *configurado* (alvo 96,81%), que é uma aproximação do RTP oficial, não uma reprodução exata.
6. **Funcionalidades extras**: laboratório estatístico, estratégias, auditoria matemática e exportação (CSV/JSON) não existem no original.
7. **Aposta em créditos**: valores de aposta adaptados para créditos fictícios, não necessariamente os botões oficiais (0,25–250).
8. **Sem certificação/RNG auditado**: o gerador será apropriado e auditável pelo código, mas não certificado por laboratório independente.

---

## 6. Resumo dos parâmetros confirmados (tabela rápida)

| Parâmetro | Valor |
|---|---|
| Rolos × Linhas | 3 × 3 |
| Linhas de pagamento | 5 (fixas) |
| Símbodoos | 7 (6 regulares + Wild) |
| RTP | 96,81% |
| Vantagem da casa | 3,19% |
| Volatilidade | Média |
| Frequência de acerto | 23,15% (22,16% principal + 0,99% feature) |
| Acionamento do Feature | 0,99% |
| Multiplicador full screen | ×10 |
| Ganho máximo | 2.500× |
| Aposta mín./máx. | 0,25 / 250 |
| Wild (pagamento) | 50× aposta total por linha (250× por linha-aposta) |
