# Fase 7 — Animações, efeitos de vitória e experiência visual

## Arquivos criados/modificados
- `js/effects.js` (classificação e comemorações)
- `css/style.css` (partículas, fogos, overlay épico)
- `index.html` (camada de efeitos)
- `js/main.js` (integração e áudio)
- `js/audio.js` (sons por nível)
- `tests/effects.test.js`

## Backups
- `backups/fase7/`

## Animações implementadas
- Animação normal da roleta em todos os giros.
- Quatro níveis de comemoração por multiplicador:
  - <2×: brilho e partículas discretas.
  - 2×–9,99×: explosão de moedas e partículas.
  - 10×–49,99×: fogos de artifício e iluminação especial.
  - ≥50×: tela especial de vitória com fogos intensos e animação cinematográfica.
- Integração com Auto apostar (aguarda comemoração).
- Integração com Feature (usa multiplicador total).
- Respeita `prefers-reduced-motion`.

## Testes
- 41/41 testes aprovados (incluindo `effects.test.js`).
- Testes visuais no navegador (giro manual e Auto apostar) sem erros.

## Limitações
- Efeitos baseados em DOM/CSS; dispositivos modestos podem reduzir partículas.
- Sem assets de áudio externos (tons sintetizados).