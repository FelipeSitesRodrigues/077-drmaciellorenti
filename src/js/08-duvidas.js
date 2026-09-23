// Acordeão das dúvidas: uma aberta por vez. As respostas fechadas ficam inertes (fora
// do Tab). Sem JS elas aparecem abertas: o CSS só fecha com .js.
;(() => {
  const lista = document.querySelector('[data-acordeao]')
  if (!lista) return
  const botoes = [...lista.querySelectorAll('.duv__pergunta')]
  const painel = (b) => document.getElementById(b.getAttribute('aria-controls'))
  botoes.forEach((b) => (painel(b).inert = true))
  lista.addEventListener('click', (e) => {
    const alvo = e.target.closest('.duv__pergunta')
    if (!alvo) return
    const abrir = alvo.getAttribute('aria-expanded') !== 'true'
    for (const b of botoes) {
      const sim = b === alvo && abrir
      b.setAttribute('aria-expanded', String(sim))
      const p = painel(b)
      p.classList.toggle('aberta', sim)
      p.inert = !sim
    }
  })
})()
