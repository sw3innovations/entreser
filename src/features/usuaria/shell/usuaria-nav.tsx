import { HomeIcon, TrilhasIcon, PerfilIcon } from '@/components/ui'
import { CompassIcon, CalendarIcon } from '../ui/icons'
import type { BottomNavItem } from '../ui'

/**
 * Áreas principais do app da Usuária depois do redesenho: Início · Explorar · Jornada ·
 * Consultas. É a lista usada pela navegação central do header (desktop) — onde a conta já
 * vive no menu à direita, então "Conta" NÃO entra aqui.
 *
 * `alias` são as rotas que pertencem à área sem morar sob o `href` dela: a trilha e o leitor
 * de conteúdo são o Explorar; agendar e o detalhe da sessão são Consultas; "Minha fase"
 * virou parte da Jornada. Sem isso, abrir uma trilha deixava a barra sem nenhuma aba acesa.
 */
export const USUARIA_NAV: BottomNavItem[] = [
  { key: 'home', label: 'Início', href: '/home', icon: <HomeIcon /> },
  { key: 'explorar', label: 'Explorar', href: '/explorar', icon: <CompassIcon />, alias: ['/feed', '/trilhas', '/conteudos'] },
  { key: 'jornada', label: 'Jornada', href: '/jornada', icon: <TrilhasIcon />, alias: ['/fase'] },
  { key: 'consultas', label: 'Consultas', href: '/consultas', icon: <CalendarIcon />, alias: ['/sessoes', '/agendar'] },
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

/**
 * Idem, por SUFIXO — o fechamento de trilha (`/trilhas/[id]/fim`) é a última tela de um
 * fluxo que já corria sem BottomNav (o leitor); os dois botões dela SÃO a navegação, e a
 * barra por cima deles quebrava a saída. Por prefixo não dava: `/trilhas/` esconderia a
 * barra na lista e no detalhe, que a querem.
 */
export const BOTTOMNAV_HIDDEN_SUFFIXES = ['/fim']
