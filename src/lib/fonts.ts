import localFont from 'next/font/local'
import { Onest } from 'next/font/google'

export const ottomat = localFont({
  src: [
    {
      path: '../assets/fonts/Ottomat_OT_Book.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Ottomat_OT_Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../assets/fonts/Ottomat_OT_Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
})

export const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
})
