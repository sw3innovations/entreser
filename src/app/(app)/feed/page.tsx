import { redirect } from 'next/navigation'

/** O Feed virou o Explorar (redesenho). Links antigos e favoritos continuam funcionando. */
export default function FeedPage() {
  redirect('/explorar')
}
