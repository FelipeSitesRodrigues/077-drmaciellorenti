/**
 * Build do site da Clínica Lorenti. HTML, CSS e JS estático em dist/ (base do 073).
 *
 *   node build.mjs                            página inteira em dist/index.html
 *   node build.mjs --preview 04-tratamentos   só aquela seção, em dist/preview/04-tratamentos.html
 *   node build.mjs --preview 00-header,01-hero
 *   node build.mjs --publicar                 página inteira do zero, sem os previews (antes de subir)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 *   Trecho entre <!-- @head --> e <!-- /@head --> num parcial sobe pro <head>.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o arquivo de cada seção, com o
 *   mesmo nome do parcial, em ordem de nome. Entra minificado num <style>.
 * - JS: mesma regra, em src/js, num <script> no fim do <body>. Cada arquivo é um IIFE.
 * - Dados em src/dados/*.json viram HTML no build (sai tudo no HTML, pro Google ler):
 *   <!-- @tratamentos --> os cards (8 à vista e o resto atrás do "Ver todos"), cada um
 *   com o WhatsApp do próprio serviço; <!-- @tratamentos-rodape --> a lista do rodapé;
 *   <!-- @depoimentos --> os cards do carrossel; <!-- @duvidas --> o acordeão.
 * - {{wa:chave}} vira o link do WhatsApp com a mensagem mensagens.chave do config.
 *   {{cfg.caminho}} puxa qualquer valor do config; {{ano}} é o ano atual.
 * - <!-- @se cfg.caminho --> ... <!-- /@se --> só fica se o valor do config existir.
 * - <i data-i="nome" data-w="light" class="..."></i> vira <svg><use> apontando pro
 *   sprite de ícones (Phosphor), montado só com os ícones usados.
 * - <img data-img="nome" sizes="..." alt="..."> vira <picture> com AVIF e WebP em
 *   srcset, width e height, a partir de src/assets/img/manifesto.json.
 *   data-img-max="640" limita o src de reserva. Direção de arte: data-desk="nome"
 *   (+ data-desk-sizes) põe uma fonte só pra tela de computador (min-width: 64em);
 *   data-img="nada" deixa o celular sem imagem nenhuma (GIF de 1 px, sem download).
 * - <!-- @schema --> recebe o JSON-LD (clínica, Dr. Marciel e as perguntas).
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem
 *   destino, marcador {{...}} que sobrou, CSS com chave desbalanceada, mais de um h1
 *   e o que ainda falta o cliente confirmar.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const dados = (nome) => JSON.parse(readFileSync(P('src/dados', `${nome}.json`), 'utf8'))
const tratamentos = dados('tratamentos')
const depoimentos = dados('depoimentos')
const duvidas = dados('duvidas')
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

// Minificação conservadora: só comentário e espaço redundante. Não mexe em espaço
// perto de ":" ou ">", que muda o sentido de seletor (".a :is(.b)").
function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
}

function valor(caminho, avisar = true) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined && avisar) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const wa = (msg) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`
function linkWa(chave) {
  const msg = cfg.mensagens[chave]
  if (!msg) avisos.push(`mensagem de WhatsApp sem chave no config: ${chave}`)
  return wa(msg || '')
}
// mensagem de orçamento de um serviço (regra da casa: cada serviço com a sua)
const waServico = (nomeNaMensagem) => wa(cfg.mensagens.servico.replace('{servico}', nomeNaMensagem))

// ---------------------------------------------------------------- ícones (sprite com <use>)
const usados = new Map()
function icone(nome, peso = 'light', classe = '') {
  const id = `i-${nome}-${peso}`
  if (!usados.has(id)) {
    const arq = P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const miolo = readFileSync(arq, 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim()
    usados.set(id, `<symbol id="${id}" viewBox="0 0 256 256">${miolo}</symbol>`)
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`
}

// ---------------------------------------------------------------- imagens (<picture> com AVIF e WebP)
const GIF_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
function versoes(nome, ext) {
  return Object.entries(manifesto)
    .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.${ext}$`)) || [])[1]) }))
    .filter((v) => v.w)
    .sort((a, b) => a.w - b.w)
}
const srcset = (vs) => vs.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
const attr = (s, nome) => (s.match(new RegExp(`\\s${nome}="([^"]*)"`)) || [])[1]
const semAttr = (s, ...nomes) => nomes.reduce((t, n) => t.replace(new RegExp(`\\s${n}="[^"]*"`, 'g'), ''), s)

function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    let attrs = antes + depois
    const sizes = attr(attrs, 'sizes') || '100vw'
    const desk = attr(attrs, 'data-desk')
    const deskSizes = attr(attrs, 'data-desk-sizes') || sizes
    const max = Number(attr(attrs, 'data-img-max') || Infinity)
    const classePicture = attr(attrs, 'data-picture')
    attrs = semAttr(attrs, 'data-desk', 'data-desk-sizes', 'data-img-max', 'data-picture', 'sizes')
    const fontes = []
    if (desk) {
      const dw = versoes(desk, 'webp')
      const da = versoes(desk, 'avif')
      if (!dw.length) avisos.push(`data-desk sem arquivo no manifesto: ${desk}`)
      const maior = dw[dw.length - 1]?.m || { w: 1, h: 1 }
      const mq = '(min-width: 64em)'
      if (da.length) fontes.push(`<source media="${mq}" type="image/avif" srcset="${srcset(da)}" sizes="${deskSizes}" width="${maior.w}" height="${maior.h}">`)
      fontes.push(`<source media="${mq}" type="image/webp" srcset="${srcset(dw)}" sizes="${deskSizes}" width="${maior.w}" height="${maior.h}">`)
    }
    let img
    if (nome === 'nada') {
      img = `<img src="${GIF_VAZIO}" width="1" height="1"${attrs}>`
    } else {
      const vw = versoes(nome, 'webp')
      const va = versoes(nome, 'avif')
      if (!vw.length) {
        avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
        return tag
      }
      const principal = [...vw].reverse().find((v) => v.w <= max) || vw[0]
      if (va.length) fontes.push(`<source type="image/avif" srcset="${srcset(va)}" sizes="${sizes}">`)
      img = `<img src="/assets/img/${principal.arq}" srcset="${srcset(vw)}" sizes="${sizes}" width="${principal.m.w}" height="${principal.m.h}"${attrs}>`
    }
    return `<picture${classePicture ? ` class="${classePicture}"` : ''}>${fontes.join('')}${img}</picture>`
  })
}

// ---------------------------------------------------------------- tratamentos (src/dados/tratamentos.json)
// a foto sai do banco de imagem (ver foto.credito no JSON); alt vazio porque o nome do
// tratamento já está no cartão. No celular ela vira miniatura e o foco diz o que não cortar.
// sizes do celular é 150px porque ali a miniatura é mais alta que larga: quem manda é a altura.
function cardTratamento(t, i) {
  const foto = t.foto
    ? `
            <span class="trat__foto"><img data-img="trat-${t.id}" data-img-max="360" sizes="(min-width: 64em) 300px, (min-width: 40em) 46vw, 150px" alt="" loading="lazy" decoding="async" style="--foco:${t.foto.foco || '50% 50%'}"></span>`
    : ''
  return `
        <li class="trat" style="--i:${i}">
          <a class="trat__link${t.foto ? ' trat__link--foto' : ''}" href="${esc(waServico(t.mensagem))}" target="_blank" rel="noopener" data-zap="servico-${t.id}" data-evento="servico">${foto}
            <span class="trat__selo"><i data-i="${t.icone}" data-w="light" class="trat__icone"></i></span>
            <div class="trat__texto">
              <h3 class="trat__nome">${esc(t.nome)}</h3>
              <p class="trat__desc">${esc(t.descricao)}</p>
            </div>
            <span class="trat__seta"><i data-i="arrow-right" data-w="regular"></i><span class="sr-only">(agendar pelo WhatsApp)</span></span>
          </a>
        </li>`
}
function htmlTratamentos() {
  const vitrine = tratamentos.filter((t) => t.vitrine)
  const resto = tratamentos.filter((t) => !t.vitrine)
  return `<ul class="trats" role="list" data-revela-lista>${vitrine.map(cardTratamento).join('')}
      </ul>
      <div class="trats-mais" id="tratamentos-mais">
        <div class="trats-mais__dentro">
          <ul class="trats trats--mais" role="list">${resto.map(cardTratamento).join('')}
          </ul>
        </div>
      </div>`
}
const htmlTratamentosRodape = () =>
  tratamentos
    .filter((t) => t.rodape)
    .map((t) => `<li><a href="#tratamentos">${esc(t.nome)}</a></li>`)
    .join('\n            ')

// ---------------------------------------------------------------- depoimentos (src/dados/depoimentos.json)
// o G e as cinco estrelas entram uma vez no sprite (<!-- @sprite-depoimentos -->) e cada
// cartão só aponta pra eles: nove cartões com 5 estrelas cada eram 100 nós a mais no DOM
const SIMBOLOS_DEPO = `<symbol id="g-google" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></symbol>`
const G_GOOGLE = '<svg class="depo__g" aria-hidden="true" focusable="false"><use href="#g-google"/></svg>'
function estrelas() {
  // a estrela cheia do Phosphor, repetida 5 vezes num símbolo de 5 x 256
  icone('star', 'fill')
  const estrela = usados.get('i-star-fill').replace(/^<symbol[^>]*>/, '').replace(/<\/symbol>$/, '')
  return `<symbol id="cinco-estrelas" viewBox="0 0 1352 256">${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(${i * 274} 0)">${estrela}</g>`).join('')}</symbol>`
}
function htmlDepoimentos() {
  return depoimentos
    .map(
      (d, i) => `
          <li class="depo" style="--i:${i % 3}">
            <figure>
              <div class="depo__topo">${G_GOOGLE}<svg class="depo__estrelas" role="img" aria-label="5 de 5 estrelas no Google"><use href="#cinco-estrelas"/></svg></div>
              <blockquote class="depo__texto"><p>“${esc(d.texto)}”</p></blockquote>
              <figcaption class="depo__nome">${esc(d.nome)}</figcaption>
            </figure>
          </li>`,
    )
    .join('')
}

// ---------------------------------------------------------------- dúvidas (src/dados/duvidas.json)
function htmlDuvidas() {
  return duvidas
    .map(
      (d, i) => `
        <div class="duv">
          <h3 class="duv__h">
            <button class="duv__pergunta" type="button" id="duv-p${i + 1}" aria-expanded="false" aria-controls="duv-r${i + 1}">
              <span>${esc(d.pergunta)}</span>
              <span class="duv__mais" aria-hidden="true"></span>
            </button>
          </h3>
          <div class="duv__resposta" id="duv-r${i + 1}" role="region" aria-labelledby="duv-p${i + 1}">
            <div class="duv__dentro"><p>${esc(d.resposta)}</p></div>
          </div>
        </div>`,
    )
    .join('')
}

// ---------------------------------------------------------------- dados estruturados (GEO e Google)
function schema() {
  const e = cfg.endereco
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const idClinica = base ? `${base}/#clinica` : '#clinica'
  const idDr = base ? `${base}/#dr-marciel` : '#dr-marciel'
  const clinica = {
    '@type': ['MedicalBusiness', 'HealthAndBeautyBusiness'],
    '@id': idClinica,
    name: cfg.nome,
    alternateName: cfg.nomeGoogle,
    description:
      'A Clínica Lorenti é uma clínica de estética avançada em Jundiaí, São Paulo, dirigida pelo biomédico esteta Dr. Marciel Lorenti (CRBM-SP 37959), especializada em harmonização facial e corporal.',
    telephone: `+${cfg.whatsapp}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: e.rua,
      addressLocality: e.cidade,
      addressRegion: e.uf,
      postalCode: e.cep,
      addressCountry: 'BR',
    },
    areaServed: cfg.atendemos.map((c) => ({ '@type': 'City', name: c })),
    knowsAbout: tratamentos.map((t) => t.nome),
    founder: { '@id': idDr },
    employee: { '@id': idDr },
    sameAs: [cfg.instagram].filter(Boolean),
  }
  if (cfg.horarioSchema) clinica.openingHours = cfg.horarioSchema
  if (base) Object.assign(clinica, { url: `${base}/`, image: `${base}/assets/img/og-clinica-lorenti.jpg`, logo: `${base}/icon-512.png` })
  const dr = {
    '@type': 'Person',
    '@id': idDr,
    name: 'Marciel Lorenti',
    honorificPrefix: 'Dr.',
    jobTitle: 'Biomédico esteta',
    identifier: { '@type': 'PropertyValue', propertyID: 'CRBM-SP', value: '37959' },
    worksFor: { '@id': idClinica },
    sameAs: [cfg.instagram].filter(Boolean),
  }
  const faq = {
    '@type': 'FAQPage',
    mainEntity: duvidas.map((d) => ({ '@type': 'Question', name: d.pergunta, acceptedAnswer: { '@type': 'Answer', text: d.resposta } })),
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [clinica, dr, faq] })}</script>`
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes('00-header') ? '<!-- @parcial 00-header -->' : ''
    const rodape = parciais.includes('10-rodape') ? '<!-- @parcial 10-rodape -->' : ''
    const meio = parciais
      .filter((n) => n !== '00-header' && n !== '10-rodape')
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(/<!--\s*@parcial 00-header\s*-->[\s\S]*<!--\s*@parcial 10-rodape\s*-->/, `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`)
  }
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  html = html
    .replace('<!-- @tratamentos -->', htmlTratamentos)
    .replace('<!-- @tratamentos-rodape -->', htmlTratamentosRodape)
    .replace('<!-- @depoimentos -->', htmlDepoimentos)
    .replace('<!-- @duvidas -->', htmlDuvidas)
  html = html.replace(/<!--\s*@se\s+cfg\.([\w.]+)\s*-->([\s\S]*?)<!--\s*\/@se\s*-->/g, (_, c, dentro) => (valor(c, false) ? dentro : ''))
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @head-parciais -->', cabeca.join('\n  '))
  // o JS entra antes dos marcadores, pra ele também poder usar {{cfg.caminho}}
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js', parciais))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css', parciais))}</style>`)
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{wa:([\w-]+)\}\}/g, (_, chave) => esc(linkWa(chave)))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = html.replace('<!-- @schema -->', schema)
  html = imagens(html)
  html = html.replace(
    '<!-- @sprite -->',
    () => {
      const extras = html.includes('#cinco-estrelas') ? SIMBOLOS_DEPO + estrelas() : ''
      if (extras) usados.delete('i-star-fill')
      return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">${[...usados.values()].join('')}${extras}</svg>`
    },
  )
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base
      ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-clinica-lorenti.jpg">`
      : '<meta property="og:image" content="/assets/img/og-clinica-lorenti.jpg">',
  )
  return html
}

function verificar(html, rotulo) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`[${rotulo}] marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '?').slice(0, 60)
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  if (!argPreview)
    $('a[href^="#"]').each((_, el) => {
      const alvo = $(el).attr('href').slice(1)
      if (alvo && !ids[alvo]) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
    })
  if (!argPreview && $('h1').length !== 1) avisos.push(`[${rotulo}] ${$('h1').length} h1 na página (precisa ser 1)`)
}

// ---------------------------------------------------------------- execução
// No --publicar, dist sai do zero: a cópia só acrescenta, então imagem que saiu de
// src/assets ficaria esquecida em dist e iria pro GitHub. Fora dele não apaga nada,
// porque vários builds de preview podem rodar ao mesmo tempo.
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
if (!argPreview) {
  const html = montar(null)
  verificar(html, 'página')
  gravar(path.join(DIST, 'index.html'), html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  gravar(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`)
  if (base) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
  gravar(
    path.join(DIST, 'site.webmanifest'),
    JSON.stringify({ name: cfg.nome, short_name: 'Lorenti', start_url: '/', display: 'standalone', background_color: '#0B0A08', theme_color: '#0B0A08', icons: [192, 512].map((s) => ({ src: `/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }),
  )
  if (existsSync(P('src/404.html'))) gravar(path.join(DIST, '404.html'), readFileSync(P('src/404.html'), 'utf8'))
  if (!base) avisos.push('dominio vazio no site.config.json: sem canonical, sem sitemap e og:image relativo')
  for (const p of cfg.pendencias || []) avisos.push(`pendente: ${p}`)
  if (process.argv.includes('--publicar')) rmSync(path.join(DIST, 'preview'), { recursive: true, force: true })
  console.log(`ok dist/index.html ${kb(html)} (${usados.size} ícones no sprite)`)
} else {
  const nome = argPreview.join('+')
  const html = montar(argPreview)
  verificar(html, `preview ${nome}`)
  gravar(path.join(DIST, `preview/${nome}.html`), html)
  console.log(`ok /preview/${nome}.html ${kb(html)}`)
}
if (avisos.length) console.log(`AVISOS:\n  ${avisos.join('\n  ')}`)
