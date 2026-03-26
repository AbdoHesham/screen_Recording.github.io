'use client'
import React, { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEditorStore, projectStorage } from '../../../store/videoEditorStore'
import Toolbar from './Toolbar'
import LeftPanel from './LeftPanel'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'
import Timeline from './Timeline'

export default function EditorLayout() {
  const { togglePlay, undo, redo, removeClip, splitClip, duplicateClip,
          selectedClipId, currentTime, setContextMenu, loadProject } = useEditorStore()

  const searchParams = useSearchParams()

  // Load project from URL param on mount
  useEffect(() => {
    const pid = searchParams.get('project')
    if (!pid) return
    const saved = projectStorage.get(pid)
    if (saved) loadProject(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) { e.preventDefault(); removeClip(selectedClipId) }
      }
      else if (e.key === 's' || e.key === 'S') {
        if (selectedClipId && !e.ctrlKey && !e.metaKey) splitClip(selectedClipId, currentTime)
      }
      else if (e.key === 'd' || e.key === 'D') {
        if (selectedClipId && !e.ctrlKey && !e.metaKey) duplicateClip(selectedClipId)
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault(); e.shiftKey ? redo() : undo()
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault(); redo()
      }
    }

    const onContextMenuClose = () => setContextMenu(null)

    window.addEventListener('keydown', onKey)
    // Close context menu on scroll
    window.addEventListener('scroll', onContextMenuClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onContextMenuClose, true)
    }
  }, [togglePlay, undo, redo, removeClip, splitClip, duplicateClip, selectedClipId, currentTime, setContextMenu])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0d16] text-white overflow-hidden">
      {/* ① Nav bar */}
      <Toolbar />

      {/* ② Middle row: Dock | Canvas | Inspector */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftPanel />
        <CanvasArea />
        <RightPanel />
      </div>

      {/* ③ Timeline */}
      <Timeline />
    </div>
  )
}
