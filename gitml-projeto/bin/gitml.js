#!/usr/bin/env node
/*!
 * GITML CLI v0.0.1 — abre páginas .gitml fora do HTML.
 *
 * Uso:
 *   node bin/gitml.js serve pagina.gitml   → sobe um servidor local e abre a página
 *   node bin/gitml.js build pagina.gitml   → gera pagina.html pronta e estilizada
 *   node bin/gitml.js components           → lista todos os componentes
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const gitml = require(path.join(__dirname, "..", "gitml.js"));

const [, , cmd, file] = process.argv;

function readSrc(f) {
  if (!f || !fs.existsSync(f)) {
    console.error("Arquivo não encontrado: " + (f || "(nenhum informado)"));
    process.exit(1);
  }
  return fs.readFileSync(f, "utf8");
}

function report(out) {
  out.errors.forEach((e) => console.warn(`[erro] linha ${e.line}: ${e.message}`));
  out.warnings.forEach((w) => console.warn(`[aviso] linha ${w.line}: ${w.message}`));
}

if (cmd === "build") {
  const src = readSrc(file);
  const out = gitml.compile(src);
  report(out);
  const dest = file.replace(/\.gitml$/i, "") + ".html";
  fs.writeFileSync(dest, out.html);
  console.log("✔ Gerado: " + dest);
} else if (cmd === "serve") {
  const src = readSrc(file);
  const out = gitml.compile(src);
  report(out);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(out.html);
  });
  server.listen(4173, () => {
    console.log("✔ GITML servindo " + file + " em http://localhost:4173");
    console.log("  (Ctrl+C para parar)");
  });
} else if (cmd === "components") {
  const list = gitml.components();
  const groups = {};
  list.forEach((c) => {
    (groups[c.group] = groups[c.group] || []).push(c);
  });
  Object.keys(groups).forEach((g) => {
    console.log("\n## " + g);
    groups[g].forEach((c) => console.log(`  <${c.tag}> — ${c.desc}`));
  });
  console.log("\nTotal: " + list.length + " tags");
} else {
  console.log("GITML v" + gitml.version);
  console.log("Uso: node bin/gitml.js <serve|build|components> [arquivo.gitml]");
}
