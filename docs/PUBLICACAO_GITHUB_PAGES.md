# Publicação no GitHub Pages

Este guia descreve o primeiro envio do projeto a um repositório público. Nenhum passo
abaixo é executado automaticamente.

## Pré-requisitos

- Revisar `docs/FASE9.md` e o aviso legal do `README.md`.
- Definir a licença do código antes de tornar o repositório público (o projeto ainda não
  possui arquivo `LICENSE`).
- Confirmar que `backups/`, `.git/` e arquivos locais não serão enviados.

## 1. Criar o repositório

- Nome: `Tigrinho`
- Visibilidade: **Público**
- Branch principal: `main`
- Descrição sugerida: *Simulador offline inspirado no Fortune Tiger, com créditos fictícios e laboratório estatístico.*

Não inicialize o repositório com README, `.gitignore` ou licença gerados pelo GitHub;
esses arquivos já existem no projeto.

## 2. Enviar os arquivos

Envie todos os arquivos versionáveis do projeto:

- `index.html`, `README.md`, `package.json`, `server.cjs`, `.gitignore`
- `assets/`, `css/`, `js/`, `tests/`, `docs/`

Não envie:

- `backups/` (ignorado pelo `.gitignore`)
- `.git/` (metadados locais)
- arquivos temporários, logs ou `.env`

`server.cjs` é apenas um servidor estático de desenvolvimento e pode ser publicado sem
afetar o GitHub Pages.

## 3. Ativar o GitHub Pages

1. Abra **Settings → Pages**.
2. Em **Source**, selecione **Deploy from a branch**.
3. Branch: `main`; pasta: `/ (root)`.
4. Salve e aguarde o deploy.

## 4. Acessar

`https://USUARIO.github.io/Tigrinho/`

O projeto usa caminhos relativos e foi validado em subdiretório `/Tigrinho/`.

## 5. Atualizar versões futuras

- Envie os arquivos alterados para `main`.
- O GitHub Pages republica automaticamente.
- Mantenha caminhos relativos e execute os testes antes de enviar.

## 6. Desativar a publicação

- Em **Settings → Pages**, altere **Source** para **None**.
- Opcionalmente, torne o repositório privado ou exclua-o.

## Segurança

- Não envie credenciais, tokens, arquivos `.env` ou dados pessoais.
- Não publique capturas de tela com informações pessoais.
- Não altere o motor matemático apenas para publicação.
