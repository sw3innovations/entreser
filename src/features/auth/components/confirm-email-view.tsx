'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { mensagemDoErro } from '../lib/errors'
import { authService } from '../services'
import { DevTokenNotice } from './dev-token-notice'
import { FormMessage } from './form-message'
import { IconMailOpen } from './icons'

interface ConfirmEmailViewProps {
  token?: string
  email?: string
  devToken?: string
}

/**
 * F3 — confirmação de e-mail.
 * Dois modos:
 *  - com `token`  → confirma a conta e mostra o resultado;
 *  - sem `token`  → aviso "enviamos um link", com reenvio.
 */
export function ConfirmEmailView({ token, email, devToken }: ConfirmEmailViewProps) {
  if (token) return <ConfirmarPorToken token={token} />
  return <AvisoConfirmacao email={email} devToken={devToken} />
}

function ConfirmarPorToken({ token }: { token: string }) {
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  const [mensagem, setMensagem] = useState('')
  const jaChamado = useRef(false)

  useEffect(() => {
    // Evita chamada dupla em StrictMode (a 2ª veria o token como "já usado").
    if (jaChamado.current) return
    jaChamado.current = true

    authService
      .confirmarEmail(token)
      .then(() => setEstado('ok'))
      .catch((e) => {
        setEstado('erro')
        setMensagem(mensagemDoErro(e))
      })
  }, [token])

  if (estado === 'carregando') {
    return <p className="text-center text-sm text-cream/40">Confirmando seu e-mail…</p>
  }

  if (estado === 'ok') {
    return (
      <div className="space-y-5 text-center">
        <FormMessage tone="success">
          E-mail confirmado! Sua conta está ativa e pronta para uso.
        </FormMessage>
        <Link
          href="/login"
          className="block text-sm font-medium text-cream transition-colors hover:text-cream/80"
        >
          Entrar agora
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-center">
      <FormMessage>{mensagem}</FormMessage>
      <Link
        href="/login"
        className="block text-sm text-cream/50 transition-colors hover:text-cream"
      >
        Voltar para o login
      </Link>
    </div>
  )
}

function AvisoConfirmacao({ email, devToken }: { email?: string; devToken?: string }) {
  const tokenAtual = devToken ?? null
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  async function reenviar() {
    if (!email || enviando) return
    setEnviando(true)
    setFeedback(null)
    try {
      await authService.reenviarConfirmacao(email)
      setFeedback({ ok: true, msg: 'Enviamos um novo link de confirmação. Confira seu e-mail e a caixa de spam.' })
    } catch (e) {
      setFeedback({ ok: false, msg: mensagemDoErro(e) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center text-cream/70">
        <IconMailOpen />
      </div>

      <div>
        <h1 className="font-display text-2xl font-light text-cream">
          Confirme seu e-mail
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-cream/50">
          Enviamos um link de confirmação
          {email ? (
            <>
              {' '}
              para <strong className="text-cream/80">{email}</strong>
            </>
          ) : null}
          . Clique nele para ativar sua conta.
        </p>
      </div>

      {tokenAtual && (
        <DevTokenNotice
          descricao="Sem envio de e-mail real nesta demonstração — use o link abaixo para confirmar a conta."
          href={`/confirmar-email?token=${tokenAtual}`}
          cta="Confirmar e-mail agora"
        />
      )}

      {/* Reenvio real do link (F3) — `POST /auth/reenviar-confirmacao`, idempotente
          e com rate limit. Cobre também quem cai aqui do login (conta não confirmada). */}
      {email && !tokenAtual && (
        <div className="space-y-3">
          {feedback && <FormMessage tone={feedback.ok ? 'success' : 'error'}>{feedback.msg}</FormMessage>}
          {!feedback?.ok && (
            <p className="text-xs leading-relaxed text-cream/40">
              Não recebeu? Confira o spam ou reenvie o link.
            </p>
          )}
          <button
            type="button"
            onClick={reenviar}
            disabled={enviando}
            className="text-sm font-medium text-cream underline-offset-4 transition-colors hover:underline disabled:cursor-default disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
          </button>
        </div>
      )}

      <Link
        href="/login"
        className="block text-sm text-cream/40 transition-colors hover:text-cream"
      >
        Voltar para o login
      </Link>
    </div>
  )
}
