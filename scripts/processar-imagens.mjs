/**
 * Gera todas as imagens do site a partir de "../077- Clínica Estética Lorenti/Recursos Site",
 * em src/assets/img, em AVIF e WebP e em várias larguras pra srcset. Grava
 * src/assets/img/manifesto.json com largura e altura de cada arquivo (pro width/height
 * do <img>, sem salto de layout).
 *
 * - Hero do computador em duas camadas, como o mockup monta: o fundo (escritório à
 *   noite, IMAGEM FUNDO HERO DESKTOP) e o recorte do Dr. Marciel (foto 03), com um
 *   ajuste quente leve pra ele entrar na luz da cena. O blazer continua azul claro.
 * - Hero do celular numa imagem só, montada aqui: a janela com a cidade do mesmo fundo,
 *   o Dr. na frente e as bordas de cima e de baixo caindo pro preto da página.
 * - Sobre: foto 04 (sentado, abajur aceso), quase quadrada como no mockup.
 * - A clínica: a recepção real, recortada do story do Instagram (print 17), sem a
 *   barra do Instagram. Escolha do Felipe em 2026-09-23 (o render do mockup não é a
 *   recepção de verdade).
 * - Resultados: o único antes e depois real dos prints, o laser Lavieen da print 10
 *   (antes e 5 dias depois), sem as etiquetas do story. Escolha do Felipe: só caso real.
 * - Tratamentos: uma foto de banco de imagem por cartão (Unsplash e Pexels), em
 *   "TRATAMENTOS (banco de imagem)", com recorte e crédito no tratamentos.json.
 * - CTA final: o close do Dr. com a mão no queixo só existe dentro do mockup. Sai
 *   recortado de lá e ampliado 2x (escolha do Felipe, sabendo que fica suave).
 * - Monograma ML (arquivo 02) e favicons.
 *
 * Uso: node scripts/processar-imagens.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const R = '../077- Clínica Estética Lorenti/Recursos Site'
const PRINTS = `${R}/PRINTS (DEPOIMENTOS, RESULTADOS, PROCEDIMENTOS, AMBIENTE ETC)`
const MOCKUP = `${R}/DESKTOP/MOCKUP REFERÊNCIA DESKTOP.png`
const FUNDO = `${R}/DESKTOP/IMAGEM FUNDO HERO DESKTOP.png`
const DR_RECORTE = `${R}/03 - DR MACIEL - HERO - FUNDO TRANSPARENTE.png`
const DR_SOBRE = `${R}/04 - DR MACIEL - SOBRE.png`
const MONOGRAMA = `${R}/02 - logo - favicon.png`
const OUT = 'src/assets/img'
const PRETO = { r: 11, g: 10, b: 8 } // #0B0A08, o preto quente das seções

// esvazia a pasta (sem apagar a pasta em si: no Windows ela fica presa se algum terminal estiver dentro)
mkdirSync(OUT, { recursive: true })
// a imagem de compartilhamento (og-*.jpg) sai do scripts/og.mjs e fica
for (const f of readdirSync(OUT)) if (!f.startsWith('og-')) rmSync(path.join(OUT, f), { recursive: true, force: true })
mkdirSync('src/raiz', { recursive: true })
const manifesto = {}

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}

// uma imagem (arquivo ou buffer) em várias larguras, AVIF e WebP
async function variantes(origem, nome, larguras, { q = 74, alfa = false, nitidez = false } = {}) {
  for (const w of larguras) {
    for (const f of ['avif', 'webp']) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      if (nitidez) p = p.sharpen({ sigma: 0.6 })
      p =
        f === 'avif'
          ? p.avif({ quality: Math.round(q - 24), effort: 7, chromaSubsampling: '4:4:4' })
          : p.webp({ quality: q, effort: 6, smartSubsample: true, ...(alfa ? { alphaQuality: 88 } : {}) })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

// degradê vertical em SVG (pra escurecer bordas das composições)
const degrade = (w, h, paradas) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${paradas
      .map(([o, a]) => `<stop offset="${o}" stop-color="rgb(${PRETO.r},${PRETO.g},${PRETO.b})" stop-opacity="${a}"/>`)
      .join('')}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
  )

// ---------------------------------------------------------------- hero do computador: fundo
await variantes(FUNDO, 'hero-fundo', [1280, 1680, 2127], { q: 70 })

// ---------------------------------------------------------------- hero: recorte do Dr. Marciel
// Só a parte de cima aparece (o hero corta na altura do bolso), então o arquivo para
// um pouco abaixo disso. Ajuste quente leve pra entrar na luz de abajur da cena.
async function drRecortado(ate) {
  const base = sharp(DR_RECORTE).extract({ left: 0, top: 0, width: 1129, height: ate })
  const alfa = await base.clone().extractChannel(3).toBuffer()
  const rgb = await base.clone().removeAlpha().linear([1.03, 1.0, 0.95], [4, 1, -3]).modulate({ brightness: 0.98, saturation: 0.97 }).toBuffer()
  return sharp(rgb).joinChannel(alfa).png().toBuffer()
}
const drHero = await sharp(await drRecortado(1040)).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
await variantes(drHero.data, 'hero-dr', [560, 840, drHero.info.width], { q: 80, alfa: true })

// ---------------------------------------------------------------- hero do celular (composição)
{
  const W = 900
  const H = 980
  // a janela com a cidade, do mesmo fundo do computador
  const fundo = await sharp(FUNDO).extract({ left: 916, top: 0, width: 676, height: 739 }).resize({ width: W, height: H, fit: 'cover' }).modulate({ brightness: 1.06 }).toBuffer()
  const dr = await sharp(await drRecortado(1393)).resize({ width: 780 }).png().toBuffer({ resolveWithObject: true })
  const composto = await sharp(fundo)
    .composite([
      // o Dr. no centro, cabeça a 80 px do topo
      { input: dr.data, left: 62, top: 80 },
      // topo caindo pro preto (emenda com a headline) e base caindo pro preto (emenda com o subtítulo)
      { input: degrade(W, 150, [[0, 1], [0.35, 0.72], [1, 0]]), left: 0, top: 0 },
      { input: degrade(W, 300, [[0, 0], [0.55, 0.62], [1, 1]]), left: 0, top: H - 300 },
    ])
    .png()
    .toBuffer()
  // 760: celular de 412 px com densidade 1,75 pede ~721 px e pulava pro 900
  await variantes(composto, 'hero-celular', [480, 760, 900], { q: 72 })
}

// ---------------------------------------------------------------- sobre: sentado, abajur aceso
await variantes(await sharp(DR_SOBRE).extract({ left: 0, top: 80, width: 960, height: 932 }).toBuffer(), 'sobre-dr', [480, 720, 960], { q: 76 })

// ---------------------------------------------------------------- a clínica: recepção real (story, print 17)
// Área limpa do story: sem a barra de progresso e o nome no alto, sem o campo de resposta embaixo.
await variantes(
  await sharp(`${PRINTS}/Captura de Tela (17).png`).extract({ left: 684, top: 196, width: 532, height: 774 }).sharpen({ sigma: 0.5 }).toBuffer(),
  'clinica-recepcao',
  [532],
  { q: 80 },
)

// ---------------------------------------------------------------- resultados: laser Lavieen (print 10)
// Antes e depois recortados acima das etiquetas do story, na mesma proporção. O depois
// é uma foto de mais longe, então sai de uma área menor, pro rosto ficar do mesmo tamanho.
{
  // antes: abaixo do nome da paciente e acima da etiqueta "Antes do lavieen"
  const antes = await sharp(`${PRINTS}/Captura de Tela (10).png`).extract({ left: 764, top: 200, width: 367, height: 330 }).toBuffer()
  // depois: abaixo da marcação do perfil e acima da etiqueta "5 dias pós lavieen"
  const depois = await sharp(`${PRINTS}/Captura de Tela (10).png`).extract({ left: 794, top: 685, width: 278, height: 250 }).resize({ width: 367, height: 330, kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).toBuffer()
  await variantes(antes, 'resultado-laser-antes', [367], { q: 82 })
  await variantes(depois, 'resultado-laser-depois', [367], { q: 82 })
}

// ---------------------------------------------------------------- tratamentos: uma foto por cartão
// Banco de imagem (Unsplash e Pexels, uso comercial liberado), escolha do Felipe em
// 2026-09-23. Recorte 4:3 e foco do celular ficam em src/dados/tratamentos.json, junto
// do crédito. O tom desce pro quente e perde um pouco de cor: fotos de clínica branca
// e luva azul saíam frias demais no cartão preto e ouro.
{
  const TRAT = `${R}/TRATAMENTOS (banco de imagem)`
  const tratamentos = JSON.parse(readFileSync('src/dados/tratamentos.json', 'utf8'))
  for (const t of tratamentos) {
    const { arquivo, recorte: [x, y, w] } = t.foto
    const origem = `${TRAT}/${arquivo}`
    const m = await sharp(origem).metadata()
    const left = Math.round(x * m.width)
    const top = Math.round(y * m.height)
    const width = Math.min(Math.round(w * m.width), m.width - left)
    const height = Math.min(Math.round((width * 3) / 4), m.height - top)
    const foto = await sharp(origem)
      .extract({ left, top, width, height })
      .modulate({ saturation: 0.84, brightness: 0.95 })
      .linear([1.04, 1.0, 0.94], [5, 2, -3])
      .toBuffer()
    await variantes(foto, `trat-${t.id}`, [360, 640], { q: 70 })
  }
}

// ---------------------------------------------------------------- CTA final: close do Dr. (do mockup, ampliado 2x)
await variantes(
  await sharp(MOCKUP).extract({ left: 290, top: 1747, width: 338, height: 137 }).resize({ width: 676, kernel: 'lanczos3' }).sharpen({ sigma: 0.8, m1: 0.6, m2: 2 }).toBuffer(),
  'cta-dr',
  [676],
  { q: 82 },
)

// ---------------------------------------------------------------- monograma ML (arquivo 02, já sem fundo)
const mono = await sharp(MONOGRAMA).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
for (const w of [66, 92, 132, 198]) await gravar(sharp(mono.data).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 80, alphaQuality: 85, effort: 6 }), `monograma-${w}.webp`)

// ---------------------------------------------------------------- favicons (monograma)
const quadrado = async (lado, fundo, margem) => {
  const util = Math.round(lado * (1 - margem * 2))
  const ic = await sharp(mono.data).resize({ width: util, height: util, fit: 'inside' }).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } }).composite([{ input: ic, gravity: 'center' }])
}
const transparente = { r: 0, g: 0, b: 0, alpha: 0 }
const preto = { ...PRETO, alpha: 1 }
await (await quadrado(32, transparente, 0)).png().toFile('src/raiz/favicon-32.png')
await (await quadrado(180, preto, 0.16)).png().toFile('src/raiz/apple-touch-icon.png')
await (await quadrado(192, preto, 0.16)).png().toFile('src/raiz/icon-192.png')
await (await quadrado(512, preto, 0.16)).png().toFile('src/raiz/icon-512.png')
// favicon.ico com o PNG de 32 embutido (o formato ICO aceita PNG desde o Vista)
const png32 = await (await quadrado(32, transparente, 0)).png().toBuffer()
const ico = Buffer.alloc(22)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4)
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18)
writeFileSync('src/raiz/favicon.ico', Buffer.concat([ico, png32]))

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
const total = Object.values(manifesto).reduce((s, m) => s + m.kb, 0)
console.log(`${Object.keys(manifesto).length} arquivos em ${OUT} (${total} KB no total), manifesto.json gravado`)
for (const [n, m] of Object.entries(manifesto)) console.log(`  ${n.padEnd(34)} ${String(m.w).padStart(5)}x${String(m.h).padEnd(5)} ${m.kb} KB`)
console.log('favicons em src/raiz:', readdirSync('src/raiz').join(', '))
