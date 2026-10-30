# GITML — páginas sem código

GITML é uma linguagem declarativa para descrever páginas. Nesta versão, a extensão transforma arquivos `.gitml` em uma prévia pronta no VS Code e pode exportar um único `.html` que abre no navegador, sem React, instalação de dependências, build ou bundler.

## Comece em 2 minutos

1. Instale a extensão GITML no VS Code (ou use **Install from VSIX...** com o arquivo incluído).
2. Crie `minha-pagina.gitml` e cole:

```gitml
<gitml theme="light">
  <nav brand="Acme"><link href="#recursos">Recursos</link><link href="#planos">Planos</link></nav>
  <hero eyebrow="PLATAFORMA PARA TIMES" title="Seu trabalho, com menos atrito" subtitle="Uma forma simples de transformar boas ideias em resultados." cta="Conheça a plataforma" href="#recursos" />
  <section id="recursos">
    <grid cols="3">
      <card><badge>Rápido</badge><h3>Comece hoje</h3><p>Uma experiência direta do rascunho à publicação.</p></card>
      <card><badge>Flexível</badge><h3>Feito para você</h3><p>Blocos que se adaptam à sua mensagem.</p></card>
      <card><badge>Confiável</badge><h3>Sem surpresas</h3><p>Design consistente em qualquer tela.</p></card>
    </grid>
  </section>
  <cta title="Pronto para começar?" button="Fale com a gente" href="mailto:oi@exemplo.com" />
  <footer>© 2026 Acme · Feito com GITML</footer>
</gitml>
```

3. Use o ícone **GITML: Abrir prévia ao vivo** na barra do editor ou abra a Paleta de Comandos (`Ctrl+Shift+P`) e procure `GITML: Abrir prévia ao vivo`.
4. Edite o arquivo: a prévia atualiza automaticamente. Use `GITML: Exportar página HTML` para salvar um arquivo autônomo que pode ser hospedado ou enviado.

## Referência de componentes

- **Estrutura:** `gitml`, `nav`, `section`, `container`, `grid`, `footer`, `head`, `actions`
- **Destaque:** `hero`, `grad`, `badge`, `chip`, `cta`
- **Conteúdo:** `h1`, `h2`, `h3`, `p`, `card`, `feature`, `stat`
- **Ação e dados:** `button`, `link`, `alert`, `progress`, `divider`
- **Social:** `testimonial`, `avatar`
- **Conteúdo avançado:** `pricing`, `li`, `ul`, `timeline`, `step`, `accordion`, `faq`, `code`, `image`, `logos`

Os atributos são opcionais; `theme="dark"` ativa o tema escuro, `grid cols="3"` escolhe colunas (a grade vira uma coluna em telas pequenas), e os componentes possuem valores de fallback. Texto pode ficar dentro das tags ou em atributos, por exemplo `<hero title="Olá" />` ou `<h1>Olá</h1>`. Use aspas nos valores com espaços. Comentários seguem `<!-- assim -->`.

## O que esta versão é (e não é)

O `.gitml` é a fonte declarativa. O motor incluído no VS Code gera HTML e CSS na prévia e na exportação; portanto, o usuário escreve GITML, não HTML. O resultado exportado é uma página estática autônoma, não um projeto React/Next com componentes, rotas e servidor. Uma integração futura com React/Next pode usar o mesmo formato como fonte e gerar um projeto completo; isso é diferente do modo sem build oferecido aqui.

## Empacotar para distribuição

```sh
npx --yes @vscode/vsce package
```

Depois, no VS Code: **Extensions → ... → Install from VSIX...**. Repositório: [Gislaine-web3/gitml](https://github.com/Gislaine-web3/gitml).
