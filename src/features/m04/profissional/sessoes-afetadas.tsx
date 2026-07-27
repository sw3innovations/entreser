'use client'

import Link from 'next/link'
import { diaPorExtenso, hora } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']

/**
 * Banner de consequências de P4 e P5. As duas telas devolvem, junto com o resultado, as
 * sessões que ficaram fora da nova agenda / dentro do bloqueio — e **nada é cancelado
 * automaticamente**. Dizer isso com todas as letras é o ponto: sem esse aviso, a
 * profissional acha que resolveu e a usuária aparece na sala.
 */
export function SessoesAfetadas({ sessoes, titulo }: { sessoes: SessaoResumo[]; titulo: string }) {
  if (sessoes.length === 0) return null
  return (
    <section className="rounded-card border border-mauve/25 bg-mauve-ghost/60 p-5">
      <h3 className="font-display text-lg text-plum">{titulo}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-plum/65">
        <strong className="font-semibold">Elas continuam valendo — nada foi cancelado.</strong> Se
        precisar, cancele uma a uma pelo detalhe da sessão.
      </p>
      <ul className="mt-3.5 flex flex-col gap-2">
        {sessoes.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-plum/8 bg-white px-4 py-3"
          >
            <span className="text-[13.5px] text-plum">
              <span className="capitalize">{diaPorExtenso(s.dataHora)}</span> · {hora(s.dataHora)}
              <span className="text-plum/50"> · {s.profissional.nome}</span>
            </span>
            <Link
              href={`/admin/agenda/${s.id}`}
              className="text-[13px] font-medium text-mauve hover:text-mauve-dark"
            >
              Ver sessão
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
