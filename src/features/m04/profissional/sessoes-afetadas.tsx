'use client'

import Link from 'next/link'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { hora } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']

/** "5 de agosto" — data curta da linha, sem dia da semana (o horário já vem ao lado). */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

/**
 * Banner de consequências de P4 e P5. As duas telas devolvem, junto com o resultado, as
 * sessões que ficaram fora da nova agenda / dentro do bloqueio — e **nada é cancelado
 * automaticamente**. Dizer isso com todas as letras é o ponto: sem esse aviso, a
 * profissional acha que resolveu e a usuária aparece na sala.
 *
 * O cancelamento não acontece aqui: cada linha leva ao detalhe da sessão, que é onde a
 * ação vive (com o diálogo de confirmação e o aviso de cobrança).
 */
export function SessoesAfetadas({
  sessoes,
  titulo,
  onFechar,
}: {
  sessoes: SessaoResumo[]
  titulo: string
  onFechar?: () => void
}) {
  // Nome do tipo vem do catálogo — nunca escrito na tela.
  const { dados: catalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const nomeDoTipo = (codigo: SessaoResumo['tipo']) =>
    catalogo?.tipos.find((t) => t.codigo === codigo)?.nome ?? codigo

  if (sessoes.length === 0) return null

  return (
    <section className="overflow-hidden rounded-card border border-mauve/30 bg-white shadow-[0_12px_32px_rgba(45,24,64,0.08)]">
      <div className="flex items-start gap-4 bg-gradient-to-r from-mauve/10 to-mauve/[0.04] p-5">
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-pill bg-mauve text-white shadow-[0_6px_16px_rgba(122,74,92,0.3)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8.5v5M12 17h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-plum">{titulo}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-plum/70">
            <strong className="font-semibold">Elas continuam valendo</strong> — nada foi cancelado.
            Se quiser desmarcar, cancele uma a uma pelo detalhe da sessão.
          </p>
        </div>
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar aviso"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[17px] leading-none text-plum/45 transition-colors hover:bg-plum/7 hover:text-plum"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex flex-col">
        {sessoes.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 border-t border-plum/7 px-[22px] py-3.5">
            <div className="shrink-0">
              <p className="font-display text-[19px] font-medium leading-none text-plum">{hora(s.dataHora)}</p>
              <p className="mt-1 text-xs text-plum/50">{dataCurta(s.dataHora)}</p>
            </div>
            <span className="w-px self-stretch bg-plum/8" />
            <div className="min-w-0 flex-1 basis-[200px]">
              <p className="text-[14.5px] font-semibold text-plum">{s.tituloGrupo ?? nomeDoTipo(s.tipo)}</p>
              <p className="mt-0.5 text-[13px] text-plum/58">
                {s.tituloGrupo
                  ? `${s.totalParticipantes ?? 0} ${s.totalParticipantes === 1 ? 'inscrita' : 'inscritas'}`
                  : (s.participanteNome ?? 'Sessão marcada')}
              </p>
            </div>
            <Link
              href={`/admin/agenda/${s.id}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-plum/16 bg-white px-4 py-2 text-[13.5px] font-semibold text-plum transition-colors hover:border-plum hover:bg-plum-soft"
            >
              Ver sessão
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
