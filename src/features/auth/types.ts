/**
 * Tipos do domínio de autenticação.
 *
 * Espelham as entidades da spec M01 (Cadastro e Acesso). Nesta etapa o foco é
 * a Usuária; Profissional e AdminGeral entram numa fase futura. Os tipos já
 * preveem o perfil para que a camada de sessão não precise mudar depois.
 */

export type Perfil = 'Usuaria' | 'Profissional' | 'AdminGeral'

/** Estados possíveis da conta de uma Usuária (spec M01 · entidade Usuária). */
export type UsuariaStatus =
  | 'Ativa'
  | 'AguardandoConfirmacao'
  | 'Inativa'
  | 'AguardandoDelecao'
  | 'Anonimizada'

export type Plano = 'Gratuito' | 'Premium'

/**
 * Registro completo da Usuária — espelha a linha do "banco".
 * No mock, vive no localStorage simulando a persistência do backend.
 * Num backend real isto fica no servidor e NUNCA é enviado cru ao cliente.
 */
export interface Usuaria {
  id: string
  nome: string
  email: string
  telefone: string
  /** ISO 8601 (YYYY-MM-DD) */
  dataNascimento: string
  googleId?: string
  emailConfirmado: boolean
  recebeComunicacoes: boolean
  fazTratamento?: boolean
  plano: Plano
  status: UsuariaStatus
  criadaEm: string
  atualizadaEm: string
}

/**
 * Projeção segura exposta ao cliente (Data Transfer Object).
 * Só os campos que a UI precisa — sem dados sensíveis.
 */
export interface UsuariaDTO {
  id: string
  nome: string
  email: string
  plano: Plano
  status: UsuariaStatus
  perfil: Perfil
}

/**
 * Sessão autenticada no cliente.
 *
 * No frontend-only o `accessToken` é simulado. Num backend real ele seria um
 * JWT de ~1h e o refresh token (UUID, 30d) viveria num cookie httpOnly —
 * por isso `accessToken` fica isolado aqui, pronto para ser substituído.
 */
export interface Session {
  user: UsuariaDTO
  accessToken: string
  /** epoch ms em que o access token expira */
  expiresAt: number
}

/** Dados retornados pelo Google após o consentimento (mock do userinfo). */
export interface GoogleProfile {
  googleId: string
  email: string
  nome: string
  emailVerificado: boolean
}

// ── Backoffice / AdminGeral ───────────────────────────────────────

/** Membro da equipe interna com acesso ao backoffice (spec M01 · AdminGeral). */
export interface AdminGeral {
  id: string
  nome: string
  email: string
  ativa: boolean
  /**
   * `true` enquanto a senha for a temporária gerada na criação (F12) —
   * obriga a troca no primeiro acesso.
   */
  senhaProvisoria: boolean
  criadaEm: string
}

/** Projeção segura do admin exposta ao cliente. */
/**
 * Quem está logado no backoffice. São dois perfis com a mesma porta e a mesma casca:
 * `AdminGeral` (equipe Entre Ser) e `Profissional` (painel de atendimento). É o `perfil`
 * que decide o menu e o acesso às telas da equipe.
 */
export interface AdminDTO {
  id: string
  nome: string
  email: string
  perfil: Extract<Perfil, 'AdminGeral' | 'Profissional'>
}

/** Sessão autenticada do backoffice (separada da sessão da Usuária). */
export interface AdminSession {
  user: AdminDTO
  accessToken: string
  /** epoch ms em que o access token expira */
  expiresAt: number
}
