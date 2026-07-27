'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso } from '@/features/m04/lib/datas'
import { hasAccessToken } from '@/lib/http/token-store'
import type { components } from '@/features/m04/api/schema'

type Convite = components['schemas']['ConvitePublico']

/**
 * U13 · Aceitar convite de sessão de casal. É a ÚNICA tela pública do módulo
 * (`GET /convites/{token}` tem `security: []`): quem recebe o e-mail pode não ter conta
 * ainda. O e-mail chega mascarado do backend — a tela só exibe, nunca mascara por conta.
 *
 * Se for preciso entrar ou criar conta, o token viaja no `?next=` para a ação ser
 * concluída na volta: perder o token no meio do cadastro quebraria o fluxo.
 */
export function ConviteView({ token }: { token: string }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados, carregando, erro: erroCarga, recarregar } = useRecurso<Convite>(
    () => m04.GET('/convites/{token}', { params: { path: { token } } }),
    [token],
  )

  const aceitar = async () => {
    if (enviando) return
    // Sem sessão, manda entrar primeiro e volta para cá com o token preservado.
    if (!hasAccessToken()) {
      router.push(`/login?next=${encodeURIComponent(`/convite/${token}`)}`)
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const { data, error } = await m04.POST('/convites/{token}/aceitar', {
        params: { path: { token } },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      if (data) router.push(`/sessoes/${data.id}`)
    } catch {
      setErro(mensagemDe())
    } finally {
      setEnviando(false)
    }
  }

  const pendente = dados?.status === 'Pendente'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-plum via-plum-mid to-mauve-dark px-5 py-12">
      <div className="w-full max-w-md rounded-card border border-white/40 bg-white/95 p-6 shadow-card backdrop-blur-xl">
        <Estado carregando={carregando} erro={erroCarga} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <>
              <p className="text-eyebrow text-mauve">Convite</p>
              <h1 className="mt-1.5 font-display text-2xl leading-snug text-plum">
                {dados.nomeQuemConvidou
                  ? `${dados.nomeQuemConvidou} convidou você para uma sessão de casal`
                  : 'Você foi convidada para uma sessão de casal'}
              </h1>

              <dl className="mt-5 flex flex-col gap-3 border-t border-plum/8 pt-4">
                <Linha rotulo="Quando" valor={dataHoraPorExtenso(dados.dataHora)} capitalizar />
                <Linha rotulo="Duração" valor={`${dados.duracaoMinutos} minutos`} />
                <Linha rotulo="Com" valor={dados.profissional.nome} />
                <Linha rotulo="Convite enviado para" valor={dados.emailMascarado} />
              </dl>

              {!pendente && (
                <p className="mt-4 rounded-input border border-plum/10 bg-cream/50 px-4 py-3 text-[13.5px] text-plum/65">
                  {dados.status === 'Aceito'
                    ? 'Este convite já foi aceito.'
                    : dados.status === 'Expirado'
                      ? 'Este convite não é mais válido.'
                      : 'Este convite foi cancelado.'}
                </p>
              )}

              {erro && <p className="mt-4 text-[13.5px] font-medium text-red-alert">{erro}</p>}

              {pendente && (
                <button
                  type="button"
                  onClick={aceitar}
                  disabled={enviando}
                  className="mt-5 h-[50px] w-full rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99] disabled:opacity-60"
                >
                  {enviando ? 'Confirmando…' : 'Aceitar convite'}
                </button>
              )}
            </>
          )}
        </Estado>
      </div>
    </div>
  )
}

/** `capitalizar` só para datas por extenso — e-mail e nome próprio vêm como estão. */
function Linha({ rotulo, valor, capitalizar }: { rotulo: string; valor: string; capitalizar?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[13px] text-plum/50">{rotulo}</dt>
      <dd className={`text-right text-[14.5px] font-medium text-plum${capitalizar ? ' first-letter:uppercase' : ''}`}>
        {valor}
      </dd>
    </div>
  )
}
