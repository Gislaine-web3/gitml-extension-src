const vscode = require('vscode');

const known = new Set(['gitml','head','nav','section','container','grid','row','col','hero','grad','badge','chip','h1','h2','h3','p','actions','button','link','card','feature','stat','alert','progress','divider','testimonial','avatar','pricing','li','ul','timeline','step','accordion','faq','code','cta','image','logos','footer']);
function parse(source) {
  const root = { tag: 'root', attrs: {}, children: [] }, stack = [root];
  const tokens = source.match(/<!--[\s\S]*?-->|<\/?[A-Za-z][\w-]*(?:\s+[^<>]*?)?\s*\/?>|[^<]+|</g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    const close = token.match(/^<\/([\w-]+)\s*>$/);
    if (close) { const idx = stack.map(x => x.tag).lastIndexOf(close[1].toLowerCase()); if (idx > 0) stack.length = idx; continue; }
    const open = token.match(/^<([\w-]+)([\s\S]*?)\s*(\/?)>$/);
    if (open) {
      const node = { tag: open[1].toLowerCase(), attrs: {}, children: [] };
      const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g; let m;
      while ((m = re.exec(open[2]))) node.attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
      stack.at(-1).children.push(node);
      if (!open[3] && !['image','divider','progress','avatar'].includes(node.tag)) stack.push(node);
    } else if (token !== '<') stack.at(-1).children.push(token);
  }
  return root.children;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(nodes) {
  return nodes.map(n => {
    if (typeof n === 'string') return esc(n);
    const a = n.attrs, inner = render(n.children), val = (k, d='') => esc(a[k] || d);
    const wrap = (tag, cls, content=inner, extra='') => `<${tag} class="${cls}" ${extra}>${content}</${tag}>`;
    switch(n.tag) {
      case 'root': return inner;
      case 'gitml': return `<main class="site" data-theme="${val('theme','light')}">${inner}</main>`;
      case 'head': return '';
      case 'hero': return `<section class="hero"><div class="eyebrow">${val('eyebrow')}</div><h1>${inner || val('title','Seu próximo projeto começa aqui')}</h1>${a.subtitle?`<p>${val('subtitle')}</p>`:''}<div class="actions">${a.cta?`<a class="btn primary" href="${val('href','#')}">${val('cta')}</a>`:''}${inner? '':''}</div></section>`;
      case 'grad': return `<span class="grad">${inner || val('text')}</span>`;
      case 'nav': return `<nav class="nav"><a class="brand" href="#">${val('brand','GITML')}</a><div>${inner}</div></nav>`;
      case 'section': case 'container': return wrap('section','section');
      case 'grid': return `<div class="grid" style="--cols:${Math.max(1,Math.min(4,Number(a.cols)||3))}">${inner}</div>`;
      case 'card': case 'feature': return wrap('article','card');
      case 'stat': return `<article class="card stat"><strong>${val('num','0')}</strong><span>${val('label',inner)}</span></article>`;
      case 'badge': case 'chip': return `<span class="badge">${inner || val('text')}</span>`;
      case 'h1': case 'h2': case 'h3': case 'p': return `<${n.tag}>${inner}</${n.tag}>`;
      case 'button': case 'link': return `<a class="btn ${val('variant','secondary')}" href="${val('href','#')}">${inner || val('text','Saiba mais')}</a>`;
      case 'actions': case 'footer': return `<div class="${n.tag}">${inner}</div>`;
      case 'divider': return '<hr class="divider">';
      case 'alert': return `<aside class="alert">${inner}</aside>`;
      case 'progress': return `<div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(a.value)||50))}%"></span></div>`;
      case 'pricing': return `<article class="card pricing ${a.featured==='true'?'featured':''}"><span>${val('tier','Plano')}</span><strong>${val('price','R$ 0')}<small>${val('period','/mês')}</small></strong>${inner}<a class="btn primary" href="${val('href','#')}">Começar</a></article>`;
      case 'li': return `<li>${inner}</li>`; case 'ul': return `<ul>${inner}</ul>`;
      case 'testimonial': return `<blockquote class="card quote">“${inner}”<cite>${val('name','Cliente')}</cite></blockquote>`;
      case 'avatar': return `<span class="avatar">${val('name','G').slice(0,1)}</span>`;
      case 'timeline': return `<div class="timeline">${inner}</div>`; case 'step': return wrap('article','step');
      case 'accordion': return `<details class="card"><summary>${val('title','Pergunta')}</summary><p>${inner}</p></details>`;
      case 'faq': return `<details class="card"><summary>${val('q','Dúvida')}</summary><p>${inner}</p></details>`;
      case 'code': return `<pre><code>${inner}</code></pre>`;
      case 'cta': return `<section class="cta"><h2>${val('title','Vamos começar?')}</h2>${inner}<a class="btn primary" href="${val('href','#')}">${val('button','Fale conosco')}</a></section>`;
      case 'image': return `<img class="image" src="${val('src','')}" alt="${val('alt','')}">`;
      default: return `<div>${inner}</div>`;
    }
  }).join('');
}
function documentHtml(source) {
 const nodes = parse(source); let theme='light'; const find = arr => { for(const n of arr) if(typeof n!=='string'){if(n.tag==='gitml')theme=n.attrs.theme||theme;find(n.children);} }; find(nodes);
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GITML — página</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#182230;background:#f7f8fc;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.site{--ink:#182230;--muted:#667085;--surface:#fff;--line:#e7eaf0;max-width:1120px;margin:auto;padding:24px;color:var(--ink)}.site[data-theme="dark"]{--ink:#f3f4f6;--muted:#aab2c0;--surface:#171c27;--line:#303746;background:#10141d}.nav{display:flex;justify-content:space-between;align-items:center;padding:10px 0 48px}.brand{font-weight:800;color:var(--ink);text-decoration:none;font-size:20px}.nav>div,.actions{display:flex;gap:12px;align-items:center}.hero{text-align:center;padding:56px 16px 80px;max-width:850px;margin:auto}.eyebrow,.badge{color:#5b4bdb;font-weight:700;font-size:13px}.hero h1{font-size:clamp(42px,7vw,76px);letter-spacing:-.055em;line-height:1.04;margin:16px 0}.hero p{font-size:19px;color:var(--muted);line-height:1.65}.grad{background:linear-gradient(100deg,#7659f6,#19a6a1);color:transparent;background-clip:text}.section{padding:32px 0}.grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:18px}.card{padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 8px 30px #17203308}.card h3{margin-top:0}.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;border:1px solid var(--line);color:var(--ink)}.primary{background:#6254e8;color:#fff;border-color:#6254e8}.secondary{background:var(--surface)}.badge{display:inline-block;padding:7px 11px;background:#efedff;border-radius:999px}.stat strong,.pricing strong{display:block;font-size:32px;margin:12px 0}.stat span,.muted{color:var(--muted)}.pricing{display:flex;flex-direction:column;gap:18px}.pricing.featured{border:2px solid #7666f4}.pricing small{font-size:14px;color:var(--muted)}.alert{padding:16px;border-radius:12px;background:#eef4ff;color:#3157a5}.progress{height:9px;background:#e8eaf0;border-radius:9px;overflow:hidden}.progress span{display:block;height:100%;background:#6254e8}.divider{border:0;border-top:1px solid var(--line);margin:24px 0}.quote{font-size:18px}.quote cite{display:block;margin-top:14px;color:var(--muted);font-size:14px}.avatar{display:inline-grid;place-items:center;border-radius:50%;width:40px;height:40px;background:#e9e6ff;color:#5746cb;font-weight:800}.timeline,.actions{display:flex;gap:14px;flex-wrap:wrap}.step{flex:1;min-width:180px}.cta{text-align:center;padding:48px 20px;border-radius:24px;background:#efedff}.cta h2{font-size:32px}details summary{cursor:pointer;font-weight:700}pre{padding:18px;background:#171c27;color:#e7eaff;border-radius:14px;overflow:auto}.image{max-width:100%;border-radius:16px}.footer{padding:32px 0;color:var(--muted);border-top:1px solid var(--line);margin-top:48px}@media(max-width:700px){.grid{grid-template-columns:1fr}.site{padding:16px}.hero{padding:44px 8px}.nav{padding-bottom:28px}}
</style></head><body>${render(nodes)}</body></html>`;
}
function activate(context) {
 let panel;
 const update = doc => { if(panel && doc && doc.uri.toString()===vscode.window.activeTextEditor?.document.uri.toString()) panel.webview.html=documentHtml(doc.getText()); };
 context.subscriptions.push(vscode.commands.registerCommand('gitml.openPreview', () => { const editor=vscode.window.activeTextEditor;if(!editor){vscode.window.showInformationMessage('Abra um arquivo .gitml primeiro.');return;} panel=vscode.window.createWebviewPanel('gitmlPreview','Prévia GITML',vscode.ViewColumn.Beside,{enableScripts:false});update(editor.document);panel.onDidDispose(()=>panel=undefined,null,context.subscriptions); }));
 context.subscriptions.push(vscode.commands.registerCommand('gitml.exportHtml', async () => { const editor=vscode.window.activeTextEditor;if(!editor)return;const uri=await vscode.window.showSaveDialog({defaultUri:editor.document.uri.with({path:editor.document.uri.path.replace(/\.gitml$/i,'.html')}),filters:{'Página HTML':['html']}});if(uri) await vscode.workspace.fs.writeFile(uri,Buffer.from(documentHtml(editor.document.getText()),'utf8')); }));
 context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>update(e.document)));
}
module.exports={activate};
