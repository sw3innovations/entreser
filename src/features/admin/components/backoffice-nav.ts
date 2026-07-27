import type { ComponentType } from 'react'
import {
  type IconProps,
  HomeIcon,
  ProfissionaisIcon,
  EquipeIcon,
  UsuariasIcon,
  TagsIcon,
  FasesIcon,
  ConteudosIcon,
  TrilhasIcon,
  OnboardingIcon,
  MetricasIcon,
  PerfilIcon,
  ManualIcon,
  AgendaIcon,
  RelogioIcon,
  ValoresIcon,
} from '@/components/ui'

export type BackofficeProfile = 'admin' | 'prof'

export interface NavItem {
  key: string
  label: string
  href: string
  icon: ComponentType<IconProps>
}

export interface NavGroup {
  section: string
  items: NavItem[]
}

/** Navegação do Admin Geral — Início / Pessoas / Conteúdo / Análise. */
export const NAV_ADMIN: NavGroup[] = [
  {
    section: 'Início',
    items: [{ key: 'home', label: 'Início', href: '/admin', icon: HomeIcon }],
  },
  {
    section: 'Pessoas',
    items: [
      { key: 'profissionais', label: 'Profissionais', href: '/admin/profissionais', icon: ProfissionaisIcon },
      { key: 'equipe', label: 'Equipe', href: '/admin/equipe', icon: EquipeIcon },
      { key: 'usuarias', label: 'Usuárias', href: '/admin/usuarias', icon: UsuariasIcon },
    ],
  },
  {
    section: 'Conteúdo',
    items: [
      { key: 'tags', label: 'Tags', href: '/admin/tags', icon: TagsIcon },
      { key: 'fases', label: 'Fases', href: '/admin/fases', icon: FasesIcon },
      { key: 'conteudos', label: 'Conteúdos', href: '/admin/conteudos', icon: ConteudosIcon },
      { key: 'trilhas', label: 'Trilhas', href: '/admin/trilhas', icon: TrilhasIcon },
      { key: 'onboarding', label: 'Onboarding', href: '/admin/onboarding', icon: OnboardingIcon },
    ],
  },
  {
    section: 'Análise',
    items: [{ key: 'metricas', label: 'Métricas', href: '/admin/metricas', icon: MetricasIcon }],
  },
  {
    section: 'Ajuda',
    items: [{ key: 'manual', label: 'Manual', href: '/admin/manual', icon: ManualIcon }],
  },
]

/** Navegação da Profissional — apenas a própria conta. */
export const NAV_PROF: NavGroup[] = [
  {
    section: 'Atendimento',
    items: [
      { key: 'agenda', label: 'Minha agenda', href: '/admin/agenda', icon: AgendaIcon },
      { key: 'horarios', label: 'Meus horários', href: '/admin/horarios', icon: RelogioIcon },
      { key: 'bloqueios', label: 'Bloquear datas', href: '/admin/bloqueios', icon: OnboardingIcon },
      { key: 'valores', label: 'Meus valores', href: '/admin/valores', icon: ValoresIcon },
    ],
  },
  {
    section: 'Conta',
    items: [{ key: 'perfil', label: 'Meu perfil', href: '/admin/perfil', icon: PerfilIcon }],
  },
]

export function getNavGroups(profile: BackofficeProfile): NavGroup[] {
  return profile === 'admin' ? NAV_ADMIN : NAV_PROF
}

const ALL_ITEMS: NavItem[] = [...NAV_ADMIN, ...NAV_PROF].flatMap((g) => g.items)

/**
 * Deriva a chave de navegação ativa a partir do pathname atual.
 * `/admin` casa só exatamente (Início); as demais casam por prefixo, então
 * sub-rotas (`/admin/profissionais/novo`, `/admin/perfil/senha`) destacam o
 * item-pai. Vence o href mais específico (mais longo).
 */
export function getActiveKey(pathname: string): string | null {
  let best: NavItem | null = null
  for (const it of ALL_ITEMS) {
    const matches =
      it.href === '/admin'
        ? pathname === '/admin'
        : pathname === it.href || pathname.startsWith(it.href + '/')
    if (matches && (!best || it.href.length > best.href.length)) best = it
  }
  return best?.key ?? null
}
