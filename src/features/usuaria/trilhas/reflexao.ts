/**
 * Reflexões da usuária ao longo de uma trilha — "o que fica pra você disso?".
 *
 * Ficam SÓ no aparelho dela, por enquanto. É a versão mínima do nó de Reflexão que o
 * redesenho das trilhas prevê: quando ele existir, com resposta guardada no servidor,
 * este arquivo vira um adaptador; a tela não muda. Até lá, o compromisso de "só você vê
 * isso" é literal — nada sai do navegador.
 *
 * Tudo em try/catch: `localStorage` pode não existir (SSR) ou estar bloqueado, e uma
 * reflexão que não salva não pode derrubar o leitor.
 */
const PREFIXO = 'entreser:reflexao:'

export function lerReflexao(chave: string): string {
  try {
    return localStorage.getItem(PREFIXO + chave) ?? ''
  } catch {
    return ''
  }
}

export function salvarReflexao(chave: string, texto: string): void {
  try {
    if (texto.trim()) localStorage.setItem(PREFIXO + chave, texto)
    else localStorage.removeItem(PREFIXO + chave)
  } catch {
    // Sem armazenamento disponível: a reflexão vive só nesta sessão da tela.
  }
}
