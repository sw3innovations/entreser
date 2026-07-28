import type { components } from '@/features/m04/api/schema'

type StatusSessao = components['schemas']['StatusSessao']
type CanceladoPor = components['schemas']['CanceladoPor']

/**
 * Rótulos pt-BR dos enums de sessão. `Agendada` e `Confirmada` compartilham o MESMO
 * rótulo: `Confirmada` não é atribuída no MVP (D8) e não deve virar um estado visual
 * separado — nem aqui, nem em filtro.
 */
export const STATUS_LABEL: Record<StatusSessao, string> = {
  Agendada: 'Agendada',
  Confirmada: 'Agendada',
  Realizada: 'Realizada',
  Cancelada: 'Cancelada',
  NaoCompareceu: 'Não compareceu',
}

/** Cor do selo de status, no tema claro do app. */
export const STATUS_TOM: Record<StatusSessao, string> = {
  Agendada: 'bg-mauve-ghost text-mauve',
  Confirmada: 'bg-mauve-ghost text-mauve',
  Realizada: 'bg-success-dark/[0.12] text-success-dark',
  Cancelada: 'bg-plum/8 text-plum/55',
  NaoCompareceu: 'bg-red-alert/[0.10] text-red-alert',
}

/**
 * Quem cancelou → o texto de quem está lendo. O mesmo `canceladoPor` significa coisas
 * opostas nos dois painéis: `Usuaria` é "você" para a usuária e "a usuária" para a
 * profissional. Usar um mapa só faria a profissional ler "Você cancelou" quando quem
 * cancelou foi a outra pessoa.
 */
export const CANCELADA_POR_TEXTO: Record<CanceladoPor, string> = {
  Usuaria: 'Você cancelou esta sessão.',
  Profissional: 'A profissional cancelou esta sessão.',
  Sistema: 'Esta sessão foi cancelada por não atingir o número mínimo de participantes.',
}

/** O mesmo, na leitura da profissional. */
export const CANCELADA_POR_TEXTO_PROF: Record<CanceladoPor, string> = {
  Usuaria: 'A usuária cancelou esta sessão.',
  Profissional: 'Você cancelou esta sessão.',
  Sistema: 'Cancelada automaticamente por não atingir o número mínimo de participantes.',
}
