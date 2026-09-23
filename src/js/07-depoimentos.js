// Carrossel de avaliações: o trilho é scroll-snap nativo (dedo, roda e teclado já
// funcionam). Aqui só entram as setas, os pontos (uma página = o que cabe na tela) e o
// ponto aceso. As setas dão a volta: da última página vão pra primeira.
;(() => {
  for (const caixa of document.querySelectorAll('[data-carrossel]')) {
    const trilho = caixa.querySelector('.carrossel__trilho')
    const itens = [...trilho.children]
    const pontos = caixa.querySelector('[data-pontos]')
    const anterior = caixa.querySelector('[data-anterior]')
    const proximo = caixa.querySelector('[data-proximo]')
    if (!itens.length || !pontos) continue
    let porVez = 1
    let paginas = 1
    let atual = 0

    const passo = () => {
      const a = itens[0].getBoundingClientRect()
      const b = itens[1]?.getBoundingClientRect()
      return (b ? b.left - a.left : a.width) || 1
    }
    const irPara = (pagina) => {
      atual = (pagina + paginas) % paginas
      const alvo = itens[Math.min(atual * porVez, itens.length - 1)]
      trilho.scrollTo({ left: alvo.offsetLeft - itens[0].offsetLeft, behavior: 'smooth' })
      marcar()
    }
    const marcar = () => {
      ;[...pontos.children].forEach((p, i) => p.setAttribute('aria-current', String(i === atual)))
    }
    const medir = () => {
      // seção ainda fora da tela (content-visibility): sem largura, sem medida
      if (!trilho.clientWidth) return
      const p = passo()
      porVez = Math.max(1, Math.round((trilho.clientWidth + 1) / p))
      paginas = Math.max(1, Math.ceil(itens.length / porVez))
      atual = Math.min(atual, paginas - 1)
      pontos.replaceChildren(
        ...Array.from({ length: paginas }, (_, i) => {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'carrossel__ponto'
          b.setAttribute('aria-label', `Avaliações, página ${i + 1} de ${paginas}`)
          b.addEventListener('click', () => irPara(i))
          return b
        }),
      )
      caixa.classList.toggle('carrossel--uma-pagina', paginas === 1)
      marcar()
    }

    // ponto aceso acompanha a rolagem (no dedo também), um cálculo por quadro
    let quadro = 0
    trilho.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(quadro)
        quadro = requestAnimationFrame(() => {
          const pagina = Math.round(trilho.scrollLeft / (passo() * porVez))
          const fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4
          const nova = fim ? paginas - 1 : Math.min(pagina, paginas - 1)
          if (nova !== atual) {
            atual = nova
            marcar()
          }
        })
      },
      { passive: true },
    )
    anterior?.addEventListener('click', () => irPara(atual - 1))
    proximo?.addEventListener('click', () => irPara(atual + 1))
    trilho.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        irPara(atual + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        irPara(atual - 1)
      }
    })
    new ResizeObserver(medir).observe(trilho)
  }
})()
