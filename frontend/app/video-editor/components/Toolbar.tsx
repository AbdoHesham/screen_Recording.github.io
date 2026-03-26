'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useEditorStore, projectStorage } from '../../../store/videoEditorStore'
import { AspectRatio, ASPECT_RATIOS } from '../types'
import ExportModal from './ExportModal'

function fmt(s: number) {
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const f   = Math.floor((s % 1) * 30)
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)  return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export default function Toolbar() {
  const {
    playing, togglePlay, currentTime, duration,
    undo, redo, history, historyIndex,
    zoom, setZoom,
    aspectRatio, setAspectRatio,
    snapEnabled, setSnapEnabled,
    projectName, setProjectName,
    lastSavedAt, saveDraft,
  } = useEditorStore()

  const [showAR,       setShowAR]       = useState(false)
  const [showExport,   setShowExport]   = useState(false)
  const [editingName,  setEditingName]  = useState(false)
  const [nameInput,    setNameInput]    = useState(projectName)
  const [savePulse,    setSavePulse]    = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Keep input in sync when project changes externally
  useEffect(() => { setNameInput(projectName) }, [projectName])

  // Focus name input when editing starts
  useEffect(() => { if (editingName) nameRef.current?.select() }, [editingName])

  const commitName = () => {
    const trimmed = nameInput.trim() || 'Untitled Project'
    setProjectName(trimmed)
    setNameInput(trimmed)
    setEditingName(false)
  }

  const handleSaveDraft = () => {
    saveDraft()
    setSavePulse(true)
    setTimeout(() => setSavePulse(false), 1200)
  }

  // Auto-save shortcut Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <header className="h-12 shrink-0 flex items-center justify-between px-3 gap-3
                         bg-[#12151f] border-b border-[#1e2535] z-30">

        {/* ── Left: Logo + history ── */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 pr-3 border-r border-[#1e2535]">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#4F72EF] to-[#7C3AED] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3.5A1.5 1.5 0 013.5 2h5.086a1.5 1.5 0 011.06.44l3.915 3.914A1.5 1.5 0 0114 7.414V12.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z" opacity=".4"/>
                <path d="M5 9l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-white tracking-tight">ProScreen</span>
          </div>

          {/* Undo / Redo */}
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 6 6.7L3 7"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
            className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18 6.7L21 7"/></svg>
          </button>
        </div>

        {/* ── Center: Project name + playback ── */}
        <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
          {/* Editable project name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameInput(projectName); setEditingName(false) } }}
                className="bg-[#1c2535] border border-[#4F72EF]/60 rounded-lg px-2 py-0.5 text-[13px] font-semibold text-white focus:outline-none w-44 text-center"
              />
            ) : (
              <button onClick={() => setEditingName(true)} title="Click to rename"
                className="text-[13px] font-semibold text-slate-300 hover:text-white truncate max-w-[160px] hover:bg-white/5 px-2 py-0.5 rounded transition-colors">
                {projectName}
              </button>
            )}

            {/* Save status */}
            {lastSavedAt ? (
              <span className={`text-[10px] text-[#3a4f6a] whitespace-nowrap transition-colors ${savePulse ? 'text-[#10B981]' : ''}`}>
                {savePulse ? '✓ Saved' : `Saved ${timeSince(lastSavedAt)}`}
              </span>
            ) : (
              <span className="text-[10px] text-[#2e3d55]">Unsaved</span>
            )}
          </div>

          <div className="w-px h-4 bg-[#1e2535]" />

          {/* Playback controls */}
          <div className="flex items-center gap-1">
            <button onClick={() => useEditorStore.getState().setCurrentTime(0)} title="Go to start"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6L9.5 12z"/></svg>
            </button>

            <button onClick={togglePlay}
              className="w-8 h-8 rounded-lg bg-[#4F72EF] hover:bg-[#6186F5] flex items-center justify-center text-white shadow-lg shadow-[#4F72EF]/25 transition-all hover:scale-105 active:scale-95">
              {playing
                ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
            </button>

            <button onClick={() => useEditorStore.getState().setCurrentTime(duration)} title="Go to end"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>

            <div className="ml-1 font-mono text-[12px] bg-[#0c0e16] border border-[#1e2535] rounded-md px-2 py-0.5 min-w-[100px] text-center">
              <span className="text-white">{fmt(currentTime)}</span>
              <span className="text-[#2e3d55] mx-1">/</span>
              <span className="text-slate-500">{fmt(duration)}</span>
            </div>
          </div>
        </div>

        {/* ── Right: Snap, AR, Zoom, Save, Export ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Snap */}
          <button onClick={() => setSnapEnabled(!snapEnabled)} title={snapEnabled ? 'Snap on' : 'Snap off'}
            className={`flex items-center gap-1 px-2 h-7 rounded text-xs transition-all ${snapEnabled ? 'bg-[#4F72EF]/15 text-[#4F72EF]' : 'text-[#3a4f6a] hover:text-slate-300'}`}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v4m0 10v4M3 12h4m10 0h4"/></svg>
            Snap
          </button>

          <div className="w-px h-4 bg-[#1e2535]" />

          {/* Aspect Ratio */}
          <div className="relative">
            <button onClick={() => setShowAR(!showAR)}
              className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium text-slate-400 bg-[#1c2233] hover:bg-[#1e2a3e] border border-[#1e2535] transition-all">
              {aspectRatio}
              <svg className="w-2.5 h-2.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 9l6 6 6-6"/></svg>
            </button>
            {showAR && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a2233] border border-[#252f47] rounded-xl shadow-2xl py-1 z-50">
                {(Object.keys(ASPECT_RATIOS) as AspectRatio[]).map((r) => (
                  <button key={r} onClick={() => { setAspectRatio(r); setShowAR(false) }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${r === aspectRatio ? 'text-[#4F72EF] bg-[#4F72EF]/10' : 'text-slate-300 hover:bg-white/5'}`}>
                    <span className="font-medium">{r}</span>
                    <span className="text-slate-500 text-[10px]">{ASPECT_RATIOS[r].w}×{ASPECT_RATIOS[r].h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 bg-[#1c2233] border border-[#1e2535] rounded-md px-1 h-7">
            <button onClick={() => setZoom(zoom - 0.25)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M5 12h14"/></svg>
            </button>
            <span className="text-[11px] font-mono text-slate-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(zoom + 0.25)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>

          <div className="w-px h-4 bg-[#1e2535]" />

          {/* Save Draft */}
          <button onClick={handleSaveDraft} title="Save draft (Ctrl+S)"
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all border ${
              savePulse
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                : 'text-slate-400 bg-white/4 hover:bg-white/8 border-[#1e2535] hover:text-white'
            }`}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {savePulse ? 'Saved!' : 'Save Draft'}
          </button>

          {/* Export */}
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#4F72EF] hover:bg-[#6186F5] text-white text-xs font-semibold shadow-lg shadow-[#4F72EF]/20 transition-all hover:scale-105 active:scale-95">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
          </button>
        </div>
      </header>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}
