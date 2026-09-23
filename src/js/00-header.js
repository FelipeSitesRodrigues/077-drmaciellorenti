// Menu do celular: tela cheia, fecha no link, no Esc (devolvendo o foco pro botão) e
// quando a tela passa pro tamanho de computador. Enquanto aberto, o resto da página
// fica inerte e sem rolagem.
;(() => {
  const topo = document.getElementById('topo')
  const botao = topo?.querySelector('.topo__menu')
  const menu = document.getElementById('menu')
  if (!topo || !botao || !menu) return
  const fundo = [document.querySelector('main'), document.querySelector('.rodape'), document.querySelector('.zap-flutuante')].filter(Boolean)

  const abrir = (sim) => {
    topo.classList.toggle('topo--aberto', sim)
    botao.setAttribute('aria-expanded', String(sim))
    botao.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu')
    document.documentElement.style.overflow = sim ? 'hidden' : ''
    fundo.forEach((el) => (el.inert = sim))
    if (sim) menu.querySelector('a')?.focus({ preventScroll: true })
  }

  botao.addEventListener('click', () => abrir(botao.getAttribute('aria-expanded') !== 'true'))
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) abrir(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !topo.classList.contains('topo--aberto')) return
    abrir(false)
    botao.focus()
  })
  matchMedia('(min-width: 64em)').addEventListener('change', (m) => m.matches && abrir(false))
})()
