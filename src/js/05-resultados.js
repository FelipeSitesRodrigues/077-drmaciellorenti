// Faixa de antes e depois. O movimento é só CSS (transform, fora da thread principal);
// aqui entram a velocidade, a pausa e o carregamento das fotos.
;(() => {
  const faixa = document.querySelector('[data-faixa]')
  if (!faixa) return
  const trilho = faixa.querySelector('.faixa__trilho')
  const lista = faixa.querySelector('.faixa__lista')
  const pausa = document.querySelector('[data-faixa-pausa]')
  const VELOCIDADE = 32 // px por segundo

  // a duração sai da largura de uma volta, pra velocidade ser a mesma no celular e no
  // computador. A seção nasce sem layout (content-visibility), por isso o ResizeObserver.
  const medir = () => {
    const largura = lista.getBoundingClientRect().width
    if (largura) trilho.style.setProperty('--duracao', `${(largura / VELOCIDADE).toFixed(1)}s`)
  }
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(lista)
  else medir()

  // botão de pausar (conteúdo que se mexe sozinho precisa de um jeito de parar)
  pausa?.addEventListener('click', () => {
    const parar = !faixa.classList.contains('pausada')
    faixa.classList.toggle('pausada', parar)
    pausa.setAttribute('aria-pressed', String(parar))
    pausa.querySelector('[data-faixa-rotulo]').textContent = parar ? 'Continuar' : 'Pausar'
  })

  // no celular, segurar o dedo em cima para, como story. Rolar a página cancela o toque
  // (pointercancel) e a faixa volta a andar.
  // O menu de "salvar imagem" do dedo longo também fica de fora (só no toque: o botão
  // direito do mouse continua normal).
  let toque = false
  faixa.addEventListener('pointerdown', (e) => {
    toque = e.pointerType !== 'mouse'
    if (toque) faixa.classList.add('segurando')
  })
  for (const tipo of ['pointerup', 'pointercancel', 'pointerleave']) faixa.addEventListener(tipo, () => faixa.classList.remove('segurando'))
  faixa.addEventListener('contextmenu', (e) => {
    if (toque) e.preventDefault()
  })

  if (!('IntersectionObserver' in window)) return
  // fora da tela a faixa para
  new IntersectionObserver(([e]) => faixa.classList.toggle('fora', !e.isIntersecting)).observe(faixa)
  // As fotos entram com loading="lazy", mas a faixa corta tudo que está fora dela
  // (overflow hidden) e o navegador só baixaria cada foto quando ela já estivesse
  // aparecendo. Perto da seção, pede todas de uma vez.
  const perto = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      for (const img of faixa.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
      perto.disconnect()
    },
    { rootMargin: '900px 0px' },
  )
  perto.observe(faixa)
})()
