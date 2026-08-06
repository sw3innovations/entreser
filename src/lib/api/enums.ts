/**
 * Codecs de enum entre o backend (UPPER_SNAKE / neutro) e o domínio do
 * frontend (PascalCase pt-BR). Mapas EXPLÍCITOS de propósito: `Ativa↔ATIVO` não
 * é uma troca de caixa (feminino→neutro) e `FormatoConteudo` fica PascalCase nos
 * dois lados — um `toUpperCase()` cego estaria errado.
 */

import type { Perfil, Plano, UsuariaStatus } from '@/features/auth/types'
import type { PlanApi, StatusUsuarioApi, UserTypeApi } from './types'

const STATUS_TO_API: Record<UsuariaStatus, StatusUsuarioApi> = {
  Ativa: 'ATIVO',
  Inativa: 'INATIVO',
  AguardandoConfirmacao: 'AGUARDANDO_CONFIRMACAO',
  AguardandoDelecao: 'AGUARDANDO_DELECAO',
  Anonimizada: 'ANONIMIZADA',
}

const STATUS_FROM_API: Record<StatusUsuarioApi, UsuariaStatus> = {
  ATIVO: 'Ativa',
  INATIVO: 'Inativa',
  AGUARDANDO_CONFIRMACAO: 'AguardandoConfirmacao',
  AGUARDANDO_DELECAO: 'AguardandoDelecao',
  ANONIMIZADA: 'Anonimizada',
}

/** Domínio → backend (ex.: body cru de `PATCH /admin/usuarios/{id}/status`). */
export function statusToApi(status: UsuariaStatus): StatusUsuarioApi {
  return STATUS_TO_API[status]
}

/** Backend → domínio, com fallback seguro para valores inesperados. */
export function statusFromApi(status: string): UsuariaStatus {
  return STATUS_FROM_API[status as StatusUsuarioApi] ?? 'Inativa'
}

// Prioridade importa: uma conta com várias roles resolve para a mais privilegiada.
const PERFIL_POR_ROLE: ReadonlyArray<readonly [string, Perfil]> = [
  ['ADMINGERAL', 'AdminGeral'],
  ['PROFISSIONAL', 'Profissional'],
  ['PACIENTE', 'Usuaria'],
]

/**
 * Deriva o perfil a partir de `roles[]` — NUNCA de `userType`, que o backend
 * monta de um Set sem ordem e pode variar (guia §5.4).
 */
export function perfilFromRoles(roles: readonly string[]): Perfil {
  for (const [role, perfil] of PERFIL_POR_ROLE) {
    if (roles.includes(role)) return perfil
  }
  return 'Usuaria'
}

/**
 * Quem pode ENTRAR no backoffice: Admin Geral e Profissional. As duas usam a mesma
 * porta (`/admin/login`) e a mesma casca, mas veem menus diferentes — a profissional
 * só o painel de atendimento (ver `NAV_PROF`).
 */
export function podeEntrarNoBackoffice(roles: readonly string[]): boolean {
  return roles.includes('ADMINGERAL') || roles.includes('PROFISSIONAL')
}

/**
 * Quem pode ENTRAR no app da Usuária: só quem é paciente e NÃO é backoffice. Espelho
 * estrito de `podeEntrarNoBackoffice` — cada perfil entra só pela sua porta. Uma conta que
 * também seja Profissional/Admin usa o `/admin`, nunca esta frente (mesmo tendo PACIENTE);
 * sem essa exclusão, o `/auth/login` unificado deixaria um profissional entrar como usuária.
 */
export function podeEntrarNoApp(roles: readonly string[]): boolean {
  return roles.includes('PACIENTE') && !podeEntrarNoBackoffice(roles)
}

/**
 * É Admin Geral — a checagem para o que é EXCLUSIVO da equipe (usuárias, conteúdos,
 * profissionais, métricas). Não confundir com `podeEntrarNoBackoffice`: uma profissional
 * entra no backoffice sem ser admin.
 */
export function isAdmin(roles: readonly string[]): boolean {
  return roles.includes('ADMINGERAL')
}

/**
 * Perfil de quem está no backoffice. Só faz sentido depois de `podeEntrarNoBackoffice`
 * ter passado — por isso o retorno é estreito (nunca `Usuaria`): quem não é Admin Geral
 * e chegou até aqui é Profissional.
 */
export function perfilBackoffice(roles: readonly string[]): 'AdminGeral' | 'Profissional' {
  return isAdmin(roles) ? 'AdminGeral' : 'Profissional'
}

/** Fallback quando só houver `userType` (menos confiável que `roles[]`). */
export function userTypeToPerfil(userType: UserTypeApi): Perfil {
  if (userType === 'ADMINGERAL') return 'AdminGeral'
  if (userType === 'PROFISSIONAL') return 'Profissional'
  return 'Usuaria'
}

/**
 * Plano (objeto RBAC no backend) → união do frontend. Shape do `Plan` não é
 * documentado (guia §4), então é best-effort pelo nome; sem plano = Gratuito.
 */
export function planoFromApi(plan: PlanApi | null | undefined): Plano {
  const nome = String(plan?.nome ?? '').toLowerCase()
  return nome.includes('premium') ? 'Premium' : 'Gratuito'
}
