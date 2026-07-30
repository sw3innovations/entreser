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
    if (response.status !== 401) return response

    const refreshed = await refreshSession()
    if (!refreshed || !original) return response

    const token = getAccessToken()
    if (token) original.headers.set('Authorization', `Bearer ${token}`)
    // Reenvio fora do pipeline do openapi-fetch: não reintercepta, então não há loop —
    // se este também vier 401, a resposta sobe para a tela.
    return fetch(original)
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
m04.use(auth)
