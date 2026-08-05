/**
 * Mapa único `code → mensagem pt-BR` do M04 (D26). Nenhum componente escreve texto de
 * erro: tudo passa por `mensagemDe(code)`. O `message` do envelope de erro é técnico e
 * fica só no log — a UI nunca o exibe, e nunca se compara erro por texto (sempre por `code`).
 *
 * Cobre os 32 códigos do contrato. O script `npm run m04:check-erros` falha se algum
 * código do `openapi.yaml` não tiver tradução aqui — a lista nunca desatualiza em silêncio.
 */
export const MENSAGENS: Record<string, string> = {
  // Marcação / slots
  ANTECEDENCIA_MINIMA: 'É preciso de pelo menos 24 horas de antecedência para isso.',
  SLOT_JA_OCUPADO: 'Esse horário acabou de ser preenchido. Veja os horários atualizados.',
  SLOT_INDISPONIVEL: 'Esse horário não está mais disponível.',
  CONFLITO_HORARIO: 'Já existe uma sessão nesse horário.',
  PRAZO_REAGENDAMENTO: 'Não dá para reagendar com menos de 24 horas. Você ainda pode cancelar a sessão.',
  VALOR_NAO_DEFINIDO: 'Esta profissional não oferece este tipo de sessão.',
  PERIODO_INVALIDO: 'Confira as datas informadas.',
  PARAMETRO_INVALIDO: 'Confira os dados informados e tente de novo.',
  JANELA_MUITO_LONGA: 'O período consultado é muito longo. Escolha um intervalo menor.',

  // Grupo / inscrição
  SESSAO_LOTADA: 'As vagas desta sessão acabaram de ser preenchidas.',
  JA_INSCRITA: 'Você já está inscrita nesta sessão.',
  NAO_INSCRITA: 'Você não está inscrita nesta sessão.',
  CAPACIDADE_INVALIDA: 'O número de vagas está fora do permitido para este tipo de sessão.',
  SESSAO_E_DE_GRUPO: 'Esta ação não vale para sessões de grupo.',
  SESSAO_NAO_E_GRUPO: 'Esta ação vale apenas para sessões de grupo.',
  TIPO_E_DE_GRUPO: 'Este tipo de sessão é de grupo — use o fluxo de sessões em grupo.',
  TIPO_NAO_E_GRUPO: 'Este tipo de sessão não é de grupo.',

  // Convite de casal
  EMAIL_PARCEIRA_INVALIDO: 'Esse e-mail não parece válido. Confira e tente de novo.',
  EMAIL_PARCEIRA_E_PROPRIO: 'Use o e-mail da sua parceira, não o seu.',
  CONVITE_INVALIDO: 'Não encontramos este convite. Confira o link do e-mail.',
  CONVITE_EXPIRADO: 'Este convite não é mais válido.',
  CONVITE_JA_ACEITO: 'Este convite já foi aceito.',
  EMAIL_NAO_CONFERE: 'Este convite foi enviado para outro e-mail. Entre com a conta que o recebeu.',

  // Profissional — configuração e registro
  FAIXA_INVALIDA: 'Confira os horários informados.',
  FAIXAS_SOBREPOSTAS: 'Há faixas de horário que se sobrepõem. Ajuste antes de salvar.',
  INTERVALO_INVALIDO: 'O intervalo informado não é válido.',
  VALOR_INVALIDO: 'Informe um valor válido.',
  LINK_INVALIDO: 'Esse link não parece válido. Cole o endereço completo da sala.',
  SESSAO_NAO_OCORREU_AINDA: 'Esta sessão ainda não aconteceu.',
  TRANSICAO_INVALIDA: 'Esta sessão não pode mais ser alterada.',

  // Transversais
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre novamente.',
  NAO_AUTORIZADO: 'Você não tem permissão para isso.',
  RECURSO_NAO_ENCONTRADO: 'Não encontramos o que você procura.',

  // Fallbacks do backend fora do contrato (GlobalExceptionHandler) — não estão no
  // openapi.yaml, mas o servidor pode emiti-los; sem tradução cairiam no FALLBACK genérico.
  CONFLITO_DADOS: 'Esta ação conflita com algo que já existe. Atualize a tela e tente de novo.',
  ERRO_INTERNO: 'Tivemos um problema inesperado. Tente novamente em instantes.',
}

export const FALLBACK = 'Não conseguimos completar essa ação. Tente novamente.'

/** Resolve a mensagem pt-BR a partir do `code` do envelope de erro. */
export function mensagemDe(code?: string | null): string {
  return (code && MENSAGENS[code]) || FALLBACK
}
