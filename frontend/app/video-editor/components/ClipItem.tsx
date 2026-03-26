'use client'
import React, { useRef, useCallback, memo, useEffect, useState } from 'react'
import { Clip, PIXELS_PER_SECOND } from '../types'
import { useEditorStore } from '../../../store/videoEditorStore'

interface Props { clip: Clip; zoom: number; trackLocked: boolean }

/* ── Type icons ── */
function VideoIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M15 10l4.55-2.07A1 1 0 0121 8.88v6.24a1 1 0 01-1.45.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
    </svg>
  )
}
function AudioIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  )
}
function TextIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M4 6h16M4 10h16M4 14h10"/>
    </svg>
  )
}
function ShapeIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
    </svg>
  )
}
function ImageIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <path strokeLinecap="round" d="M21 15l-5-5L5 21"/>
    </svg>
  )
}

/* ── SVG Waveform (smooth path) ── */
function Waveform({ width, height, seed }: { width: number; height: number; seed: number }) {
  const points = Math.max(4, Math.floor(width / 4))
  const mid = height / 2
  const amp = height * 0.38

  // Generate pseudo-random waveform from clip id seed
  const tops: number[] = []
  const bots: number[] = []
  for (let i = 0; i <= points; i++) {
    const x = i
    const h = amp * Math.abs(Math.sin(i * 0.31 + seed) * 0.7 + Math.sin(i * 0.73 + seed * 2.1) * 0.3)
    tops.push(h)
    bots.push(h)
  }

  const segW = width / points

  // Build smooth SVG path (top then bottom reversed)
  let d = `M 0 ${mid}`
  for (let i = 0; i <= points; i++) {
    const x = i * segW
    d += ` L ${x} ${mid - tops[i]}`
  }
  for (let i = points; i >= 0; i--) {
    const x = i * segW
    d += ` L ${x} ${mid + bots[i]}`
  }
  d += ' Z'

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={d} fill="rgba(255,255,255,0.35)" />
    </svg>
  )
}

/* ── Video thumbnail (capture first frame from src file) ── */
function VideoThumbnails({ clip, width, height }: { clip: Clip; width: number; height: number }) {
  const [frames, setFrames] = useState<string[]>([])
  const thumbW = 56

  useEffect(() => {
    if (!clip.src || typeof clip.src !== 'string') return
    let cancelled = false

    const count = Math.max(1, Math.floor(width / thumbW))
    const vid = document.createElement('video')
    vid.src = clip.src as string
    vid.crossOrigin = 'anonymous'
    vid.muted = true
    vid.preload = 'metadata'

    const canvas = document.createElement('canvas')
    canvas.width  = thumbW
    canvas.height = height

    const captureAt = (t: number) =>
      new Promise<string>((res) => {
        vid.currentTime = isFinite(t) ? Math.max(0, t) : 0
        vid.onseeked = () => {
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(vid, 0, 0, thumbW, height)
          res(canvas.toDataURL('image/jpeg', 0.5))
        }
      })

    vid.onloadedmetadata = async () => {
      const dur = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 1
      const results: string[] = []
      for (let i = 0; i < count; i++) {
        if (cancelled) return
        const t = (i / count) * dur
        const frame = await captureAt(isFinite(t) ? t : 0)
        results.push(frame)
      }
      if (!cancelled) setFrames(results)
    }

    return () => { cancelled = true; vid.src = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.src, clip.id, width, height])

  if (frames.length === 0) {
    // Fallback: repeating gradient strip
    return (
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent ${Math.max(20, PIXELS_PER_SECOND * 0.5)}px)`,
        }}
      />
    )
  }

  return (
    <div className="absolute inset-0 flex pointer-events-none overflow-hidden opacity-50">
      {frames.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt=""
          className="shrink-0 object-cover"
          style={{ width: thumbW, height: '100%' }}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ClipItem
═══════════════════════════════════════════════════════════ */
const ClipItem = memo(function ClipItem({ clip, zoom, trackLocked }: Props) {
  const { selectedClipId, selectClip, moveClip, resizeClip,
          splitClip, duplicateClip, currentTime, setContextMenu } = useEditorStore()
  const isSelected = selectedClipId === clip.id
  const pps = PIXELS_PER_SECOND * zoom

  const left  = clip.startTime * pps
  const width = Math.max(4, (clip.endTime - clip.startTime) * pps)
  const clipH = 48 // visual height of clip (absolute, inset from track row)

  /* ── Clip color by type ── */
  const colorMap: Record<string, string> = {
    video:   '#3B5EE8',
    audio:   '#0F7B6C',
    image:   '#7C3AED',
    text:    '#B45309',
    shape:   '#be185d',
  }
  const baseColor = clip.color || colorMap[clip.type] || '#4F72EF'

  /* ── Drag clip body ── */
  const dragStart = useRef<{ x: number; t: number } | null>(null)

  const onBodyMouseDown = useCallback((e: React.MouseEvent) => {
    if (trackLocked || e.button !== 0) return
    e.stopPropagation()
    selectClip(clip.id)
    dragStart.current = { x: e.clientX, t: clip.startTime }

    const onMove = (mv: MouseEvent) => {
      if (!dragStart.current) return
      moveClip(clip.id, clip.trackId, dragStart.current.t + (mv.clientX - dragStart.current.x) / pps)
    }
    const onUp = () => {
      dragStart.current = null
      useEditorStore.getState().saveHistory()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [clip.id, clip.startTime, clip.trackId, pps, trackLocked, selectClip, moveClip])

  /* ── Resize left ── */
  const onLeftHandle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const ox = e.clientX; const os = clip.startTime; const oe = clip.endTime
    const onMove = (mv: MouseEvent) => {
      const ns = Math.max(0, Math.min(os + (mv.clientX - ox) / pps, oe - 0.25))
      resizeClip(clip.id, ns, oe)
    }
    const onUp = () => {
      useEditorStore.getState().saveHistory()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [clip.id, clip.startTime, clip.endTime, pps, resizeClip])

  /* ── Resize right ── */
  const onRightHandle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const ox = e.clientX; const os = clip.startTime; const oe = clip.endTime
    const onMove = (mv: MouseEvent) => {
      const ne = Math.max(os + 0.25, oe + (mv.clientX - ox) / pps)
      resizeClip(clip.id, os, ne)
    }
    const onUp = () => {
      useEditorStore.getState().saveHistory()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [clip.id, clip.startTime, clip.endTime, pps, resizeClip])

  /* ── Double-click: split at playhead ── */
  const onDblClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    splitClip(clip.id, currentTime)
  }, [clip.id, currentTime, splitClip])

  /* ── Right-click context menu ── */
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    selectClip(clip.id)
    setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id })
  }, [clip.id, selectClip, setContextMenu])

  const dur = clip.endTime - clip.startTime

  // Seed for waveform from clip id string
  const wSeed = clip.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100

  return (
    <div
      onMouseDown={onBodyMouseDown}
      onDoubleClick={onDblClick}
      onContextMenu={onContextMenu}
      className="absolute select-none group"
      style={{
        left,
        width,
        top: '50%',
        transform: 'translateY(-50%)',
        height: clipH,
        borderRadius: 6,
        overflow: 'hidden',
        cursor: trackLocked ? 'not-allowed' : 'grab',
        background: isSelected
          ? `linear-gradient(160deg, ${baseColor}f0 0%, ${baseColor}cc 100%)`
          : `linear-gradient(160deg, ${baseColor}cc 0%, ${baseColor}99 100%)`,
        border: isSelected
          ? `2px solid ${baseColor}`
          : `1.5px solid ${baseColor}55`,
        boxShadow: isSelected
          ? `0 0 0 2px ${baseColor}44, 0 4px 16px ${baseColor}40`
          : `0 1px 6px rgba(0,0,0,0.4)`,
        zIndex: isSelected ? 10 : 1,
      }}
    >
      {/* ── Background decorations by clip type ── */}

      {/* Video: thumbnail frames */}
      {clip.type === 'video' && width > 24 && (
        <VideoThumbnails clip={clip} width={width} height={clipH} />
      )}

      {/* Audio: smooth SVG waveform */}
      {clip.type === 'audio' && width > 20 && (
        <Waveform width={width} height={clipH} seed={wSeed} />
      )}

      {/* Image: faint checkerboard hint */}
      {clip.type === 'image' && (
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: `repeating-conic-gradient(rgba(255,255,255,.15) 0% 25%, transparent 0% 50%)`,
            backgroundSize: '8px 8px',
          }}
        />
      )}

      {/* Shape: color swatch strip */}
      {clip.type === 'shape' && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: `repeating-linear-gradient(45deg, rgba(255,255,255,.15) 0px, rgba(255,255,255,.15) 3px, transparent 3px, transparent 9px)` }}
        />
      )}

      {/* ── Label row (always on top) ── */}
      {width > 24 && (
        <div className="absolute inset-0 flex items-center px-1.5 gap-1 overflow-hidden pointer-events-none z-10">
          {/* Type icon */}
          <span className="text-white/70 shrink-0">
            {clip.type === 'video'   && <VideoIcon />}
            {clip.type === 'audio'   && <AudioIcon />}
            {clip.type === 'text'    && <TextIcon />}
            {clip.type === 'shape'   && <ShapeIcon />}
            {clip.type === 'image'   && <ImageIcon />}
          </span>

          {/* Name / text content */}
          <span
            className="text-white font-medium truncate leading-none"
            style={{
              fontSize: 10,
              textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}
          >
            {clip.type === 'text' && clip.text ? clip.text : clip.name}
          </span>

          {/* Duration badge (only if enough room) */}
          {width > 90 && (
            <span
              className="ml-auto text-white/40 font-mono shrink-0"
              style={{ fontSize: 9 }}
            >
              {dur.toFixed(1)}s
            </span>
          )}
        </div>
      )}

      {/* ── Selected overlay border glow ── */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 4,
            boxShadow: `inset 0 0 0 1px ${baseColor}`,
          }}
        />
      )}

      {/* ── Left resize handle ── */}
      <div
        onMouseDown={onLeftHandle}
        className="absolute left-0 top-0 bottom-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          width: 10,
          cursor: 'ew-resize',
          background: `linear-gradient(to right, ${baseColor}cc, transparent)`,
        }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="w-0.5 h-2 rounded-full bg-white/80" />
          <div className="w-0.5 h-2 rounded-full bg-white/80" />
        </div>
      </div>

      {/* ── Right resize handle ── */}
      <div
        onMouseDown={onRightHandle}
        className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          width: 10,
          cursor: 'ew-resize',
          background: `linear-gradient(to left, ${baseColor}cc, transparent)`,
        }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="w-0.5 h-2 rounded-full bg-white/80" />
          <div className="w-0.5 h-2 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  )
})

export default ClipItem
