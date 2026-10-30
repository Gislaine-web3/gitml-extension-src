# GITML v0.0.1

**Uma linguagem declarativa que transforma tags simples em páginas modernas e estilizadas** — com cara de site feito em React/Next, sem escrever HTML nem CSS.

> Versão 0.0.1 — ainda não publicada, em testes na extensão do VS Code.

---

## O que tem nesta pasta

| Arquivo | O que é |
| --- | --- |
| `gitml.js` | O motor completo (um único arquivo, sem dependências) |
| `bin/gitml.js` | Ferramenta de linha de comando (CLI) |
| `examples/landing.gitml` | Exemplo de landing page completa |
| `examples/demo.gitml` | Demonstração de todos os componentes |

## Como usar

### 1. No navegador (sem escrever HTML)

Crie um arquivo `index.html` mínimo que aponta para sua página `.gitml`:

```html
<script src="gitml.js" data-src="pagina.gitml"></script>
```

Ou escreva o GITML direto na página:

```html
<script src="gitml.js"></script>
<script type="text/gitml">
<gitml title="Minha página">
  <hero title="Olá, mundo!" cta="Começar"></hero>
</gitml>
</script>
```

### 2. Na linha de comando (fora do HTML)

```bash
# Abre a página num servidor local (http://localhost:4173)
node bin/gitml.js serve examples/landing.gitml

# Gera um arquivo .html pronto e estilizado
node bin/gitml.js build examples/landing.gitml

# Lista todos os componentes
node bin/gitml.js components
```

### 3. No Node.js / extensão do VS Code

```js
const gitml = require("./gitml.js");
const out = gitml.compile(codigoFonte);
// out.html → página completa pronta
// out.errors / out.warnings → problemas encontrados
```

---

## Estrutura de uma página

```gitml
<gitml theme="light" accent="violet" font="sora" title="Título da aba">
  <nav brand="MeuSite" sticky>...</nav>
  <hero title="..." cta="..."></hero>
  <section title="...">...</section>
  <footer brand="MeuSite">...</footer>
</gitml>
```

**Atributos da tag raiz `<gitml>`:**
- `theme` — `light` ou `dark`
- `accent` — `violet`, `blue`, `green`, `orange`, `pink`, `red`, `teal`, `black` ou qualquer cor (`#ff0066`)
- `font` — `sora`, `inter`, `space-grotesk`, `manrope`, `outfit`, `dm-sans`, `serif`
- `title`, `description`, `icon`, `lang`

## Os componentes (70+ tags)

### Estrutura
- `<gitml>` / `<page>` — raiz do documento
- `<head>` / `<meta>` — metadados (title, description, icon)
- `<section title subtitle eyebrow bg>` — seção com cabeçalho
- `<container>` — centraliza o conteúdo

### Layout
- `<grid cols="3">` — grade responsiva
- `<row>` / `<stack>` — linha flexível / pilha vertical
- `<col span>` — coluna dentro de row
- `<split reverse>` — duas colunas (texto + mídia)
- `<bento>` — grade estilo Apple (bento grid)
- `<spacer size>` — espaço vertical
- `<divider text>` — linha divisória

### Navegação
- `<nav brand logo sticky>` — barra de navegação com menu mobile automático
- `<link href>` — link
- `<breadcrumb items="Início/Docs/API">` — trilha de navegação
- `<footer brand>` — rodapé
- `<theme-toggle>` — botão claro/escuro

### Destaque
- `<hero title subtitle eyebrow cta href cta2 href2 image variant>` — cabeçalho impactante (variant: `center` ou `split`)

### Tipografia
- `<h1>` a `<h4>` — títulos
- `<p>` / `<text>` — parágrafo (aceita `**negrito**`, `*itálico*`, `` `código` ``, `[link](url)`)
- `<grad>` — texto com degradê animado
- `<quote author>` — citação
- `<kbd>` — tecla de atalho
- `<mark>` — texto marcado
- `<ul icon="check">` + `<li>` — lista com ícones
- `<ol>` — lista numerada
- `<code lang title>` — bloco de código com botão de copiar

### Ações
- `<button href variant size icon>` — botão (variant: `primary`, `outline`, `ghost`, `soft`, `gradient`; size: `sm`, `lg`)
- `<actions align>` — agrupa botões

### Cards
- `<card title icon image href variant>` — cartão (variant: `glass`, `soft`, `outline`, `gradient`)
- `<feature icon title>` — recurso com ícone
- `<stat num label prefix suffix>` — número que anima ao aparecer
- `<pricing tier price period featured cta>` — plano de preço
- `<testimonial name role avatar rating>` — depoimento
- `<avatar name src size>` / `<avatars>` — avatar / grupo de avatares
- `<team name role src>` — membro da equipe

### Dados
- `<table>` + `<tr>` + `<td>`/`<th>` — tabela estilizada
- `<progress value label>` — barra de progresso animada
- `<rating value>` — estrelas de avaliação
- `<countdown to="2026-12-31">` — contagem regressiva ao vivo

### Feedback
- `<badge variant>` — etiqueta (`primary`, `success`, `warning`, `danger`)
- `<alert type title>` — aviso (`info`, `success`, `warning`, `danger`)
- `<tooltip text>` — dica ao passar o mouse
- `<banner href>` — faixa de anúncio no topo

### Interativos
- `<accordion title>` — pergunta expansível (FAQ)
- `<tabs>` + `<tab label>` — abas
- `<modal trigger title>` — janela modal
- `<carousel>` — carrossel horizontal
- `<marquee>` — faixa de logos em movimento

### Mídia
- `<image src alt>` — imagem arredondada
- `<video src>` — vídeo (arquivo ou YouTube)
- `<map q="São Paulo">` — mapa do Google
- `<icon name size>` — ícone embutido (star, zap, rocket, heart, check, menu, sun, moon, github, globe, shield, layers, sparkles, user, users, mail, phone, play, code, copy, chart, cart, clock, cloud, cpu, lock, book, graduation, arrow, info, alert, map…)
- `<browser url>` — moldura de navegador para screenshots

### Formulários
- `<form action method>` — formulário
- `<input label type placeholder name required>` — campo
- `<textarea label name>` — texto longo
- `<select label options="A,B,C">` — lista de opções
- `<submit>` — botão de enviar
- `<newsletter placeholder button>` — captura de e-mail

### Seções especiais
- `<timeline>` + `<step title date>` — linha do tempo vertical
- `<cta title button href>` — chamada final para ação

### Avançado
- `<style>` — CSS próprio
- `<script>` — JavaScript próprio (só com `allowScripts`)
- `<define name="x">` — cria seu próprio componente reutilizável, usando `{{atributo}}` e `{{children}}`
- `<raw>` — HTML puro dentro do GITML

## Criando seus próprios componentes

```gitml
<define name="meu-botao">
  <button variant="gradient" href="{{href}}">{{children}}</button>
</define>

<meu-botao href="#comprar">Comprar agora</meu-botao>
```

## O que já vem de graça em toda página

- Modo claro/escuro com transição suave
- Animações de entrada ao rolar a página
- Números que contam sozinhos (`<stat>`)
- Menu mobile automático na navegação
- Tipografia profissional (Google Fonts)
- Design responsivo (celular, tablet, desktop)
- Proteção contra XSS (textos e URLs escapados)
- Acessibilidade (respeita `prefers-reduced-motion`)

## Licença

MIT — use à vontade.
