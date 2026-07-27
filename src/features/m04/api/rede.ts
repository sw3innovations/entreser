import { mensagemDe } from './erros'

/**
 * Esperas entre as repetições de um GET (D19): duas tentativas extras, com folga
 * crescente. Três chamadas no total.
 */
const ESPERAS_MS = [1000, 3000]

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Qualquer resultado do `openapi-fetch` — só precisamos do status. */
type ComResposta = { response?: { status?: number } }

/**
 * Vale repetir? Sim para falha de rede (o fetch nem chegou) e para 5xx — o servidor
 * tropeçou, e tropeço costuma passar. NÃO para 4xx: aí o servidor entendeu e decidiu,
 * e repetir só devolve o mesmo "não" mais três vezes.
 */
function valeRepetir(r: ComResposta): boolean {
  const status = r.response?.status
  return status != null && status >= 500
}

/**
 * Repete um GET transitoriamente falho (D19). Só GET: escrita nunca repete sozinha —
 * repetir um `POST /sessoes` cria sessão duplicada, e repetir um registro de presença
 * falseia o histórico.
 *
 * `continuar` aborta entre as tentativas quando o componente desmontou; sem isso, uma
 * tela fechada seguiria tentando por 4 segundos.
 */
export async function comRetry<T extends ComResposta>(
  fn: () => Promise<T>,
  continuar: () => boolean = () => true,
): Promise<T> {
  let ultimoErro: unknown
  for (let tentativa = 0; tentativa <= ESPERAS_MS.length; tentativa++) {
    const ultima = tentativa === ESPERAS_MS.length
    try {
      const r = await fn()
      // Resposta veio: só repete se for 5xx, e só se ainda houver tentativa.
      if (!valeRepetir(r) || ultima || estaOffline() || !continuar()) return r
    } catch (erro) {
      ultimoErro = erro
      // Offline não se resolve repetindo: para na hora e deixa a mensagem certa aparecer.
      if (ultima || estaOffline() || !continuar()) throw erro
    }
    await dormir(ESPERAS_MS[tentativa])
    if (!continuar()) break
  }
  if (ultimoErro) throw ultimoErro
  // Só chega aqui se as três tentativas devolveram 5xx — repete a última chamada para
  // a tela receber o resultado (e a mensagem de servidor indisponível).
  return fn()
}

/** `navigator.onLine` é impreciso (diz "online" em wi-fi sem internet), mas quando diz
 *  offline está certo — e é a única pista que o browser dá de graça. */
export function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Mensagem de uma falha de INFRAESTRUTURA (não de negócio): sem conexão, servidor fora,
 * fetch que não completou. Erro com `code` continua vindo de `mensagemDe`.
 */
export function mensagemDeRede(status?: number): string {
  if (estaOffline()) return 'Você está sem conexão. Verifique a internet e tente de novo.'
  if (status != null && status >= 500) {
    return 'O servidor não respondeu. Tente novamente em instantes.'
  }
  return mensagemDe()
}
