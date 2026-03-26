'use client'
import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'
import { PIXELS_PER_SECOND } from '../types'
import Track, { HEADER_W } from './Track'
import ContextMenu from './ContextMenu'

const RULER_H = 28
const TIMELINE_H = 300

function fmtTime(s: number) {
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ds  = Math.floor((s % 1) * 10)
  if (m > 0) return `${m}:${sec.toString().padStart(2,'0')}.${ds}`
  return `${sec}.${ds}s`
}

function fmtFull(s: number) {
  const m   = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4,'0')
  return `${m}:${sec}`
}

export default memo(function Timeline() {
  const {
    currentTime, duration, tracks, zoom, playing,
    addTrack, setCurrentTime, setZoom,
    selectedClipId, splitClip,
    contextMenu, setContextMenu,
  } = useEditorStore()

  const scrollRef  = useRef<HTMLDivElement>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [loop,      setLoop]      = useState(false)

  const pps    = PIXELS_PER_SECOND * zoom
  const totalW = Math.max(duration * pps + 400, 1400)

  /* ── Auto-scroll during playback ── */
  useEffect(() => {
    if (!playing || !scrollRef.current) return
    const x = currentTime * pps
    const { scrollLeft, clientWidth } = scrollRef.current
    if (x > scrollLeft + clientWidth - 80) {
      scrollRef.current.scrollLeft = x - clientWidth / 2
    }
  }, [playing, currentTime, pps])

  /* ── Loop ── */
  useEffect(() => {
    if (!loop) return
    const state = useEditorStore.getState()
    if (!state.playing && state.currentTime >= state.duration) {
      state.setCurrentTime(0)
      state.setPlaying(true)
    }
  }, [loop, currentTime])

  /* ── Seek helper ── */
  const getTimeAt = useCallback((clientX: number) => {
    if (!scrollRef.current) return 0
    const rect = scrollRef.current.getBoundingClientRect()
    const x = clientX - rect.left + scrollRef.current.scrollLeft - HEADER_W
    return Math.max(0, Math.min(x / pps, duration))
  }, [pps, duration])

  const handleRulerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentTime(getTimeAt(e.clientX))
    const onMove = (mv: MouseEvent) => setCurrentTime(getTimeAt(mv.clientX))
    const onUp   = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getTimeAt, setCurrentTime])

  /* ── Fit View ── */
  const fitView = useCallback(() => {
    if (!scrollRef.current) return
    const available = scrollRef.current.clientWidth - HEADER_W - 40
    const newZoom   = available / (duration * PIXELS_PER_SECOND)
    setZoom(Math.max(0.1, Math.min(5, newZoom)))
    scrollRef.current.scrollLeft = 0
  }, [duration, setZoom])

  /* ── Ruler ticks ── */
  const tickInterval  = zoom < 0.3 ? 20 : zoom < 0.6 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : zoom < 4 ? 1 : 0.5
  const labelEvery    = 5   // show label every N ticks
  const ticks: number[] = []
  for (let t = 0; t <= duration + tickInterval * 2; t += tickInterval) {
    ticks.push(Math.round(t * 1000) / 1000)
  }

  const playheadLeft = HEADER_W + currentTime * pps

  return (
    <div
      className="flex flex-col bg-[#0c101a] border-t border-[#1e2535] shrink-0"
      style={{ height: TIMELINE_H }}
    >
      {/* ══ CONTROL BAR (matches img.ly layout) ══ */}
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[#1a2236] bg-[#0e1320] select-none">

        {/* Left group: add tracks + split */}
        <div className="flex items-center gap-1">
          {/* Add track buttons */}
          {(['video','audio','overlay'] as const).map((type) => {
            const icons: Record<string, React.ReactNode> = {
              video:   <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M15 10l4.55-2.07A1 1 0 0121 8.88v6.24a1 1 0 01-1.45.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>,
              audio:   <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
              overlay: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h7"/></svg>,
            }
            return (
              <button key={type} onClick={() => addTrack(type)} title={`Add ${type} track`}
                className="flex items-center gap-1 h-6 px-2 rounded bg-[#1c2535] hover:bg-[#232f48] border border-[#232a3b] text-[10px] text-[#4a5c7a] hover:text-slate-300 transition-all font-medium">
                {icons[type]}
                <span>+ {type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </button>
            )
          })}
        </div>

        <div className="w-px h-5 bg-[#1e2535]" />

        {/* Split Clip */}
        <button
          onClick={() => selectedClipId && splitClip(selectedClipId, currentTime)}
          disabled={!selectedClipId}
          title="Split clip at playhead (S)"
          className="flex items-center gap-1.5 h-6 px-2.5 rounded bg-[#1c2535] hover:bg-[#232f48] border border-[#232a3b] text-[10px] text-[#4a5c7a] hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M12 3v18M6 7l6 5-6 5M18 7l-6 5 6 5" opacity=".4"/>
            <path strokeLinecap="round" d="M12 3v18"/>
          </svg>
          Split Clip
        </button>

        {/* ── Center: time + playback ── */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="font-mono text-[12px] text-white/80 tabular-nums">
            {fmtFull(currentTime)}
          </span>
          <span className="text-[#2e3d55] text-[11px]">/</span>
          <span className="font-mono text-[12px] text-[#3a4f6a] tabular-nums">
            {fmtFull(duration)}
          </span>

          <div className="w-px h-4 bg-[#1e2535] mx-1" />

          {/* Play */}
          <button onClick={() => useEditorStore.getState().togglePlay()}
            className="w-7 h-7 rounded-lg bg-[#4F72EF] hover:bg-[#6186F5] flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md shadow-[#4F72EF]/20">
            {playing
              ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
          </button>

          {/* Loop */}
          <button onClick={() => setLoop(!loop)} title={loop ? 'Loop on' : 'Loop off'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${loop ? 'bg-[#4F72EF]/20 text-[#4F72EF]' : 'text-[#3a4f6a] hover:text-slate-300 hover:bg-white/5'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
          </button>
        </div>

        {/* ── Right: Timeline Scale ── */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#3a4f6a] font-medium hidden sm:block">Timeline Scale</span>

          <div className="flex items-center border border-[#232a3b] rounded-lg overflow-hidden bg-[#151d2e]">
            <button
              onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
              title="Zoom out (timeline)"
              className="w-7 h-6 flex items-center justify-center text-[#4a5c7a] hover:text-white hover:bg-[#1e2a3e] transition-colors font-bold text-base leading-none select-none">
              −
            </button>
            <div className="w-px h-4 bg-[#232a3b]" />
            <button
              onClick={() => setZoom(Math.min(5, zoom + 0.25))}
              title="Zoom in (timeline)"
              className="w-7 h-6 flex items-center justify-center text-[#4a5c7a] hover:text-white hover:bg-[#1e2a3e] transition-colors font-bold text-base leading-none select-none">
              +
            </button>
          </div>

          <button
            onClick={fitView}
            title="Fit entire duration in view"
            className="h-6 px-2.5 rounded-lg border border-[#232a3b] bg-[#151d2e] text-[10px] text-[#4a5c7a] hover:text-white hover:bg-[#1e2a3e] hover:border-[#4F72EF]/40 transition-all font-medium">
            Fit View
          </button>

          {/* Zoom % badge */}
          <span className="text-[10px] font-mono text-[#2e3d55] w-8 text-right">{Math.round(zoom * 100)}%</span>

        </div>
      </div>

      {/* ══ SCROLLABLE AREA ══ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative scrollbar-thin"
        onMouseMove={(e) => setHoverTime(getTimeAt(e.clientX))}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div style={{ width: totalW + HEADER_W, minHeight: '100%', position: 'relative' }}>

          {/* ── RULER ── */}
          <div
            className="sticky top-0 z-20 flex select-none bg-[#0c101a]"
            style={{ height: RULER_H }}
            onMouseDown={handleRulerDown}
          >
            {/* Corner */}
            <div
              className="shrink-0 bg-[#0d1220] border-r border-[#1e2535]"
              style={{ width: HEADER_W }}
            />

            {/* Tick area */}
            <div
              className="relative flex-1 cursor-col-resize border-b border-[#1e2535]"
              style={{ width: totalW }}
            >
              {ticks.map((t, i) => {
                const isMajor = i % labelEvery === 0
                const x = t * pps
                return (
                  <div
                    key={t}
                    className="absolute top-0"
                    style={{ left: x }}
                  >
                    {/* Tick line from top */}
                    <div
                      className={isMajor ? 'bg-[#3a5070]' : 'bg-[#1e2a3a]'}
                      style={{ width: 1, height: isMajor ? 12 : 5, marginTop: 0 }}
                    />
                    {/* Label */}
                    {isMajor && (
                      <span
                        className="absolute text-[9px] text-[#3a5070] font-mono"
                        style={{ top: 13, left: -14, whiteSpace: 'nowrap' }}
                      >
                        {fmtTime(t)}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Hover ghost line + tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{ left: hoverTime * pps }}
                >
                  <div className="w-px h-full bg-white/15" />
                  <div
                    className="absolute bg-[#1a2236] border border-[#2a3a55] rounded px-1 py-0.5 text-[9px] text-[#7a9cc0] font-mono whitespace-nowrap -translate-x-1/2"
                    style={{ top: 14 }}
                  >
                    {fmtTime(hoverTime)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── TRACKS ── */}
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#131d2e] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2a3550]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="4" rx="1.5"/>
                  <rect x="3" y="12" width="18" height="4" rx="1.5" opacity=".5"/>
                  <rect x="3" y="19" width="12" height="4" rx="1.5" opacity=".25"/>
                </svg>
              </div>
              <p className="text-[#2a3550] text-xs">No tracks yet — use + buttons above to add</p>
            </div>
          ) : (
            <div>
              {tracks.map((track) => (
                <Track key={track.id} track={track} zoom={zoom} />
              ))}
            </div>
          )}

          {/* ── PLAYHEAD ── */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30"
            style={{ left: playheadLeft }}
          >
            {/* Vertical line — full height */}
            <div className="absolute top-0 bottom-0 w-px bg-[#4F72EF]" style={{ left: 0, opacity: 0.9 }} />

            {/* Head: label + caret, draggable */}
            <div
              className="absolute pointer-events-auto cursor-ew-resize z-40 flex flex-col items-center"
              style={{ top: 0, left: 0, transform: 'translateX(-50%)' }}
              onMouseDown={(e) => {
                e.stopPropagation()
                const onMove = (mv: MouseEvent) => setCurrentTime(getTimeAt(mv.clientX))
                const onUp   = () => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              {/* Time label pill */}
              <div className="bg-[#4F72EF] rounded-sm px-1.5 py-px text-[9px] text-white font-mono whitespace-nowrap shadow-md shadow-[#4F72EF]/40 select-none"
                style={{ minWidth: 32, textAlign: 'center', lineHeight: '14px' }}>
                {fmtTime(currentTime)}
              </div>
              {/* Downward caret */}
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #4F72EF',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && <ContextMenu />}
    </div>
  )
})
