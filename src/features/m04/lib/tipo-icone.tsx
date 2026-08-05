import type { ComponentType } from 'react'
import {
  UserIcon,
  HeartIcon,
  CompassIcon,
  MessageCircleIcon,
  UsersIcon,
  SparkleIcon,
} from '@/features/usuaria/ui'
import type { components } from '@/features/m04/api/schema'

type Codigo = components['schemas']['TipoSessao']
type IconeComponent = ComponentType<{ size?: number; className?: string }>

/** Ícone por tipo de sessão — por `codigo` (nunca por posição/índice), com fallback
 * genérico para qualquer código futuro que o catálogo (`GET /tipos-sessao`) venha a trazer. */
const ICONE_DO_TIPO: Partial<Record<Codigo, IconeComponent>> = {
  Individual: UserIcon,
  Casal: HeartIcon,
  Consultoria: CompassIcon,
  RodaConversa: MessageCircleIcon,
  TerapiaGrupo: UsersIcon,
}

export function iconeDoTipo(codigo: Codigo): IconeComponent {
  return ICONE_DO_TIPO[codigo] ?? SparkleIcon
}
