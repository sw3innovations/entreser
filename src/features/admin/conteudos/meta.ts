import type { ComponentType } from 'react'
import { AudioIcon, ConteudosIcon, ImageIcon, VideoIcon, type IconProps } from '@/components/ui'
import type { Formato } from './types'

export const FORMATO: Record<Formato, { label: string; Icon: ComponentType<IconProps> }> = {
  artigo: { label: 'Artigo', Icon: ConteudosIcon },
  video: { label: 'Vídeo', Icon: VideoIcon },
  audio: { label: 'Áudio', Icon: AudioIcon },
  imagem: { label: 'Imagem', Icon: ImageIcon },
}

export const FORMATO_OPTIONS: Formato[] = ['artigo', 'video', 'audio']
