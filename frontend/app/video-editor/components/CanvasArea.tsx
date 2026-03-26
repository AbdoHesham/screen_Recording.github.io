'use client'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'
import { Clip, ASPECT_RATIOS } from '../types'

// Video element pool
const videoPool = new Map<string, HTMLVideoElement>()
function getVideo(src: string) {
  if (!videoPool.has(src)) {
    const v = document.createElement('video')
    v.src = src; v.crossOrigin = 'anonymous'; v.playsInline = true; v.muted = true; v.preload = 'auto'
    videoPool.set(src, v)
  }
  return videoPool.get(src)!
}

/* ─────────────────────────────────────────────────────
   Transform types
───────────────────────────────────────────────────── */
type HandleType =
  | 'move'
  | 'rotate'
  | 'resize-nw' | 'resize-n' | 'resize-ne'
  | 'resize-e'  | 'resize-se' | 'resize-s'
  | 'resize-sw' | 'resize-w'

const HANDLE_CURSORS: Record<HandleType, string> = {
  move:       'grab',
  rotate:     'crosshair',
  'resize-nw':'nwse-resize', 'resize-se':'nwse-resize',
  'resize-ne':'nesw-resize', 'resize-sw':'nesw-resize',
  'resize-n': 'ns-resize',   'resize-s': 'ns-resize',
  'resize-e': 'ew-resize',   'resize-w': 'ew-resize',
}

interface TransformState {
  handle: HandleType
  startClientX: number
  startClientY: number
  previewClientX: number   // preview top-left in client space
  previewClientY: number
  clip: Clip               // snapshot
  scale: number
}

/* ─────────────────────────────────────────────────────
   Main CanvasArea
───────────────────────────────────────────────────── */
export default function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef   = useRef<HTMLDivElement>(null)
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 })

  const { playing, currentTime, duration, tracks, selectedClipId, aspectRatio,
          selectClip, updateClip } = useEditorStore()

  const { w: NW, h: NH } = ASPECT_RATIOS[aspectRatio]
  const scale = previewSize.w > 0 ? previewSize.w / NW : 0

  // Responsive preview sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect()
      const padW = width - 48, padH = height - 48
      const ratio = NW / NH
      let w = padW, h = padW / ratio
      if (h > padH) { h = padH; w = padH * ratio }
      setPreviewSize({ w: Math.floor(w), h: Math.floor(h) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [NW, NH])

  // RAF playback
  const rafRef    = useRef<number>()
  const lastTsRef = useRef(0)

  useEffect(() => {
    const store = useEditorStore.getState()
    const tick = (ts: number) => {
      const s = useEditorStore.getState()
      if (!s.playing) return
      if (lastTsRef.current) {
        const dt = (ts - lastTsRef.current) / 1000
        const next = s.currentTime + dt
        if (next >= s.duration) { store.setCurrentTime(s.duration); store.setPlaying(false); return }
        store.setCurrentTime(next)
      }
      lastTsRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    if (playing) { lastTsRef.current = 0; rafRef.current = requestAnimationFrame(tick) }
    else { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing])

  // Sync video elements
  useEffect(() => {
    tracks.flatMap((t) => t.clips).forEach((clip) => {
      if (clip.type === 'video' && clip.src) {
        const vid = getVideo(clip.src)
        const offset = currentTime - clip.startTime + (clip.srcIn || 0)
        if (currentTime >= clip.startTime && currentTime < clip.endTime) {
          if (Math.abs(vid.currentTime - offset) > 0.2) vid.currentTime = offset
          if (playing && vid.paused) vid.play().catch(() => {})
          else if (!playing && !vid.paused) vid.pause()
        } else {
          if (!vid.paused) vid.pause()
        }
      }
    })
  }, [currentTime, playing, tracks])

  /* ── Transform state ── */
  const transformRef = useRef<TransformState | null>(null)
  const [activeCursor, setActiveCursor] = useState('default')

  // Find clip at canvas position
  const findClipAt = useCallback((x: number, y: number): Clip | null => {
    const t = useEditorStore.getState().currentTime
    for (const track of [...useEditorStore.getState().tracks].reverse()) {
      if (!track.visible) continue
      for (const clip of [...track.clips].reverse()) {
        if (t < clip.startTime || t >= clip.endTime) continue
        if (x >= clip.x && x <= clip.x + clip.width && y >= clip.y && y <= clip.y + clip.height)
          return clip
      }
    }
    return null
  }, [])

  // Global mousemove/up handlers (attached on mousedown on any handle)
  const startTransform = useCallback((
    handle: HandleType,
    e: React.MouseEvent | MouseEvent,
    clip: Clip,
    currentScale: number,
  ) => {
    const pr = previewRef.current?.getBoundingClientRect()
    if (!pr) return
    transformRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      previewClientX: pr.left,
      previewClientY: pr.top,
      clip: { ...clip },
      scale: currentScale,
    }
    setActiveCursor(HANDLE_CURSORS[handle])

    const onMove = (mv: MouseEvent) => {
      const t = transformRef.current
      if (!t) return
      const { clip: c, scale: sc, handle: h,
              startClientX: sx, startClientY: sy,
              previewClientX: px, previewClientY: py } = t

      const dx = (mv.clientX - sx) / sc
      const dy = (mv.clientY - sy) / sc
      const MIN = 20 // minimum clip size in canvas units

      let updates: Partial<Clip> = {}

      if (h === 'move') {
        updates = { x: c.x + dx, y: c.y + dy }

      } else if (h === 'rotate') {
        const cx = px + (c.x + c.width  / 2) * sc
        const cy = py + (c.y + c.height / 2) * sc
        const startAngle   = Math.atan2(sy - cy, sx - cx)
        const currentAngle = Math.atan2(mv.clientY - cy, mv.clientX - cx)
        updates = { rotation: (c.rotation || 0) + (currentAngle - startAngle) * (180 / Math.PI) }

      } else if (h === 'resize-se') {
        updates = {
          width:  Math.max(MIN, c.width  + dx),
          height: Math.max(MIN, c.height + dy),
        }
      } else if (h === 'resize-sw') {
        const nw = Math.max(MIN, c.width - dx)
        updates = { x: c.x + c.width - nw, width: nw, height: Math.max(MIN, c.height + dy) }
      } else if (h === 'resize-ne') {
        const nh = Math.max(MIN, c.height - dy)
        updates = { y: c.y + c.height - nh, width: Math.max(MIN, c.width + dx), height: nh }
      } else if (h === 'resize-nw') {
        const nw = Math.max(MIN, c.width  - dx)
        const nh = Math.max(MIN, c.height - dy)
        updates = { x: c.x + c.width - nw, y: c.y + c.height - nh, width: nw, height: nh }
      } else if (h === 'resize-e') {
        updates = { width: Math.max(MIN, c.width + dx) }
      } else if (h === 'resize-w') {
        const nw = Math.max(MIN, c.width - dx)
        updates = { x: c.x + c.width - nw, width: nw }
      } else if (h === 'resize-s') {
        updates = { height: Math.max(MIN, c.height + dy) }
      } else if (h === 'resize-n') {
        const nh = Math.max(MIN, c.height - dy)
        updates = { y: c.y + c.height - nh, height: nh }
      }

      useEditorStore.getState().updateClip(c.id, updates)
    }

    const onUp = () => {
      if (transformRef.current) {
        useEditorStore.getState().saveHistory()
        transformRef.current = null
        setActiveCursor('default')
      }
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }, [])

  // Background canvas mousedown (click to select or start move)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!previewRef.current || !scale) return
    const pr = previewRef.current.getBoundingClientRect()
    const x  = (e.clientX - pr.left)  / scale
    const y  = (e.clientY - pr.top)   / scale
    const clip = findClipAt(x, y)
    if (clip) {
      selectClip(clip.id)
      startTransform('move', e, clip, scale)
    } else {
      selectClip(null)
    }
  }, [scale, findClipAt, selectClip, startTransform])

  // Active clips and selected clip
  const activeClips = tracks
    .filter((t) => t.visible)
    .flatMap((t) => t.clips.filter((c) => currentTime >= c.startTime && currentTime < c.endTime))

  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null

  const isSelectedVisible = selectedClip
    ? currentTime >= selectedClip.startTime && currentTime < selectedClip.endTime
    : false

  if (previewSize.w === 0) return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center bg-[#0a0d16]">
      <div className="w-8 h-8 rounded-full border-2 border-[#4F72EF]/30 border-t-[#4F72EF] animate-spin" />
    </div>
  )

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center bg-[#0a0d16] relative overflow-hidden">
      {/* Dot-grid */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, #6B7280 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Preview frame */}
      <div ref={previewRef}
        className="relative shadow-[0_8px_80px_rgba(0,0,0,0.7)] rounded-sm overflow-visible"
        style={{ width: previewSize.w, height: previewSize.h }}>

        {/* Black bg + clips (clipped to frame) */}
        <div className="absolute inset-0 rounded-sm overflow-hidden bg-black">
          {activeClips.map((clip) => (
            <ClipRenderer key={clip.id} clip={clip} scale={scale} />
          ))}
        </div>

        {/* Transform overlay (outside overflow:hidden so handles aren't clipped) */}
        {selectedClip && isSelectedVisible && (
          <TransformOverlay
            clip={selectedClip}
            scale={scale}
            onHandle={(handle, e) => startTransform(handle, e, selectedClip, scale)}
          />
        )}

        {/* Background interaction layer */}
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: activeCursor }}
          onMouseDown={handleCanvasMouseDown}
        />
      </div>

      {/* Resolution label */}
      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#2a3550]">
        {NW}×{NH}
      </div>

      {/* Canvas quick-action menu */}
      {selectedClip && isSelectedVisible && (
        <CanvasMenu clip={selectedClip} scale={scale} previewSize={previewSize} />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   Transform overlay: selection border + handles
───────────────────────────────────────────────────── */
function TransformOverlay({
  clip, scale, onHandle,
}: {
  clip: Clip
  scale: number
  onHandle: (h: HandleType, e: React.MouseEvent) => void
}) {
  const L = clip.x * scale
  const T = clip.y * scale
  const W = clip.width  * scale
  const H = clip.height * scale
  const ROT_OFFSET = 28  // px above top edge for rotate handle

  // Handle helper
  const H_SIZE = 9
  const handleStyle = (left: number, top: number, cursor: string): React.CSSProperties => ({
    position: 'absolute',
    left: left - H_SIZE / 2,
    top:  top  - H_SIZE / 2,
    width:  H_SIZE,
    height: H_SIZE,
    cursor,
    zIndex: 30,
    pointerEvents: 'auto',
  })

  const onH = (type: HandleType) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onHandle(type, e)
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: L, top: T, width: W, height: H, zIndex: 20 }}
    >
      {/* Selection border */}
      <div
        className="absolute inset-0 border-2 border-[#4F72EF] rounded-sm"
        style={{ transform: clip.rotation ? `rotate(${clip.rotation}deg)` : undefined }}
      />

      {/* ── Rotate handle ── */}
      {/* connector line */}
      <div className="absolute pointer-events-none"
        style={{ left: W / 2 - 0.5, top: -ROT_OFFSET, width: 1, height: ROT_OFFSET, background: '#4F72EF88' }} />
      <div
        className="rounded-full bg-white border-2 border-[#4F72EF] shadow-lg shadow-[#4F72EF]/40 flex items-center justify-center"
        style={handleStyle(W / 2, -ROT_OFFSET, 'crosshair')}
        onMouseDown={onH('rotate')}
        title="Rotate"
      >
        <svg style={{ width: 6, height: 6, pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="#4F72EF" strokeWidth="3">
          <path strokeLinecap="round" d="M21 2v6h-6M3 12A9 9 0 0 1 19.5 6.3"/>
        </svg>
      </div>

      {/* ── Corner handles ── */}
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(0, 0, 'nwse-resize')} onMouseDown={onH('resize-nw')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(W, 0, 'nesw-resize')} onMouseDown={onH('resize-ne')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(0, H, 'nesw-resize')} onMouseDown={onH('resize-sw')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(W, H, 'nwse-resize')} onMouseDown={onH('resize-se')} />

      {/* ── Edge handles ── */}
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(W / 2, 0, 'ns-resize')} onMouseDown={onH('resize-n')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(W / 2, H, 'ns-resize')} onMouseDown={onH('resize-s')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(0, H / 2, 'ew-resize')} onMouseDown={onH('resize-w')} />
      <div className="absolute rounded-sm bg-white border-2 border-[#4F72EF] shadow"
        style={handleStyle(W, H / 2, 'ew-resize')} onMouseDown={onH('resize-e')} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   Clip renderer (DOM-based)
───────────────────────────────────────────────────── */
function ClipRenderer({ clip, scale }: { clip: Clip; scale: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { playing, currentTime } = useEditorStore()

  useEffect(() => {
    if (clip.type !== 'video' || !clip.src || !videoRef.current) return
    const vid = videoRef.current
    const offset = currentTime - clip.startTime + (clip.srcIn || 0)
    if (Math.abs(vid.currentTime - offset) > 0.25) vid.currentTime = offset
    if (playing) vid.play().catch(() => {})
    else vid.pause()
  }, [playing, currentTime, clip])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: clip.x * scale,
    top:  clip.y * scale,
    width:  clip.width  * scale,
    height: clip.height * scale,
    opacity: clip.opacity,
    transform: clip.rotation ? `rotate(${clip.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    pointerEvents: 'none',
  }

  const eff    = clip.effects
  const filter = eff
    ? `brightness(${eff.brightness}%) contrast(${eff.contrast}%) saturate(${eff.saturation}%) hue-rotate(${eff.hue}deg)`
    : undefined

  if (clip.type === 'video' && clip.src)
    return <video ref={videoRef} src={clip.src} muted playsInline style={{ ...style, objectFit: 'cover', filter }} />

  if (clip.type === 'image' && clip.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={clip.src} alt="" style={{ ...style, objectFit: 'cover', filter }} />

  if (clip.type === 'text' && clip.text)
    return (
      <div style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: (clip.fontSize || 48) * scale,
        color: clip.fontColor || '#fff',
        fontFamily: clip.fontFamily || 'Inter, sans-serif',
        fontWeight: clip.fontWeight || 'bold',
        fontStyle: clip.fontStyle || 'normal',
        textAlign: clip.textAlign || 'center',
        letterSpacing: clip.letterSpacing ? `${clip.letterSpacing * scale}px` : undefined,
        textShadow: '0 2px 16px rgba(0,0,0,0.7)',
        userSelect: 'none', lineHeight: 1.1,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {clip.text}
      </div>
    )

  return <div style={{ ...style, backgroundColor: clip.color || '#4F72EF', borderRadius: 4, filter }} />
}

/* ─────────────────────────────────────────────────────
   Canvas quick-action menu
───────────────────────────────────────────────────── */
function CanvasMenu({ clip, scale, previewSize }: {
  clip: Clip; scale: number; previewSize: { w: number; h: number }
}) {
  const { removeClip, duplicateClip, splitClip, currentTime } = useEditorStore()

  const cx  = clip.x * scale + (clip.width  * scale) / 2
  const top = clip.y * scale - 36
  const menuX = cx - 100
  const menuY = top < 0 ? clip.y * scale + clip.height * scale + 6 : top
  const left  = Math.max(0, Math.min(menuX, previewSize.w - 200))
  const topC  = Math.max(0, menuY)

  const btns = [
    { label: 'Split',     action: () => splitClip(clip.id, currentTime),
      icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v18"/><path d="M3 12h18" opacity=".3"/></svg> },
    { label: 'Duplicate', action: () => duplicateClip(clip.id),
      icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path strokeLinecap="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> },
    { label: 'Delete',    action: () => removeClip(clip.id), danger: true,
      icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6" strokeLinecap="round"/><path d="M10 11v6M14 11v6" strokeLinecap="round"/></svg> },
  ]

  return (
    <div className="absolute z-20 pointer-events-none"
      style={{ left: `calc(50% - ${previewSize.w / 2}px + ${left}px)`, top: `calc(50% - ${previewSize.h / 2}px + ${topC}px)` }}>
      <div className="pointer-events-auto flex items-center gap-0.5 bg-[#151c2e]/95 backdrop-blur border border-[#2a3547] rounded-xl px-1 py-1 shadow-2xl">
        {btns.map((b) => (
          <button key={b.label} onClick={b.action} title={b.label}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              (b as { danger?: boolean }).danger
                ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                : 'text-slate-300 hover:bg-white/8 hover:text-white'
            }`}>
            {b.icon}{b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
