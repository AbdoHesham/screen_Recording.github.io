'use client'
import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'

export default function ContextMenu() {
  const { contextMenu, setContextMenu, removeClip, duplicateClip,
          splitClip, currentTime, selectClip, getClip } = useEditorStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [setContextMenu])

  if (!contextMenu) return null
  const { x, y, clipId } = contextMenu
  const clip = getClip(clipId)
  if (!clip) return null

  const items = [
    {
      label: 'Split at playhead',
      kbd: 'S',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v18M6 7l6 5-6 5M18 7l-6 5 6 5" opacity=".4"/><path strokeLinecap="round" d="M12 3v18"/></svg>,
      action: () => { splitClip(clipId, currentTime); setContextMenu(null) },
    },
    {
      label: 'Duplicate',
      kbd: 'D',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
      action: () => { duplicateClip(clipId); setContextMenu(null) },
    },
    {
      label: 'Select clip',
      kbd: null,
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>,
      action: () => { selectClip(clipId); setContextMenu(null) },
    },
    { separator: true },
    {
      label: 'Delete',
      kbd: '⌦',
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6" strokeLinecap="round"/><path strokeLinecap="round" d="M10 11v6M14 11v6"/></svg>,
      action: () => { removeClip(clipId); setContextMenu(null) },
      danger: true,
    },
  ]

  return (
    <div ref={ref}
      className="fixed z-50 bg-[#141c2e] border border-[#252f47] rounded-xl shadow-2xl py-1 min-w-[172px] overflow-hidden"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}>

      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#1e2a3e]">
        <p className="text-[11px] font-semibold text-slate-400 truncate">{clip.name}</p>
        <p className="text-[10px] text-[#3a4f6a] capitalize">{clip.type} · {(clip.endTime - clip.startTime).toFixed(2)}s</p>
      </div>

      {items.map((item, i) => {
        if ('separator' in item) {
          return <div key={i} className="my-1 border-t border-[#1e2a3e]" />
        }
        return (
          <button key={item.label} onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors group ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}>
            <span className={item.danger ? 'text-red-500' : 'text-[#4a5c7a] group-hover:text-slate-300'}>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.kbd && <kbd className="text-[9px] text-[#2e3d55] font-mono">{item.kbd}</kbd>}
          </button>
        )
      })}
    </div>
  )
}
