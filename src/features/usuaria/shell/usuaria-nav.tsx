import { HomeIcon, ConteudosIcon, TrilhasIcon, FasesIcon, PerfilIcon } from '@/components/ui'
import type { BottomNavItem } from '../ui'

/**
 * Áreas de CONTEÚDO do app da Usuária (Início, Feed, Trilhas, Minha fase). É a
 * lista usada pela navegação central do header (desktop) — onde a conta já vive
 * no menu à direita, então "Conta" NÃO entra aqui. Abas de outros módulos
 * (Social, Agendar, Diário) entram quando forem construídas, sem tocar no shell.
 */
export const USUARIA_NAV: BottomNavItem[] = [
  { key: 'home', label: 'Início', href: '/home', icon: <HomeIcon /> },
  { key: 'feed', label: 'Feed', href: '/feed', icon: <ConteudosIcon /> },
  { key: 'trilhas', label: 'Trilhas', href: '/trilhas', icon: <TrilhasIcon /> },
  { key: 'fase', label: 'Minha fase', href: '/fase', icon: <FasesIcon /> },
]

/**
 * Navegação MOBILE (BottomNav) = áreas de conteúdo + "Conta". No celular o header
 * some, então a aba Conta é o único caminho para os dados da conta e o logout
 * (`/conta`). No desktop essa função fica no menu de conta do header.
 */
export const USUARIA_NAV_MOBILE: BottomNavItem[] = [
  ...USUARIA_NAV,
  { key: 'conta', label: 'Conta', href: '/conta', icon: <PerfilIcon /> },
]

/**
 * Rotas full-screen que escondem a BottomNav — leitor, onboarding e os fluxos do M04
 * (agendamento e detalhe da sessão), que têm barra de ação fixa embaixo e colidiriam
 * com a navegação.
 */
export const NAV_HIDDEN_PREFIXES = ['/onboarding', '/conteudos/', '/agendar', '/sessoes/']
