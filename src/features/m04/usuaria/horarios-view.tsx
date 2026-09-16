'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import {
  PageHero,
  PageContent,
  HeroIconButton,
  ArrowLeftIcon,
} from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { janelaDoHorizonte, reais } from '@/features/m04/lib/datas'
import { CalendarioSlots } from './calendario-slots'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']
type TipoSessao = components['schemas']['TipoSessao']

/**
 * U4 · Horários disponíveis. A tela faz UMA busca — o horizonte inteiro de 90 dias, o teto
 * que o contrato permite — e entrega ao `CalendarioSlots`, que desenha o calendário, abre
 * no primeiro mês com vaga e mostra os horários do dia escolhido. Navegar entre meses e
 * dias não custa requisição nenhuma. O backend já filtrou o que não pode ser marcado, então
 * a tela nunca desabilita um horário: se veio, é selecionável. Escolher leva à confirmação
 * (U5).
 *
 * A busca por mês, que veio antes desta, tinha o defeito de abrir sempre no mês atual: com
 * a agenda esparsa, quem entrava em agosto via uma grade inteira apagada e precisava
 * adivinhar quantas vezes clicar em "›". Ver o horizonte todo de uma vez resolve isso sem
 * reintroduzir o avanço automático às cegas que existia na versão semana a semana — lá a
 * pessoa era levada a outubro sem saber; aqui o mês está escrito no cabeçalho e o "‹"
 * continua disponível.
 */
export function HorariosView({ tipo, profissionalId }: { tipo: TipoSessao; profissionalId: string }) {
  const router = useRouter()
  const voltar = useVoltar(`/agendar/${tipo}`)
  const janela = janelaDoHorizonte()

  const { dados, carregando, erro, recarregar } = useRecurso(
    () =>
      m04.GET('/profissionais/{profissionalId}/slots', {
        params: { path: { profissionalId }, query: { tipo, inicio: janela.inicio, fim: janela.fim } },
      }),
    [profissionalId, tipo],
  )

  const escolher = (slot: Slot) => {
    router.push(
      `/agendar/${tipo}/${profissionalId}/confirmar?inicio=${encodeURIComponent(slot.inicio)}&fim=${encodeURIComponent(slot.fim)}`,
    )
  }

  const topBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        topBarClassName="lg:hidden"
        eyebrow="Agendar"
        title="Escolha o horário"
        description={
          dados
            ? [`Sessão de ${dados.duracaoMinutos} minutos`, reais(dados.valor)].filter(Boolean).join(' · ')
            : 'Horários disponíveis'
        }
      />
      <PageContent width="md" className="pt-6">
        {/* Só o ERRO troca a tela inteira: o calendário fica de pé durante a carga (é o
            controle de navegação entre meses) e ele mesmo cuida do spinner e do vazio. */}
        <Estado carregando={false} erro={erro} aoRepetir={recarregar}>
          <CalendarioSlots
            slots={dados?.slots ?? []}
            carregando={carregando}
            aoEscolher={escolher}
            aoVazio={
              <EmptyState
                title="Sem horários por enquanto"
                description="Esta profissional não tem horários livres nos próximos meses. Você pode escolher outra profissional."
              />
            }
          />
        </Estado>
      </PageContent>
    </div>
  )
}
