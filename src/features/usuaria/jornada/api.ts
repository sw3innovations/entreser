import { api } from '@/lib/http'

/**
 * Contrato da Jornada e do termômetro emocional — espelho dos records Java em
 * `controller/dto/jornada/JornadaDTO.java` e `controller/dto/DadosEmocionaisDTO.java`
 * (backend `development`). Base: `/api/v1/paciente/...`.
 */

export type FaseTratamento = 'INDUCAO' | 'ESTIMULACAO' | 'COLETA' | 'TRANSFERENCIA' | 'BETA' | 'POS_RESULTADO' | 'OUTRA'
export type CategoriaRegistro =
  | 'EXAME' | 'MEDICAMENTO' | 'SUPLEMENTO' | 'CICLO_MENSTRUAL' | 'NUTRICAO' | 'CHECKIN' | 'MICROPRATICA'
export type Emocao = 'CALMA' | 'ANSIOSA' | 'TRISTE' | 'IRRITADA' | 'ESPERANCOSA' | 'EXAUSTA' | 'ALIVIADA' | 'OUTRA'

export interface RegistroJornada {
  id: string
  tratamentoId: string | null
  categoria: CategoriaRegistro
  titulo: string
  detalhes: string | null
  /** `YYYY-MM-DD` no fuso da jornada. */
  dataEvento: string | null
  lembreteEm: string | null
  concluido: boolean
  criadoEm: string
}

export interface SessaoAgenda {
  sessaoId: string
  tipo: string
  data: string
  inicio: string
  fim: string
  status: string
  profissional: string | null
}

export interface MarcoJornada {
  tratamentoId: string
  tratamento: string
  fase: FaseTratamento
  dataInformada: string | null
  registradaEm: string
}

export interface CheckinAgenda {
  id: string
  pontuacao: number
  emocoes: Emocao[]
  criadoEm: string
}

export interface JornadaHoje {
  data: string
  registros: RegistroJornada[]
  sessoes: SessaoAgenda[]
  checkinFeitoHoje: boolean
  modalidadeAtiva: string | null
  faseAtual: FaseTratamento | null
}

export interface JornadaAgenda {
  registros: RegistroJornada[]
  sessoes: SessaoAgenda[]
  marcos: MarcoJornada[]
  checkins: CheckinAgenda[]
}

export interface TratamentoItem {
  id: string
  titulo: string
  modalidade: string
  dataInicio: string | null
  dataFim: string | null
  faseAtual: FaseTratamento | null
  ativo: boolean
}

export interface TrilhaSugerida {
  trilhaId: string
  titulo: string
  categoria: string | null
  justificativa: string | null
}

export interface TermometroInput {
  /** 1 (muito difícil) a 5 (muito bem). */
  pontuacao: number
  /** Até 5, sem repetir. */
  emocoes: Emocao[]
  nota?: string
}

export interface TermometroItem {
  id: string
  pontuacao: number
  emocoes: Emocao[]
  nota: string | null
  criadoEm: string
  /** Presente quando o registro acionou o fluxo de apoio (risco). */
  mostrarApoio?: boolean
}

const BASE = '/paciente/jornada'

export const jornadaApi = {
  hoje: () => api.get<JornadaHoje>(`${BASE}/hoje`),
  agenda: () => api.get<JornadaAgenda>(`${BASE}/agenda`),
  recomendacoes: () => api.get<TrilhaSugerida[]>(`${BASE}/recomendacoes`),
  registros: () => api.get<RegistroJornada[]>(`${BASE}/registros`),
  tratamentos: () => api.get<TratamentoItem[]>(`${BASE}/tratamentos`),
  concluirRegistro: (id: string) => api.post<RegistroJornada>(`${BASE}/registros/${id}/concluir`),
  registrarTermometro: (input: TermometroInput) => api.post<TermometroItem>('/paciente/termometro', input),
}

/** Rótulos das fases — a ordem do array é a ordem da linha do tempo na Jornada. */
export const FASES: { chave: FaseTratamento; rotulo: string }[] = [
  { chave: 'INDUCAO', rotulo: 'Indução' },
  { chave: 'ESTIMULACAO', rotulo: 'Estimulação' },
  { chave: 'COLETA', rotulo: 'Coleta' },
  { chave: 'TRANSFERENCIA', rotulo: 'Transferência' },
  { chave: 'BETA', rotulo: 'Beta' },
  { chave: 'POS_RESULTADO', rotulo: 'Pós-resultado' },
]

export function rotuloFase(f: FaseTratamento | null | undefined): string | null {
  if (!f) return null
  return FASES.find((x) => x.chave === f)?.rotulo ?? 'Outra fase'
}
