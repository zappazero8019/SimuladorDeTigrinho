# Auditoria da Fase 6 — Carteira Virtual e GitHub Pages

## A. Resumo executivo

A aplicação está funcional e compatível com GitHub Pages. A carteira virtual opera corretamente em centavos, com formatação BRL. O Auto apostar funciona, mas possui limitações de usabilidade. A persistência é adequada para volumes moderados. Não foram encontrados problemas críticos de contabilização.

## B. Auditoria financeira

- Saldo inicial padrão R$ 100,00.
- `addCredits` utiliza centavos inteiros (sem erro de ponto flutuante).
- Aposta descontada uma única vez.
- Prêmio creditado uma única vez.
- Adições de créditos registradas separadamente (não contabilizadas como lucro).
- Resultado operacional calculado corretamente.

Exemplo validado: saldo 100,00 − aposta 1,00 + prêmio 2,50 = 101,50.

## C. Auditoria do Auto apostar

- Quantidade de giros respeitada.
- Stop-win e stop-loss verificados.
- Parada manual interrompe novas apostas.
- Registro individual de rodadas.
- Sem apostas sobrepostas.
- Limitação: a automação continua se o usuário navegar para outra seção; recomendado pausar automaticamente ao sair da aba.

## D. Auditoria estatística

- Indicadores coerentes (hit rate, taxa de rodadas lucrativas, RTP observado).
- Gráficos de saldo e lucro/prejuízo funcionam.
- Adições não aparecem como lucro.
- Gráficos sem dados não geram erro.

## E. Auditoria de persistência

- Saldo, histórico e transações persistem após recarregar.
- Tratamento básico de erro no salvamento.
- Limitação: LocalStorage pode ser insuficiente para grandes volumes.

## F. Auditoria GitHub Pages

- Testado em subdiretório (`/Tigrinho/index.html`).
- Caminhos relativos funcionam.
- Web Worker carrega corretamente.
- Sem dependência de `server.cjs`.
- SVGs e CSS carregam sem erro.

## G. Testes

- 37 testes existentes aprovados.
- Nenhum teste específico para Fase 6 (recomendado).

## H. Problemas encontrados

### ALTO
- Nenhum.

### MÉDIO
1. `resetBalance` define 10000 (valor antigo) em vez de R$ 100,00.
2. Incremento/decremento de aposta altera R$ 1,00 por clique (poderia ser R$ 0,25 ou R$ 0,50).
3. Auto apostar não pausa ao navegar para outra seção.
4. Ausência de testes automatizados para carteira/Auto apostar.

### BAIXO
- `state.sessions` não utilizado.
- Histórico limitado a 200 rodadas.

## I. Conclusão

Classificação: **APROVADA COM RESSALVAS**.

A aplicação está pronta para publicação, com ressalvas de usabilidade e testes. Nenhuma correção foi implementada nesta etapa.