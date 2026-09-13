import { TrilhaFimView } from '@/features/usuaria/trilhas/trilha-fim-view'

/** Fechamento de uma trilha — onde o percurso termina e o que valeu fica guardado. */
export default async function TrilhaFimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TrilhaFimView key={id} id={id} />
}
