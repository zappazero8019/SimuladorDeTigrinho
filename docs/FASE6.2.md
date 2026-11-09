# Fase 6.2 — Auto apostar sequencial

## Correções
- Reset do saldo corrigido para R$ 100,00.
- Incremento de aposta ajustado para R$ 0,25.
- Auto apostar agora executa rodadas sequenciais, respeitando animações e intervalo configurável.
- Pausa automática ao navegar para outra seção.
- Condições de stop-win/stop-loss baseadas no resultado líquido da sessão.

## Testes
- 40/40 testes aprovados.
- Auto apostar testado no navegador (3 giros concluídos sem erros).

## Limitações
- Auto apostar executa na thread principal (com intervalos).
- Persistência em LocalStorage.