# Redesenho do app da Usuária — plano de execução

**Branch:** `feat/redesenho-usuaria` (a partir de `develop`) → PR para `develop` → `deploy.sh dev` na VPS
publica em `dev.entreser.sw3.tec.br` (backend `dev-api`).

**Fontes:** documento "Entre Ser: melhorias de UX/UI" + protótipo `EntreSer-telas-app.html`
(Claude Design). Telas do protótipo implementadas: **Home (1a), Explorar (1c), Jornada (1f),
Consultas (1h)**. Perfil da profissional (1i/1j/2a) fica fora, como pedido — o perfil atual continua.

## Princípios aplicados em todas as telas

- **Sem header ameixa.** No lugar, o "véu" do protótipo: gradiente `#E7D7DF → #EFE9F1 → transparente`
  no topo, sobre fundo `#F6F5F8`.
- **Imagem.** As duas ilustrações do protótipo (casal + psicóloga, em ameixa e em verde-água) entram
  como capas padrão quando o conteúdo/trilha não tem `thumb`. **Sem bebês nem gestantes** — segue o
  alerta de curadoria do documento.
- **Hierarquia.** Cada tela tem uma ordem fixa de seções (abaixo).
- **Navegação inferior:** Início · Explorar · Jornada · Consultas · Conta.

## O que o backend já entrega (dev, `development@1a06ce57`)

O backend andou muito desde setembro — boa parte do que o documento pede já tem API:

| Necessidade | Endpoint |
|---|---|
| Check-in de humor | `POST/GET /paciente/termometro` — `pontuacao` 1–5, até 5 `emocoes` de `CALMA ANSIOSA TRISTE IRRITADA ESPERANCOSA EXAUSTA ALIVIADA OUTRA`, `nota` opcional |
| "Já fez o check-in hoje?" | `GET /paciente/jornada/hoje` → `checkinFeitoHoje`, `registros` do dia, `sessoes` do dia, `faseAtual`, `modalidadeAtiva` |
| Próximos compromissos | `GET /paciente/jornada/agenda` → `registros` (exames, medicamentos…) e `sessoes` futuras, `marcos`, `checkins` |
| Fase do tratamento | `GET /paciente/jornada/tratamentos` (fases `INDUCAO ESTIMULACAO COLETA TRANSFERENCIA BETA POS_RESULTADO OUTRA`) |
| Trilhas recomendadas pela fase | `GET /paciente/jornada/recomendacoes` (curadoria, não inferência) |
| Práticas do dia | `GET /paciente/jornada/praticas-diarias` |
| Sessões, profissionais, grupos, tipos | M04 (`/usuaria/sessoes`, `/profissionais?tipo=`, `/grupos`, `/tipos-sessao`) |

## Ordem das seções por tela

**Home** — saudação (fase · nome) → atalhos (Jornada, Explorar, Consultas, Humor) → check-in reduzido
(se pendente) → banner de destaque (trilha recomendada/em andamento) → Próximos dias (sessões +
registros pendentes) → Para você (carrossel) com link para Explorar.

**Check-in emocional** — bottom sheet grande: escala de 5 humores ilustrados → até 5 emoções em
chips → nota opcional. Abre sozinho na Home quando `checkinFeitoHoje=false` e ela ainda não pulou
hoje. Pulou → chip "Como você está hoje?" na Home reabre a mesma tela. Preencheu → some até amanhã.

**Explorar** (substitui Feed, sem abas) — título + busca → chips de tema → carrossel de destaques →
Para você → Trilhas → Por tema. `/feed` redireciona para `/explorar`.

**Jornada** (substitui "Minha fase" na navegação) — "Você está na *fase*." → três contadores
(pedem atenção · em andamento · tudo certo) → linha das fases → Precisa de atenção (registros
atrasados/de hoje, sessões a confirmar) → Em andamento (trilhas, check-ins da semana) → Tudo certo
(compacto).

**Consultas** (tela única) — Minhas sessões (próximas + link para histórico) → Profissionais (cards
com foto e gradiente escuro) → Sessões em grupo → Tipos de sessão (informativo). Perfil e agendamento
seguem os fluxos atuais.

## Decisões tomadas (pontos em aberto do documento)

| Ponto | Decisão provisória | Por quê |
|---|---|---|
| Frequência do check-in | Uma vez por dia, ao abrir a Home | É o que o backend já mede (`checkinFeitoHoje`) |
| "Pulou hoje" | Guardado no aparelho (`localStorage`, por dia) | Não há campo no backend; é preferência de exibição, não dado clínico |
| Imagens | Ilustrações do protótipo como padrão; `thumb` do conteúdo quando existir | Sem banco de imagens contratado ainda |
| Imagem por fase | Não nesta entrega | Depende da curadoria |
| Atalhos da Home | 4: Jornada, Explorar, Consultas, Humor | "Diário" do protótipo fica para quando a tela de diário existir |
| Status da Jornada | Derivados de `registros` (concluído/data) e sessões | São os dados que já existem |

## Fases de entrega

1. Fundação: navegação nova, véu, ilustrações, primitivas (seção, carrossel, card com imagem), camada de API da Jornada.
2. Check-in emocional (sheet + chip).
3. Home.
4. Explorar.
5. Jornada.
6. Consultas.

Cada fase é um commit verificável no navegador contra o `dev-api`.
