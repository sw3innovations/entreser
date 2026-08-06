# Relatório de Testes — M04 (Agendamento)

_Redesign das telas de agendamento (Usuária) e do backoffice (Profissional), fiéis aos
protótipos do Claude Design. Testes funcionais e de requisições. Data: 05/08/2026._

## Ambiente

- **Front:** `entreser-app` (Next.js) em `localhost:3000`, branch `develop`.
- **Backend:** dev real (proxy `/m04-api` → `M04_ORIGIN`). Confirmado com **estado
  persistente** — sessões canceladas durante o teste permaneceram Canceladas em releituras.
- **Método:** navegação pela interface + inspeção das requisições de rede (método, URL,
  status e corpo) para cada operação de leitura e escrita.
- **Perfis:** Usuária (`maria@entreser.com.br`) e Profissional (`profissional 1`, via
  backoffice em `/admin`).

Legenda: ✅ testado ao vivo · 🔎 conferido no código (sem execução ao vivo) · ⏳ pendente.

---

## 1. Área da Usuária

Fluxo completo de marcação e gestão de sessões. Todas as telas foram redesenhadas e
percorridas na interface.

| Tela / rota | O que foi verificado | Requisições | Status |
|---|---|---|---|
| **Escolha do tipo** `/agendar` | Lista de tipos, agrupamento Individual/Grupo, ícone por tipo, pill "Você está na fase X", botão de voltar | `GET /tipos-sessao` | ✅ |
| **Escolha da profissional** `/agendar/[tipo]` | Lista por tipo (Individual, Casal, Consultoria), CRP + abordagem + bio, preço correto por tipo; tipo inexistente → erro tratado | `GET /profissionais?tipo=` | ✅ |
| **Perfil da profissional** `/agendar/[tipo]/[id]` | Dados, tipos oferecidos com ícone, destaque no tipo selecionado; **troca de tipo instantânea, sem piscar e sem refetch** (corrigido — ver §5) | `GET /profissionais/{id}`, `GET /tipos-sessao` | ✅ |
| **Escolha do horário** `/agendar/[tipo]/[id]/horarios` | Agrupamento Manhã/Tarde/Noite com contagem correta; conversão UTC→local correta (12:00 UTC = 09:00 Brasília) | `GET /profissionais/{id}/slots` | ✅ |
| **Confirmar** `/agendar/[tipo]/[id]/confirmar` | Resumo (data-cartão, ícones, total); campo de e-mail da parceira preservado no fluxo de Casal; navegação ao detalhe após criar | **`POST /sessoes` → 201 Created** | ✅ |
| **Detalhe da sessão** `/sessoes/[id]` | Estado **Agendada**: pill "Começa em N dias", timeline "No dia" (sala abre → começa → encerramento); estado **Cancelada**: badge cinza, botão "Agendar novamente" com rota correta | `GET /sessoes/{id}`; cancelamento via diálogo | ✅ |
| **Cancelar sessão** (diálogo) | Abre modal, motivo opcional, confirma → sessão vira Cancelada | `POST /sessoes/{id}/cancelar` | ✅ |
| **Reagendar** `/sessoes/[id]/reagendar` | Mesmo padrão de grade de horários da tela de Horários, re-estilizado | `GET .../slots`, `PATCH /sessoes/{id}/reagendar` | ✅ (leitura); PATCH 🔎 |
| **Minhas sessões** `/sessoes` | Abas Próximas / Anteriores / Todas | `GET /usuaria/sessoes` | ✅ |
| **Sessões em grupo** `/agendar/grupo/[tipo]` | Empty state "Nenhuma sessão aberta" | `GET /grupos` | ✅ |

**Cobertura da Usuária:** o caminho crítico (marcar → confirmar → detalhe → cancelar →
agendar novamente) foi exercitado ponta a ponta, com o `POST /sessoes` retornando **201
Created** e o cancelamento refletindo na tela.

---

## 2. Área da Profissional (backoffice)

### 2.1 Leituras e navegação — ✅

| Tela / rota | Verificado | Requisições | Status |
|---|---|---|---|
| **Minha agenda** `/admin/agenda` | Lista (janela −14/+30 dias), **4 métricas** (próximos 7 dias, aguardando registro, canceladas 14 dias, previsto no mês), card lateral "Ritmo da semana" e "Sua semana"; filtro por status; toggle **Por dia / Semana** (grade de horário com blocos posicionados) | Vários `GET /profissional/agenda` (lista, métricas, semana) + `GET /tipos-sessao` | ✅ todos 200 |
| Filtro de status | Clicar "Canceladas" dispara requisição filtrada e a lista reduz corretamente | `GET /profissional/agenda?...&status=Cancelada` | ✅ |
| **Detalhe da sessão** `/admin/agenda/[id]` | Grid de métricas (Horário/Duração/Valor), **timeline só com eventos reais** (marcada + cancelada, sem eventos fabricados), "Quem marcou", sala de vídeo | `GET /sessoes/{id}` | ✅ |

### 2.2 Escritas (operações de estado) — ✅

| Operação | Como foi testado | Requisição | Resultado |
|---|---|---|---|
| **Meus valores** — salvar | Editei Individual R$120 → R$130 e salvei | **`PUT /profissional/valores` → 200 OK** | ✅ valor persiste, form limpa |
| **Meus horários** — salvar | Liguei um dia (gera faixa) e salvei | **`PUT /profissional/disponibilidade` → 200 OK** | ✅ banner verde "Horários salvos." |
| **Bloquear datas** — criar | Selecionei 20–22/ago e bloqueei | **`POST /profissional/bloqueios` → 201 Created** | ✅ banner de sucesso; calendário e resumo atualizados |
| **Bloquear datas** — desfazer | Confirmação inline → desfazer | **`DELETE /profissional/bloqueios/{id}` → 204** | ✅ lista 3→2 períodos (ver §4.2) |
| **Cancelar sessão** (Profissional) | Abri sessão Agendada, diálogo com motivo, confirmei | **`POST /sessoes/{id}/cancelar` → 200 OK** | ✅ status → Cancelada, timeline ganha "Sessão cancelada" |

**Destaque — conversão de fuso correta:** ao bloquear 20–22/ago, o corpo enviado foi
`dataInicio: 2026-08-20T03:00:00Z` (meia-noite de São Paulo = 03:00 UTC) e
`dataFim: 2026-08-23T02:59:59Z` (fim do dia 22 local). Sem deslocamento de 3h.

### 2.3 Registrar sessão — 🔎 conferido no código, ⏳ não testado ao vivo

O fluxo de registro (`registrar-dialog.tsx`) foi **conferido no código** — as três chamadas
batem com o contrato:

- `PATCH /sessoes/{id}/realizada` — "a sessão aconteceu" / "encerrar" (grupo)
- `PATCH /sessoes/{id}/nao-compareceu` — falta (apenas individual)
- `POST /sessoes/{id}/cancelar` — não conta como falta

Diálogo de dois passos (escolher → confirmar), ações diferentes por tipo, "Encerrar" travado
até todas as presenças de grupo serem registradas.

**Por que não foi testado ao vivo:** registrar só aparece quando a sessão **já aconteceu e
continua Agendada** (`pendenteRegistro: true`). Inspecionei as 14 sessões da agenda: nenhuma
tem `pendenteRegistro: true` e `totalPendenteRegistro: 0`. As passadas já estão resolvidas
(Realizada/Cancelada/NãoCompareceu) e as duas Agendadas são futuras. Não dá para *criar* uma
sessão passada — a regra `ANTECEDENCIA_MINIMA` (24h) impede agendar no passado. Ver §6.

---

## 3. Correções feitas durante o desenvolvimento/testes

1. **Perfil da profissional (Usuária) piscava ao trocar de tipo.** A troca navegava
   (`router.replace`), remontando a página e voltando ao estado de loading. Passou a ser
   **estado local** (`useState`) — troca instantânea, sem refetch. Navegação real só ao
   avançar para os horários.
2. **`/agendar` sem botão de voltar.** Adicionado `HeroIconButton` + `useVoltar('/home')`.
3. **Trocar tipo na tela de perfil** passou a ser permitido (antes só exibia o tipo que
   chegava pela rota).
4. **Bloquear datas / Meus horários** foram **reescritos** após constatação de que os
   protótipos usados na primeira passada eram a versão resumida; os protótipos dedicados
   (`BloquearDatas.dc.html`, `MeusHorarios.dc.html`) são bem mais ricos:
   - Bloquear datas: calendário próprio de 3 meses (dias já bloqueados/passados travados),
     lista com confirmação inline de desfazer, resumo lateral.
   - Meus horários: mapa visual da semana em barras, toggle por dia, chips de faixa com
     contagem de horários gerados.

Todas as telas passam por `tsc --noEmit` e `eslint` sem erros.

---

## 4. Observações (não são bugs funcionais)

### 4.1 Requisições duplicadas na agenda
A tela `/admin/agenda` dispara cada `GET` ~4× no carregamento (React Strict Mode em dev +
o fetch próprio da sidebar "Sua semana" + re-render de navegação). **Não é loop infinito** —
os timestamps são do mesmo lote e não crescem, e todas retornam 200. Em produção o Strict
Mode não duplica. Dá para deduplicar depois se quiser, mas não afeta funcionamento.

### 4.2 `DELETE` de bloqueio aparece como `204 [ERR_ABORTED]`
No painel de rede o DELETE mostra `204 No Content [FAILED: net::ERR_ABORTED]`. O servidor
respondeu **204 (correto)** e a UI atualizou (lista 3→2). O abort é só a leitura do corpo
vazio de um 204 coincidindo com o refetch imediato. Cosmético.

---

## 5. O que ainda falta testar

| Item | Rota / componente | Por que não foi testado |
|---|---|---|
| **Registrar sessão — sucesso** | `PATCH /sessoes/{id}/realizada` e `/nao-compareceu` | Sem sessão elegível no seed (nenhuma passada + Agendada); não dá para criar (regra das 24h). Precisa de seed do backend. |
| **Registrar sessão — presença em grupo** | `PATCH /sessoes/{id}/participantes/{pid}` | Depende de sessão de grupo `pendenteRegistro`. |
| **Criar sessão de grupo** | `/admin/agenda/novo-grupo` → `POST /profissional/sessoes/grupo` | Não exercitado nesta rodada. |
| **Sala com problema (link manual)** | `/admin/agenda/[id]/sala` → `PATCH /sessoes/{id}/link-meet` | Só aparece quando `linkMeetStatus = Falhou`; nenhuma sessão nesse estado. |
| **Convite de casal (aceite)** | `/convite/[token]` (Usuária) | Requer um token de convite pendente. |
| **Reagendar — PATCH** | `PATCH /sessoes/{id}/reagendar` | Leitura da tela testada; o PATCH de sucesso não foi disparado. |

---

## 6. Recomendação para fechar o registro

Para testar o caminho de sucesso de **registrar sessão** ponta a ponta, o mais limpo é o
backend **semear uma sessão passada ainda Agendada** no `entreser_dev` (ou mover a `dataHora`
de uma sessão existente para o passado). Aí `pendenteRegistro` vira `true`, o botão
"Registrar sessão" aparece e o fluxo (`realizada` / `nao-compareceu`) roda de verdade.

Alternativa parcial: forçar temporariamente o botão no front e disparar o `PATCH` real — o
backend rejeita (`SESSAO_NAO_OCORREU_AINDA`), o que valida UI + forma da requisição +
tratamento de erro, mas **não** o caminho de sucesso.
