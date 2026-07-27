import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getAccessTokenClaims,
  getAccessTokenExpiry,
  refreshSession,
  request,
  setAccessToken,
} from '@/lib/http'
import { podeEntrarNoBackoffice, perfilBackoffice, perfilFromRoles, planoFromApi, statusFromApi } from '@/lib/api/enums'
import type { LoginResponse } from '@/lib/api/types'
import { AuthError } from '../lib/errors'
import { apenasDigitos } from '../schemas/auth.schema'
import type {
  RecuperarSenhaInput,
  RedefinirSenhaInput,
  SignInInput,
  SignUpInput,
} from '../schemas/auth.schema'
import type { AdminDTO, AdminSession, GoogleProfile, Session, UsuariaDTO } from '../types'
import type {
  AdminSignInResult,
  AuthService,
  GoogleSignInResult,
  RecuperarSenhaResult,
  SignUpResult,
} from './auth.service'

/**
 * Implementação REAL do AuthService contra o backend Spring Boot (JWT).
 *
 * Mantém EXATAMENTE o contrato do `AuthService` (mesmos `Session`/`AdminSession`
 * do mock), reconciliando por trás do seam:
 * - login UNIFICADO (`POST /auth/login`) — roteia por `roles[]`, não `userType`;
 * - a resposta do login/refresh já traz `id`/`email`/`plano` (desde 14/jul) → a
 *   UsuariaDTO é montada direto, sem o antigo `GET /paciente/perfil` serial;
 * - access token vive em memória (token-store); refresh via cookie httpOnly;
 * - `getSession`/`getAdminSession` reidratam por `POST /auth/refresh` (sem GET /session);
 * - erros heterogêneos (§5.2) são traduzidos para `AuthError` — nenhuma tela muda.
 */

/** Estado do primeiro acesso do admin (troca de senha provisória), em memória. */
let pendingAdmin: { email: string; nome: string } | null = null

const norm = (email: string): string => email.trim().toLowerCase()

export class ApiAuthService implements AuthService {
  // ── helpers de sessão ───────────────────────────────────────────
  private expiresAt(): number {
    return getAccessTokenExpiry() ?? Date.now() + 60 * 60 * 1000
  }

  private claim(nome: string): string {
    const valor = getAccessTokenClaims()?.[nome]
    return typeof valor === 'string' ? valor : ''
  }

  /**
   * Monta a UsuariaDTO a partir do próprio login/refresh — que desde 14/jul traz
   * `id`/`email`/`plano`. Elimina o `GET /paciente/perfil` serial que bloqueava o
   * gate de auth (o `nome` já vinha no login; faltava só o `plano`). Claims do JWT
   * ficam como fallback caso o backend omita `id`/`email`.
   */
  private buildUsuaria(login: LoginResponse, emailFallback = ''): UsuariaDTO {
    return {
      id: login.id || this.claim('sub'),
      nome: login.nome,
      email: login.email || emailFallback || this.claim('email'),
      plano: planoFromApi(login.plano),
      status: statusFromApi(login.status),
      perfil: perfilFromRoles(login.roles),
    }
  }

  private buildAdminDTO(login: LoginResponse, emailFallback = ''): AdminDTO {
    return {
      id: login.id || this.claim('sub'),
      nome: login.nome,
      email: login.email || emailFallback || this.claim('email'),
      // Deriva de `roles[]` — o backoffice recebe Admin Geral E Profissional, e é este
      // campo que decide o menu e o acesso às telas da equipe. Cravar 'AdminGeral' daria
      // à profissional a navegação de admin.
      perfil: perfilBackoffice(login.roles),
    }
  }

  // ── F1: cadastro ────────────────────────────────────────────────
  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const email = norm(input.email)
    try {
      await request('/auth/cadastro', {
        method: 'POST',
        auth: false,
        responseType: 'text',
        body: {
          nome: input.nome.trim(),
          email,
          telefone: apenasDigitos(input.telefone),
          dataNascimento: input.dataNascimento,
          senha: input.senha,
          termos: true,
        },
      })
      return { email }
    } catch (erro) {
      throw toAuthError(erro, 'cadastro')
    }
  }

  // ── F3: confirmação de e-mail ───────────────────────────────────
  async confirmarEmail(token: string): Promise<void> {
    try {
      await request('/auth/confirmar-email', {
        method: 'POST',
        auth: false,
        responseType: 'text',
        body: { token },
      })
    } catch (erro) {
      throw toAuthError(erro, 'token')
    }
  }

  async reenviarConfirmacao(email: string): Promise<SignUpResult> {
    // `POST /auth/reenviar-confirmacao` (backend commit 26abf8ee) — idempotente
    // (200 mesmo se o e-mail não existir, sem revelar cadastro) e com rate limit
    // (429 → RATE_LIMITED). Não devolve corpo útil; só reprovamos em erro real.
    const e = norm(email)
    try {
      await request('/auth/reenviar-confirmacao', {
        method: 'POST',
        auth: false,
        responseType: 'text',
        body: { email: e },
      })
    } catch (erro) {
      throw toAuthError(erro, 'cadastro')
    }
    return { email: e }
  }

  // ── F4: login ───────────────────────────────────────────────────
  async signIn(input: SignInInput): Promise<Session> {
    const email = norm(input.email)
    let login: LoginResponse
    try {
      login = await request<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        retryOn401: false,
        body: { email, senha: input.senha },
      })
    } catch (erro) {
      throw toAuthError(erro, 'login')
    }
    setAccessToken(login.accessToken)
    // TODO(backend): exigirTrocaSenha para paciente ainda não tem tela dedicada
    // (só o admin trata). Por ora, segue com a sessão válida emitida pelo backend.
    const user = this.buildUsuaria(login, email)
    return { user, accessToken: login.accessToken, expiresAt: this.expiresAt() }
  }

  // ── F2/F5: Google (redirect real) ───────────────────────────────
  async signInComGoogle(): Promise<GoogleSignInResult> {
    if (typeof window !== 'undefined') {
      // Guia §2.2: navegação de browser para o backend (SEM /api/v1). O retorno
      // acontece em /oauth2/redirect?token=. A página navega; nada mais roda.
      window.location.href = `${window.location.origin}/oauth2/authorization/google`
    }
    return new Promise<GoogleSignInResult>(() => {
      /* nunca resolve: o browser sai da página */
    })
  }

  async getPendingGoogle(): Promise<GoogleProfile | null> {
    // No fluxo real o Google volta com sessão pronta — não há perfil pendente.
    return null
  }

  async completarCadastroGoogle(): Promise<Session> {
    // TODO(backend): sem endpoint de complemento pós-Google (guia §2.2).
    // Inalcançável no fluxo real (o token já chega em /oauth2/redirect).
    throw new AuthError('ERRO_INESPERADO')
  }

  // ── F6/F7: recuperação de senha ─────────────────────────────────
  async recuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult> {
    try {
      await request('/auth/recuperar-senha', {
        method: 'POST',
        auth: false,
        responseType: 'text',
        body: { email: norm(input.email) },
      })
    } catch {
      // Resposta sempre neutra (guia §2.5) — não revela se o e-mail existe.
    }
    return {}
  }

  async redefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void> {
    try {
      await request('/auth/redefinir-senha', {
        method: 'POST',
        auth: false,
        responseType: 'text',
        body: { token, novaSenha: input.senha },
      })
    } catch (erro) {
      throw toAuthError(erro, 'token')
    }
  }

  /**
   * Primeiro acesso da profissional (`POST /auth/profissional/primeiro-acesso`). O corpo
   * usa `senha` (não `novaSenha`, como o redefinir) — é outro endpoint, com outro contrato.
   * Token inválido ou já usado volta 410, que `toAuthError` mapeia como token expirado.
   *
   * O backend ATIVA a conta e já devolve a sessão (mesmo corpo do login, mais o cookie de
   * refresh). Aproveitamos: a profissional entra direto no painel, sem passar pelo login
   * logo depois de criar a senha.
   */
  async profissionalPrimeiroAcesso(
    token: string,
    input: RedefinirSenhaInput,
  ): Promise<AdminSession> {
    let login: LoginResponse
    try {
      login = await request<LoginResponse>('/auth/profissional/primeiro-acesso', {
        method: 'POST',
        auth: false,
        retryOn401: false,
        body: { token, senha: input.senha },
      })
    } catch (erro) {
      throw toAuthError(erro, 'token')
    }
    setAccessToken(login.accessToken)
    return {
      user: this.buildAdminDTO(login),
      accessToken: login.accessToken,
      expiresAt: this.expiresAt(),
    }
  }

  // ── sessão ──────────────────────────────────────────────────────
  async getSession(): Promise<Session | null> {
    const login = await refreshSession()
    if (!login || !login.roles.includes('PACIENTE')) return null
    const user = this.buildUsuaria(login)
    return { user, accessToken: login.accessToken, expiresAt: this.expiresAt() }
  }

  async signOut(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST', responseType: 'void', retryOn401: false })
    } catch {
      // logout é best-effort; limpamos o token localmente de qualquer forma.
    }
    clearAccessToken()
  }

  // ── Backoffice / AdminGeral (mesmo /auth/login) ─────────────────
  async adminSignIn(input: SignInInput): Promise<AdminSignInResult> {
    const email = norm(input.email)
    let login: LoginResponse
    try {
      login = await request<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        retryOn401: false,
        body: { email, senha: input.senha },
      })
    } catch (erro) {
      throw toAuthError(erro, 'login')
    }
    if (!podeEntrarNoBackoffice(login.roles)) {
      // Nem admin nem profissional — não revela o motivo (mesma resposta de credencial
      // inválida). Uma usuária comum entra pelo `/login`, não por aqui.
      clearAccessToken()
      throw new AuthError('CREDENCIAIS_INVALIDAS')
    }
    setAccessToken(login.accessToken)
    if (login.exigirTrocaSenha) {
      pendingAdmin = { email, nome: login.nome }
      return { tipo: 'trocar_senha', email }
    }
    const session: AdminSession = {
      user: this.buildAdminDTO(login, email),
      accessToken: login.accessToken,
      expiresAt: this.expiresAt(),
    }
    return { tipo: 'sessao', session }
  }

  async getPendingAdminChange(): Promise<{ email: string } | null> {
    return pendingAdmin ? { email: pendingAdmin.email } : null
  }

  async adminTrocarSenhaProvisoria(input: RedefinirSenhaInput): Promise<AdminSession> {
    if (!pendingAdmin) throw new AuthError('NAO_AUTENTICADO')
    try {
      // Backend já emitiu um token válido no login; alteramos a senha com ele.
      await request('/auth/alterar-senha', {
        method: 'POST',
        responseType: 'text',
        body: { novaSenha: input.senha },
      })
    } catch (erro) {
      throw toAuthError(erro, 'generic')
    }
    const session: AdminSession = {
      user: {
        id: this.claim('sub'),
        nome: pendingAdmin.nome,
        email: pendingAdmin.email,
        perfil: 'AdminGeral',
      },
      accessToken: getAccessToken() ?? '',
      expiresAt: this.expiresAt(),
    }
    pendingAdmin = null
    return session
  }

  async adminRecuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult> {
    // Mesmo endpoint unificado da paciente.
    return this.recuperarSenha(input)
  }

  async adminRedefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void> {
    // Mesmo endpoint unificado da paciente.
    return this.redefinirSenha(token, input)
  }

  async getAdminSession(): Promise<AdminSession | null> {
    const login = await refreshSession()
    if (!login || !podeEntrarNoBackoffice(login.roles)) return null
    return {
      user: this.buildAdminDTO(login),
      accessToken: getAccessToken() ?? '',
      expiresAt: this.expiresAt(),
    }
  }

  async adminSignOut(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST', responseType: 'void', retryOn401: false })
    } catch {
      /* best-effort */
    }
    clearAccessToken()
  }
}

/** Contexto para desambiguar mensagens de erro por tipo de operação. */
type ErroCtx = 'login' | 'cadastro' | 'token' | 'generic'

/**
 * Traduz o `ApiError` (heterogêneo, sem envelope — guia §5.2) para `AuthError`
 * com código estável. Como o backend não devolve `{ code }`, a decisão é por
 * status HTTP + sniff do corpo cru (ex.: 403 = e-mail não confirmado OU inativo).
 */
function toAuthError(erro: unknown, ctx: ErroCtx): AuthError {
  if (erro instanceof AuthError) return erro
  if (!(erro instanceof ApiError)) return new AuthError('ERRO_INESPERADO')
  const body = erro.bodyText.toLowerCase()
  switch (erro.kind) {
    case 'unauthorized':
      return new AuthError('CREDENCIAIS_INVALIDAS')
    case 'forbidden':
      return body.includes('confirm')
        ? new AuthError('EMAIL_NAO_CONFIRMADO', { campo: 'email' })
        : new AuthError('CONTA_INATIVA')
    case 'conflict':
      return new AuthError('EMAIL_JA_CADASTRADO', { campo: 'email' })
    case 'rate_limited':
      return new AuthError('RATE_LIMITED')
    case 'bad_request':
    case 'not_found':
      if (ctx === 'cadastro' && body.includes('cadastr')) {
        return new AuthError('EMAIL_JA_CADASTRADO', { campo: 'email' })
      }
      if (ctx === 'token') {
        if (body.includes('expir')) return new AuthError('TOKEN_EXPIRADO')
        if (body.includes('utiliz') || body.includes('usad')) return new AuthError('TOKEN_JA_USADO')
        return new AuthError('TOKEN_NAO_ENCONTRADO')
      }
      // Sem código específico: mostra a mensagem REAL do backend (ex.: o mapa de
      // validação por campo do cadastro) em vez de um genérico que a esconde.
      return new AuthError('DADOS_INVALIDOS', { mensagem: mensagemBackend(erro) })
    default:
      return new AuthError('ERRO_INESPERADO', { mensagem: mensagemBackend(erro) })
  }
}

/**
 * Extrai a mensagem humana que o backend mandou no corpo do erro. O backend não
 * tem envelope (guia §5.2), então o corpo pode ser: texto cru
 * (`"Credenciais inválidas."`), um objeto `{ message }`/`{ error }`, ou — no
 * cadastro — um MAPA de validação por campo (`{ email: "...", senha: "..." }`),
 * caso em que juntamos todas as mensagens. Retorna `undefined` quando não há nada
 * legível (aí o `AuthError` usa o texto amigável padrão do código).
 */
function mensagemBackend(erro: ApiError): string | undefined {
  const corpo = erro.body
  if (corpo && typeof corpo === 'object') {
    const o = corpo as Record<string, unknown>
    for (const chave of ['message', 'error', 'mensagem']) {
      const v = o[chave]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    // Mapa de validação por campo: junta as mensagens (todas strings).
    const msgs = Object.values(o).filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    if (msgs.length) return msgs.join(' ')
    return undefined
  }
  const txt = erro.bodyText.trim()
  // Texto cru só serve se não for JSON/HTML (o `{` já teria caído no ramo acima).
  if (txt && !/^[[{<]/.test(txt)) return txt
  return undefined
}
