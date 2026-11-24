import type { Metadata } from 'next'
import { ottomat, onest } from '@/lib/fonts'
import { AuthProvider } from '@/features/auth/context/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'Entre Ser',
  description: 'Plataforma de saúde mental para mulheres e casais tentantes.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${ottomat.variable} ${onest.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
