# Tasks para o Backend — M04 (Agendamento)

_Pendências identificadas no fluxo da Usuária que **só podem ser resolvidas no servidor**.
Levantadas durante a rodada de ajustes do agendamento. Data: 06/08/2026._

## Contexto

Ao testar "Cancelar minha inscrição" numa sessão de grupo, a usuária relatou que **continuou
na página e com o botão ainda ativo**, como se o cancelamento não tivesse acontecido.

A investigação mostrou que **a desinscrição funcionou** — o backend registrou `saiuEm` e
devolveu a vaga (`vagasDisponiveis` voltou a 12/12). O problema era de apresentação, somado a
duas inconsistências no contrato. A parte do frontend **já foi corrigida** (ver §3); o que
está abaixo depende do backend.

**Ambiente das evidências:** front local (branch `develop`) contra o backend de dev, via o
proxy `/m04-api` → `M04_ORIGIN` do `.env.local`. Os identificadores abaixo bastam para
localizar os registros; a conta de teste da usuária é a de `usuariaId
b46b3960-0c4d-4c9a-825e-ab748424a5ac`, e a sessão de grupo usada nos exemplos é a
`55cb3046-ae12-43df-a398-dd154339b3e7` ("Testando terapia em grupo", `RodaConversa`).

---

## 1. `GET /sessoes/{id}` mantém `podeCancelar: true` depois da desistência

**Severidade:** média — leva a uma ação que o próprio servidor rejeita.

Depois de a usuária sair do grupo (`DELETE /sessoes/{id}/inscrever` → sucesso), o detalhe da
sessão continua devolvendo `podeCancelar: true`, mesmo com o `saiuEm` já preenchido no
participante correspondente.

**Resposta observada** (`GET /m04-api/sessoes/55cb3046-…`, 200 OK), campos relevantes:

```json
{
  "status": "Agendada",
  "vagas": 12,
  "vagasDisponiveis": 12,
  "podeCancelar": true,
  "participantes": [
    {
      "usuaria": { "id": "b46b3960-0c4d-4c9a-825e-ab748424a5ac", "nome": "Raiff Maia" },
      "inscritaEm": "2026-08-06T14:48:47.574102Z",
      "saiuEm": "2026-08-06T16:47:09.240336Z"
    }
  ]
}
```

Note a contradição interna: `vagasDisponiveis` já é 12 de 12 (ninguém inscrito) e `saiuEm`
está preenchido, mas `podeCancelar` continua `true`.

**Consequência:** a tela oferecia "Cancelar minha inscrição" para quem já tinha saído; o
clique resultava em `400 NAO_INSCRITA`.

```json
{ "code": "NAO_INSCRITA", "message": "Not registered for this session" }
```

**Esperado:** `podeCancelar` deve ser `false` para quem já tem `saiuEm` preenchido. Vale a
mesma lógica que já zera a vaga — o flag e a contagem de vagas devem sair da mesma fonte.

**Como reproduzir:**
1. Inscrever-se numa sessão de grupo (`POST /sessoes/{id}/inscrever`).
2. Sair (`DELETE /sessoes/{id}/inscrever`) — retorna sucesso.
3. `GET /sessoes/{id}` → `podeCancelar` ainda vem `true`.

---

## 2. `GET /usuaria/sessoes` continua listando sessões das quais a usuária saiu

**Severidade:** alta — a sessão reaparece em "Minhas sessões" como se ainda fosse dela.

Depois da desistência, a sessão de grupo **permanece na lista** de sessões da usuária. Não é
cache do cliente: a requisição abaixo foi disparada **depois** da saída (16:56 > 16:47) e a
sessão veio no `content`.

```
GET /m04-api/usuaria/sessoes?status=Agendada,Confirmada&de=2026-08-06T16:56:46Z&page=0&size=20 → 200 OK
```

```json
{
  "id": "55cb3046-ae12-43df-a398-dd154339b3e7",
  "tipo": "RodaConversa",
  "status": "Agendada",
  "tituloGrupo": "Testando terapia em grupo",
  "vagas": null,
  "vagasDisponiveis": null,
  "totalParticipantes": null,
  "jaInscrita": null
}
```

**Por que não dá para contornar no frontend:** o `SessaoResumo` desta listagem vem com
`jaInscrita`, `vagas`, `vagasDisponiveis` e `totalParticipantes` **todos `null`** — não há
sinal algum que permita filtrar. A única alternativa seria buscar o detalhe de cada item da
lista (N requisições por página), o que é inviável.

**Esperado — uma das duas opções, preferindo a primeira:**

| Opção | O que muda | Observação |
|---|---|---|
| **A. Excluir da listagem** (preferida) | `GET /usuaria/sessoes` não retorna sessões de grupo em que a usuária tem `saiuEm` preenchido | "Minhas sessões" volta a significar "as minhas" |
| **B. Popular `jaInscrita`** | Preencher `jaInscrita` (ou expor `saiuEm`) no `SessaoResumo` desta rota | O frontend passa a filtrar; exige uma alteração no cliente |

Se a intenção for manter histórico ("já participei"), o caminho natural é a opção A para as
listagens de *Próximas* e um tratamento explícito em *Anteriores* — mas isso é decisão de
produto, não só de contrato.

---

## 3. O que já foi resolvido no frontend (não precisa de ação)

Registrado aqui só para evitar trabalho duplicado:

- **Sair do grupo agora sai da tela.** Sair não cancela a sessão (ela segue `Agendada` para
  as outras, corretamente), então recarregar repintava uma tela idêntica — nenhum sinal de
  que algo aconteceu. Agora volta para `/sessoes` com toast de confirmação.
- **Botão suprimido para quem já saiu.** O frontend passou a derivar isso de `saiuEm` no
  payload, em vez de confiar no `podeCancelar` (§1). Aparece no lugar a explicação "Você
  cancelou sua inscrição nesta sessão…" e a ação "Agendar novamente".
- **`NAO_INSCRITA` deixou de ser erro visível.** Se o servidor diz que a usuária não está
  inscrita, o objetivo já está cumprido — a tela trata como sucesso em vez de mostrar erro.

Os dois contornos acima podem ser simplificados quando §1 e §2 forem corrigidos, mas não
quebram nada se ficarem.

---

## 4. Listagens de sessões vêm sem ordenação por data

**Severidade:** alta — quebra a paginação, não só a leitura.

Nem `GET /profissional/agenda` nem `GET /usuaria/sessoes` devolvem os itens ordenados por
`dataHora`, e o contrato não documenta ordenação nem aceita um parâmetro `sort`.

Observado na agenda da profissional (ordem exata em que os dias chegaram):

```
7/ago → 11/ago → 10/ago → 17/ago → 13/ago → 28/set → 21/set → 29/set
```

E na lista da usuária:

```
11/ago 19:30 → 11/ago 16:00 → 10/ago 12:00 → 13/ago 18:00 → 11/ago 21:00
```

**Por que importa mais do que parece:** numa lista paginada, sem ordenação a "página 1"
deixa de ser "as 20 mais próximas" e passa a ser 20 quaisquer. Uma sessão de outubro pode
cair na página 1 e uma de agosto na página 3. A profissional pagina atrás de algo que
deveria estar no topo, e não há como saber quantas páginas faltam.

**Contornos já aplicados no frontend (paliativos):**
- `agenda-view` ordena por data o que está carregado (dias entre si e sessões dentro do dia).
- `use-proxima-sessao` busca uma página inteira e escolhe a menor `dataHora` no cliente, em
  vez de pedir `size=1` — que devolveria a "próxima" errada.

Os dois só corrigem o que já foi baixado; **a ordem entre páginas continua sendo a do
servidor**, e por isso o problema não está resolvido de fato.

**Esperado:** ordenar por `dataHora` ascendente por padrão nas duas rotas (idealmente
descendente quando o filtro for de período passado), ou expor um parâmetro `sort`.

---

## 5. Endpoint de resumo para as métricas da agenda

**Severidade:** baixa — é otimização, não defeito. Nada está errado hoje.

A tela `/admin/agenda` dispara **7 requisições** ao carregar, todas para
`GET /profissional/agenda` com recortes diferentes:

| # | Para quê | Recorte |
|---|---|---|
| 1 | Lista principal | período escolhido, `size=20` |
| 2 | Pendências (registro / sala falhou) | −14d → +90d, `size=1` (usa só os totais do envelope) |
| 3 | Métrica "próximos 7 dias" | hoje → +7d, `status=Agendada,Confirmada`, `size=1` |
| 4 | Métrica "canceladas 14 dias" | −14d → hoje, `status=Cancelada`, `size=1` |
| 5 | Métrica "previsto no mês" | mês corrente, `size=100` (soma no cliente) |
| 6 | Semana visível | semana navegada, `size=100` |
| 7 | Próxima sessão | hoje → +90d, `status=Agendada,Confirmada`, `size=50` |

Quatro delas (2, 3, 4 e parte da 7) existem só para obter **contagens**, e usam `size=1`
justamente para não trazer corpo. Consolidar no cliente resolveria pouco e amarraria
métricas de períodos diferentes a um mesmo fetch.

**Sugestão:** um `GET /profissional/agenda/resumo` devolvendo de uma vez as contagens do
painel (próximos 7 dias, canceladas no período, aguardando registro, salas com falha,
receita prevista no mês). Reduziria de 7 para ~3 requisições e tiraria do cliente a soma
de receita, que hoje é feita sobre uma página de até 100 itens (item 5) — a única com
suposição de volume.

---

## 6. `SessaoResumo` não permite distinguir quem cancelou

**Severidade:** baixa — hoje resolvido com ajuste de rótulo.

A métrica "últimos 14 dias" pretendia mostrar **canceladas pelas usuárias**, mas
`canceladaPor` existe só na `Sessao` completa — não no `SessaoResumo` das listagens, nem
como parâmetro de query em `GET /profissional/agenda`. Não há como filtrar.

O frontend passou a rotular apenas "canceladas" (verdadeiro), em vez de atribuir à usuária
cancelamentos que a própria profissional fez.

**Esperado, se a distinção importar para o produto:** expor `canceladaPor` no
`SessaoResumo` ou aceitá-lo como filtro na listagem.

---

## 7. Resumo

| # | Endpoint | Problema | Esperado | Prioridade |
|---|---|---|---|---|
| 1 | `GET /sessoes/{id}` | `podeCancelar: true` mesmo com `saiuEm` preenchido | `false` para quem já saiu | Média |
| 2 | `GET /usuaria/sessoes` | Lista sessões das quais a usuária saiu; sem campo para filtrar (`jaInscrita: null`) | Excluir da listagem (ou popular `jaInscrita`) | Alta |
| 3 | `GET /profissional/agenda` e `GET /usuaria/sessoes` | Sem ordenação por data — a paginação vira arbitrária | Ordenar por `dataHora` (ou expor `sort`) | Alta |
| 4 | `GET /profissional/agenda` | 7 requisições para montar o painel; 4 são só contagem | Endpoint `/resumo` com as métricas agregadas | Baixa |
| 5 | `SessaoResumo` | Sem `canceladaPor` — não dá para separar quem cancelou | Expor o campo ou aceitá-lo como filtro | Baixa |
