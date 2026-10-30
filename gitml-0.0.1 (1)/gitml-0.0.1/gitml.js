/*!
 * GITML Engine v0.0.1 — linguagem declarativa para páginas modernas.
 * MIT License · https://github.com/Gislaine-web3/gitml
 *
 * Funciona em 3 lugares com o MESMO código:
 *   1. Node.js / VS Code   → const gitml = require('./gitml.js'); gitml.compile(src)
 *   2. Navegador (runtime) → <script src="gitml.js"></script>
 *                            <script type="text/gitml"> ... </script>
 *                            ou <script src="gitml.js" data-src="pagina.gitml"></script>
 *   3. CLI                 → npx gitml serve pagina.gitml
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GITML = api;
  if (typeof document !== "undefined") api.__autoboot();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = "0.0.1";

  /* ------------------------------------------------------------------ *
   * 1. PARSER — tolerante a erros, com tags "raw" e auto-fechamento
   * ------------------------------------------------------------------ */
  var VOID = toSet("image img divider hr progress avatar spacer input icon br meta rating countdown video map embed theme-toggle include use".split(" "));
  var RAW = toSet("code style script".split(" "));

  function toSet(arr) { var o = {}; for (var i = 0; i < arr.length; i++) o[arr[i]] = true; return o; }

  function parse(src) {
    var root = { tag: "#root", attrs: {}, children: [], line: 1 };
    var stack = [root], i = 0, n = src.length, errors = [];
    function line(at) { return src.slice(0, at).split("\n").length; }
    while (i < n) {
      if (src.startsWith("<!--", i)) {
        var e = src.indexOf("-->", i + 4); i = e < 0 ? n : e + 3; continue;
      }
      if (src[i] === "<" && src[i + 1] === "/") {
        var m = /^<\/([A-Za-z][\w-]*)\s*>/.exec(src.slice(i));
        if (m) {
          var t = m[1].toLowerCase(), idx = -1;
          for (var k = stack.length - 1; k > 0; k--) if (stack[k].tag === t) { idx = k; break; }
          if (idx > 0) stack.length = idx;
          else errors.push({ line: line(i), message: "</" + t + "> fechado sem abrir" });
          i += m[0].length; continue;
        }
      }
      if (src[i] === "<" && /[A-Za-z]/.test(src[i + 1] || "")) {
        var end = findTagEnd(src, i);
        if (end > 0) {
          var raw = src.slice(i + 1, end), selfClose = /\/\s*$/.test(raw);
          if (selfClose) raw = raw.replace(/\/\s*$/, "");
          var nm = /^([A-Za-z][\w-]*)/.exec(raw);
          var node = { tag: nm[1].toLowerCase(), attrs: parseAttrs(raw.slice(nm[1].length)), children: [], line: line(i) };
          stack[stack.length - 1].children.push(node);
          i = end + 1;
          if (RAW[node.tag] && !selfClose) {
            var close = src.toLowerCase().indexOf("</" + node.tag, i);
            if (close < 0) close = n;
            node.children.push(dedent(src.slice(i, close)));
            var gt = src.indexOf(">", close); i = gt < 0 ? n : gt + 1;
          } else if (!selfClose && !VOID[node.tag]) stack.push(node);
          continue;
        }
      }
      var next = src.indexOf("<", i + 1); if (next < 0) next = n;
      stack[stack.length - 1].children.push(src.slice(i, next));
      i = next;
    }
    for (var s = stack.length - 1; s > 0; s--)
      errors.push({ line: stack[s].line, message: "<" + stack[s].tag + "> não foi fechado" });
    return { children: root.children, errors: errors };
  }
  function findTagEnd(src, i) {
    var q = null;
    for (var j = i + 1; j < src.length; j++) {
      var c = src[j];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === ">") return j;
      else if (c === "<") return -1;
    }
    return -1;
  }
  function parseAttrs(s) {
    var a = {}, re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g, m;
    while ((m = re.exec(s))) a[m[1].toLowerCase()] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : "true";
    return a;
  }
  function dedent(s) {
    s = s.replace(/^\n/, "").replace(/\s+$/, "");
    var ls = s.split("\n"), min = Infinity;
    ls.forEach(function (l) { if (l.trim()) min = Math.min(min, l.match(/^ */)[0].length); });
    return min === Infinity ? s : ls.map(function (l) { return l.slice(min); }).join("\n");
  }

  /* ------------------------------------------------------------------ *
   * 2. HELPERS
   * ------------------------------------------------------------------ */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { u = String(u || "#").trim(); return /^\s*javascript:/i.test(u) ? "#" : esc(u); }
  function num(v, d, lo, hi) { var x = Number(v); if (!isFinite(x)) x = d; return Math.max(lo, Math.min(hi, x)); }
  function inline(text) {
    // **negrito**, *itálico*, `código`, [link](url) dentro de textos
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code class='g-inline-code'>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) { return "<a href='" + safeUrl(u) + "'>" + t + "</a>"; });
  }
  function commonAttrs(a, extraClass) {
    var cls = ["g-" + (extraClass || "")];
    if (a["class"]) cls.push(esc(a["class"]));
    if (a.animate) cls.push("g-anim g-anim-" + esc(a.animate === "true" ? "up" : a.animate));
    if (a.align) cls.push("g-align-" + esc(a.align));
    var out = ' class="' + cls.join(" ").trim() + '"';
    if (a.id) out += ' id="' + esc(a.id) + '"';
    var st = [];
    if (a.bg) st.push("background:" + cssColor(a.bg));
    if (a.color) st.push("color:" + cssColor(a.color));
    if (a.pad) st.push("padding:" + esc(a.pad));
    if (a.gap) st.push("gap:" + esc(a.gap));
    if (a.width) st.push("max-width:" + esc(a.width));
    if (a.style) st.push(esc(a.style));
    if (st.length) out += ' style="' + st.join(";") + '"';
    return out;
  }
  function cssColor(c) {
    var named = { primary: "var(--g-primary)", accent: "var(--g-accent)", muted: "var(--g-muted)", surface: "var(--g-surface)", soft: "var(--g-soft)", gradient: "var(--g-gradient)" };
    return named[c] || esc(c);
  }

  /* Ícones SVG embutidos (traço estilo Lucide) */
  var ICONS = {
    zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
    check: "M20 6 9 17l-5-5",
    x: "M18 6 6 18M6 6l12 12",
    heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
    rocket: "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
    globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z",
    mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    chart: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
    lock: "M5 11h14v11H5zM7 11V7a5 5 0 0 1 10 0v4",
    cloud: "M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z",
    layers: "m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5",
    sparkles: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM5 3v4M3 5h4M19 17v4M17 19h4",
    arrow: "M5 12h14M12 5l7 7-7 7",
    play: "M6 3l14 9-14 9z",
    github: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.3 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5 5 0 0 0 19.9 1S18.7.7 16 2.5a13.4 13.4 0 0 0-7 0C6.3.7 5.1 1 5.1 1A5 5 0 0 0 5 4.8a5.4 5.4 0 0 0-1.5 3.7c0 5.5 3.3 6.7 6.4 7A3.4 3.4 0 0 0 9 18.1V22",
    cpu: "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    menu: "M3 6h18M3 12h18M3 18h18",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    copy: "M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
    alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
    map: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4zM8 2v16M16 6v16",
    cart: "M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6",
    graduation: "M22 10 12 5 2 10l10 5zM6 12v5c3 3 9 3 12 0v-5"
  };
  function icon(name, size) {
    var d = ICONS[name];
    if (!d) return '<span class="g-emoji" style="font-size:' + (size || 22) + 'px">' + esc(name) + "</span>";
    return '<svg class="g-icon" width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* ------------------------------------------------------------------ *
   * 3. COMPONENTES — cada um recebe (attrs, innerHtml, node, ctx)
   * ------------------------------------------------------------------ */
  var C = {};
  function def(names, info, fn) { names.split(" ").forEach(function (nm) { C[nm] = { render: fn, info: info, group: info.group }; }); }

  // --- Estrutura
  def("gitml page", { group: "Estrutura", desc: "Raiz do documento. theme, accent, font, title", attrs: "theme accent font title" },
    function (a, h) { return '<div class="g-page">' + h + "</div>"; });
  def("head meta", { group: "Estrutura", desc: "Metadados da página (title, description, icon)", attrs: "title description icon lang" }, function () { return ""; });
  def("section", { group: "Estrutura", desc: "Seção com título opcional", attrs: "title subtitle eyebrow id bg" },
    function (a, h) {
      var head = a.title || a.eyebrow ? '<header class="g-section-head">' + (a.eyebrow ? '<span class="g-eyebrow">' + esc(a.eyebrow) + "</span>" : "") + (a.title ? "<h2>" + inline(a.title) + "</h2>" : "") + (a.subtitle ? "<p>" + inline(a.subtitle) + "</p>" : "") + "</header>" : "";
      return "<section" + commonAttrs(a, "section") + '><div class="g-wrap">' + head + h + "</div></section>";
    });
  def("container", { group: "Estrutura", desc: "Centraliza o conteúdo", attrs: "width" }, function (a, h) { return "<div" + commonAttrs(a, "wrap") + ">" + h + "</div>"; });
  def("grid", { group: "Layout", desc: "Grade responsiva", attrs: "cols gap" },
    function (a, h) { return "<div" + commonAttrs(a, "grid") .replace('class="', 'style="--cols:' + num(a.cols, 3, 1, 6) + '" class="') + ">" + h + "</div>"; });
  def("row stack", { group: "Layout", desc: "Linha flexível (row) ou pilha vertical (stack)", attrs: "gap align justify wrap" },
    function (a, h, n) { return "<div" + commonAttrs(a, n.tag) + (a.justify ? ' data-justify="' + esc(a.justify) + '"' : "") + ">" + h + "</div>"; });
  def("col", { group: "Layout", desc: "Coluna dentro de row (span)", attrs: "span" },
    function (a, h) { return '<div class="g-col" style="flex:' + num(a.span, 1, 1, 12) + '">' + h + "</div>"; });
  def("split", { group: "Layout", desc: "Duas colunas: texto + mídia", attrs: "reverse" },
    function (a, h) { return "<div" + commonAttrs(a, "split" + (a.reverse === "true" ? " g-reverse" : "")) + ">" + h + "</div>"; });
  def("bento", { group: "Layout", desc: "Grade estilo bento (Apple)", attrs: "" }, function (a, h) { return "<div" + commonAttrs(a, "bento") + ">" + h + "</div>"; });
  def("spacer", { group: "Layout", desc: "Espaço vertical", attrs: "size" }, function (a) { return '<div style="height:' + num(a.size, 32, 0, 400) + 'px"></div>'; });
  def("divider hr", { group: "Layout", desc: "Linha divisória com texto opcional", attrs: "text" },
    function (a) { return a.text ? '<div class="g-divider-t"><span>' + esc(a.text) + "</span></div>" : '<hr class="g-divider">'; });

  // --- Navegação
  def("nav navbar", { group: "Navegação", desc: "Barra de navegação fixa com menu mobile", attrs: "brand logo sticky" },
    function (a, h) {
      var brand = (a.logo ? '<img src="' + safeUrl(a.logo) + '" alt="">' : "") + esc(a.brand || "GITML");
      return '<header class="g-nav' + (a.sticky === "false" ? "" : " g-sticky") + '"><div class="g-wrap g-nav-in"><a class="g-brand" href="#">' + brand + '</a><button class="g-burger" aria-label="Menu" data-g-burger>' + icon("menu") + '</button><nav class="g-nav-links">' + h + "</nav></div></header>";
    });
  def("link", { group: "Navegação", desc: "Link de texto", attrs: "href" }, function (a, h) { return '<a class="g-link" href="' + safeUrl(a.href) + '">' + (h || esc(a.text)) + "</a>"; });
  def("breadcrumb", { group: "Navegação", desc: "Trilha: items=\"Início/Docs/API\"", attrs: "items" },
    function (a) { return '<nav class="g-crumb">' + String(a.items || "").split("/").map(function (x) { return "<span>" + esc(x.trim()) + "</span>"; }).join('<i>/</i>') + "</nav>"; });
  def("footer", { group: "Navegação", desc: "Rodapé", attrs: "brand" },
    function (a, h) { return '<footer class="g-footer"><div class="g-wrap">' + (a.brand ? '<strong class="g-brand">' + esc(a.brand) + "</strong>" : "") + '<div class="g-footer-in">' + h + "</div></div></footer>"; });
  def("theme-toggle", { group: "Navegação", desc: "Botão claro/escuro", attrs: "" },
    function () { return '<button class="g-btn g-btn-ghost g-icon-btn" data-g-theme aria-label="Alternar tema">' + icon("moon", 18) + "</button>"; });

  // --- Conteúdo / Hero
  def("hero", { group: "Destaque", desc: "Cabeçalho principal impactante", attrs: "title subtitle eyebrow cta href cta2 href2 image variant" },
    function (a, h) {
      var title = a.title ? "<h1>" + inline(a.title) + "</h1>" : "";
      var acts = (a.cta ? '<a class="g-btn g-btn-primary g-btn-lg" href="' + safeUrl(a.href) + '">' + esc(a.cta) + icon("arrow", 18) + "</a>" : "") + (a.cta2 ? '<a class="g-btn g-btn-outline g-btn-lg" href="' + safeUrl(a.href2) + '">' + esc(a.cta2) + "</a>" : "");
      var body = (a.eyebrow ? '<span class="g-pill">' + icon("sparkles", 14) + esc(a.eyebrow) + "</span>" : "") + title + (a.subtitle ? '<p class="g-lead">' + inline(a.subtitle) + "</p>" : "") + h + (acts ? '<div class="g-actions">' + acts + "</div>" : "");
      var img = a.image ? '<div class="g-hero-media"><img src="' + safeUrl(a.image) + '" alt=""></div>' : "";
      return '<section class="g-hero g-hero-' + esc(a.variant || "center") + '"><div class="g-hero-glow"></div><div class="g-wrap g-hero-in"><div class="g-hero-body g-anim g-anim-up">' + body + "</div>" + img + "</div></section>";
    });
  def("grad gradient", { group: "Tipografia", desc: "Texto com degradê", attrs: "" }, function (a, h) { return '<span class="g-grad">' + (h || esc(a.text)) + "</span>"; });
  def("h1 h2 h3 h4", { group: "Tipografia", desc: "Títulos", attrs: "align" }, function (a, h, n) { return "<" + n.tag + commonAttrs(a, "h") + ">" + h + "</" + n.tag + ">"; });
  def("p text", { group: "Tipografia", desc: "Parágrafo (aceita **negrito**, *itálico*, `código`, [link](url))", attrs: "size muted" },
    function (a, h) { return "<p" + commonAttrs(a, "p" + (a.muted ? " g-muted" : "") + (a.size === "lg" ? " g-lead" : "")) + ">" + h + "</p>"; });
  def("quote blockquote", { group: "Tipografia", desc: "Citação", attrs: "author" },
    function (a, h) { return '<blockquote class="g-quote">' + h + (a.author ? "<cite>— " + esc(a.author) + "</cite>" : "") + "</blockquote>"; });
  def("kbd", { group: "Tipografia", desc: "Tecla de atalho", attrs: "" }, function (a, h) { return '<kbd class="g-kbd">' + h + "</kbd>"; });
  def("mark", { group: "Tipografia", desc: "Texto marcado", attrs: "" }, function (a, h) { return '<mark class="g-mark">' + h + "</mark>"; });
  def("ul list", { group: "Tipografia", desc: "Lista com ícones (icon=check)", attrs: "icon" },
    function (a, h) { return '<ul class="g-list' + (a.icon ? " g-list-icon" : "") + '"' + (a.icon ? ' data-icon="' + esc(a.icon) + '"' : "") + ">" + h + "</ul>"; });
  def("ol", { group: "Tipografia", desc: "Lista numerada", attrs: "" }, function (a, h) { return '<ol class="g-list">' + h + "</ol>"; });
  def("li item", { group: "Tipografia", desc: "Item de lista", attrs: "" }, function (a, h, n, ctx) { return "<li>" + (ctx.parentIcon ? '<span class="g-li-ic">' + icon(ctx.parentIcon, 16) + "</span>" : "") + "<span>" + h + "</span></li>"; });
  def("code", { group: "Tipografia", desc: "Bloco de código com botão copiar", attrs: "lang title" },
    function (a, h, n) {
      var txt = typeof n.children[0] === "string" ? n.children[0] : "";
      return '<div class="g-code"><div class="g-code-bar"><span class="g-dots"><i></i><i></i><i></i></span><span>' + esc(a.title || a.lang || "código") + '</span><button data-g-copy aria-label="Copiar">' + icon("copy", 14) + '</button></div><pre><code>' + esc(txt) + "</code></pre></div>";
    });

  // --- Ações
  def("button btn", { group: "Ações", desc: "Botão: variant=primary|outline|ghost|soft size=sm|lg icon", attrs: "href variant size icon" },
    function (a, h) {
      var v = a.variant || "primary";
      return '<a class="g-btn g-btn-' + esc(v) + (a.size ? " g-btn-" + esc(a.size) : "") + '" href="' + safeUrl(a.href) + '"' + (a.target ? ' target="' + esc(a.target) + '" rel="noopener"' : "") + ">" + (a.icon ? icon(a.icon, 18) : "") + (h || esc(a.text || "Botão")) + "</a>";
    });
  def("actions", { group: "Ações", desc: "Agrupa botões", attrs: "align" }, function (a, h) { return "<div" + commonAttrs(a, "actions") + ">" + h + "</div>"; });

  // --- Dados / Cards
  def("card", { group: "Cards", desc: "Cartão: title, icon, image, href, variant=glass|soft|outline", attrs: "title icon image href variant" },
    function (a, h) {
      var tag = a.href ? "a" : "article";
      return "<" + tag + commonAttrs(a, "card g-card-" + esc(a.variant || "default")) + (a.href ? ' href="' + safeUrl(a.href) + '"' : "") + ">" + (a.image ? '<img class="g-card-img" src="' + safeUrl(a.image) + '" alt="">' : "") + (a.icon ? '<div class="g-card-icon">' + icon(a.icon) + "</div>" : "") + (a.title ? "<h3>" + inline(a.title) + "</h3>" : "") + h + "</" + tag + ">";
    });
  def("feature", { group: "Cards", desc: "Recurso com ícone", attrs: "icon title" },
    function (a, h) { return '<article class="g-feature g-anim g-anim-up"><div class="g-card-icon">' + icon(a.icon || "sparkles") + "</div><h3>" + inline(a.title || "") + "</h3><p>" + h + "</p></article>"; });
  def("stat", { group: "Cards", desc: "Número de destaque (anima ao aparecer)", attrs: "num label prefix suffix" },
    function (a, h) { return '<div class="g-stat"><strong data-g-count="' + esc(String(a.num || a.value || "0")) + '">' + esc(a.num || a.value || "0") + "</strong><span>" + (esc(a.label || "") || h) + "</span></div>"; });
  def("pricing plan", { group: "Cards", desc: "Plano de preço", attrs: "tier price period featured cta href" },
    function (a, h) {
      var f = a.featured === "true";
      return '<article class="g-pricing' + (f ? " g-featured" : "") + '">' + (f ? '<span class="g-pricing-tag">Mais popular</span>' : "") + "<h3>" + esc(a.tier || a.name || "Plano") + '</h3><div class="g-price">' + esc(a.price || "R$ 0") + "<small>" + esc(a.period || "/mês") + '</small></div><div class="g-pricing-body">' + h + '</div><a class="g-btn ' + (f ? "g-btn-primary" : "g-btn-outline") + '" href="' + safeUrl(a.href) + '">' + esc(a.cta || "Começar") + "</a></article>";
    });
  def("testimonial", { group: "Cards", desc: "Depoimento com avatar", attrs: "name role avatar rating" },
    function (a, h) {
      var stars = a.rating ? '<div class="g-stars">' + new Array(num(a.rating, 5, 1, 5) + 1).join("★") + "</div>" : "";
      return '<figure class="g-testimonial">' + stars + "<blockquote>“" + h.trim() + '”</blockquote><figcaption>' + avatarHtml(a.name, a.avatar) + "<div><strong>" + esc(a.name || "Cliente") + "</strong><span>" + esc(a.role || "") + "</span></div></figcaption></figure>";
    });
  function avatarHtml(name, src, size) {
    var s = size || 40;
    return src ? '<img class="g-avatar" style="width:' + s + "px;height:" + s + 'px" src="' + safeUrl(src) + '" alt="">' : '<span class="g-avatar" style="width:' + s + "px;height:" + s + 'px">' + esc(String(name || "G").split(" ").map(function (p) { return p[0]; }).slice(0, 2).join("")) + "</span>";
  }
  def("avatar", { group: "Cards", desc: "Avatar com iniciais ou imagem", attrs: "name src size" }, function (a) { return avatarHtml(a.name, a.src, num(a.size, 40, 16, 200)); });
  def("avatars", { group: "Cards", desc: "Grupo de avatares sobrepostos", attrs: "" }, function (a, h) { return '<div class="g-avatars">' + h + "</div>"; });
  def("team member", { group: "Cards", desc: "Membro da equipe", attrs: "name role src" },
    function (a, h) { return '<article class="g-member">' + avatarHtml(a.name, a.src, 88) + "<strong>" + esc(a.name || "") + "</strong><span>" + esc(a.role || "") + "</span>" + (h ? "<p>" + h + "</p>" : "") + "</article>"; });
  def("table", { group: "Dados", desc: "Tabela: primeira linha vira cabeçalho", attrs: "" }, function (a, h) { return '<div class="g-table-wrap"><table class="g-table">' + h + "</table></div>"; });
  def("tr", { group: "Dados", desc: "Linha de tabela", attrs: "" }, function (a, h) { return "<tr>" + h + "</tr>"; });
  def("td th", { group: "Dados", desc: "Célula", attrs: "" }, function (a, h, n) { return "<" + n.tag + ">" + h + "</" + n.tag + ">"; });
  def("progress", { group: "Dados", desc: "Barra de progresso", attrs: "value label" },
    function (a) { var v = num(a.value, 50, 0, 100); return '<div class="g-progress-w">' + (a.label ? '<div class="g-progress-l"><span>' + esc(a.label) + "</span><span>" + v + "%</span></div>" : "") + '<div class="g-progress"><span style="width:' + v + '%"></span></div></div>'; });
  def("rating", { group: "Dados", desc: "Estrelas de avaliação", attrs: "value" },
    function (a) { var v = num(a.value, 5, 0, 5); return '<span class="g-stars">' + new Array(Math.round(v) + 1).join("★") + '<i>' + new Array(6 - Math.round(v)).join("★") + "</i></span>"; });
  def("countdown", { group: "Dados", desc: "Contagem regressiva até to=\"2026-12-31\"", attrs: "to" },
    function (a) { return '<div class="g-countdown" data-g-countdown="' + esc(a.to || "") + '">' + ["dias", "horas", "min", "seg"].map(function (l) { return "<div><strong>00</strong><span>" + l + "</span></div>"; }).join("") + "</div>"; });

  // --- Feedback
  def("badge chip tag", { group: "Feedback", desc: "Etiqueta: variant=primary|success|warning|danger", attrs: "variant" },
    function (a, h) { return '<span class="g-badge g-badge-' + esc(a.variant || "primary") + '">' + (h || esc(a.text)) + "</span>"; });
  def("alert callout", { group: "Feedback", desc: "Aviso: type=info|success|warning|danger", attrs: "type title" },
    function (a, h) { var t = a.type || "info"; var ic = { info: "info", success: "check", warning: "alert", danger: "alert" }[t] || "info"; return '<aside class="g-alert g-alert-' + esc(t) + '">' + icon(ic, 20) + "<div>" + (a.title ? "<strong>" + esc(a.title) + "</strong>" : "") + "<div>" + h + "</div></div></aside>"; });
  def("tooltip", { group: "Feedback", desc: "Dica ao passar o mouse", attrs: "text" }, function (a, h) { return '<span class="g-tip" data-tip="' + esc(a.text || "") + '">' + h + "</span>"; });
  def("banner announcement", { group: "Feedback", desc: "Faixa de anúncio no topo", attrs: "href" },
    function (a, h) { return '<div class="g-banner">' + h + (a.href ? ' <a href="' + safeUrl(a.href) + '">Saiba mais →</a>' : "") + "</div>"; });

  // --- Interativos
  def("accordion faq", { group: "Interativos", desc: "Pergunta expansível (title ou q)", attrs: "title q open" },
    function (a, h) { return '<details class="g-acc"' + (a.open === "true" ? " open" : "") + "><summary>" + esc(a.title || a.q || "Pergunta") + '<span class="g-acc-i">+</span></summary><div class="g-acc-b">' + h + "</div></details>"; });
  def("tabs", { group: "Interativos", desc: "Abas (contém <tab label>)", attrs: "" },
    function (a, h, n) {
      var labels = n.children.filter(function (c) { return typeof c !== "string" && c.tag === "tab"; }).map(function (c, i) { return '<button role="tab" data-g-tab="' + i + '"' + (i === 0 ? ' aria-selected="true"' : "") + ">" + esc(c.attrs.label || "Aba " + (i + 1)) + "</button>"; }).join("");
      return '<div class="g-tabs" data-g-tabs><div class="g-tabs-list" role="tablist">' + labels + "</div>" + h + "</div>";
    });
  def("tab", { group: "Interativos", desc: "Conteúdo de uma aba", attrs: "label" }, function (a, h, n, ctx) { var i = ctx.tabIndex++; return '<div class="g-tab-panel" data-g-panel="' + i + '"' + (i ? " hidden" : "") + ">" + h + "</div>"; });
  def("modal", { group: "Interativos", desc: "Janela modal aberta por botão", attrs: "trigger title" },
    function (a, h, n, ctx) { var id = "gm" + ctx.uid++; return '<button class="g-btn g-btn-primary" data-g-open="' + id + '">' + esc(a.trigger || "Abrir") + '</button><dialog class="g-modal" id="' + id + '"><form method="dialog"><button class="g-modal-x" aria-label="Fechar">' + icon("x", 18) + "</button></form>" + (a.title ? "<h3>" + esc(a.title) + "</h3>" : "") + h + "</dialog>"; });
  def("carousel slider", { group: "Interativos", desc: "Carrossel horizontal com rolagem", attrs: "" }, function (a, h) { return '<div class="g-carousel">' + h + "</div>"; });
  def("marquee logos", { group: "Interativos", desc: "Faixa de logos/textos em movimento", attrs: "" },
    function (a, h) { return '<div class="g-marquee"><div class="g-marquee-t">' + h + h + "</div></div>"; });

  // --- Mídia
  def("image img", { group: "Mídia", desc: "Imagem arredondada", attrs: "src alt rounded" },
    function (a) { return '<img class="g-image" src="' + safeUrl(a.src) + '" alt="' + esc(a.alt || "") + '" loading="lazy">'; });
  def("video", { group: "Mídia", desc: "Vídeo (arquivo ou YouTube)", attrs: "src" },
    function (a) {
      var yt = /(?:youtu\.be\/|v=)([\w-]{11})/.exec(a.src || "");
      return yt ? '<div class="g-embed"><iframe src="https://www.youtube.com/embed/' + yt[1] + '" allowfullscreen loading="lazy"></iframe></div>' : '<video class="g-image" src="' + safeUrl(a.src) + '" controls></video>';
    });
  def("map", { group: "Mídia", desc: "Mapa do Google: q=\"São Paulo\"", attrs: "q" },
    function (a) { return '<div class="g-embed"><iframe loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(a.q || "") + '&output=embed"></iframe></div>'; });
  def("icon", { group: "Mídia", desc: "Ícone embutido: name=" + Object.keys(ICONS).slice(0, 6).join("|") + "… ou emoji", attrs: "name size" }, function (a) { return icon(a.name || "star", num(a.size, 22, 8, 128)); });
  def("browser", { group: "Mídia", desc: "Moldura de navegador para screenshots", attrs: "url" },
    function (a, h) { return '<div class="g-browser"><div class="g-code-bar"><span class="g-dots"><i></i><i></i><i></i></span><span class="g-url">' + esc(a.url || "seusite.com") + "</span></div>" + h + "</div>"; });

  // --- Formulários
  def("form", { group: "Formulários", desc: "Formulário (action, method)", attrs: "action method" },
    function (a, h) { return '<form class="g-form" action="' + safeUrl(a.action || "#") + '" method="' + esc(a.method || "post") + '">' + h + "</form>"; });
  def("input field", { group: "Formulários", desc: "Campo: label, type, placeholder, name", attrs: "label type placeholder name required" },
    function (a) { return '<label class="g-field">' + (a.label ? "<span>" + esc(a.label) + "</span>" : "") + '<input type="' + esc(a.type || "text") + '" name="' + esc(a.name || "") + '" placeholder="' + esc(a.placeholder || "") + '"' + (a.required ? " required" : "") + "></label>"; });
  def("textarea", { group: "Formulários", desc: "Texto longo", attrs: "label name placeholder" },
    function (a, h) { return '<label class="g-field">' + (a.label ? "<span>" + esc(a.label) + "</span>" : "") + '<textarea name="' + esc(a.name || "") + '" placeholder="' + esc(a.placeholder || "") + '" rows="4">' + h + "</textarea></label>"; });
  def("select", { group: "Formulários", desc: "Lista: options=\"A,B,C\"", attrs: "label name options" },
    function (a) { return '<label class="g-field">' + (a.label ? "<span>" + esc(a.label) + "</span>" : "") + '<select name="' + esc(a.name || "") + '">' + String(a.options || "").split(",").map(function (o) { return "<option>" + esc(o.trim()) + "</option>"; }).join("") + "</select></label>"; });
  def("submit", { group: "Formulários", desc: "Botão de enviar", attrs: "" }, function (a, h) { return '<button type="submit" class="g-btn g-btn-primary">' + (h || "Enviar") + "</button>"; });
  def("newsletter", { group: "Formulários", desc: "Captura de e-mail em linha", attrs: "placeholder button action" },
    function (a) { return '<form class="g-newsletter" action="' + safeUrl(a.action || "#") + '"><input type="email" required placeholder="' + esc(a.placeholder || "seu@email.com") + '"><button class="g-btn g-btn-primary">' + esc(a.button || "Inscrever") + "</button></form>"; });

  // --- Seções prontas
  def("timeline", { group: "Seções", desc: "Linha do tempo vertical", attrs: "" }, function (a, h) { return '<ol class="g-timeline">' + h + "</ol>"; });
  def("step", { group: "Seções", desc: "Etapa da timeline", attrs: "title date" },
    function (a, h) { return '<li class="g-step"><span class="g-step-dot"></span>' + (a.date ? '<span class="g-eyebrow">' + esc(a.date) + "</span>" : "") + (a.title ? "<h3>" + esc(a.title) + "</h3>" : "") + "<div>" + h + "</div></li>"; });
  def("cta", { group: "Seções", desc: "Chamada final para ação", attrs: "title button href" },
    function (a, h) { return '<section class="g-wrap"><div class="g-cta g-anim g-anim-up"><h2>' + inline(a.title || "Vamos começar?") + "</h2>" + (h ? "<p>" + h + "</p>" : "") + (a.button ? '<a class="g-btn g-btn-light g-btn-lg" href="' + safeUrl(a.href) + '">' + esc(a.button) + "</a>" : "") + "</div></section>"; });

  // --- Extensibilidade
  def("style", { group: "Avançado", desc: "CSS próprio (bruto)", attrs: "" }, function (a, h, n) { return "<style>" + String(n.children[0] || "").replace(/<\/style/gi, "") + "</style>"; });
  def("script", { group: "Avançado", desc: "JavaScript próprio (apenas se allowScripts)", attrs: "" }, function (a, h, n, ctx) { return ctx.allowScripts ? "<script>" + String(n.children[0] || "") + "</script>" : ""; });
  def("define component", { group: "Avançado", desc: "Cria seu componente: <define name=\"x\"> usa {{attr}} e {{children}}", attrs: "name" }, function () { return ""; });
  def("raw html", { group: "Avançado", desc: "HTML puro dentro do GITML", attrs: "" }, function (a, h, n) { return n.children.map(function (c) { return typeof c === "string" ? c : rebuild(c); }).join(""); });

  function rebuild(n) {
    var at = Object.keys(n.attrs).map(function (k) { return " " + k + '="' + esc(n.attrs[k]) + '"'; }).join("");
    return "<" + n.tag + at + ">" + n.children.map(function (c) { return typeof c === "string" ? c : rebuild(c); }).join("") + "</" + n.tag + ">";
  }

  /* ------------------------------------------------------------------ *
   * 4. RENDERIZAÇÃO
   * ------------------------------------------------------------------ */
  function renderNodes(nodes, ctx, parent) {
    var out = "";
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (typeof nd === "string") { out += inline(nd.replace(/\{\{\s*([\w-]+)\s*\}\}/g, function (m, k) { return ctx.vars[k] != null ? ctx.vars[k] : m; })); continue; }
      out += renderNode(nd, ctx, parent);
    }
    return out;
  }
  function renderNode(nd, ctx, parent) {
    // componentes definidos pelo usuário
    if (ctx.custom[nd.tag]) {
      var tpl = ctx.custom[nd.tag], inner = renderNodes(nd.children, ctx, nd);
      var vars = Object.assign({}, ctx.vars, nd.attrs, { children: inner });
      var saved = ctx.vars; ctx.vars = vars;
      var parsed = parse(tpl.replace(/\{\{\s*children\s*\}\}/g, "\u0000CH\u0000")).children;
      var html = renderNodes(parsed, ctx, nd).replace(/\u0000CH\u0000/g, inner);
      ctx.vars = saved; return html;
    }
    var comp = C[nd.tag];
    var a = {};
    for (var k in nd.attrs) a[k] = String(nd.attrs[k]).replace(/\{\{\s*([\w-]+)\s*\}\}/g, function (m, key) { return ctx.vars[key] != null ? ctx.vars[key] : ""; });
    var prevIcon = ctx.parentIcon;
    if (nd.tag === "ul" || nd.tag === "list") ctx.parentIcon = a.icon || null;
    if (nd.tag === "tabs") ctx.tabIndex = 0;
    var h = RAW[nd.tag] ? "" : renderNodes(nd.children, ctx, nd);
    ctx.parentIcon = (nd.tag === "ul" || nd.tag === "list") ? prevIcon : ctx.parentIcon;
    if (!comp) {
      ctx.warnings.push({ line: nd.line, message: "Tag desconhecida <" + nd.tag + "> — renderizada como bloco" });
      return '<div class="g-unknown" data-tag="' + esc(nd.tag) + '">' + h + "</div>";
    }
    return comp.render(a, h, nd, ctx);
  }
  function collect(nodes, ctx) {
    nodes.forEach(function (n) {
      if (typeof n === "string") return;
      if (n.tag === "gitml" || n.tag === "page") Object.assign(ctx.page, n.attrs);
      if (n.tag === "head" || n.tag === "meta") Object.assign(ctx.page, n.attrs);
      if ((n.tag === "define" || n.tag === "component") && n.attrs.name) ctx.custom[n.attrs.name.toLowerCase()] = n.__src || "";
      collect(n.children, ctx);
    });
  }
  function extractDefines(src) {
    var defs = {}, re = /<(define|component)\s+name\s*=\s*["']([\w-]+)["'][^>]*>([\s\S]*?)<\/\1>/gi, m;
    while ((m = re.exec(src))) defs[m[2].toLowerCase()] = m[3];
    return { defs: defs, src: src.replace(re, "") };
  }

  var FONTS = {
    inter: ["Inter", "Inter:wght@400;500;600;700;800"],
    "space-grotesk": ["Space Grotesk", "Space+Grotesk:wght@400;500;600;700"],
    sora: ["Sora", "Sora:wght@400;500;600;700;800"],
    manrope: ["Manrope", "Manrope:wght@400;500;600;700;800"],
    outfit: ["Outfit", "Outfit:wght@400;500;600;700;800"],
    "dm-sans": ["DM Sans", "DM+Sans:wght@400;500;700"],
    serif: ["Instrument Serif", "Instrument+Serif"]
  };
  var ACCENTS = { violet: "#7c5cff", blue: "#2f6bff", green: "#12b981", orange: "#ff7a1a", pink: "#ec4899", red: "#ef4444", teal: "#14b8a6", black: "#111111" };

  function compile(source, opts) {
    opts = opts || {};
    var ex = extractDefines(String(source || ""));
    var parsed = parse(ex.src);
    var ctx = { page: {}, custom: ex.defs, vars: {}, warnings: [], uid: 1, tabIndex: 0, parentIcon: null, allowScripts: !!opts.allowScripts };
    collect(parsed.children, ctx);
    var body = renderNodes(parsed.children, ctx, null);
    var p = ctx.page;
    var accent = ACCENTS[p.accent] || (p.accent && /^#|^rgb|^hsl|^oklch/.test(p.accent) ? p.accent : ACCENTS.violet);
    var font = FONTS[p.font] || FONTS.sora;
    var theme = p.theme === "dark" ? "dark" : "light";
    var title = p.title || "Página GITML";
    var html = "<!doctype html>\n<html lang=\"" + esc(p.lang || "pt-BR") + "\" data-theme=\"" + theme + "\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"generator\" content=\"GITML " + VERSION + "\">\n<title>" + esc(title) + "</title>\n" +
      (p.description ? '<meta name="description" content="' + esc(p.description) + '">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(p.description) + '">\n' : "") +
      (p.icon ? '<link rel="icon" href="' + safeUrl(p.icon) + '">\n' : "") +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + font[1] + '&family=JetBrains+Mono:wght@400;600&display=swap">\n' +
      "<style>:root{--g-primary:" + esc(accent) + ";--g-font:'" + font[0] + "',ui-sans-serif,system-ui,sans-serif}" + CSS + "</style>\n</head>\n<body>\n" + body + "\n<script>" + RUNTIME + "<\/script>\n</body>\n</html>";
    return { html: html, body: body, errors: parsed.errors, warnings: ctx.warnings, page: p };
  }

  /* ------------------------------------------------------------------ *
   * 5. CSS DO DESIGN SYSTEM
   * ------------------------------------------------------------------ */
  var CSS = [
    ":root{--g-accent:color-mix(in oklab,var(--g-primary),#19c6b3 55%);--g-gradient:linear-gradient(110deg,var(--g-primary),var(--g-accent));--g-bg:#fbfbfd;--g-surface:#fff;--g-soft:color-mix(in oklab,var(--g-primary) 7%,#fff);--g-ink:#0d1120;--g-muted:#5d6577;--g-line:#e8eaf0;--g-radius:18px;--g-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12)}",
    "[data-theme=dark]{--g-bg:#07080d;--g-surface:#10121a;--g-soft:color-mix(in oklab,var(--g-primary) 14%,#07080d);--g-ink:#f2f4f8;--g-muted:#9aa3b5;--g-line:#1f2330;--g-shadow:0 1px 2px rgba(0,0,0,.4),0 16px 40px -16px rgba(0,0,0,.6)}",
    "*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--g-bg);color:var(--g-ink);font-family:var(--g-font);line-height:1.6;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}",
    "a{color:inherit}img{max-width:100%;display:block}h1,h2,h3,h4{line-height:1.1;letter-spacing:-.03em;margin:0 0 .5em}h2{font-size:clamp(28px,4vw,44px)}h3{font-size:19px;letter-spacing:-.01em}p{margin:0 0 1em}",
    ".g-wrap{max-width:1180px;margin:0 auto;padding:0 24px;width:100%}.g-section{padding:clamp(56px,9vw,112px) 0}.g-section-head{text-align:center;max-width:720px;margin:0 auto 48px}.g-section-head p{color:var(--g-muted);font-size:18px}",
    ".g-eyebrow{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--g-primary);margin-bottom:12px}.g-muted{color:var(--g-muted)}.g-lead{font-size:clamp(17px,2vw,20px);color:var(--g-muted);max-width:640px}",
    ".g-align-center{text-align:center;margin-left:auto;margin-right:auto;justify-content:center}.g-align-right{text-align:right;justify-content:flex-end}",
    ".g-grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:20px}.g-row{display:flex;gap:20px;flex-wrap:wrap;align-items:center}.g-row[data-justify=between]{justify-content:space-between}.g-row[data-justify=center]{justify-content:center}.g-stack{display:flex;flex-direction:column;gap:16px}",
    ".g-split{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}.g-reverse>:first-child{order:2}",
    ".g-bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(180px,auto);gap:16px}.g-bento>:nth-child(1){grid-column:span 2;grid-row:span 2}.g-bento>:nth-child(4){grid-column:span 2}",
    ".g-divider{border:0;border-top:1px solid var(--g-line);margin:32px 0}.g-divider-t{display:flex;align-items:center;gap:16px;color:var(--g-muted);font-size:14px;margin:32px 0}.g-divider-t::before,.g-divider-t::after{content:'';flex:1;border-top:1px solid var(--g-line)}",
    /* nav */
    ".g-nav{position:relative;z-index:50;border-bottom:1px solid transparent;transition:.3s}.g-sticky{position:sticky;top:0;backdrop-filter:saturate(180%) blur(14px);background:color-mix(in oklab,var(--g-bg) 75%,transparent)}.g-nav.g-scrolled{border-color:var(--g-line)}",
    ".g-nav-in{display:flex;align-items:center;justify-content:space-between;height:68px}.g-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.03em;text-decoration:none}.g-brand img{height:28px}",
    ".g-nav-links{display:flex;align-items:center;gap:6px}.g-nav-links .g-link{padding:8px 14px;border-radius:10px;text-decoration:none;color:var(--g-muted);font-weight:500;font-size:15px;transition:.2s}.g-nav-links .g-link:hover{color:var(--g-ink);background:var(--g-soft)}.g-burger{display:none;background:none;border:0;color:inherit;cursor:pointer}",
    ".g-crumb{display:flex;gap:8px;font-size:14px;color:var(--g-muted)}.g-crumb span:last-child{color:var(--g-ink);font-weight:600}.g-crumb i{opacity:.4;font-style:normal}",
    ".g-footer{border-top:1px solid var(--g-line);padding:48px 0;margin-top:48px;color:var(--g-muted);font-size:14px}.g-footer .g-wrap{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:center}.g-footer-in{display:flex;gap:20px;flex-wrap:wrap;align-items:center}.g-footer .g-link{text-decoration:none}.g-footer .g-link:hover{color:var(--g-ink)}",
    /* hero */
    ".g-hero{position:relative;overflow:hidden;padding:clamp(72px,12vw,150px) 0 clamp(64px,10vw,120px)}.g-hero-glow{position:absolute;inset:-30% -10% auto;height:640px;background:radial-gradient(closest-side,color-mix(in oklab,var(--g-primary) 30%,transparent),transparent),radial-gradient(closest-side at 70% 40%,color-mix(in oklab,var(--g-accent) 22%,transparent),transparent);filter:blur(40px);opacity:.8;pointer-events:none;animation:g-float 12s ease-in-out infinite alternate}",
    ".g-hero::after{content:'';position:absolute;inset:0;background-image:linear-gradient(var(--g-line) 1px,transparent 1px),linear-gradient(90deg,var(--g-line) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at top,#000 20%,transparent 70%);opacity:.5;pointer-events:none}",
    ".g-hero-in{position:relative;z-index:1}.g-hero-center .g-hero-body{text-align:center;max-width:880px;margin:0 auto;display:flex;flex-direction:column;align-items:center}.g-hero-center .g-hero-media{margin-top:64px}",
    ".g-hero-split .g-hero-in{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}",
    ".g-hero h1{font-size:clamp(42px,7.4vw,84px);font-weight:800;letter-spacing:-.05em;line-height:1.02;margin:20px 0}.g-hero-media img{border-radius:24px;border:1px solid var(--g-line);box-shadow:0 40px 80px -30px color-mix(in oklab,var(--g-primary) 45%,transparent)}",
    ".g-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;background:var(--g-surface);border:1px solid var(--g-line);box-shadow:var(--g-shadow);color:var(--g-ink)}.g-pill svg{color:var(--g-primary)}",
    ".g-grad{background:var(--g-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% auto;animation:g-shine 6s linear infinite}",
    /* botões */
    ".g-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.g-hero-center .g-actions{justify-content:center}",
    ".g-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border-radius:12px;font:600 15px/1 var(--g-font);text-decoration:none;border:1px solid transparent;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s;white-space:nowrap}.g-btn:hover{transform:translateY(-2px)}.g-btn:active{transform:translateY(0)}",
    ".g-btn-primary{background:var(--g-primary);color:#fff;box-shadow:0 8px 24px -8px var(--g-primary),inset 0 1px 0 rgba(255,255,255,.2)}.g-btn-primary:hover{box-shadow:0 14px 32px -10px var(--g-primary)}",
    ".g-btn-outline,.g-btn-secondary{background:var(--g-surface);border-color:var(--g-line);color:var(--g-ink)}.g-btn-ghost{background:transparent;color:var(--g-ink)}.g-btn-ghost:hover{background:var(--g-soft)}.g-btn-soft{background:var(--g-soft);color:var(--g-primary)}.g-btn-gradient{background:var(--g-gradient);color:#fff}.g-btn-light{background:#fff;color:#0d1120}",
    ".g-btn-sm{padding:8px 14px;font-size:13px}.g-btn-lg{padding:15px 26px;font-size:16px;border-radius:14px}.g-icon-btn{padding:9px}",
    /* cards */
    ".g-card,.g-feature,.g-pricing,.g-testimonial,.g-stat,.g-member{background:var(--g-surface);border:1px solid var(--g-line);border-radius:var(--g-radius);padding:28px;box-shadow:var(--g-shadow);transition:transform .3s,box-shadow .3s,border-color .3s;text-decoration:none;display:block;position:relative}",
    ".g-card:hover,.g-feature:hover{transform:translateY(-4px);border-color:color-mix(in oklab,var(--g-primary) 40%,var(--g-line))}.g-card p,.g-feature p{color:var(--g-muted);margin:0}",
    ".g-card-glass{background:color-mix(in oklab,var(--g-surface) 60%,transparent);backdrop-filter:blur(16px)}.g-card-soft{background:var(--g-soft);border-color:transparent;box-shadow:none}.g-card-outline{box-shadow:none}.g-card-gradient{background:var(--g-gradient);color:#fff;border:0}.g-card-gradient p{color:rgba(255,255,255,.85)}",
    ".g-card-img{margin:-28px -28px 20px;width:calc(100% + 56px);max-width:none;aspect-ratio:16/9;object-fit:cover;border-radius:var(--g-radius) var(--g-radius) 0 0}",
    ".g-card-icon{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:var(--g-soft);color:var(--g-primary);margin-bottom:18px}",
    ".g-stat{text-align:center}.g-stat strong{display:block;font-size:clamp(34px,5vw,48px);font-weight:800;letter-spacing:-.04em;background:var(--g-gradient);-webkit-background-clip:text;background-clip:text;color:transparent}.g-stat span{color:var(--g-muted);font-size:15px}",
    ".g-pricing{display:flex;flex-direction:column;gap:14px}.g-pricing h3{font-size:16px;color:var(--g-muted);font-weight:600}.g-price{font-size:46px;font-weight:800;letter-spacing:-.04em}.g-price small{font-size:15px;color:var(--g-muted);font-weight:500;margin-left:4px}.g-pricing-body{flex:1}",
    ".g-featured{border:2px solid var(--g-primary);transform:scale(1.03);box-shadow:0 30px 60px -24px color-mix(in oklab,var(--g-primary) 50%,transparent)}.g-pricing-tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--g-gradient);color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px}",
    ".g-testimonial{margin:0}.g-testimonial blockquote{margin:0 0 20px;font-size:17px;line-height:1.6}.g-testimonial figcaption{display:flex;gap:12px;align-items:center}.g-testimonial figcaption span{display:block;color:var(--g-muted);font-size:14px}",
    ".g-avatar{display:inline-grid;place-items:center;border-radius:50%;background:var(--g-gradient);color:#fff;font-weight:700;font-size:14px;object-fit:cover;flex:none;border:2px solid var(--g-surface)}.g-avatars{display:flex}.g-avatars .g-avatar{margin-left:-10px}.g-avatars .g-avatar:first-child{margin:0}",
    ".g-member{text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}.g-member span{color:var(--g-muted);font-size:14px}.g-member .g-avatar{font-size:28px;margin-bottom:10px}",
    ".g-stars{color:#f5b301;letter-spacing:2px}.g-stars i{color:var(--g-line);font-style:normal}",
    /* tipografia extra */
    ".g-quote{border-left:3px solid var(--g-primary);padding:4px 0 4px 20px;margin:24px 0;font-size:20px;font-style:italic}.g-quote cite{display:block;margin-top:10px;font-size:14px;font-style:normal;color:var(--g-muted)}",
    ".g-kbd{font:600 12px 'JetBrains Mono',monospace;padding:3px 7px;border-radius:6px;border:1px solid var(--g-line);border-bottom-width:3px;background:var(--g-surface)}.g-mark{background:color-mix(in oklab,var(--g-primary) 22%,transparent);color:inherit;padding:0 4px;border-radius:4px}",
    ".g-inline-code{font:500 .9em 'JetBrains Mono',monospace;background:var(--g-soft);padding:2px 6px;border-radius:6px;color:var(--g-primary)}",
    ".g-list{padding-left:20px;margin:0 0 1em}.g-list li{margin:8px 0}.g-list-icon{list-style:none;padding:0}.g-list-icon li{display:flex;gap:10px;align-items:flex-start}.g-li-ic{color:var(--g-primary);margin-top:4px;flex:none}",
    ".g-code,.g-browser{border-radius:14px;overflow:hidden;background:#0c0e16;border:1px solid #1e2230;box-shadow:var(--g-shadow);margin:16px 0;color:#e6e9f5}.g-code-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #1e2230;font-size:12px;color:#8b93a7;font-family:'JetBrains Mono',monospace}.g-code-bar button{margin-left:auto;background:none;border:0;color:inherit;cursor:pointer}",
    ".g-dots{display:flex;gap:6px}.g-dots i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.g-dots i:nth-child(2){background:#febc2e}.g-dots i:nth-child(3){background:#28c840}.g-url{flex:1;text-align:center;background:#161926;border-radius:6px;padding:3px}",
    ".g-code pre{margin:0;padding:18px;overflow:auto;font:14px/1.7 'JetBrains Mono',monospace}.g-browser{background:var(--g-surface);border-color:var(--g-line)}.g-browser .g-code-bar{background:#0c0e16}",
    /* feedback */
    ".g-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:12.5px;font-weight:600;background:var(--g-soft);color:var(--g-primary)}.g-badge-success{background:#e7f8ef;color:#0f8a4f}.g-badge-warning{background:#fff4e0;color:#b25e00}.g-badge-danger{background:#fdecec;color:#c42b2b}.g-badge-dark{background:var(--g-ink);color:var(--g-bg)}",
    ".g-alert{display:flex;gap:14px;padding:16px 18px;border-radius:14px;border:1px solid;margin:16px 0}.g-alert strong{display:block;margin-bottom:2px}.g-alert svg{flex:none;margin-top:2px}.g-alert-info{background:color-mix(in oklab,#2f6bff 8%,var(--g-surface));border-color:color-mix(in oklab,#2f6bff 25%,transparent);color:#2f6bff}.g-alert-success{background:color-mix(in oklab,#12b981 8%,var(--g-surface));border-color:color-mix(in oklab,#12b981 30%,transparent);color:#0d8a60}.g-alert-warning{background:color-mix(in oklab,#f59e0b 10%,var(--g-surface));border-color:color-mix(in oklab,#f59e0b 35%,transparent);color:#b25e00}.g-alert-danger{background:color-mix(in oklab,#ef4444 8%,var(--g-surface));border-color:color-mix(in oklab,#ef4444 30%,transparent);color:#c42b2b}.g-alert div div{color:var(--g-ink)}",
    ".g-tip{position:relative;border-bottom:1px dashed var(--g-muted);cursor:help}.g-tip::after{content:attr(data-tip);position:absolute;bottom:130%;left:50%;transform:translate(-50%,4px);background:var(--g-ink);color:var(--g-bg);padding:6px 10px;border-radius:8px;font-size:13px;white-space:nowrap;opacity:0;pointer-events:none;transition:.2s}.g-tip:hover::after{opacity:1;transform:translate(-50%,0)}",
    ".g-banner{background:var(--g-gradient);color:#fff;text-align:center;padding:10px 16px;font-size:14px;font-weight:500}.g-banner a{color:#fff;font-weight:700}",
    ".g-progress-l{display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px;font-weight:500}.g-progress{height:8px;background:var(--g-line);border-radius:99px;overflow:hidden}.g-progress span{display:block;height:100%;background:var(--g-gradient);border-radius:99px;transition:width 1.2s cubic-bezier(.2,.8,.2,1)}",
    ".g-countdown{display:flex;gap:12px;justify-content:center}.g-countdown div{background:var(--g-surface);border:1px solid var(--g-line);border-radius:14px;padding:14px 18px;min-width:80px;text-align:center}.g-countdown strong{display:block;font-size:32px;font-weight:800;font-variant-numeric:tabular-nums}.g-countdown span{font-size:12px;color:var(--g-muted);text-transform:uppercase;letter-spacing:.1em}",
    ".g-table-wrap{overflow:auto;border:1px solid var(--g-line);border-radius:14px;background:var(--g-surface)}.g-table{width:100%;border-collapse:collapse;font-size:15px}.g-table td,.g-table th{padding:14px 18px;text-align:left;border-bottom:1px solid var(--g-line)}.g-table tr:first-child{background:var(--g-soft);font-weight:700}.g-table tr:last-child td{border-bottom:0}",
    /* interativos */
    ".g-acc{border:1px solid var(--g-line);border-radius:14px;background:var(--g-surface);margin-bottom:10px;overflow:hidden}.g-acc summary{padding:18px 20px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px}.g-acc summary::-webkit-details-marker{display:none}.g-acc-i{transition:transform .3s;color:var(--g-primary);font-size:22px;line-height:1}.g-acc[open] .g-acc-i{transform:rotate(45deg)}.g-acc-b{padding:0 20px 18px;color:var(--g-muted)}",
    ".g-tabs-list{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--g-soft);margin-bottom:20px}.g-tabs-list button{border:0;background:none;padding:8px 16px;border-radius:9px;font:600 14px var(--g-font);color:var(--g-muted);cursor:pointer}.g-tabs-list button[aria-selected=true]{background:var(--g-surface);color:var(--g-ink);box-shadow:var(--g-shadow)}",
    ".g-modal{border:1px solid var(--g-line);border-radius:20px;padding:32px;max-width:520px;width:92%;background:var(--g-surface);color:var(--g-ink);box-shadow:0 40px 80px -20px rgba(0,0,0,.4)}.g-modal::backdrop{background:rgba(5,7,15,.5);backdrop-filter:blur(4px)}.g-modal[open]{animation:g-pop .3s}.g-modal-x{position:absolute;right:14px;top:14px;background:none;border:0;color:inherit;cursor:pointer}",
    ".g-carousel{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}.g-carousel>*{flex:0 0 min(340px,85%);scroll-snap-align:start}",
    ".g-marquee{overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);padding:20px 0}.g-marquee-t{display:flex;gap:56px;width:max-content;animation:g-marquee 30s linear infinite;align-items:center;color:var(--g-muted);font-weight:700;font-size:20px}.g-marquee-t img{height:30px;opacity:.7}",
    /* mídia/forms */
    ".g-image{border-radius:var(--g-radius);border:1px solid var(--g-line);width:100%}.g-embed{position:relative;aspect-ratio:16/9;border-radius:var(--g-radius);overflow:hidden;border:1px solid var(--g-line)}.g-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}",
    ".g-form{display:grid;gap:16px;max-width:560px}.g-field{display:grid;gap:6px;font-size:14px;font-weight:600}.g-field input,.g-field textarea,.g-field select,.g-newsletter input{font:15px var(--g-font);padding:12px 14px;border-radius:12px;border:1px solid var(--g-line);background:var(--g-surface);color:var(--g-ink);outline:none;transition:.2s}.g-field input:focus,.g-field textarea:focus,.g-newsletter input:focus{border-color:var(--g-primary);box-shadow:0 0 0 4px color-mix(in oklab,var(--g-primary) 18%,transparent)}",
    ".g-newsletter{display:flex;gap:8px;max-width:440px;margin:16px auto 0}.g-newsletter input{flex:1}",
    /* seções */
    ".g-timeline{list-style:none;padding:0 0 0 28px;margin:0;border-left:2px solid var(--g-line)}.g-step{position:relative;padding:0 0 36px}.g-step-dot{position:absolute;left:-36px;top:4px;width:14px;height:14px;border-radius:50%;background:var(--g-primary);box-shadow:0 0 0 5px var(--g-soft)}.g-step div{color:var(--g-muted)}",
    ".g-cta{position:relative;overflow:hidden;text-align:center;padding:clamp(48px,8vw,88px) 24px;border-radius:28px;background:var(--g-gradient);color:#fff;margin:48px 0}.g-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 0,rgba(255,255,255,.3),transparent 50%)}.g-cta>*{position:relative}.g-cta h2{font-size:clamp(30px,5vw,52px)}.g-cta p{opacity:.9;font-size:18px;max-width:560px;margin:0 auto 28px}",
    ".g-unknown{outline:1px dashed #ef4444;outline-offset:4px}",
    /* animações */
    ".g-anim{opacity:0;transform:translateY(24px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}.g-anim-fade{transform:none}.g-anim-zoom{transform:scale(.94)}.g-anim.g-in{opacity:1;transform:none}",
    "@keyframes g-float{to{transform:translate3d(0,40px,0) scale(1.08)}}@keyframes g-shine{to{background-position:200% center}}@keyframes g-marquee{to{transform:translateX(-50%)}}@keyframes g-pop{from{opacity:0;transform:scale(.95)}}",
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.g-anim{opacity:1;transform:none}}",
    "@media(max-width:900px){.g-grid{grid-template-columns:repeat(min(var(--cols),2),1fr)}.g-split,.g-hero-split .g-hero-in{grid-template-columns:1fr}.g-bento{grid-template-columns:1fr 1fr}.g-featured{transform:none}}",
    "@media(max-width:640px){.g-grid,.g-bento{grid-template-columns:1fr}.g-bento>*{grid-column:auto!important;grid-row:auto!important}.g-burger{display:block}.g-nav-links{display:none;position:absolute;top:68px;left:0;right:0;flex-direction:column;align-items:stretch;padding:16px;background:var(--g-surface);border-bottom:1px solid var(--g-line)}.g-nav.g-open .g-nav-links{display:flex}.g-newsletter{flex-direction:column}}"
  ].join("");

  /* ------------------------------------------------------------------ *
   * 6. RUNTIME (interatividade na página gerada)
   * ------------------------------------------------------------------ */
  var RUNTIME = "(function(){var d=document;" +
    "var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('g-in');var c=e.target.querySelector&&e.target.querySelectorAll('[data-g-count]');io.unobserve(e.target)}})},{threshold:.12});" +
    "d.querySelectorAll('.g-anim,.g-grid>*,.g-bento>*').forEach(function(el,i){el.classList.add('g-anim');el.style.transitionDelay=(i%4)*80+'ms';io.observe(el)});" +
    "var co=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target,raw=el.getAttribute('data-g-count'),m=raw.match(/^(\\D*)([\\d.,]+)(.*)$/);co.unobserve(el);if(!m)return;var target=parseFloat(m[2].replace(/\\./g,'').replace(',','.')),t0=performance.now();function f(t){var p=Math.min(1,(t-t0)/1400),v=target*(1-Math.pow(1-p,3));el.textContent=m[1]+(target%1?v.toFixed(1):Math.round(v).toLocaleString('pt-BR'))+m[3];if(p<1)requestAnimationFrame(f);else el.textContent=raw}requestAnimationFrame(f)})});d.querySelectorAll('[data-g-count]').forEach(function(el){co.observe(el)});" +
    "var nav=d.querySelector('.g-nav');addEventListener('scroll',function(){nav&&nav.classList.toggle('g-scrolled',scrollY>8)});" +
    "d.addEventListener('click',function(e){var t=e.target.closest('[data-g-burger]');if(t)t.closest('.g-nav').classList.toggle('g-open');" +
    "t=e.target.closest('[data-g-theme]');if(t){var h=d.documentElement;h.setAttribute('data-theme',h.getAttribute('data-theme')==='dark'?'light':'dark')}" +
    "t=e.target.closest('[data-g-copy]');if(t){navigator.clipboard&&navigator.clipboard.writeText(t.closest('.g-code').querySelector('code').innerText);t.style.color='#28c840'}" +
    "t=e.target.closest('[data-g-open]');if(t){var m=d.getElementById(t.getAttribute('data-g-open'));m&&m.showModal()}" +
    "t=e.target.closest('[data-g-tab]');if(t){var w=t.closest('[data-g-tabs]'),i=t.getAttribute('data-g-tab');w.querySelectorAll('[data-g-tab]').forEach(function(b){b.setAttribute('aria-selected',b===t)});w.querySelectorAll('[data-g-panel]').forEach(function(p){p.hidden=p.getAttribute('data-g-panel')!==i})}});" +
    "d.querySelectorAll('[data-g-countdown]').forEach(function(el){var to=new Date(el.getAttribute('data-g-countdown')).getTime();function tick(){var s=Math.max(0,Math.floor((to-Date.now())/1000)),v=[Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];el.querySelectorAll('strong').forEach(function(x,i){x.textContent=String(v[i]).padStart(2,'0')})}tick();setInterval(tick,1000)});" +
    "})();";

  /* ------------------------------------------------------------------ *
   * 7. AUTO-BOOT no navegador
   * ------------------------------------------------------------------ */
  function autoboot() {
    function run(src) {
      var out = compile(src);
      document.open(); document.write(out.html); document.close();
      if (out.errors.length && typeof console !== "undefined") out.errors.forEach(function (e) { console.warn("[GITML] linha " + e.line + ": " + e.message); });
    }
    function go() {
      var inlineEl = document.querySelector('script[type="text/gitml"]');
      var me = document.currentScript || document.querySelector("script[data-src]");
      var url = (me && me.getAttribute("data-src")) || new URLSearchParams(location.search).get("src");
      if (inlineEl) run(inlineEl.textContent);
      else if (url) fetch(url).then(function (r) { return r.text(); }).then(run);
      else if (/\.gitml$/i.test(location.pathname)) fetch(location.href).then(function (r) { return r.text(); }).then(run);
    }
    var cs = document.currentScript;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { document.currentScript || cs; go(); });
    else go();
  }

  function components() {
    return Object.keys(C).map(function (k) { return { tag: k, group: C[k].group, desc: C[k].info.desc, attrs: C[k].info.attrs }; });
  }

  return { version: VERSION, parse: parse, compile: compile, components: components, icons: Object.keys(ICONS), __autoboot: autoboot };
});
