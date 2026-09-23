/**
 * Baixa as fontes do Google Fonts e grava no próprio site (src/assets/fonts), com o
 * @font-face em src/css/_fontes.css e a assinatura em src/partials/_assinatura.html.
 *
 * O mockup aprovado usa uma serifada Garamond de alto contraste nos títulos, com itálico
 * dourado ("melhor versão"), e uma sans geométrica no texto. Ficou assim:
 * - 'EB Garamond' 500, redondo e itálico: títulos. A estática 500 do Google, cortada nas
 *   letras do português (subset-font), um arquivo pequeno por estilo. A Cormorant
 *   Garamond parecia mais com o mockup, mas a circunflexa dela é alta e solta ("você",
 *   "ciência" ficam com o acento flutuando), o mesmo problema que tirou ela do 052.
 * - 'Montserrat' variável de 400 a 700: texto, menu, rótulos e botões.
 * - A assinatura do Dr. Marciel (hero e Sobre) sai da Whisper, a manuscrita do Google
 *   mais parecida com a do mockup, mas convertida em SVG aqui mesmo (opentype.js): a
 *   página não baixa fonte nenhuma pra ela e o traço pode ser animado.
 * - Fallbacks com size-adjust (Times New Roman e Arial medidas contra a fonte real):
 *   enquanto a fonte chega, o texto já ocupa quase o mesmo espaço e nada pula.
 *
 * O CSS do Google é pedido sem user agent de navegador de propósito: assim ele entrega
 * TTF estático, que o opentype.js consegue ler pra medir e desenhar. A Montserrat do site
 * é a variável em WOFF2 (pedida com user agent de navegador).
 *
 * Uso: node scripts/baixar-fontes.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import subsetFont from 'subset-font'
import opentype from 'opentype.js'

const CACHE = 'scripts/.cache'
mkdirSync('src/assets/fonts', { recursive: true })
mkdirSync(CACHE, { recursive: true })
mkdirSync('src/partials', { recursive: true })

// letras do site: ASCII, Latin-1 (acentos do português) e a pontuação tipográfica usada
let LETRAS = ''
for (let c = 0x20; c <= 0x7e; c++) LETRAS += String.fromCharCode(c)
for (let c = 0xa0; c <= 0xff; c++) LETRAS += String.fromCharCode(c)
LETRAS += '‘’“”•…·→'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Sem user agent o Google entrega TTF estático (um por peso). Com UA de navegador,
// WOFF2 cortado por alfabeto, e aí vale o bloco /* latin */.
async function baixarTtf(familia, arq, { navegador = false } = {}) {
  const destino = `${CACHE}/${arq}`
  if (existsSync(destino)) return readFileSync(destino)
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${familia}`, navegador ? { headers: { 'User-Agent': UA } } : {})).text()
  const bloco = navegador ? [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].find(([, sub]) => sub === 'latin')?.[2] : css
  const url = bloco?.match(/url\((https:[^)]+)\)/)?.[1]
  if (!url) throw new Error(`sem url de fonte para ${familia}:\n${css.slice(0, 300)}`)
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  writeFileSync(destino, buf)
  console.log('baixada', arq, Math.round(buf.length / 1024) + ' KB')
  return buf
}

const kb = (b) => (b.length / 1024).toFixed(1) + ' KB'
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

// largura média de um texto de referência, em em
const AMOSTRA = 'Avaliação personalizada e tratamentos modernos para realçar o que você tem de mais autêntico, sempre com naturalidade, segurança e evidência. Beleza real na sua melhor versão.'
const largura = (fonte) => fonte.getAdvanceWidth(AMOSTRA, fonte.unitsPerEm) / fonte.unitsPerEm

function fallback(nome, fonte, local, arqLocal) {
  const ref = opentype.parse(ab(readFileSync(arqLocal)))
  const ajuste = largura(fonte) / largura(ref)
  const upm = fonte.unitsPerEm
  const hhea = fonte.tables.hhea
  const pct = (v) => (v * 100).toFixed(2) + '%'
  return `@font-face {
  font-family: '${nome}';
  src: ${local.map((l) => `local('${l}')`).join(', ')};
  size-adjust: ${pct(ajuste)};
  ascent-override: ${pct(hhea.ascender / upm / ajuste)};
  descent-override: ${pct(Math.abs(hhea.descender) / upm / ajuste)};
  line-gap-override: ${pct((hhea.lineGap || 0) / upm / ajuste)};
}`
}

const saida = ['/* Gerado por scripts/baixar-fontes.mjs. Não editar à mão. */']

// ---------------------------------------------------------------- EB Garamond 500 (títulos)
const garamondRedondo = await baixarTtf('EB+Garamond:wght@500', 'garamond-500.ttf')
const garamondItalico = await baixarTtf('EB+Garamond:ital,wght@1,500', 'garamond-500-italic.ttf')
let garamondMedida = null
for (const [buf, estilo, arq] of [
  [garamondRedondo, 'normal', 'garamond-500.woff2'],
  [garamondItalico, 'italic', 'garamond-500-italico.woff2'],
]) {
  const woff2 = await subsetFont(buf, LETRAS, { targetFormat: 'woff2' })
  writeFileSync(`src/assets/fonts/${arq}`, woff2)
  console.log('ok', arq, kb(woff2))
  if (estilo === 'normal') garamondMedida = opentype.parse(ab(buf))
  saida.push(`@font-face {
  font-family: 'EB Garamond';
  font-style: ${estilo};
  font-weight: 500;
  font-display: swap;
  src: url('/assets/fonts/${arq}') format('woff2');
}`)
}
saida.push(fallback('Garamond fallback', garamondMedida, ['Times New Roman', 'Times', 'Noto Serif'], 'C:/Windows/Fonts/times.ttf'))

// ---------------------------------------------------------------- Montserrat variável 400 a 700 (texto)
// a variável (WOFF2, bloco latin) vai pro site; a estática 400 (TTF) só serve pra medir o fallback
const montserrat = await baixarTtf('Montserrat:wght@400..700', 'montserrat-var-latin.woff2', { navegador: true })
const montserrat400 = await baixarTtf('Montserrat:wght@400', 'montserrat-400.ttf')
let montserratWoff2
try {
  montserratWoff2 = await subsetFont(montserrat, LETRAS, { targetFormat: 'woff2', variationAxes: { wght: { min: 400, max: 700, default: 400 } } })
} catch (e) {
  console.log('aviso: subset-font não limitou o eixo, vai a variável inteira:', e.message)
  montserratWoff2 = await subsetFont(montserrat, LETRAS, { targetFormat: 'woff2' })
}
writeFileSync('src/assets/fonts/montserrat-var.woff2', montserratWoff2)
console.log('ok montserrat-var.woff2', kb(montserratWoff2))
saida.push(`@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/assets/fonts/montserrat-var.woff2') format('woff2');
}`)
const montserratMedida = opentype.parse(ab(montserrat400))
saida.push(fallback('Montserrat fallback', montserratMedida, ['Arial', 'Helvetica', 'Roboto'], 'C:/Windows/Fonts/arial.ttf'))

writeFileSync('src/css/_fontes.css', saida.join('\n') + '\n')
console.log('src/css/_fontes.css gravado')

// ---------------------------------------------------------------- assinatura em SVG (Whisper)
const whisper = opentype.parse(ab(await baixarTtf('Whisper', 'whisper.ttf')))
const TEXTO = 'Dr. Marciel Lorenti'
const TAM = 100
const caminho = whisper.getPath(TEXTO, 0, 0, TAM)
const bb = caminho.getBoundingBox()
const folga = 4
const x0 = Math.floor(bb.x1 - folga)
const y0 = Math.floor(bb.y1 - folga)
const w = Math.ceil(bb.x2 - bb.x1 + folga * 2)
const h = Math.ceil(bb.y2 - bb.y1 + folga * 2)
const d = caminho.toPathData(0)
writeFileSync(
  'src/partials/_assinatura.html',
  `<!-- Gerado por scripts/baixar-fontes.mjs (Whisper convertida em SVG). Não editar à mão. -->
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">
  <symbol id="assinatura" viewBox="${x0} ${y0} ${w} ${h}"><path d="${d}"/></symbol>
</svg>
`,
)
console.log(`assinatura: viewBox ${x0} ${y0} ${w} ${h} (proporção ${(w / h).toFixed(3)}), ${(d.length / 1024).toFixed(1)} KB de path`)
