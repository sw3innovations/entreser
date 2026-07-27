import { AuthError } from '../lib/errors'
import { apenasDigitos } from '../schemas/auth.schema'
import type {
  CompletarCadastroInput,
  RecuperarSenhaInput,
  RedefinirSenhaInput,
  SignInInput,
  SignUpInput,
} from '../schemas/auth.schema'
import type {
  AdminDTO,
  AdminGeral,
  AdminSession,
  GoogleProfile,
  Session,
  Usuaria,
  UsuariaDTO,
} from '../types'
import type {
  AdminSignInResult,
  AuthService,
  GoogleSignInResult,
  RecuperarSenhaResult,
  SignUpResult,
} from './auth.service'

/**
 * Implementação MOCK do AuthService (frontend-only).
 *
 * Simula o backend descrito na spec M01 inteiramente no navegador:
 * - "banco" persistido no localStorage (usuárias, tokens);
 * - latência de rede simulada;
 * - tokens de confirmação/recuperação com expiração e marcação de uso;
 * - erros padronizados (AuthError) com os mesmos códigos do contrato.
 *
 * Limitações conscientes (resolvidas pelo backend real):
 * - senha guardada em claro no "banco" mock (o backend guarda só o hash);
 * - access token é um UUID simulado, não um JWT assinado;
 * - não há envio de e-mail: os tokens são devolvidos em campos `dev*` para
 *   permitir testar os fluxos de ponta a ponta.
 */

const DB_KEY = 'entreser.mock.db'
const SESSION_KEY = 'entreser.session'
const PENDING_GOOGLE_KEY = 'entreser.pendingGoogle'
const ADMIN_SESSION_KEY = 'entreser.admin.session'
const PENDING_ADMIN_KEY = 'entreser.admin.pendingChange'

const ACCESS_TOKEN_TTL = 60 * 60 * 1000 // 1h (spec)
const CONFIRM_TOKEN_TTL = 24 * 60 * 60 * 1000 // 24h (spec)
const RESET_TOKEN_TTL = 60 * 60 * 1000 // 1h (spec)

/** Identidade Google fixa usada pelo fluxo simulado (consentimento "fake"). */
const DEMO_GOOGLE: GoogleProfile = {
  googleId: 'google-demo-0001',
  email: 'maria.google@gmail.com',
  nome: 'Maria do Google',
  emailVerificado: true,
}

interface TokenRecord {
  token: string
  usuariaId: string
  expiraEm: number
  usadoEm?: number
}

interface AdminTokenRecord {
  token: string
  adminId: string
  expiraEm: number
  usadoEm?: number
}

interface MockDB {
  usuarias: Usuaria[]
  /** senha em claro — APENAS no mock; o backend real guarda hash no servidor */
  credenciais: Record<string, string>
  tokensConfirmacao: TokenRecord[]
  tokensReset: TokenRecord[]
  admins: AdminGeral[]
  credenciaisAdmin: Record<string, string>
  tokensResetAdmin: AdminTokenRecord[]
}

// ── utilidades ────────────────────────────────────────────────────
const delay = (ms = 550) => new Promise((r) => setTimeout(r, ms))

function novoId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

function agoraIso(): string {
  return new Date().toISOString()
}

function toDTO(u: Usuaria): UsuariaDTO {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    plano: u.plano,
    status: u.status,
    perfil: 'Usuaria',
  }
}

function toAdminDTO(a: AdminGeral): AdminDTO {
  return { id: a.id, nome: a.nome, email: a.email, perfil: 'AdminGeral' }
}

export class MockAuthService implements AuthService {
  // ── persistência ────────────────────────────────────────────────
  private load(): MockDB {
    if (typeof window === 'undefined') return this.seed()
    const raw = window.localStorage.getItem(DB_KEY)
    if (!raw) {
      const db = this.seed()
      this.save(db)
      return db
    }
    try {
      const parsed = JSON.parse(raw) as Partial<MockDB>
      const db = this.normalizar(parsed)
      // Migra "bancos" antigos (sem a seção de admins) gravando uma vez.
      if (parsed.admins === undefined) this.save(db)
      return db
    } catch {
      const db = this.seed()
      this.save(db)
      return db
    }
  }

  private save(db: MockDB): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DB_KEY, JSON.stringify(db))
  }

  /**
   * Garante todos os campos do "banco", preenchendo seções ausentes — ex.: a
   * seção de admins, ao migrar um localStorage gravado antes do backoffice
   * existir.
   */
  private normalizar(db: Partial<MockDB>): MockDB {
    const base = this.seed()
    return {
      usuarias: db.usuarias ?? base.usuarias,
      credenciais: db.credenciais ?? base.credenciais,
      tokensConfirmacao: db.tokensConfirmacao ?? [],
      tokensReset: db.tokensReset ?? [],
      admins: db.admins ?? base.admins,
      credenciaisAdmin: db.credenciaisAdmin ?? base.credenciaisAdmin,
      tokensResetAdmin: db.tokensResetAdmin ?? [],
    }
  }

  /** Semente: uma Usuária já ativa para login imediato em testes manuais. */
  private seed(): MockDB {
    const id = novoId()
    const usuaria: Usuaria = {
      id,
      nome: 'Maria da Silva',
      email: 'maria@entreser.com.br',
      telefone: '83999999999',
      dataNascimento: '1992-05-20',
      emailConfirmado: true,
      recebeComunicacoes: true,
      plano: 'Gratuito',
      status: 'Ativa',
      criadaEm: agoraIso(),
      atualizadaEm: agoraIso(),
    }
    // F13 — admins de seed: uma ativa (login direto) e uma com senha
    // provisória (exercita a troca no primeiro acesso, F12).
    const adminId = novoId()
    const novoMembroId = novoId()
    return {
      usuarias: [usuaria],
      credenciais: { [id]: 'Entre123' },
      tokensConfirmacao: [],
      tokensReset: [],
      admins: [
        {
          id: adminId,
          nome: 'Equipe Entre Ser',
          email: 'admin@entreser.com.br',
          ativa: true,
          senhaProvisoria: false,
          criadaEm: agoraIso(),
        },
        {
          id: novoMembroId,
          nome: 'Novo Membro',
          email: 'equipe@entreser.com.br',
          ativa: true,
          senhaProvisoria: true,
          criadaEm: agoraIso(),
        },
      ],
      credenciaisAdmin: { [adminId]: 'Admin123', [novoMembroId]: 'Temp1234' },
      tokensResetAdmin: [],
    }
  }

  private acharPorEmail(db: MockDB, email: string): Usuaria | undefined {
    const e = normalizarEmail(email)
    return db.usuarias.find((u) => u.email === e)
  }

  private criarSessao(u: Usuaria): Session {
    const session: Session = {
      user: toDTO(u),
      accessToken: novoId(),
      expiresAt: Date.now() + ACCESS_TOKEN_TTL,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    return session
  }

  private acharAdminPorEmail(db: MockDB, email: string): AdminGeral | undefined {
    const e = normalizarEmail(email)
    return db.admins.find((a) => a.email === e)
  }

  private criarAdminSessao(a: AdminGeral): AdminSession {
    const session: AdminSession = {
      user: toAdminDTO(a),
      accessToken: novoId(),
      expiresAt: Date.now() + ACCESS_TOKEN_TTL,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
    }
    return session
  }

  // ── F1: cadastro ────────────────────────────────────────────────
  async signUp(input: SignUpInput): Promise<SignUpResult> {
    await delay()
    const db = this.load()
    const email = normalizarEmail(input.email)

    if (this.acharPorEmail(db, email)) {
      throw new AuthError('EMAIL_JA_CADASTRADO', { campo: 'email' })
    }

    const id = novoId()
    const usuaria: Usuaria = {
      id,
      nome: input.nome.trim(),
      email,
      telefone: apenasDigitos(input.telefone),
      dataNascimento: input.dataNascimento,
      emailConfirmado: false,
      recebeComunicacoes: true,
      plano: 'Gratuito',
      status: 'AguardandoConfirmacao',
      criadaEm: agoraIso(),
      atualizadaEm: agoraIso(),
    }
    db.usuarias.push(usuaria)
    db.credenciais[id] = input.senha

    const token = novoId()
    db.tokensConfirmacao.push({
      token,
      usuariaId: id,
      expiraEm: Date.now() + CONFIRM_TOKEN_TTL,
    })
    this.save(db)

    return { email, devConfirmToken: token }
  }

  // ── F3: confirmação de e-mail ───────────────────────────────────
  async confirmarEmail(token: string): Promise<void> {
    await delay()
    const db = this.load()
    const registro = db.tokensConfirmacao.find((t) => t.token === token)

    if (!registro) throw new AuthError('TOKEN_NAO_ENCONTRADO')
    if (registro.usadoEm) throw new AuthError('TOKEN_JA_USADO')
    if (registro.expiraEm < Date.now()) throw new AuthError('TOKEN_EXPIRADO')

    const usuaria = db.usuarias.find((u) => u.id === registro.usuariaId)
    if (!usuaria) throw new AuthError('TOKEN_NAO_ENCONTRADO')

    usuaria.emailConfirmado = true
    usuaria.status = 'Ativa'
    usuaria.atualizadaEm = agoraIso()
    registro.usadoEm = Date.now()
    this.save(db)
  }

  async reenviarConfirmacao(email: string): Promise<SignUpResult> {
    await delay()
    const db = this.load()
    const usuaria = this.acharPorEmail(db, email)
    const normalizado = normalizarEmail(email)

    // Não revela se o e-mail existe nem se já está confirmado.
    if (!usuaria || usuaria.emailConfirmado) {
      return { email: normalizado }
    }

    const token = novoId()
    db.tokensConfirmacao.push({
      token,
      usuariaId: usuaria.id,
      expiraEm: Date.now() + CONFIRM_TOKEN_TTL,
    })
    this.save(db)
    return { email: normalizado, devConfirmToken: token }
  }

  // ── F4: login e-mail/senha ──────────────────────────────────────
  async signIn(input: SignInInput): Promise<Session> {
    await delay()
    const db = this.load()
    const usuaria = this.acharPorEmail(db, input.email)

    // 401 genérico — não revela qual campo está errado (spec F4).
    if (!usuaria || db.credenciais[usuaria.id] !== input.senha) {
      throw new AuthError('CREDENCIAIS_INVALIDAS')
    }
    if (!usuaria.emailConfirmado) {
      throw new AuthError('EMAIL_NAO_CONFIRMADO', { campo: 'email' })
    }
    if (usuaria.status !== 'Ativa') {
      throw new AuthError('CONTA_INATIVA')
    }
    return this.criarSessao(usuaria)
  }

  // ── F2/F5: Google ───────────────────────────────────────────────
  async signInComGoogle(): Promise<GoogleSignInResult> {
    await delay()
    const db = this.load()
    const existente = db.usuarias.find(
      (u) => u.googleId === DEMO_GOOGLE.googleId || u.email === DEMO_GOOGLE.email,
    )

    if (existente) {
      if (!existente.googleId) {
        existente.googleId = DEMO_GOOGLE.googleId
        existente.atualizadaEm = agoraIso()
        this.save(db)
      }
      return { tipo: 'sessao', session: this.criarSessao(existente) }
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_GOOGLE_KEY, JSON.stringify(DEMO_GOOGLE))
    }
    return { tipo: 'completar', profile: DEMO_GOOGLE }
  }

  async getPendingGoogle(): Promise<GoogleProfile | null> {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(PENDING_GOOGLE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as GoogleProfile
    } catch {
      return null
    }
  }

  async completarCadastroGoogle(input: CompletarCadastroInput): Promise<Session> {
    await delay()
    const pending = await this.getPendingGoogle()
    if (!pending) throw new AuthError('ERRO_INESPERADO')
    if (!pending.emailVerificado) throw new AuthError('EMAIL_NAO_VERIFICADO_GOOGLE')

    const db = this.load()
    let usuaria = this.acharPorEmail(db, pending.email)

    if (usuaria) {
      // Conta já existe (com senha): vincula o googleId.
      usuaria.googleId = pending.googleId
      usuaria.telefone = apenasDigitos(input.telefone)
      usuaria.dataNascimento = input.dataNascimento
      usuaria.atualizadaEm = agoraIso()
    } else {
      usuaria = {
        id: novoId(),
        nome: pending.nome,
        email: normalizarEmail(pending.email),
        telefone: apenasDigitos(input.telefone),
        dataNascimento: input.dataNascimento,
        googleId: pending.googleId,
        emailConfirmado: true, // Google já confirmou
        recebeComunicacoes: true,
        plano: 'Gratuito',
        status: 'Ativa',
        criadaEm: agoraIso(),
        atualizadaEm: agoraIso(),
      }
      db.usuarias.push(usuaria)
    }
    this.save(db)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_GOOGLE_KEY)
    }
    return this.criarSessao(usuaria)
  }

  // ── F6/F7: recuperação de senha ─────────────────────────────────
  async recuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult> {
    await delay()
    const db = this.load()
    const usuaria = this.acharPorEmail(db, input.email)

    // Resposta sempre de sucesso — não revela se o e-mail existe (spec F6).
    if (!usuaria) return {}

    const token = novoId()
    db.tokensReset.push({
      token,
      usuariaId: usuaria.id,
      expiraEm: Date.now() + RESET_TOKEN_TTL,
    })
    this.save(db)
    return { devResetToken: token }
  }

  async redefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void> {
    await delay()
    const db = this.load()
    const registro = db.tokensReset.find((t) => t.token === token)

    if (!registro) throw new AuthError('TOKEN_NAO_ENCONTRADO')
    if (registro.usadoEm) throw new AuthError('TOKEN_JA_USADO')
    if (registro.expiraEm < Date.now()) throw new AuthError('TOKEN_EXPIRADO')

    db.credenciais[registro.usuariaId] = input.senha
    registro.usadoEm = Date.now()
    this.save(db)

    // F7 passo 7 — invalida sessões ativas do owner.
    const session = await this.getSession()
    if (session && session.user.id === registro.usuariaId) {
      await this.signOut()
    }
  }

  /**
   * Primeiro acesso da profissional. O mock não semeia convites de profissional (o fluxo
   * nasce no backoffice, que já roda contra o backend real), então aqui só existe o
   * caminho de token inexistente — o suficiente para a tela ser exercitada sem servidor.
   */
  async profissionalPrimeiroAcesso(): Promise<AdminSession> {
    await delay()
    throw new AuthError('TOKEN_NAO_ENCONTRADO')
  }

  // ── sessão ──────────────────────────────────────────────────────
  async getSession(): Promise<Session | null> {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      const session = JSON.parse(raw) as Session
      if (session.expiresAt < Date.now()) {
        window.localStorage.removeItem(SESSION_KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  }

  async signOut(): Promise<void> {
    await delay(200)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY)
    }
  }

  // ── Backoffice / AdminGeral ─────────────────────────────────────
  async adminSignIn(input: SignInInput): Promise<AdminSignInResult> {
    await delay()
    const db = this.load()
    const admin = this.acharAdminPorEmail(db, input.email)

    // 401 genérico — não revela qual campo está errado, nem que não é admin.
    if (!admin || db.credenciaisAdmin[admin.id] !== input.senha) {
      throw new AuthError('CREDENCIAIS_INVALIDAS')
    }
    if (!admin.ativa) {
      throw new AuthError('CONTA_INATIVA')
    }

    // F12 — senha provisória: exige troca antes de acessar o painel.
    if (admin.senhaProvisoria) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PENDING_ADMIN_KEY, admin.id)
      }
      return { tipo: 'trocar_senha', email: admin.email }
    }

    return { tipo: 'sessao', session: this.criarAdminSessao(admin) }
  }

  async getPendingAdminChange(): Promise<{ email: string } | null> {
    if (typeof window === 'undefined') return null
    const adminId = window.localStorage.getItem(PENDING_ADMIN_KEY)
    if (!adminId) return null
    const admin = this.load().admins.find((a) => a.id === adminId)
    return admin ? { email: admin.email } : null
  }

  async adminTrocarSenhaProvisoria(input: RedefinirSenhaInput): Promise<AdminSession> {
    await delay()
    const adminId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(PENDING_ADMIN_KEY)
        : null
    if (!adminId) throw new AuthError('NAO_AUTENTICADO')

    const db = this.load()
    const admin = db.admins.find((a) => a.id === adminId)
    if (!admin) throw new AuthError('NAO_AUTENTICADO')

    db.credenciaisAdmin[admin.id] = input.senha
    admin.senhaProvisoria = false
    this.save(db)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_ADMIN_KEY)
    }
    return this.criarAdminSessao(admin)
  }

  async adminRecuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult> {
    await delay()
    const db = this.load()
    const admin = this.acharAdminPorEmail(db, input.email)

    // Resposta sempre de sucesso — não revela se o e-mail existe (spec F6).
    if (!admin) return {}

    const token = novoId()
    db.tokensResetAdmin.push({
      token,
      adminId: admin.id,
      expiraEm: Date.now() + RESET_TOKEN_TTL,
    })
    this.save(db)
    return { devResetToken: token }
  }

  async adminRedefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void> {
    await delay()
    const db = this.load()
    const registro = db.tokensResetAdmin.find((t) => t.token === token)

    if (!registro) throw new AuthError('TOKEN_NAO_ENCONTRADO')
    if (registro.usadoEm) throw new AuthError('TOKEN_JA_USADO')
    if (registro.expiraEm < Date.now()) throw new AuthError('TOKEN_EXPIRADO')

    const admin = db.admins.find((a) => a.id === registro.adminId)
    if (admin) admin.senhaProvisoria = false
    db.credenciaisAdmin[registro.adminId] = input.senha
    registro.usadoEm = Date.now()
    this.save(db)

    // Invalida a sessão do backoffice do owner, se for a atual.
    const session = await this.getAdminSession()
    if (session && session.user.id === registro.adminId) {
      await this.adminSignOut()
    }
  }

  async getAdminSession(): Promise<AdminSession | null> {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    try {
      const session = JSON.parse(raw) as AdminSession
      if (session.expiresAt < Date.now()) {
        window.localStorage.removeItem(ADMIN_SESSION_KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  }

  async adminSignOut(): Promise<void> {
    await delay(200)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_SESSION_KEY)
    }
  }
}
