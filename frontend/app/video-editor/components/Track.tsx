'use client'
import React, { memo } from 'react'
import { Track as TTrack, PIXELS_PER_SECOND } from '../types'
import { useEditorStore } from '../../../store/videoEditorStore'
import ClipItem from './ClipItem'

export const HEADER_W = 168

interface Props { track: TTrack; zoom: number }

const Track = memo(function Track({ track, zoom }: Props) {
  const { toggleTrackVisibility, toggleTrackMute, toggleTrackLock, removeTrack } = useEditorStore()
  const pps = PIXELS_PER_SECOND * zoom

  const typeLabel = track.type === 'video' ? 'V' : track.type === 'audio' ? 'A' : 'O'
  const typeColor = track.color

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const raw = e.dataTransfer.getData('application/video-editor-clip')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      // e.currentTarget is the clips-area div (after the header), so rect.left is already correct
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      const t = Math.max(0, x / pps)
      const clipDur = (data.srcOut ?? 10) - (data.srcIn ?? 0)
      useEditorStore.getState().addClip(track.id, {
        ...data,
        trackId: track.id,
        startTime: t,
        endTime: t + clipDur,
      })
    } catch (err) {
      console.error('Drop parse error', err)
    }
  }

  return (
    <div className="flex" style={{ height: track.height }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 border-r border-[#1a2236] bg-[#0f1520]"
        style={{ width: HEADER_W }}>
        {/* Type badge */}
        <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
          style={{ backgroundColor: typeColor + '22', color: typeColor }}>
          {typeLabel}
        </div>

        {/* Name */}
        <span className="text-[11px] text-slate-400 font-medium truncate flex-1 leading-tight">{track.name}</span>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <TrackBtn title={track.visible ? 'Hide' : 'Show'} active={track.visible}
            onClick={() => toggleTrackVisibility(track.id)}>
            {track.visible
              ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
          </TrackBtn>

          {track.type !== 'overlay' && (
            <TrackBtn title={track.muted ? 'Unmute' : 'Mute'} active={!track.muted}
              onClick={() => toggleTrackMute(track.id)}>
              {track.muted
                ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>}
            </TrackBtn>
          )}

          <TrackBtn title={track.locked ? 'Unlock' : 'Lock'} active={!track.locked}
            onClick={() => toggleTrackLock(track.id)}>
            {track.locked
              ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </TrackBtn>

          <TrackBtn title="Remove track" danger onClick={() => removeTrack(track.id)}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </TrackBtn>
        </div>
      </div>

      {/* Clips area */}
      <div className="relative flex-1 overflow-hidden border-b border-[#131a28]"
        style={{ opacity: track.visible ? 1 : 0.35 }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}>

        {/* Second-grid lines */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent ${pps}px)`,
          }} />

        {/* Clips */}
        {track.clips.map((clip) => (
          <ClipItem key={clip.id} clip={clip} zoom={zoom} trackLocked={track.locked} />
        ))}
      </div>
    </div>
  )
})

function TrackBtn({ children, onClick, title, active = true, danger = false }:
  { children: React.ReactNode; onClick: () => void; title: string; active?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
        danger
          ? 'text-[#2a3550] hover:text-red-400'
          : active
            ? 'text-[#4a5c7a] hover:text-slate-200'
            : 'text-[#1e2838] hover:text-[#4a5c7a]'
      }`}>
      {children}
    </button>
  )
}

export default Track
