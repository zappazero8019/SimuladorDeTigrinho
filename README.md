# Fortune Tiger Simulator — Simulador Offline

Simulador educacional/recreativo inspirado no Fortune Tiger, com créditos fictícios,
carteira virtual, Auto apostar e laboratório estatístico. Funciona 100% no navegador,
sem backend, sem APIs externas e sem dinheiro real.

> **Descrição sugerida do repositório:** Simulador offline inspirado no Fortune Tiger,
> com créditos fictícios e laboratório estatístico.

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
- **O RTP exibido é experimental.** Ele emerge dos pesos configurados e não representa
  garantia de retorno individual nem promessa de resultado.
- **Os recursos matemáticos são implementações próprias.** O motor, o RNG, o laboratório
  e as estatísticas foram escritos para este projeto, sem código proprietário de terceiros.
- **Sem licença definida até o momento.** Este repositório está licenciado sob a
  [MIT License](./LICENSE); a licença de distribuição deve ser respeitada em cópias
  e porções substanciais do Software.

## Funcionalidades

- Grade 3×3, 5 linhas de pagamento, Wild e Feature com respins e multiplicador ×10.
- Carteira de créditos fictícios em reais (BRL), com adição, zeragem e reinício de saldo.
- Contador de resultado operacional acumulado (lucro, prejuízo ou empate).
- Auto apostar sequencial, com pausa, parada manual, stop-profit e stop-loss.
- Histórico de rodadas, estatísticas e gráficos.
- Laboratório estatístico com simulações, RTP, análise de risco e comparação de estratégias.
- Animações e comemorações por faixa de prêmio, com suporte a `prefers-reduced-motion`.
- Interface responsiva, pensada primeiro para telas de celular.
- Persistência local via `localStorage`; nenhum dado sai do navegador.

## Como executar

O projeto é estático. Basta abrir `index.html` ou servir a pasta localmente:

```bash
node server.cjs
# http://localhost:8080/
```

`server.cjs` é apenas um servidor estático de desenvolvimento; a aplicação não depende
dele para funcionar no GitHub Pages.

## Testes

Requer apenas Node.js (sem dependências externas):

```bash
node --test "tests/**/*.test.js"
```

Referência atual: **61 testes aprovados**.

## Estrutura

- `index.html` — interface.
- `css/` — estilos.
- `js/` — motor, carteira, estatísticas, laboratório, efeitos e persistência.
- `assets/symbols/` — SVGs originais criados para este projeto.
- `tests/` — testes automatizados.
- `docs/` — arquitetura, matemática, auditorias e relatórios de fases.

## Documentação

- `docs/REGRAS_ORIGINAIS.md` — regras pesquisadas, confirmadas e hipóteses.
- `docs/ARQUITETURA.md` — arquitetura e módulos.
- `docs/VALIDACAO_MATEMATICA.md` — validação matemática.
- `docs/FASE9.md` — auditoria final para publicação.
- `docs/PUBLICACAO_GITHUB_PAGES.md` — passos de publicação no GitHub Pages.

## Publicação

O projeto foi preparado para o GitHub Pages em subdiretório
(`https://USUARIO.github.io/Tigrinho/`). Consulte `docs/PUBLICACAO_GITHUB_PAGES.md`.

Nenhuma publicação é feita automaticamente. O envio ao GitHub depende de autorização
expressa.
