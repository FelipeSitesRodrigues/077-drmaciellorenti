/**
 * Recorta o mockup aprovado (Recursos Site/DESKTOP) por seção, na largura do print:
 * referencias/desktop/<secao>.png em 1440. É o que o scripts/revisar.mjs põe ao lado
 * do print do site. Os limites vêm da troca de fundo claro/escuro medida no mockup
 * (763 x 2062 px); entre o hero e os selos, o fio dourado.
 * Não existe mockup de celular: o mobile foi adaptado a partir do desktop.
 *
 * Uso: node scripts/recortar-mockup.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const D = '../077- Clínica Estética Lorenti/Recursos Site/DESKTOP/MOCKUP REFERÊNCIA DESKTOP.png'
mkdirSync('referencias/desktop', { recursive: true })

const desktop = {
  '01-hero': [0, 322],
  '02-selos': [320, 398],
  '03-sobre': [398, 674],
  '04-tratamentos': [674, 1006],
  '05-resultados': [1006, 1194],
  '06-clinica': [1194, 1444],
  '07-depoimentos': [1444, 1590],
  '08-duvidas': [1590, 1743],
  '09-cta': [1743, 1886],
  '10-rodape': [1886, 2062],
  'pagina-inteira': [0, 2062],
}
for (const [nome, [t, b]] of Object.entries(desktop))
  await sharp(D).extract({ left: 0, top: t, width: 763, height: b - t }).resize({ width: 1440, kernel: 'lanczos3' }).toFile(`referencias/desktop/${nome}.png`)
console.log('ok referencias/desktop')
