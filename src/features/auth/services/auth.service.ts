import type { AdminSession, GoogleProfile, Session } from '../types'
import type {
  CompletarCadastroInput,
  RecuperarSenhaInput,
  RedefinirSenhaInput,
  SignInInput,
  SignUpInput,
} from '../schemas/auth.schema'

/**
 * Contrato da camada de autenticação — o "seam" entre a UI e o backend.
 *
 * Hoje existe a implementação `MockAuthService` (frontend-only). Quando o
 * backend real entrar (Supabase, API própria, etc.), basta criar outra
 * implementação deste contrato e trocar em `services/index.ts`: nenhuma tela
 * precisa mudar.
 *
 * Os métodos lançam `AuthError` (com `codigo` estável) em caso de falha.
 */
export interface AuthService {
  /** F1 — cria a Usuária (status AguardandoConfirmacao) e dispara a confirmação. */
  signUp(input: SignUpInput): Promise<SignUpResult>

  /** F3 — confirma o e-mail via token e ativa a conta. */
  confirmarEmail(token: string): Promise<void>

  /** Reenvia o e-mail de confirmação (telas de aviso). */
  reenviarConfirmacao(email: string): Promise<SignUpResult>

  /** F4 — login com e-mail e senha. */
  signIn(input: SignInInput): Promise<Session>

  /** F2/F5 — inicia o fluxo Google. Retorna uma sessão (conta existente)
   *  ou um pedido de complemento de cadastro (conta nova). */
  signInComGoogle(): Promise<GoogleSignInResult>

  /** Recupera o perfil Google pendente de complemento (após `signInComGoogle`). */
  getPendingGoogle(): Promise<GoogleProfile | null>

  /** F2 — finaliza o cadastro Google com os dados complementares e loga. */
  completarCadastroGoogle(input: CompletarCadastroInput): Promise<Session>

  /** F6 — solicita recuperação de senha (resposta sempre de sucesso). */
  recuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult>

  /** F7 — redefine a senha via token e invalida sessões anteriores. */
  redefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void>

  /**
   * Primeiro acesso da profissional: define a senha a partir do token do convite
   * recebido por e-mail. O token é de uso único e expira — daí o erro dedicado.
   * O backend ativa a conta e devolve a sessão, então já entra no painel.
   */
  profissionalPrimeiroAcesso(token: string, input: RedefinirSenhaInput): Promise<AdminSession>

  /** Retorna a sessão atual persistida, ou null. */
  getSession(): Promise<Session | null>

  /** F9 — encerra a sessão atual. */
  signOut(): Promise<void>

  // ── Backoffice / AdminGeral ─────────────────────────────────────

  /** F4 — login do admin. Retorna a sessão, ou um pedido de troca da
   *  senha provisória no primeiro acesso (F12). */
  adminSignIn(input: SignInInput): Promise<AdminSignInResult>

  /** E-mail do admin com troca de senha pendente (após `adminSignIn`). */
  getPendingAdminChange(): Promise<{ email: string } | null>

  /** F12 — define a nova senha (troca a provisória) e loga o admin. */
  adminTrocarSenhaProvisoria(input: RedefinirSenhaInput): Promise<AdminSession>

  /** F6 — solicita recuperação de senha do admin (resposta sempre de sucesso). */
  adminRecuperarSenha(input: RecuperarSenhaInput): Promise<RecuperarSenhaResult>

  /** F7 — redefine a senha do admin via token e invalida a sessão anterior. */
  adminRedefinirSenha(token: string, input: RedefinirSenhaInput): Promise<void>

  /** Sessão do backoffice persistida, ou null. */
  getAdminSession(): Promise<AdminSession | null>

  /** Encerra a sessão do backoffice. */
  adminSignOut(): Promise<void>
}

export type AdminSignInResult =
  | { tipo: 'sessao'; session: AdminSession }
  | { tipo: 'trocar_senha'; email: string }

export interface SignUpResult {
  email: string
  /**
   * DEV-ONLY: como não há envio de e-mail real no mock, o token de confirmação
   * é devolvido para que o fluxo possa ser testado de ponta a ponta.
   * Num backend real este campo NÃO existe — o token vai só no e-mail.
   */
  devConfirmToken?: string
}

export interface RecuperarSenhaResult {
  /** DEV-ONLY (mesma razão de `devConfirmToken`). */
  devResetToken?: string
}

export type GoogleSignInResult =
  | { tipo: 'sessao'; session: Session }
  | { tipo: 'completar'; profile: GoogleProfile }
