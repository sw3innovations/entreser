import createClient, { type Middleware } from 'openapi-fetch'
import { getAccessToken } from '@/lib/http/token-store'
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
const auth: Middleware = {
  async onRequest({ request }) {
    // D20 — uma fonte de token só: reusa a sessão do M01 (token-store), sem duplicar auth.
    const token = getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
}

export const m04 = createClient<paths>({ baseUrl: '/m04-api' })
m04.use(auth)
