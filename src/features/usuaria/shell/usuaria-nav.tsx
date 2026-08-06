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
 * Rotas verdadeiramente full-screen: escondem HEADER (desktop) e BottomNav (mobile) —
 * leitor de conteúdo e onboarding. Diferente dos fluxos do M04 abaixo, estas não têm um
 * "chrome" de app ao redor em nenhum tamanho de tela.
 */
export const NAV_FULLSCREEN_PREFIXES = ['/onboarding', '/conteudos/']

/**
 * Rotas que escondem só a BottomNav (mobile) — os fluxos do M04 (agendamento e detalhe da
 * sessão) têm barra de ação fixa embaixo no mobile, que colidiria com a navegação. No
 * desktop elas mantêm o header normalmente: sem isso, o header (visível só em `lg:`) some
 * junto com a BottomNav, e essas telas ficam sem nenhum "chrome" acima no desktop.
 */
export const BOTTOMNAV_HIDDEN_PREFIXES = ['/onboarding', '/conteudos/', '/agendar', '/sessoes/']
