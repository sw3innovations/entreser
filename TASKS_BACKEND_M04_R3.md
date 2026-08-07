# Devolutiva — M04 (Agendamento), 3ª rodada

> ## ✅ Resolvido — verificado em 07/08/2026
>
> Entregue no commit `241d05e4` e conferido: **os 5 itens estão fechados**, e o frontend já
> consome tudo. Nada aqui depende mais do backend.
>
> | Item | Como veio | Verificação |
> |---|---|---|
> | §1 `jaInscrita` | Opção A, a preferida — reusou o campo existente | `false` na abandonada, `true` nas demais ✅ |
> | §2.1 Reagendamento | `sendReagendamento` para profissional **e** paciente | Duas notificações ✅ |
> | §2.2 Convite | `criarConvite` devolve token; `sendConviteParceira` linka `/convite/:token` | ✅ |
> | §2.3 Casal | Laço sobre as demais participantes ativas no ramo da usuária | ✅ |
> | §2.4 Saída de grupo | Avisa a profissional | ✅ |
> | §3 `ordem` | `OrdemSessaoResolver`, ponto único | `ordem=descendente` → **400 `PARAMETRO_INVALIDO`** ✅ |
>
> **O `incluirSaidas` finalmente foi ligado** (era o que o §1 bloqueava). O histórico marca
> a sessão abandonada com o selo "Você saiu" ao lado do status — sem ele o card mostraria
> "Agendada" e pareceria que ela participou.
>
> Fizeram mais do que o pedido em dois pontos: o `ordem` passou a **rejeitar** valor inválido
> em vez de mascarar (era sugestão sem urgência), e o reagendamento notifica os **dois** lados,
> não só a profissional.

_Resposta à entrega do commit `0b162765` ("devolutiva 2a rodada M04 — resumo, ordenacao e
historico"). Verificado em **07/08/2026** por três caminhos: leitura do código, `/v3/api-docs`
do `dev-api` e chamadas reais com as duas contas (profissional `a6f1f31c-…`, usuária
`b46b3960-…`)._

## Resumo

**Os 5 itens da 2ª rodada estão corrigidos** e já em produção no `dev-api`. Rodamos os 8
critérios de aceite do documento anterior — **todos passaram** (§3). O frontend já consome
tudo: contrato atualizado, drift verde, telas ajustadas.

Resta **um item**, e ele é a última peça de algo que vocês construíram inteiro:

| | Item | Severidade |
|---|---|---|
| §1 | `incluirSaidas=true` não devolve nada que identifique o que foi abandonado | **Média** |

Não é defeito do que foi feito — é uma peça que faltou para o recurso ser utilizável.
**Enquanto isso não existir, não conseguimos ligar o `incluirSaidas`**, e a decisão de
produto da 2ª rodada (histórico deve preservar grupo abandonado) fica sem efeito na tela.

---

## 1. `incluirSaidas` não é consumível: nada distingue a sessão abandonada

**O que foi entregue e funciona:** `GET /usuaria/sessoes?incluirSaidas=true` traz de volta as
sessões de grupo com `saiuEm` preenchido, mantendo `false` como default. Confirmado ao vivo —
a listagem vai de 20 para 21 itens e a sessão `55cb3046-…` reaparece.

**O problema:** ela reaparece **indistinguível** de uma sessão em que a usuária continua
inscrita. Este é o objeto exatamente como chega:

```json
{
  "id": "55cb3046-ae12-43df-a398-dd154339b3e7",
  "tituloGrupo": "Testando terapia em grupo",
  "status": "Agendada",
  "jaInscrita": null,
  "vagas": null,
  "vagasDisponiveis": null,
  "totalParticipantes": null
}
```

Todos os campos que poderiam sinalizar a saída vêm **nulos**, e `status` é da *sessão*
(`Agendada`, porque ela segue de pé para as outras participantes), não do vínculo dela.

Confirmado no código: `SessaoMapper.resumo()` preenche `id`, `tipo`, `dataHora`,
`duracaoMinutos`, `status`, `tituloGrupo`, `valorPraticado`, `profissional`, `linkMeetStatus`
e `canceladaPor` — nenhum campo de vínculo. `jaInscrita` continua sendo preenchido só em
`GET /grupos`.

**Por que importa:** o histórico passaria a mostrar *"Testando terapia em grupo · Agendada"*
para uma sessão que ela **abandonou**. A leitura natural é "eu participei disso" — e é falso.

Isso é pior do que o estado atual. Hoje o histórico é **incompleto** (a sessão não aparece);
com `incluirSaidas` ligado sem marcador, ele fica **enganoso**. Entre as duas, incompleto é
menos danoso, e é por isso que ainda não ligamos o parâmetro.

**O que resolveria** (qualquer um dos dois, preferência pelo primeiro):

| Opção | O que muda | Observação |
|---|---|---|
| **A. Popular `jaInscrita`** (preferida) | `false` para quem tem `saiuEm`, `true` para quem segue inscrita — nesta rota, quando `incluirSaidas=true` | Campo **já existe** no `SessaoResumo` e já tem exatamente esse significado em `GET /grupos`. Zero superfície nova. |
| **B. Expor `saiuEm`** | Novo campo no `SessaoResumo`, nulo quando não se aplica | Mais informativo (dá a data da saída), mas é campo novo no contrato |

Com a opção A, a tela passa a marcar o item com algo como *"Você saiu deste grupo"* e o
histórico fica verdadeiro.

---

## 2. Uma sugestão pequena, sem urgência

`ordem` aceita qualquer string e trata tudo que não seja `desc` (case-insensitive) como
`asc`. Um `ordem=descendente` ou `ordem=DSC` por engano devolve silenciosamente a ordem
oposta à pretendida, sem 400.

Não nos atrapalha — o cliente é tipado pelo contrato e só emite `asc`/`desc`. Fica como
observação para quando outro consumidor entrar.

Na mesma linha: a expressão que monta o `Sort` está duplicada nos dois controllers
(`ProfissionalAgendaController.ordenacaoPorDataHora()` e inline no
`UsuariaSessaoController`). São dois lugares para mudar se a regra evoluir.

---

## 3. Critérios de aceite da 2ª rodada — resultados

Os 8 cenários do `TASKS_BACKEND_M04_R2.md` §4, executados contra o `dev-api`:

| # | Cenário | Resultado |
|---|---|---|
| 1.1 | Pendência de registro antiga entra na contagem | ✅ código (`noPeriodo(null, agora)`) — sem dado para observar, ver ressalva |
| 1.1 | Sala falhada antiga **não** entra | ✅ janela `−14d/+90d` mantida e desacoplada |
| 1.2 | Cancelamento de hoje para sessão futura entra | ✅ |
| 1.2 | Sessão antiga cancelada há meses **não** entra | ✅ |
| 1.3 | `canceladas14Dias` vs `canceladasPelaUsuaria14Dias` | ✅ 23 e 20 — conferidos item a item por fora |
| 1.4 | `/profissional/agenda?ordem=desc` | ✅ |
| 1.4 | `/usuaria/sessoes?ordem=desc` | ✅ |
| 1.4 | Sem `ordem` → ascendente | ✅ idêntico ao `ordem=asc` |

**O §1.2 em números.** Na base de dev, a diferença entre contar por `canceladaEm` e por
`dataHora`:

```
por canceladaEm (correto):  23
por dataHora    (o antigo):  3
```

**Vinte cancelamentos estavam invisíveis** — o painel mostrava 3 de 23. Vale o aviso: quem
olhar a tela vai ver o número saltar de 3 para 23 e pode ler como regressão, quando é o
oposto.

**Uma ressalva de método:** o §1.1 não deu para provar em runtime — a conta de teste tem
`pendenteRegistro: 0`, então não havia o que observar. Confirmamos só por leitura de código.
É o único dos oito que não tem evidência de execução.

**Registro positivo:** as `@Schema(description=...)` do `ResumoAgendaDTO` resolveram
exatamente o que pedimos. Foi lendo elas — e não o código — que documentamos nosso contrato
desta vez.

---

## 4. Do nosso lado — já entregue

Tudo o que a 2ª rodada destravou está consumido:

- **Contrato atualizado**: `ordem`, `incluirSaidas`, `canceladasPelaUsuaria14Dias` e as
  descrições que a entrega tornou obsoletas. Guarda de drift **verde**, 18 schemas.
- **Métrica corrigida**: o card voltou a ser "canceladas **pelas usuárias**", usando o campo
  novo — mostra 20 em vez de 23, excluindo o que a própria profissional cancelou. Era o
  objetivo original, abandonado quando só existia o total.
- **"Anteriores" pede `ordem=desc`** nas duas telas.
- **Os últimos paliativos saíram**: a próxima sessão da home voltou a `size=1` (baixava 50
  registros para renderizar 1, com uma suposição de volume que ninguém revisitaria), e o
  detalhe da sessão voltou a confiar em `podeCancelar` em vez de vetar pelo `saiuEm`.

Um detalhe que quase passou: a agenda reordenava tudo no cliente, resquício de quando o
servidor não ordenava. Mandar `ordem=desc` e reordenar em seguida teria deixado o parâmetro
**inerte** — a tela idêntica, e a impressão de que a entrega de vocês não tinha funcionado.

**Só o `incluirSaidas` ficou de fora**, pelo motivo do §1.
