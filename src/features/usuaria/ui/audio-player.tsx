'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  src: string | null
  titulo: string
  /** Duração humana ("6 min") mostrada como dica até os metadados carregarem. */
  duracao?: string
}

/** Segundos → m:ss (tempo do scrubber). */
function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Waveform decorativa: alturas 0.32..0.94 geradas por uma soma de senos —
// DETERMINÍSTICA (sem Math.random) para o SSR e o cliente baterem na hidratação.
// Não representa o áudio real (isso exigiria decodificar o arquivo); é um traço
// estável e orgânico que serve de trilha buscável.
const BARS = 56
const BAR_HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const v = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 0.37 + 1.1) * 0.3 + Math.sin(i * 2.3 + 0.5) * 0.2
  return 0.32 + Math.abs(v) * 0.62
})

/**
 * Player de áudio próprio, no tema da Usuária (ameixa/malva sobre o card blush) —
 * substitui o `<audio controls>` nativo (o retângulo cinza do navegador) por
 * controles estilizados: play/pause, ±15s, barra buscável e tempos. O `<audio>`
 * real fica escondido; o React dirige tudo pelos eventos de mídia. Acessível:
 * a barra é um `slider` navegável por teclado (setas, Home/End, espaço).
 */
export function AudioPlayer({ src, titulo, duracao }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)

  const ratio = total > 0 ? Math.min(current / total, 1) : 0

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }, [])

  const skip = useCallback((delta: number) => {
    const a = audioRef.current
    if (!a || !Number.isFinite(a.duration)) return
    a.currentTime = Math.min(Math.max(a.currentTime + delta, 0), a.duration)
    setCurrent(a.currentTime)
  }, [])

  const seekToClientX = useCallback((clientX: number) => {
    const a = audioRef.current
    const el = trackRef.current
    if (!a || !el || !Number.isFinite(a.duration) || a.duration <= 0) return
    const rect = el.getBoundingClientRect()
    const r = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    a.currentTime = r * a.duration
    setCurrent(a.currentTime)
  }, [])

  // Espelha o estado do elemento <audio> no React. `dragging` congela o tempo
  // durante o scrub para o thumb não "brigar" com o timeupdate.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => { if (!dragging) setCurrent(a.currentTime) }
    const onMeta = () => { setTotal(a.duration); setReady(true) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnd = () => { setPlaying(false); setCurrent(a.duration) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnd)
    }
  }, [dragging])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    seekToClientX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) seekToClientX(e.clientX)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); skip(5) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); skip(-5) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
    else if (e.key === 'Home') { e.preventDefault(); if (a) { a.currentTime = 0; setCurrent(0) } }
    else if (e.key === 'End') { e.preventDefault(); if (a && Number.isFinite(a.duration)) { a.currentTime = a.duration; setCurrent(a.duration) } }
  }

  return (
    <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-plum-soft to-mauve-ghost p-5 shadow-card">
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
      <div className="relative z-10">
        <p className="text-eyebrow text-mauve">Áudio</p>
        <p className="mt-1 font-display text-lg leading-snug text-plum">{titulo}</p>
        {duracao && <p className="mt-0.5 text-xs text-plum/45">{duracao}</p>}

        <audio ref={audioRef} src={src ?? undefined} preload="metadata" className="hidden" />

        {/* Waveform buscável — barras tocadas em malva, restantes em ameixa suave */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(total) || 0}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${fmt(current)} de ${fmt(total)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="mt-5 flex h-12 cursor-pointer touch-none select-none items-center gap-[3px] outline-none focus-visible:opacity-90"
        >
          {BAR_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className={cn(
                'flex-1 rounded-full transition-colors duration-150',
                (i + 0.5) / BARS <= ratio ? 'bg-mauve' : 'bg-plum/20',
              )}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>

        {/* Tempos */}
        <div className="mt-2 flex items-center justify-between text-[11.5px] font-medium tabular-nums text-plum/50">
          <span>{fmt(current)}</span>
          <span>{ready ? fmt(total) : '—:—'}</span>
        </div>

        {/* Transporte: −15 · play/pause · +15 */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <TransportButton label="Voltar 15 segundos" onClick={() => skip(-15)}>
            <SkipIcon dir="back" />
          </TransportButton>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-mauve text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es hover:bg-mauve-dark active:scale-95"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <TransportButton label="Avançar 15 segundos" onClick={() => skip(15)}>
            <SkipIcon dir="fwd" />
          </TransportButton>
        </div>
      </div>
    </div>
  )
}

function TransportButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border border-mauve/15 bg-white/70 text-mauve',
        'transition-es hover:bg-white active:scale-95',
      )}
    >
      {children}
    </button>
  )
}

/* ── Ícones inline (sem lib) ── */
function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-0.5">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.3" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.3" />
    </svg>
  )
}
/** Glifo "pular ±15s": arco de retorno + a marca "15". */
function SkipIcon({ dir }: { dir: 'back' | 'fwd' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === 'back' ? (
        <>
          <path d="M3 8a9 9 0 1 0 2.6-4" />
          <path d="M3 3v4h4" />
        </>
      ) : (
        <>
          <path d="M21 8a9 9 0 1 1-2.6-4" />
          <path d="M21 3v4h-4" />
        </>
      )}
      <text x="12" y="15.6" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">15</text>
    </svg>
  )
}
