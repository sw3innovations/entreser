import type { NextConfig } from 'next'

/**
 * Proxy same-origin para o backend Spring Boot em desenvolvimento.
 *
 * Mantém app e API sob a MESMA origem (localhost:3000) para que o cookie de
 * refresh (HttpOnly, SameSite=Lax, Path=/api/v1/auth) seja enviado nas chamadas
 * a `/auth/refresh` e `/auth/logout`. Sem o proxy, o browser em localhost:3000
 * falaria cross-site com api.entreser.sw3.tec.br e o cookie Lax não viajaria.
 * Em produção, sirva app e API same-site (mesmo registrable domain) e o proxy
 * deixa de ser necessário.
 *
 *   /api/*                    → REST autenticado (/api/v1/...)
 *   /oauth2/authorization/*   → início do fluxo OAuth2 (SEM /api/v1)
 *   /usuaria/*                → rotas legadas da paciente (SEM /api/v1)
 *
 * `/oauth2/redirect` NÃO é reescrito de propósito: é uma rota real do App Router
 * que captura o `?token=` devolvido pelo backend.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'https://api.entreser.sw3.tec.br'

/**
 * Proxy same-origin `/m04-api/*` do M04 (Agendamento), espelhando o `/api/*` acima.
 *
 * O padrão é o MESMO host do resto da API porque hoje é o mesmo Spring: ele serve
 * `/api/v1/...` (M01/M05) e as rotas do M04 na raiz. `M04_ORIGIN` continua existindo para
 * apontar para outro ambiente — em `.env.local` ela manda o dev local para o `dev-api`.
 *
 * **O padrão já foi `http://localhost:4010`** (o mock Prism de quando o backend do M04 não
 * existia), e isso derrubou o módulo inteiro em homologação: sem a variável definida na
 * hospedagem, a Vercel resolvia `localhost`, via IP privado e recusava o proxy com
 * `404 DNS_HOSTNAME_RESOLVED_PRIVATE`. O `/api/*` passou ileso pelo mesmo esquecimento
 * só porque o padrão dele já era público — era a assimetria entre as duas linhas que
 * transformava "variável esquecida" em 404 silencioso aqui e em nada ali.
 *
 * Herdar de `BACKEND_ORIGIN` também impede que os dois destinos divirjam por engano.
 */
const M04_ORIGIN = process.env.M04_ORIGIN ?? BACKEND_ORIGIN

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: '/m04-api/:path*', destination: `${M04_ORIGIN}/:path*` },
      {
        source: '/oauth2/authorization/:path*',
        destination: `${BACKEND_ORIGIN}/oauth2/authorization/:path*`,
      },
      // Callback do Google (Spring Security). Só necessário se o `redirect_uri`
      // do OAuth voltar pela origem do frontend; proxyamos same-origin como o
      // resto. NÃO reescrever `/oauth2/redirect` — é rota real do App Router que
      // captura o `?token=`.
      { source: '/login/oauth2/:path*', destination: `${BACKEND_ORIGIN}/login/oauth2/:path*` },
      { source: '/usuaria/:path*', destination: `${BACKEND_ORIGIN}/usuaria/:path*` },
    ]
  },
}

export default nextConfig
