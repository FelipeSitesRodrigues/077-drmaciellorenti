/**
 * Imagem de compartilhamento (1200 x 630), a prévia que aparece quando alguém manda o
 * link no WhatsApp, Instagram ou Facebook. Montada em HTML com as fontes, o fundo do
 * hero, o recorte do Dr. e o monograma do próprio site, fotografada pelo Chrome e
 * gravada em src/assets/img/og-clinica-lorenti.jpg (o build copia pra dist).
 *
 * Precisa do build feito e do servidor: node scripts/serve.mjs
 * Uso: node scripts/og.mjs
 */
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3077'
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(/assets/fonts/garamond-500.woff2)}
@font-face{font-family:G;font-style:italic;src:url(/assets/fonts/garamond-500-italico.woff2)}
@font-face{font-family:M;font-weight:400 700;src:url(/assets/fonts/montserrat-var.woff2)}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0B0A08;position:relative;font-family:M}
.fundo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:62% 40%}
.veu{position:absolute;inset:0;background:linear-gradient(90deg,rgb(8 7 6/.95) 0%,rgb(8 7 6/.82) 34%,rgb(8 7 6/.15) 60%,transparent 75%),linear-gradient(270deg,rgb(8 7 6/.6),transparent 22%),linear-gradient(0deg,rgb(8 7 6/.5),transparent 30%)}
.luz{position:absolute;left:560px;top:-40px;width:620px;height:620px;background:radial-gradient(closest-side,rgb(223 160 57/.22),transparent)}
.dr{position:absolute;right:40px;bottom:-190px;width:560px}
.txt{position:absolute;left:72px;top:64px;width:560px}
.marca{display:flex;align-items:center;gap:16px}
.marca img{width:58px}
.marca b{font:500 22px/1 M;letter-spacing:.06em;color:#F6F1E9;text-transform:uppercase}
.marca span{display:block;margin-top:6px;font:500 11px/1 M;letter-spacing:.3em;color:#CFC6B8;text-transform:uppercase}
.rot{margin-top:64px;font:600 14px/1.3 M;letter-spacing:.22em;color:#D7A650;text-transform:uppercase}
h1{margin-top:14px;font:500 76px/.86 G;letter-spacing:-.01em;color:#FFFDF8}
h1 em{font-style:italic;background:linear-gradient(100deg,#E9B452,#F7D98E 30%,#FFEDB6 42%,#EFC064 58%,#DFA13E);-webkit-background-clip:text;background-clip:text;color:transparent}
.cred{margin-top:30px;font:500 16px/1.5 M;color:#D5CEC4}
.cred strong{color:#F2C66B;font-weight:600}
.fio{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,transparent,#DFA039 20%,#F8DC94 50%,#DFA039 80%,transparent)}
</style></head><body>
<img class="fundo" src="/assets/img/hero-fundo-1280.webp" alt="">
<div class="veu"></div><div class="luz"></div>
<img class="dr" src="/assets/img/hero-dr-840.webp" alt="">
<div class="txt">
  <div class="marca"><img src="/assets/img/monograma-132.webp" alt=""><div><b>Clínica Lorenti</b><span>Estética avançada</span></div></div>
  <p class="rot">Harmonização facial e corporal em Jundiaí</p>
  <h1>Beleza real<br>na sua <em>melhor<br>versão</em></h1>
  <p class="cred">Dr. Marciel Lorenti · Biomédico esteta · CRBM-SP 37959<br><strong>5,0 no Google</strong> · 73 avaliações</p>
</div>
<div class="fio"></div>
</body></html>`

mkdirSync('dist/preview', { recursive: true })
writeFileSync('dist/preview/og.html', html)
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await p.goto(`${BASE}/preview/og.html`, { waitUntil: 'networkidle0' })
  await p.evaluate(() => document.fonts.ready)
  const png = await p.screenshot({ type: 'png' })
  const info = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile('src/assets/img/og-clinica-lorenti.jpg')
  console.log(`ok src/assets/img/og-clinica-lorenti.jpg ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`)
} finally {
  await b.close()
  rmSync('dist/preview/og.html', { force: true })
}
