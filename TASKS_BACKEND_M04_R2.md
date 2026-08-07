# Devolutiva — M04 (Agendamento), 2ª rodada

_Resposta à correção entregue sobre o `TASKS_BACKEND_M04.md`. Verificado em **06/08/2026**
por dois caminhos: chamadas ao vivo em `dev-api.entreser.sw3.tec.br` (contas reais —
profissional `a6f1f31c-…`, usuária `b46b3960-…`) **e leitura do código-fonte** do backend
atualizado (commit `c100076f`)._

## Resumo

**Os 5 itens da 1ª rodada estão corrigidos** — conferidos um a um (§4). A ordenação e o
`/resumo` resolveram problemas estruturais.

Lendo o código para documentar as regras do `/resumo`, encontramos **duas métricas que contam
algo diferente do que o painel afirma**. São o assunto principal desta rodada.

**Dito logo, porque muda quem é o responsável:** as duas nasceram do **nosso** frontend. O
backend replicou fielmente as janelas que a tela já usava — o comentário no código diz isso
com todas as letras (*"exatamente como o painel já usa hoje"*). Não é erro de execução de
vocês; é especificação ruim que nós demos. O que mudou é que, centralizadas no servidor,
ficaram invisíveis para quem lê a tela.

| | Item | Severidade | Onde |
|---|---|---|---|
| §1.1 | `pendenteRegistro` tem teto de 14 dias no passado — pendência antiga desaparece | **Alta** | `/profissional/agenda/resumo` |
| §1.2 | `canceladas14Dias` conta pela data da sessão, não pela do cancelamento | **Média** | `/profissional/agenda/resumo` |
| §1.3 | Não há como separar quem cancelou numa contagem | **Média** | `/profissional/agenda/resumo` |
| §1.4 | Período passado vem em ordem crescente | Baixa | `/profissional/agenda` e `/usuaria/sessoes` |
| §2 | Uma decisão de **produto** (não é bug) | — | `/usuaria/sessoes` |

**Este documento é a lista completa.** Resolvidos os itens de §1 e respondida a pergunta de
§2, não temos mais nada pendente do backend no M04 — as três simplificações que ainda faltam
no frontend (§6) já estão destravadas pela 1ª rodada. Para não precisarmos de uma 3ª rodada,
propomos em §3 os **nomes exatos** de campos e parâmetros: adotaremos exatamente esses, salvo
se preferirem outros.

---

## 1. Ajustes necessários

### 1.1 `pendenteRegistro` tem teto de 14 dias no passado

**Onde:** `ListagemSessaoService.resumoAgenda()`

```java
Specification<Sessao> basePendencias = daProfissional.and(
        SessaoSpecifications.noPeriodo(agora.minus(Duration.ofDays(14)), agora.plus(Duration.ofDays(90))));
long pendenteRegistro = sessaoRepository.count(
        basePendencias.and(SessaoSpecifications.pendenteRegistro(true, agora)));
```

**O que acontece:** a contagem só enxerga sessões cuja `dataHora` está nos últimos 14 dias.
Uma sessão que aconteceu há 20, 40 ou 90 dias e continua sem registro **deixa de ser
contada**.

**Por que importa:** ela não é resolvida — ela some. E some justamente por ter sido esquecida
por tempo demais, que é a única situação em que o alerta ainda importa. O card existe para
dizer "você tem coisas em aberto"; hoje diz "das últimas duas semanas", sem avisar do
recorte. Uma profissional que passe três semanas fora vê `0` e conclui que está em dia.

É o inverso do que o campo foi criado para fazer (D16): existir para o frontend não comparar
datas e não perder pendência de vista.

**O que resolveria:** remover o limite inferior — `noPeriodo(null, agora)` basta, já que
`pendenteRegistro(true, agora)` por definição só casa com sessão que já passou.

⚠️ **Atenção ao desacoplar:** `basePendencias` hoje é compartilhada com `linkMeetFalhou`.
Elas precisam de janelas **diferentes** — e `linkMeetFalhou` deve **manter** a janela atual.
Uma sala que falhou numa sessão que já aconteceu não é acionável (não há mais o que fazer);
já uma pendência de registro é acionável para sempre. Só o `pendenteRegistro` deve perder o
piso.

---

### 1.2 `canceladas14Dias` conta pela data da sessão, não pela do cancelamento

**Onde:** `ListagemSessaoService.resumoAgenda()` + `SessaoSpecifications.noPeriodo()`

```java
long canceladas14Dias = sessaoRepository.count(daProfissional
        .and(SessaoSpecifications.noPeriodo(agora.minus(Duration.ofDays(14)), agora))
        .and(SessaoSpecifications.comStatus(List.of(StatusSessao.Cancelada))));
```

E `noPeriodo` filtra por **`dataHora`** — a data em que a sessão *aconteceria*:

```java
if (de != null) p = cb.and(p, cb.greaterThanOrEqualTo(root.get("dataHora"), de));
```

**O que acontece:** o card diz "Últimos 14 dias · canceladas", que se lê como *"cancelaram
comigo nas últimas duas semanas"*. Não é o que ele conta:

| Situação | Conta hoje? | Deveria? |
|---|---|---|
| Usuária cancelou **hoje** uma sessão que seria dia 25/08 | ❌ Não (`dataHora` no futuro) | **Sim** — é a notícia mais fresca |
| Sessão de 01/08 cancelada **há 3 meses** | ✅ Sim | Não — é notícia velha |

**Por que importa:** o primeiro caso é o grave. Um cancelamento recente para uma sessão futura
**não aparece em lugar nenhum do painel** — e é exatamente o evento sobre o qual ela
gostaria de saber, porque abriu um buraco na agenda dela.

**O que resolveria:** filtrar por `cancelada_em` em vez de `dataHora`. A coluna **já existe**
(`Sessao.canceladaEm`) e é preenchida nos dois caminhos de cancelamento que encontramos —
`SessaoService:239` (manual) e `AgendamentoScheduler:197` (automático, `Sistema`).

⚠️ **Um ponto que não conseguimos verificar:** se houver linhas antigas com `status =
Cancelada` e `cancelada_em` nulo (dados semeados ou anteriores à coluna), elas sairão da
contagem ao trocar o critério. Vale conferir no banco antes de subir — se existirem, decidir
entre um backfill ou tratá-las como "data desconhecida" (nossa preferência: não contar, já
que de fato não se sabe quando foi).

---

### 1.3 Não há como separar quem cancelou numa contagem

O item 6 da 1ª rodada pedia *"expor `canceladaPor` no `SessaoResumo` **ou** aceitá-lo como
filtro"*. O campo foi exposto e funciona (`Usuaria`, `Sistema` observados) — é útil no detalhe
e nas listagens.

Mas **a necessidade que originou o item era uma métrica**, e ela segue sem solução. Confirmado
no código: `ProfissionalAgendaController.listarAgenda()` aceita `status`, `tipo`,
`pendenteRegistro` e `linkMeetStatus` — **não `canceladaPor`**; e o `ResumoAgenda` traz o
total sem recorte.

O campo novo permite a distinção item a item, mas só sobre a página carregada. Contar o
período inteiro exigiria baixar o período inteiro — que é o que o `/resumo` veio eliminar.

**Por que importa:** o card quer dizer "desmarcaram comigo". Hoje soma também os
cancelamentos que a **própria profissional** fez, atribuindo a ela o que ela mesma decidiu.
Mantivemos o rótulo genérico "canceladas" para não mentir, mas o número perdeu o sentido.

**O que resolveria:** um campo a mais no `ResumoAgenda`, contando só as canceladas **pela
usuária** (ver nome proposto em §3). Basta esse: preferimos isso a um filtro
`canceladaPor` na listagem, porque a listagem já cumpre seu papel e um filtro novo seria
superfície de API sem demanda.

---

### 1.4 Período passado vem em ordem crescente — nas duas rotas

A 1ª rodada pediu ascendente *"idealmente **descendente** quando o filtro for de período
passado"*. Veio só a primeira parte, e **não há como o cliente pedir a outra**.

Confirmado no código: `ListagemSessaoService.comOrdenacaoPadrao()` tem um `getSortOr`, mas
`ProfissionalAgendaController` monta `PageRequest.of(page, size)` **sem `Sort`** e não expõe
`sort` como parâmetro — o fallback ascendente é o único caminho, como o próprio comentário
reconhece (*"os dois controllers nunca setam Sort"*).

Observado ao vivo (últimos 14 dias): primeira `2026-08-04T16:00Z`, última
`2026-08-04T22:00Z` — mais antiga primeiro.

**Por que importa:** **as duas telas têm aba "Anteriores"** — a agenda da profissional e
"Minhas sessões" da usuária (`?status=Realizada,Cancelada&ate=…`). Numa lista do que já
passou, o topo deveria ser o mais recente. Quanto mais histórico a conta acumula, mais para
baixo fica o que interessa; com paginação, migra para a última página.

**O que resolveria:** um parâmetro `ordem` (ver §3) **nas duas rotas** — `/profissional/agenda`
e `/usuaria/sessoes`. Preferimos parâmetro explícito a inverter automaticamente quando o
período é passado: o automático é difícil de documentar e surpreende quem consulta um período
que cruza o presente.

**Severidade baixa.** Se não valer o esforço, tudo bem — mas vale fechar a questão
explicitamente, porque hoje ela está no meio do caminho entre o pedido e a entrega.

---

## 2. Uma decisão de produto (não é bug)

O item 2 da 1ª rodada foi resolvido pela **opção A**: sessões de grupo das quais a usuária
saiu não vêm mais em `GET /usuaria/sessoes`. Está correto e é o que pedimos.

Só que a exclusão vale para **todas** as listagens, inclusive a de **"Anteriores"**. Ou seja:
se ela participou de uma roda de conversa em julho e saiu, esse fato desapareceu por completo
do histórico dela.

A 1ª rodada já tinha antecipado isso: *"se a intenção for manter histórico ('já participei'),
o caminho natural é a opção A para as listagens de Próximas e um tratamento explícito em
Anteriores — mas isso é decisão de produto"*.

**Não estamos pedindo mudança** — estamos pedindo uma resposta, porque ela define se
construímos algo:

- **Se "saiu, não é histórico dela"** → está pronto, nada a fazer, e nós fechamos o assunto.
- **Se "quem já participou deveria ver"** → precisaríamos de um jeito de trazê-las só em
  Anteriores (um `incluirSaidas=true`, por exemplo), e isso vira um item de backlog.

---

## 3. Contrato — a forma exata que vamos adotar

Para não gastarmos uma 3ª rodada em nomenclatura. **Adotaremos exatamente isto**, salvo se
responderem preferindo outra coisa.

**`ResumoAgendaDTO`** — um campo novo (aditivo; `canceladas14Dias` continua existindo com o
mesmo nome e passa a contar pela data do cancelamento, §1.2):

```jsonc
{
  "proximos7Dias": 6,
  "canceladas14Dias": 3,              // total, agora por cancelada_em
  "canceladasPelaUsuaria14Dias": 2,   // NOVO (§1.3) — canceladaPor = Usuaria
  "pendenteRegistro": 0,              // agora sem piso de 14 dias (§1.1)
  "linkMeetFalhou": 0,                // janela inalterada, de propósito
  "receitaPrevistaMes": 830
}
```

**`GET /profissional/agenda` e `GET /usuaria/sessoes`** — um parâmetro novo (§1.4):

```
ordem = asc | desc      (opcional; default asc — comportamento atual preservado)
```

Aplica-se sempre a `dataHora`. Se preferirem a convenção do Spring (`sort=dataHora,desc`),
serve igual — só nos digam qual, que adaptamos o cliente.

**Além disso, um pedido que não muda comportamento:** `description` em cada campo do
`ResumoAgendaDTO`, dizendo janela e status. Hoje eles chegam sem descrição no `/v3/api-docs`,
e por isso tivemos que ler o código-fonte para saber o que a tela está estampando. Sem isso,
qualquer ajuste futuro numa métrica muda o significado do número na tela **em silêncio** —
nada quebra, nada avisa.

---

## 4. Critérios de aceite

Como validaremos — e como vocês podem validar antes de entregar.

| # | Cenário | Esperado |
|---|---|---|
| 1.1 | Sessão ativa com `dataHora` de **30 dias atrás**, sem registro | Entra em `pendenteRegistro` |
| 1.1 | Sala com `Falhou` numa sessão de **30 dias atrás** | **Não** entra em `linkMeetFalhou` (janela mantida) |
| 1.2 | Cancelar **hoje** uma sessão marcada para **daqui a 20 dias** | Entra em `canceladas14Dias` |
| 1.2 | Sessão de 10 dias atrás, cancelada há **3 meses** | **Não** entra em `canceladas14Dias` |
| 1.3 | Duas canceladas pela usuária + uma pela profissional, na janela | `canceladas14Dias: 3`, `canceladasPelaUsuaria14Dias: 2` |
| 1.4 | `GET /profissional/agenda?…&ordem=desc` | Mais recente primeiro |
| 1.4 | `GET /usuaria/sessoes?…&ordem=desc` | Mais recente primeiro |
| 1.4 | Sem `ordem` | Ascendente (inalterado) |

Do nosso lado, ao receber: atualizamos o `openapi.yaml`, regeneramos os tipos e rodamos o
guarda de drift (`m04:check-drift`), que compara nosso contrato com o `/v3/api-docs` de vocês
e falha se divergir.

---

## 5. Confirmação da 1ª rodada

Registrado para fechar o ciclo. Nada aqui pede ação.

| # | Item | O que foi observado |
|---|---|---|
| 1 | `podeCancelar` após desistência | `false`, com `saiuEm` preenchido (`2026-08-06T17:28:03Z`) e vagas 12/12 ✅ |
| 2 | Sessões abandonadas na listagem | Resolvido pela opção A. A sessão `55cb3046-…` é de **13/08, futura**, e não aparece nem em `?page=0&size=100` sem filtro de data nem de status ✅ (ver §2) |
| 3 | Ordenação por data | Ascendente nas duas rotas: 34 sessões (jan/26→jun/27) e 20 sessões (10/08→27/10) ✅ (ver §1.4) |
| 4 | Endpoint de resumo | 200 com as 5 métricas; já em uso, substituiu 4 requisições ✅ (ver §1.1/§1.2) |
| 5 | `canceladaPor` no `SessaoResumo` | Presente e populado ✅ (ver §1.3) |

**Dois registros positivos, com evidência:**

- **`receitaPrevistaMes` bate exatamente** com a soma que o cliente fazia: `830` dos dois
  lados, sobre 28 sessões do mês. E o cálculo de vocês é **melhor que o nosso**: usa o
  timezone da profissional em vez de assumir `America/Sao_Paulo`, e tira as bordas do mês de
  `atStartOfDay(tz)`, sem o erro de fuso que concatenar `Z` produziria.
- **`proximos7Dias` mudou de semântica** em relação ao nosso código antigo (contava do início
  do dia; agora conta de `agora`). A nova é mais fiel ao rótulo "Próximos" — registrando só
  para não parecer divergência não percebida.

**Uma observação de método, sobre o item 2:** o primeiro teste deu falso positivo. Filtramos
por data futura, a lista veio sem nenhuma sessão de grupo, e isso *pareceria* corrigido mesmo
se não estivesse. Refizemos com a janela mais ampla possível, para separar "excluída porque
saiu" de "fora do recorte". A conclusão da tabela é a do segundo teste.

---

## 6. Do nosso lado (informativo)

- Contrato atualizado (`canceladaPor` + `/profissional/agenda/resumo`); guarda de drift no
  verde — **18 schemas batendo**.
- A agenda saiu de **7 para 5** requisições. As quatro de contagem viraram uma; as três
  restantes buscam sessões de verdade e não têm agregado que as substitua.
- O ganho maior não é o número: **saiu o `size=100` do mês inteiro**, a única parte da tela
  que supunha um volume máximo de sessões.
- Seguem no nosso backlog, já destravadas pela 1ª rodada e **sem dependência de vocês**:
  remover a ordenação paliativa do cliente, simplificar a busca da próxima sessão e voltar a
  confiar em `podeCancelar` no detalhe.
