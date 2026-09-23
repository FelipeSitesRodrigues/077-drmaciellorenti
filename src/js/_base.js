// Clínica Lorenti: comportamento comum a todas as seções. Sem biblioteca e sem ouvir o
// scroll da janela: o que depende de rolagem vai por IntersectionObserver.
// Cada seção com comportamento próprio tem o seu arquivo (mesmo nome do parcial).
;(() => {
  const temIO = 'IntersectionObserver' in window

  // ---------------------------------------------------------------- revelação no scroll
  const alvos = document.querySelectorAll('[data-revela], [data-revela-lista]')
  if (!temIO) {
    alvos.forEach((el) => el.classList.add('visivel'))
  } else {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          e.target.classList.add('visivel')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    alvos.forEach((el) => io.observe(el))
  }

  // ---------------------------------------------------------------- topo e botão flutuante
  // O topo ganha o vidro fosco quando a página sai do começo (sentinela a 60 px do topo),
  // e o WhatsApp flutuante aparece quando o hero some da tela.
  const topo = document.getElementById('topo')
  const hero = document.getElementById('inicio')
  const zap = document.querySelector('.zap-flutuante')
  if (temIO && hero) {
    const sentinela = document.createElement('div')
    sentinela.setAttribute('aria-hidden', 'true')
    sentinela.style.cssText = 'position:absolute;top:60px;left:0;width:1px;height:1px;pointer-events:none'
    hero.prepend(sentinela)
    new IntersectionObserver(([e]) => topo?.classList.toggle('topo--rolado', !e.isIntersecting)).observe(sentinela)
    new IntersectionObserver(([e]) => zap?.classList.toggle('visivel', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(hero)
  } else {
    zap?.classList.add('visivel')
  }

  // ---------------------------------------------------------------- âncoras
  // As seções abaixo da dobra usam content-visibility (layout só perto da tela) e, até
  // aparecerem, têm altura estimada: a rolagem até uma âncora distante parava no lugar
  // errado. No primeiro clique numa âncora (ou chegando com #algo no endereço) a página
  // desenha tudo uma vez e só então rola.
  const desenharTudo = () => document.documentElement.classList.add('cv-pronto')
  if (location.hash.length > 1) desenharTudo()
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]')
    if (!a || e.defaultPrevented) return
    const id = a.getAttribute('href').slice(1)
    const alvo = id && document.getElementById(id)
    if (!alvo) return
    e.preventDefault()
    desenharTudo()
    requestAnimationFrame(() => {
      alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      history.pushState(null, '', '#' + id)
      // o foco acompanha (teclado e leitor de tela continuam de onde a página parou)
      if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1')
      alvo.focus({ preventScroll: true })
    })
  })

  // ---------------------------------------------------------------- menu: seção atual acesa
  const links = new Map([...document.querySelectorAll('.menu__lista a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]))
  // o hero entra na conta sem link: com ele no meio da tela, nenhum item fica aceso
  const secoes = ['inicio', ...links.keys()]
  if (temIO && links.size) {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          links.forEach((a, id) => a.setAttribute('aria-current', String(id === e.target.id)))
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    secoes.forEach((id) => {
      const s = document.getElementById(id)
      if (s) io.observe(s)
    })
  }

  // ---------------------------------------------------------------- rastreio dos cliques no WhatsApp
  // Todo botão de WhatsApp manda evento com a origem (data-zap) e, nos cartões, o serviço.
  // Vai pro dataLayer (GA4 / Tag Manager) e pro Pixel, se um dia forem instalados.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="https://wa.me/"]')
    if (!a) return
    const origem = a.dataset.zap || a.closest('section, header, footer')?.id || 'pagina'
    const servico = a.dataset.evento === 'servico' ? a.querySelector('.trat__nome')?.textContent.trim() : undefined
    ;(window.dataLayer = window.dataLayer || []).push({ event: 'whatsapp_clique', origem, servico })
    if (typeof window.fbq === 'function') window.fbq('track', 'Contact', { origem, servico })
  })
})()
