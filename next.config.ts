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

// M04 (Agendamento) fala com um backend próprio. Hoje é o mock Prism em :4010 (D20 — o
// backend ainda não existe); troque `M04_ORIGIN` para o staging quando existir. Proxy
// same-origin `/m04-api/*` para evitar CORS, espelhando o `/api/*` acima.
const M04_ORIGIN = process.env.M04_ORIGIN ?? 'http://localhost:4010'

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
