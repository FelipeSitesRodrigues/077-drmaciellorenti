# 077 Clínica Lorenti

Site da Clínica Lorenti (Dr. Marciel Lorenti, biomédico esteta, CRBM-SP 37959):
harmonização facial e corporal em Jundiaí/SP. HTML, CSS e JavaScript estáticos, montados
por um `build.mjs` em Node e servidos de `dist/`. Feito a partir do mockup desktop aprovado
(`../077- Clínica Estética Lorenti/Recursos Site/DESKTOP/`); o celular foi adaptado dele.

Lighthouse local (2026-09-23): **100 · 100 · 100 · 100** no celular e no computador.

## Rodar

```bash
npm install          # só na primeira vez (sharp, puppeteer-core, cheerio, phosphor, lighthouse)
npm run build        # monta dist/index.html
npm run serve        # http://localhost:3077 (ou dois cliques em ABRIR-SITE.bat)
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run build` | monta `dist/` a partir de `src/` e avisa o que está pendente |
| `npm run publicar` | o mesmo, do zero, apagando os previews (antes de subir) |
| `npm run serve` | servidor local na porta 3077, com gzip como a Vercel |
| `npm run testar` | layout em 9 larguras, menu, âncoras, "ver todos", carrossel, acordeão, WhatsApp e console |
| `npm run lighthouse` | Lighthouse de celular e de computador, com o resumo no terminal |
| `npm run imagens` | gera as imagens (AVIF e WebP) a partir da pasta de recursos do cliente |
| `npm run fontes` | baixa e recorta as fontes e gera a assinatura em SVG |
| `node scripts/og.mjs` | refaz a imagem de compartilhamento (1200 x 630) |
| `node scripts/revisar.mjs pagina` | print do site ao lado do mockup, em 1440 e 390 |
| `node scripts/perfil.mjs` | trace da thread principal com a CPU 4x mais lenta |

## Estrutura

- `src/index.html` é o molde; cada seção é um parcial em `src/partials/`, com CSS e JS de
  mesmo nome em `src/css/` e `src/js/`.
- `src/dados/tratamentos.json` gera os 14 cartões (8 à vista, como no mockup, e 6 atrás do
  "Ver todos"), cada um com o WhatsApp do próprio serviço, e a lista do rodapé. O campo
  `foto` de cada tratamento diz o arquivo, o recorte 4:3, o foco da miniatura do celular e
  o crédito da imagem.
  `depoimentos.json` são as 9 avaliações reais do Google; `duvidas.json` vira o acordeão e o
  JSON-LD de perguntas.
- `site.config.json` guarda contato, endereço, nota e total de avaliações, horário e as
  mensagens de WhatsApp. O build lista as `pendencias` a cada execução.
- `dist/` vai versionado: a Vercel só serve a pasta, sem instalar nem buildar (ver
  `vercel.json`). Depois de mexer em `src/`, rodar `npm run publicar` e commitar.

## Decisões que não estão no mockup

- **Resultados:** um caso real (laser Lavieen, print 10). Os três antes e depois do mockup
  foram inventados pelo ChatGPT e não podem ir pro ar como resultado de paciente.
- **A clínica:** a recepção real, recortada do story do Instagram (print 17), no lugar do
  render do mockup.
- **Depoimentos:** as avaliações do mockup eram inventadas; entraram 9 reais do Google,
  com o sobrenome abreviado (como o mockup mostra).
- **Tratamentos:** "Skinbooster" não é serviço da clínica; no lugar entrou "Emagrecimento
  facial".
- **Foto nos cartões de tratamento** (pedido do Felipe, 2026-09-23): uma foto por
  procedimento, de banco de imagem com uso comercial liberado (13 do Unsplash e 1 do Pexels,
  sem atribuição obrigatória; o crédito fica no `tratamentos.json`). Os originais estão em
  `Recursos Site/TRATAMENTOS (banco de imagem)/`. No computador a foto fica no topo e o
  ícone vira um selo na emenda; no celular ela vira miniatura à esquerda. O tom desce pro
  quente no `processar-imagens.mjs` pra conversar com o preto e ouro. São ilustrativas, não
  são pacientes da clínica: quando o Dr. Marciel mandar fotos reais dos procedimentos, basta
  trocar o arquivo e o recorte no JSON e rodar `npm run imagens`. A foto da toxina foi
  recortada pra tirar o nome da profissional que aparecia bordado na camiseta.
- **Rótulo do hero:** "Harmonização facial e corporal em Jundiaí" (era "Estética avançada em
  Jundiaí"): é o H1 da página e carrega a busca principal, como pedia a copy.
- **Horário:** "Segunda a sexta, até as 19h" (o que o Google mostra); o "9h às 18h" do
  mockup não tem fonte.
- **Fonte dos títulos:** EB Garamond. A Cormorant Garamond era a mais parecida, mas a
  circunflexa dela flutua sobre o "e" ("você", "ciência"), o mesmo problema que tirou ela
  do 052.

## Desempenho

- CSS e JS embutidos no HTML (35 KB com gzip), fontes próprias recortadas no português,
  imagens em AVIF com WebP de reserva e `srcset`.
- A abertura do hero anima só `transform` e `opacity` no celular: recorte (`clip-path`) e
  brilho do ouro (`background-position`) seguravam a thread principal e o celular caía pra
  67 no Lighthouse. O brilho ficou só no computador.
- As seções abaixo da dobra usam `content-visibility: auto`: o primeiro layout fica só no
  hero e o LCP não espera a página inteira. Como a altura delas é estimada até aparecerem,
  o primeiro clique numa âncora desenha tudo antes de rolar (`_base.js`), senão a rolagem
  parava no lugar errado.

A copy, o mockup e a memória do projeto ficam na pasta `sites/077- Clínica Estética Lorenti/`.
