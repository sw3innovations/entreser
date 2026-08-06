import createClient, { type Middleware } from 'openapi-fetch'
import { getAccessToken, refreshSession } from '@/lib/http'
import type { paths } from './schema'

/**
 * Cliente HTTP do M04 (Agendamento), tipado pelo contrato — `schema.ts` é gerado do
 * `openapi.yaml` por `npm run gen:api`. Nunca se escreve tipo de API à mão; path,
 * parâmetro e retorno são conferidos em tempo de compilação (sem `any`).
 *
 * Base same-origin `/m04-api` → o proxy do `next.config.ts` encaminha para o mock
 * Prism (:4010) hoje, e para o staging quando existir (env `M04_ORIGIN`). Same-origin
 * evita CORS e espelha o padrão do `/api/v1` do app.
 */

/**
 * Um 204/205 não tem corpo para o `openapi-fetch` ler (ele devolve `data: undefined` sem
 * tocar no stream). O stream não-consumido é cancelado no GC/re-render seguinte, e o painel
 * de rede marca a requisição como `ERR_ABORTED` mesmo com o status entregue. Drenar o corpo
 * (vazio) aqui fecha o stream de forma limpa — e como o `openapi-fetch` já não o lê num 204,
 * não há dupla-leitura.
 */
async function drenarSemConteudo(response: Response): Promise<Response> {
  if (response.status === 204 || response.status === 205) {
    try {
      await response.arrayBuffer()
    } catch {
      // Corpo já ausente/consumido — nada a fazer.
    }
  }
  return response
}

/**
 * Dedup de GET em andamento. Duas leituras IDÊNTICAS disparadas juntas — o Strict Mode do
 * dev dobra os efeitos, e a mesma janela pode ser pedida pela página e pela sidebar ao mesmo
 * tempo — passam a compartilhar UMA resposta de rede em vez de baterem no servidor duas
 * vezes. Só GET (idempotente); escrita nunca é deduplicada. Chave = URL completa (path +
 * query), então janelas diferentes seguem sendo requisições distintas.
 *
 * Registrado ANTES do `auth`: uma requisição "carona" curto-circuita aqui e nem chega a
 * pedir token nem a clonar o request.
 */
const emVoo = new Map<string, { resolver: (r: Response) => void; promessa: Promise<Response> }>()

const dedupGet: Middleware = {
  async onRequest({ request }) {
    if (request.method !== 'GET') return undefined
    const emAndamento = emVoo.get(request.url)
    if (emAndamento) {
      // Carona: espera a resposta da requisição idêntica e devolve um clone (curto-circuito).
      const r = await emAndamento.promessa
      return r.clone()
    }
    // Primeira: registra o deferred; resolvido em `onResponse`, limpo em `onResponse`/`onError`.
    let resolver!: (r: Response) => void
    const promessa = new Promise<Response>((res) => {
      resolver = res
    })
    emVoo.set(request.url, { resolver, promessa })
    return undefined
  },
  onResponse({ request, response }) {
    if (request.method === 'GET') {
      const entrada = emVoo.get(request.url)
      if (entrada) {
        // O clone guardado fica intacto (nunca é lido direto); cada carona clona a partir dele.
        entrada.resolver(response.clone())
        emVoo.delete(request.url)
      }
    }
    return response
  },
  onError({ request }) {
    if (request?.method === 'GET') emVoo.delete(request.url)
    return undefined
  },
}

/**
 * Clone da requisição por `id` (único por request no openapi-fetch), tirado ANTES de o
 * fetch consumir o body — é o que permite reenviar um POST/PATCH após o refresh (o body
 * original já foi consumido pela primeira tentativa). Preenchido em `onRequest`, sempre
 * limpo em `onResponse` ou `onError`, então não vaza.
 */
const pendentes = new Map<string, Request>()

const auth: Middleware = {
  async onRequest({ request, id }) {
    // D20 — uma fonte de token só: reusa a sessão do M01 (token-store), sem duplicar auth.
    const token = getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    pendentes.set(id, request.clone())
    return request
  },

  /**
   * Retry único no 401, igual ao cliente legado (`src/lib/http/client.ts`): o token pode
   * ter expirado no meio da sessão (D19). `refreshSession` compartilha uma promise
   * in-flight, então várias telas tomando 401 ao mesmo tempo disparam um refresh só. Se o
   * refresh falha, ele já limpa o token e notifica — o guard de layout redireciona para o
   * login; aqui devolvemos o 401 e a tela mostra "sua sessão expirou".
   */
  async onResponse({ response, id }) {
    const original = pendentes.get(id)
    pendentes.delete(id)
    if (response.status !== 401) return drenarSemConteudo(response)

    const refreshed = await refreshSession()
    if (!refreshed || !original) return drenarSemConteudo(response)

    const token = getAccessToken()
    if (token) original.headers.set('Authorization', `Bearer ${token}`)
    // Reenvio fora do pipeline do openapi-fetch: não reintercepta, então não há loop —
    // se este também vier 401, a resposta sobe para a tela.
    return drenarSemConteudo(await fetch(original))
  },

  onError({ id }) {
    // Falha de rede não passa por `onResponse`; limpa o clone para o mapa não crescer.
    pendentes.delete(id)
  },
}

export const m04 = createClient<paths>({
  baseUrl: '/m04-api',
  /**
   * O contrato declara `style: form` + `explode: false` em todos os parâmetros de array
   * (status, tipo, linkMeetStatus) — ou seja, `?status=Agendada,Confirmada`. O default do
   * openapi-fetch repete o parâmetro (`?status=A&status=B`), e um servidor que siga o
   * contrato à risca leria só um valor. Os tipos gerados não carregam `style`/`explode`,
   * então isso não aparece em tempo de compilação.
   */
  querySerializer: { array: { style: 'form', explode: false } },
})
// Ordem importa: `dedupGet` antes de `auth` — a carona curto-circuita antes de pedir token.
m04.use(dedupGet)
m04.use(auth)
