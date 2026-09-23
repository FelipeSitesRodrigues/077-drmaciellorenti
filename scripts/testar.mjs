/**
 * Teste de cliques e de layout do site, no Chrome da máquina (puppeteer-core).
 * Base do 073, adaptado à Clínica Lorenti.
 *
 * - Estouro horizontal em 9 larguras, de 320 a 1920.
 * - Revelação no scroll: rola na roda do mouse, como gente de verdade, e todo
 *   [data-revela] e [data-revela-lista] precisa ganhar .visivel (bug do 067).
 * - Topo: ganha o vidro fosco depois de rolar; o WhatsApp flutuante aparece depois do hero.
 * - Menu do celular: abre, marca aria-expanded, põe o foco dentro, fecha no link
 *   (e a seção fica visível sob o header) e no Esc (devolvendo o foco pro botão).
 * - Tratamentos: "Ver todos" abre os seis de trás e fecha de novo.
 * - Carrossel: três páginas no computador, setas e pontos mudam a página.
 * - Dúvidas: o acordeão abre uma de cada vez e a resposta fechada fica inerte.
 * - Todo link de WhatsApp: número certo, nova aba e mensagem; os dos cartões com o
 *   nome do serviço na mensagem (regra da casa).
 * - Âncoras do menu (computador e celular) param com a seção logo abaixo do header, mesmo
 *   com as seções de baixo em content-visibility (altura estimada até aparecerem).
 * - Âncoras apontam pra seções que existem. Um h1 só. Toda imagem com alt. Console limpo.
 *
 * Uso: node scripts/serve.mjs  (noutro terminal)  e depois  node scripts/testar.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3077'
const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'))
const tratamentos = JSON.parse(readFileSync(new URL('../src/dados/tratamentos.json', import.meta.url), 'utf8'))
const NAVEGADOR = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const falhas = []
const ok = (cond, msg) => (cond ? console.log('  ok', msg) : (falhas.push(msg), console.log('  FALHA', msg)))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, args: ['--no-first-run'] })
try {
  const page = await browser.newPage()
  const erros = []
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('pageerror', (e) => erros.push(e.message))
  // ERR_ABORTED é o srcset/picture trocando de candidato quando a janela muda, não arquivo faltando
  page.on('requestfailed', (r) => !/wa\.me|instagram|google/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED' && erros.push(`falhou: ${r.url()} (${r.failure()?.errorText})`))

  console.log('\nLarguras (estouro horizontal)')
  for (const w of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: w < 768 ? 800 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    ok(sw <= iw, `${w}px sem rolagem lateral (${sw}/${iw})`)
  }

  console.log('\nRevelação no scroll, topo e botão flutuante')
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: w < 768 ? 844 : 900, isMobile: w < 768, hasTouch: w < 768 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const inicio = await page.evaluate(() => ({ rolado: document.getElementById('topo').classList.contains('topo--rolado'), zap: document.querySelector('.zap-flutuante').classList.contains('visivel') }))
    ok(!inicio.rolado && !inicio.zap, `${w}px: no topo, sem vidro no header e sem WhatsApp flutuante`)
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < altura; y += 120) {
      await page.mouse.wheel({ deltaY: 120 })
      await espera(25)
    }
    await espera(1500)
    const presos = await page.evaluate(() => [...document.querySelectorAll('[data-revela]:not(.visivel), [data-revela-lista]:not(.visivel)')].filter((e) => e.checkVisibility()).map((e) => `${e.tagName.toLowerCase()}.${e.classList[0] || '?'}`))
    ok(presos.length === 0, `${w}px: todo elemento animado aparece${presos.length ? ` (presos: ${presos.join(', ')})` : ''}`)
    const fim = await page.evaluate(() => ({ rolado: document.getElementById('topo').classList.contains('topo--rolado'), zap: document.querySelector('.zap-flutuante').classList.contains('visivel') }))
    ok(fim.rolado && fim.zap, `${w}px: depois de rolar, header com vidro e WhatsApp flutuante à vista`)
  }

  console.log('\nMenu do celular')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.click('.topo__menu')
  await espera(500)
  let e = await page.evaluate(() => {
    const b = document.querySelector('.topo__menu')
    const painel = document.getElementById(b.getAttribute('aria-controls'))
    return { aria: b.getAttribute('aria-expanded'), visivel: painel.checkVisibility({ visibilityProperty: true }), focoDentro: painel.contains(document.activeElement), inerte: document.querySelector('main').inert }
  })
  ok(e.aria === 'true' && e.visivel, 'abre e marca aria-expanded=true')
  ok(e.focoDentro, 'foco vai pra dentro do menu')
  ok(e.inerte, 'o resto da página fica inerte enquanto o menu está aberto')
  await page.evaluate(() => document.querySelector('#menu a[href="#tratamentos"]').click())
  await espera(1200)
  e = await page.evaluate(() => ({ aria: document.querySelector('.topo__menu').getAttribute('aria-expanded'), y: Math.round(document.getElementById('tratamentos').getBoundingClientRect().top), inerte: document.querySelector('main').inert }))
  ok(e.aria === 'false' && !e.inerte, 'fecha ao tocar num link e devolve a página')
  ok(e.y >= 0 && e.y < 120, `rola até Tratamentos sem ficar escondido sob o header (topo em ${e.y}px)`)
  await page.click('.topo__menu')
  await espera(400)
  await page.keyboard.press('Escape')
  await espera(400)
  e = await page.evaluate(() => ({ aria: document.querySelector('.topo__menu').getAttribute('aria-expanded'), foco: document.activeElement?.matches('.topo__menu') }))
  ok(e.aria === 'false' && e.foco, 'Esc fecha e devolve o foco pro botão')

  console.log('\nÂncoras do menu')
  for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
    await page.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob })
    for (const alvo of ['tratamentos', 'resultados', 'sobre', 'depoimentos', 'duvidas', 'contato']) {
      await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
      if (mob) {
        await page.click('.topo__menu')
        await espera(450)
      }
      await page.evaluate((a) => document.querySelector(`#menu a[href="#${a}"]`).click(), alvo)
      await espera(1800)
      const r = await page.evaluate((a) => ({ top: Math.round(document.getElementById(a).getBoundingClientRect().top), y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, header: document.getElementById('topo').offsetHeight }), alvo)
      const noFim = r.y >= r.max - 2
      ok((r.top >= r.header - 2 && r.top <= r.header + 30) || (noFim && r.top >= r.header - 2), `${w}px: #${alvo} para logo abaixo do header (${r.top}px${noFim ? ', fim da página' : ''})`)
    }
  }

  console.log('\nTratamentos: ver todos')
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.getElementById('tratamentos').scrollIntoView({ behavior: 'instant' }))
  const visiveis = () => page.evaluate(() => [...document.querySelectorAll('#tratamentos .trat')].filter((t) => t.getBoundingClientRect().height > 20 && t.closest('.trats-mais__dentro') === null || (t.closest('.trats-mais.aberto') && t.getBoundingClientRect().height > 20)).length)
  const vitrine = tratamentos.filter((t) => t.vitrine).length
  let n = await visiveis()
  let inerte = await page.evaluate(() => document.getElementById('tratamentos-mais').inert)
  ok(n === vitrine && inerte, `${n} cartões à vista antes de abrir (mockup: ${vitrine}), os de trás inertes`)
  await page.click('[data-ver-todos]')
  await espera(1100)
  n = await visiveis()
  e = await page.evaluate(() => ({ aria: document.querySelector('[data-ver-todos]').getAttribute('aria-expanded'), texto: document.querySelector('[data-ver-todos]').innerText.trim(), inerte: document.getElementById('tratamentos-mais').inert }))
  ok(n === tratamentos.length && e.aria === 'true' && !e.inerte, `"Ver todos" abre os ${tratamentos.length} tratamentos (botão: "${e.texto}")`)
  await page.click('[data-ver-todos]')
  await espera(1000)
  n = await visiveis()
  ok(n === vitrine, `e fecha de novo (${n} à vista)`)

  console.log('\nCarrossel de avaliações')
  await page.evaluate(() => document.getElementById('depoimentos').scrollIntoView({ behavior: 'instant' }))
  await espera(300)
  const pagina = () => page.evaluate(() => [...document.querySelectorAll('.carrossel__ponto')].findIndex((p) => p.getAttribute('aria-current') === 'true'))
  const pontos = await page.evaluate(() => document.querySelectorAll('.carrossel__ponto').length)
  ok(pontos === 3, `três pontos no computador, como no mockup (${pontos})`)
  await page.click('[data-proximo]')
  await espera(900)
  ok((await pagina()) === 1, 'a seta da direita vai pra página 2')
  await page.click('.carrossel__ponto:nth-child(3)')
  await espera(900)
  const ultimo = await page.evaluate(() => { const t = document.querySelector('.carrossel__trilho'); return t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 })
  ok((await pagina()) === 2 && ultimo, 'o terceiro ponto leva até o fim')
  await page.click('[data-proximo]')
  await espera(1100)
  ok((await pagina()) === 0, 'na última página, a seta da direita volta pra primeira')

  console.log('\nDúvidas')
  const perguntas = await page.$$('.duv__pergunta')
  await perguntas[0].click()
  await espera(300)
  await perguntas[2].click()
  await espera(700)
  e = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.duv__pergunta')]
    return { abertas: bs.filter((b) => b.getAttribute('aria-expanded') === 'true').length, terceira: bs[2].getAttribute('aria-expanded'), inerte: document.getElementById('duv-r1').inert, altura: Math.round(document.getElementById('duv-r3').getBoundingClientRect().height) }
  })
  ok(e.abertas === 1 && e.terceira === 'true' && e.inerte && e.altura > 20, `abre uma de cada vez (${perguntas.length} perguntas; a resposta aberta tem ${e.altura}px e a fechada fica inerte)`)

  console.log('\nLinks de WhatsApp')
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => ({ href: a.href, origem: a.dataset.zap || '', servico: a.querySelector('.trat__nome')?.textContent.trim() || '', alvo: a.target, texto: (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim() })),
  )
  const origens = links.map((l) => l.origem)
  ok(new Set(origens).size === origens.length && !origens.includes(''), `todo link tem data-zap único${new Set(origens).size !== origens.length ? ': repetidos ' + origens.filter((o, i) => origens.indexOf(o) !== i).join(', ') : ''}`)
  const servicos = links.filter((l) => l.servico)
  ok(servicos.length === tratamentos.length, `${servicos.length} cartões de tratamento com WhatsApp próprio`)
  for (const l of links) {
    const u = new URL(l.href)
    const numero = u.pathname.replace(/\//g, '')
    const msg = u.searchParams.get('text') || ''
    const t = tratamentos.find((x) => x.nome === l.servico)
    const servicoOk = !l.servico || msg.includes(`*${t.mensagem}*`)
    ok(numero === cfg.whatsapp && l.alvo === '_blank' && msg && servicoOk, `${l.origem.padEnd(30)} "${l.texto.slice(0, 26)}" -> ${msg.slice(0, 84)}`)
  }

  console.log('\nÂncoras, h1 e imagens')
  const ancoras = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))].filter((h) => h.length > 1).map((h) => [h, !!document.querySelector(h)]))
  for (const [h, existe] of ancoras) ok(existe, `${h} existe`)
  const estrutura = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, semAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, quebradas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(-40)) }))
  ok(estrutura.h1 === 1, `um h1 só (${estrutura.h1})`)
  ok(estrutura.semAlt === 0, `toda imagem tem alt (${estrutura.semAlt} sem)`)
  ok(estrutura.quebradas.length === 0, `nenhuma imagem quebrada${estrutura.quebradas.length ? ': ' + estrutura.quebradas.join(', ') : ''}`)

  console.log('\nConsole')
  ok(erros.length === 0, `sem erros no console${erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.')
process.exitCode = falhas.length ? 1 : 0
