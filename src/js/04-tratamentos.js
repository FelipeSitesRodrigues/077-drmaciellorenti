// "Ver todos os tratamentos": abre os seis cartões que ficam atrás dos oito do mockup.
// Sem JS eles já aparecem abertos (o CSS só fecha com .js), e o botão some.
;(() => {
  const botao = document.querySelector('[data-ver-todos]')
  const mais = document.getElementById('tratamentos-mais')
  if (!botao || !mais) return
  mais.inert = true
  botao.addEventListener('click', () => {
    const abrir = botao.getAttribute('aria-expanded') !== 'true'
    botao.setAttribute('aria-expanded', String(abrir))
    mais.classList.toggle('aberto', abrir)
    mais.inert = !abrir
    botao.querySelector('[data-texto-fechado]').hidden = abrir
    botao.querySelector('[data-texto-aberto]').hidden = !abrir
  })
})()
