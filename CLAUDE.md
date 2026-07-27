# Entre Ser — Contexto do Projeto

Plataforma de saúde mental para mulheres e casais tentantes. Tom: acolhedor,
sóbrio, empático — nunca clínico ou frio. Português brasileiro em toda a UI.

Este repositório é a **recriação do zero** do app (o protótipo antigo vive em
`../entreser`). A etapa atual implementa **apenas autenticação** (spec M01),
perfil **Usuária**, em modo **frontend-only**.

## Stack

- Next.js 16 (App Router, React Server Components) · React 19 · TypeScript estrito
- Tailwind CSS v4 — tema 100% em `src/app/globals.css` via `@theme inline` (sem `tailwind.config`)
- Zod + react-hook-form (`@hookform/resolvers/zod`)
- Fontes via `next/font`: Cormorant Garamond (`--font-display`) + Onest (`--font-onest`)
- HeroUI v3 (`@heroui/react`) entra **só** para o DatePicker da data de
  nascimento (`features/auth/components/birth-date-field.tsx`); o resto das
  telas de auth segue Tailwind puro. Sem framer-motion.

## Fonte da verdade

- Spec técnica: `../Claude/spec.md` (M01 · Cadastro e Acesso) — **manda**.
- `../entreser/especificacao.md` é a spec antiga de produto e diverge (campo
  "fase", "WhatsApp"); só referência histórica.

## Design — telas de auth

Tema escuro próprio (diferente do resto do app): gradiente `from-plum via-plum-mid
to-mauve-dark`, orbs com `blur-3xl`, inputs glassmorphic (`bg-white/10
backdrop-blur`), botão primário pílula creme, erros em `mauve-soft`. Tudo
encapsulado em `features/auth/components` (AuthShell, AuthField, AuthSubmit,
AuthCheckbox, GoogleButton, BirthDateField). Ícones são SVG inline (sem lib de
ícones). O BirthDateField (DatePicker do HeroUI) é estilizado para combinar com
o glassmorphic; o calendário é escuro on-brand via override das variáveis
semânticas do HeroUI no `:root` de `globals.css` (precisa ser `:root` porque o
popover é renderizado em portal no `<body>`).

Tokens (classes Tailwind): `plum`/`plum-mid`/`plum-light`/`plum-soft`,
`mauve`/`mauve-dark`/`mauve-mid`/`mauve-soft`, `cream`/`cream-mid`/`cream-dark`,
`red-alert` (somente erros).

## Arquitetura

Feature-based. Tudo de auth em `src/features/auth/`. O contrato `AuthService`
isola a UI do backend; a implementação ativa fica em `services/index.ts` (hoje
`MockAuthService`, com "banco" em `localStorage`). Validação Zod centralizada em
`schemas/auth.schema.ts` (reutilizável no servidor quando o backend entrar).
Erros padronizados (`lib/errors.ts`) seguem `{ codigo, mensagem, campo }` da spec.

Rotas: `(auth)` públicas, `(app)` autenticadas (guard no cliente hoje; no
backend real vira proxy otimista + Data Access Layer no servidor).

## Branches e ambientes

| Branch | Papel |
|---|---|
| `main` | **Homologação** — é o que está publicado em `app.entreser.sw3.tec.br` e o que as clientes veem. Só recebe o que já vai ser apresentado. |
| `develop` | Trabalho corrente: módulos novos e melhorias. É daqui que se ramifica. |
| `feat/*` | Uma frente de trabalho; nasce de `develop` e volta pra lá. |

Promover para homologação é **merge `develop` → `main`**, e acontece quando o módulo vai
ser apresentado — não a cada commit. Correção urgente do que já está no ar pode ir direto
na `main` (e depois voltar pro `develop`), como foi o fix do primeiro acesso.

⚠️ **A config de deploy não está no repositório** (sem `.github/workflows`, sem
`vercel.json`) — ela vive na hospedagem e observa a `main`. Renomear ou trocar essa branch
quebra a publicação até alguém ajustar lá.

## Padrões de código

- Server Components por padrão; `'use client'` só com hooks/eventos/estado.
- Props tipadas com `interface`; sem `any` (usar `unknown`).
- Named exports em componentes; `export default` só em pages/layouts.
- `cn()` para classes condicionais.
- Tom de voz: "Entrar", "Criar minha conta"; erros com empatia, nunca códigos.

## Escopo / fora de escopo

Dentro: F1–F9 (Usuária). Fora (fases futuras): backend real, Profissional/Admin
(F10–F13), painel admin, rate limiting, LGPD, onboarding de "fase".

## Conta de demonstração

`maria@entreser.com.br` / `Entre123` (semeada no mock). Sem e-mail real: tokens
de confirmação/reset aparecem num bloco "Modo demonstração" na própria tela.
