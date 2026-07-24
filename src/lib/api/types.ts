/**
 * Contratos do backend (Spring Boot · REST/JWT).
 *
 * Espelham EXATAMENTE o que a API devolve — enums em UPPER_SNAKE, sem envelope
 * `{ data, error }`. A tradução para os tipos de domínio do frontend (PascalCase
 * pt-BR) acontece nos adaptadores (`ApiAuthService`, `ApiXService`) usando os
 * codecs de `@/lib/api/enums`. Fonte: `Claude/docs-backend/guia-integracao-backend.md` §4.
 */

/** Estado da conta no backend (StatusUsuario). */
export type StatusUsuarioApi =
  | 'ATIVO'
  | 'INATIVO'
  | 'AGUARDANDO_CONFIRMACAO'
  | 'AGUARDANDO_DELECAO'
  | 'ANONIMIZADA'

/** Tipo de usuário derivado das roles (pode ser não-determinístico — preferir `roles[]`). */
export type UserTypeApi = 'PACIENTE' | 'PROFISSIONAL' | 'ADMINGERAL'

/** Formato de conteúdo — o backend mantém PascalCase (NÃO é UPPER_SNAKE). */
export type FormatoConteudoApi = 'Artigo' | 'Video' | 'Audio' | 'Imagem'

/** Origem da fase da paciente (FasePaciente). */
export type OrigemFaseApi = 'Onboarding' | 'EscolhaManual'

export interface CidadeApi {
  id: string
  nome: string
}

export interface EstadoApi {
  id: string
  nome: string
  uf?: string
}

export interface EnderecoApi {
  id: string
  /** String livre no backend (não há enum EnderecoTipo). */
  tipo: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  apelido?: string
  principal: boolean
  cidade: CidadeApi
  estado: EstadoApi
}

/**
 * Resposta de `POST /auth/login` (e de `/auth/refresh`, `/auth/primeiro-acesso`).
 *
 * É PLANA. Desde 14/jul o backend também devolve `id`, `email` e `plano` (este só
 * quando a paciente tem plano atribuído) — então a UsuariaDTO é montada só a
 * partir daqui, sem o antigo `GET /paciente/perfil`. O refresh token chega em
 * cookie HttpOnly (invisível ao JS).
 */
export interface LoginResponse {
  accessToken: string
  roles: string[]
  userType: UserTypeApi
  nome: string
  status: StatusUsuarioApi
  exigirTrocaSenha: boolean
  enderecos: EnderecoApi[]
  /** Desde 14/jul: id/email do usuário no próprio login/refresh. */
  id?: string
  email?: string
  /** Só quando a paciente tem plano atribuído (objeto RBAC). */
  plano?: PlanApi
}

/** Plano da paciente — no backend é um objeto (RBAC), não um enum simples. */
export interface PlanApi {
  id?: string
  nome?: string
  [chave: string]: unknown
}

/** Dados de `GET /api/v1/paciente/perfil` — hidrata o que o login não devolve. */
export interface PacienteApi {
  id: string
  nome: string
  email: string
  telefone?: string
  dataNascimento?: string
  status: StatusUsuarioApi
  emailConfirmado?: boolean
  recebeComunicacoes?: boolean
  fazTratamento?: boolean
  enderecos?: EnderecoApi[]
  roles?: string[]
  plan?: PlanApi
}

/** Wrapper de página do Spring Data (usado em `/feed` e listas paginadas). */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  /** página atual (0-based). */
  number: number
  size: number
  first: boolean
  last: boolean
}
