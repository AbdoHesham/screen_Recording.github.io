'use client'
import React, { useRef, useState } from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'
import { DEFAULT_EFFECTS } from '../types'

type Tab = 'media' | 'text' | 'audio' | 'shapes'

const DOCK_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'media', label: 'Media',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M9.5 8.5 16 12l-6.5 3.5V8.5z" fill="currentColor" stroke="none"/></svg>,
  },
  {
    id: 'text', label: 'Text',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
  },
  {
    id: 'audio', label: 'Audio',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  {
    id: 'shapes', label: 'Shapes',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17.5" cy="6.5" r="3.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>,
  },
]

const TEXT_PRESETS = [
  { label: 'Big Title',  fontSize: 96, fontWeight: 'bold',   y: 460 },
  { label: 'Title',      fontSize: 72, fontWeight: 'bold',   y: 100 },
  { label: 'Subtitle',   fontSize: 48, fontWeight: '600',    y: 200 },
  { label: 'Heading',    fontSize: 36, fontWeight: 'bold',   y: 300 },
  { label: 'Body',       fontSize: 28, fontWeight: 'normal', y: 400 },
  { label: 'Caption',    fontSize: 20, fontWeight: 'normal', y: 940 },
]

const SHAPE_COLORS = [
  '#4F72EF','#7C3AED','#EC4899','#EF4444',
  '#F59E0B','#10B981','#06B6D4','#FFFFFF',
]

interface MediaItem {
  name: string
  src: string
  type: 'video' | 'image'
  duration: number   // seconds; 5 default for images
}

interface AudioItem {
  name: string
  src: string
  duration: number
}

export default function LeftPanel() {
  const { dockTab, setDockTab, tracks, addClip, currentTime } = useEditorStore()
  const [mediaFiles, setMediaFiles] = useState<MediaItem[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>([])
  const fileRef  = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  const videoTrack   = tracks.find((t) => t.type === 'video')
  const audioTrack   = tracks.find((t) => t.type === 'audio')
  const overlayTrack = tracks.find((t) => t.type === 'overlay')

  /* ── File import handlers ── */
  const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((file) => {
      const src  = URL.createObjectURL(file)
      const type = file.type.startsWith('video') ? 'video' : 'image'
      if (type === 'video') {
        const vid = document.createElement('video')
        vid.preload = 'metadata'
        vid.src = src
        vid.onloadedmetadata = () => {
          setMediaFiles((p) => [...p, { name: file.name, src, type, duration: Math.min(vid.duration, 3600) }])
        }
        vid.onerror = () => setMediaFiles((p) => [...p, { name: file.name, src, type, duration: 10 }])
        vid.load()
      } else {
        setMediaFiles((p) => [...p, { name: file.name, src, type, duration: 5 }])
      }
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((file) => {
      const src = URL.createObjectURL(file)
      const au  = document.createElement('audio')
      au.preload = 'metadata'
      au.src = src
      au.onloadedmetadata = () => {
        setAudioFiles((p) => [...p, { name: file.name, src, duration: Math.min(au.duration, 3600) }])
      }
      au.onerror = () => setAudioFiles((p) => [...p, { name: file.name, src, duration: 60 }])
      au.load()
    })
    if (audioRef.current) audioRef.current.value = ''
  }

  /* ── Build drag data ── */
  const mediaDragData = (f: MediaItem) => JSON.stringify({
    name: f.name, type: f.type, src: f.src,
    srcIn: 0, srcOut: f.duration, speed: 1,
    x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1,
    color: '#4F72EF', volume: 1, effects: { ...DEFAULT_EFFECTS },
  })

  const audioDragData = (f: AudioItem) => JSON.stringify({
    name: f.name, type: 'audio', src: f.src,
    srcIn: 0, srcOut: f.duration, speed: 1,
    x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1,
    volume: 1, color: '#10B981', effects: { ...DEFAULT_EFFECTS },
  })

  /* ── Click-to-add ── */
  const addMediaToTimeline = (f: MediaItem) => {
    if (!videoTrack) return
    addClip(videoTrack.id, {
      name: f.name, type: f.type, src: f.src,
      startTime: currentTime, endTime: currentTime + f.duration,
      srcIn: 0, srcOut: f.duration, speed: 1,
      x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1,
      color: '#4F72EF', volume: 1, effects: { ...DEFAULT_EFFECTS },
    })
  }

  const addAudioToTimeline = (f: AudioItem) => {
    if (!audioTrack) return
    addClip(audioTrack.id, {
      name: f.name, type: 'audio', src: f.src,
      startTime: currentTime, endTime: currentTime + f.duration,
      srcIn: 0, srcOut: f.duration, speed: 1,
      x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1,
      volume: 1, color: '#10B981', effects: { ...DEFAULT_EFFECTS },
    })
  }

  const addText = (preset: typeof TEXT_PRESETS[0]) => {
    if (!overlayTrack) return
    addClip(overlayTrack.id, {
      name: preset.label, type: 'text',
      startTime: currentTime, endTime: currentTime + 5,
      srcIn: 0, srcOut: 5, speed: 1,
      x: 120, y: preset.y, width: 1680, height: preset.fontSize + 24,
      rotation: 0, opacity: 1,
      text: preset.label, fontSize: preset.fontSize,
      fontColor: '#FFFFFF', fontFamily: 'Inter, sans-serif',
      fontWeight: preset.fontWeight, textAlign: 'center',
      color: '#F59E0B', effects: { ...DEFAULT_EFFECTS },
    })
  }

  const addShape = (color: string) => {
    if (!overlayTrack) return
    addClip(overlayTrack.id, {
      name: 'Shape', type: 'shape',
      startTime: currentTime, endTime: currentTime + 5,
      srcIn: 0, srcOut: 5, speed: 1,
      x: 460, y: 290, width: 1000, height: 500,
      rotation: 0, opacity: 0.85,
      color, bgColor: color, effects: { ...DEFAULT_EFFECTS },
    })
  }

  return (
    <div className="flex h-full shrink-0">
      {/* ── Icon strip ── */}
      <div className="w-[52px] h-full flex flex-col items-center pt-2 pb-2 gap-1 bg-[#12151f] border-r border-[#1e2535]">
        {DOCK_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setDockTab(tab.id)} title={tab.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              dockTab === tab.id
                ? 'bg-[#4F72EF]/15 text-[#4F72EF]'
                : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'
            }`}>
            {tab.icon}
          </button>
        ))}
      </div>

      {/* ── Slide-in content panel ── */}
      {dockTab && (
        <div className="w-[240px] h-full bg-[#161c2a] border-r border-[#1e2535] flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#1e2535]">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {DOCK_TABS.find((t) => t.id === dockTab)?.label}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">

            {/* ── MEDIA TAB ── */}
            {dockTab === 'media' && (
              <>
                <input ref={fileRef} type="file" accept="video/*,image/*" multiple onChange={handleMedia} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-2 rounded-lg border border-dashed border-[#2a3550] hover:border-[#4F72EF]/60 hover:bg-[#4F72EF]/5 text-slate-500 hover:text-[#4F72EF] text-xs font-medium transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
                  Import Video / Image
                </button>

                {mediaFiles.length === 0 ? (
                  <EmptyPlaceholder
                    icon={<svg className="w-6 h-6 text-[#2a3550]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M9.5 8.5 16 12l-6.5 3.5V8.5z" fill="currentColor" opacity=".4"/></svg>}
                    text="No media imported"
                    sub="Click above or drag files in"
                  />
                ) : (
                  <>
                    <p className="text-[10px] text-[#3a4a66]">Click to add at playhead · Drag to timeline</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {mediaFiles.map((f, i) => (
                        <div
                          key={i}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/video-editor-clip', mediaDragData(f))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => addMediaToTimeline(f)}
                          className="group relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-[#1e2535] hover:border-[#4F72EF]/50 transition-all cursor-grab active:cursor-grabbing"
                        >
                          {f.type === 'video'
                            ? <video src={f.src} className="w-full h-full object-cover pointer-events-none" />
                            : <img src={f.src} alt="" className="w-full h-full object-cover pointer-events-none" />}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 pointer-events-none">
                            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-1 pointer-events-none">
                            <p className="text-[9px] text-white/70 truncate">{f.name}</p>
                            <p className="text-[9px] text-white/40">{f.type} · {f.duration.toFixed(1)}s</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── TEXT TAB ── */}
            {dockTab === 'text' && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-[#3a4a66]">Click to add at playhead</p>
                {TEXT_PRESETS.map((p) => (
                  <button key={p.label} onClick={() => addText(p)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1c2535] hover:bg-[#232f48] border border-[#232a3b] hover:border-[#4F72EF]/30 text-left transition-all">
                    <span className="block text-white truncate"
                      style={{ fontSize: Math.min(20, p.fontSize / 3.5), fontWeight: p.fontWeight }}>
                      {p.label}
                    </span>
                    <span className="text-[10px] text-[#3a4a66]">{p.fontSize}px</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── AUDIO TAB ── */}
            {dockTab === 'audio' && (
              <>
                <input ref={audioRef} type="file" accept="audio/*" multiple onChange={handleAudio} className="hidden" />
                <button onClick={() => audioRef.current?.click()}
                  className="w-full py-2 rounded-lg border border-dashed border-[#2a3550] hover:border-[#10B981]/60 hover:bg-[#10B981]/5 text-slate-500 hover:text-[#10B981] text-xs font-medium transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
                  Import Audio File
                </button>

                {audioFiles.length === 0 ? (
                  <EmptyPlaceholder
                    icon={<svg className="w-6 h-6 text-[#2a3550]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                    text="No audio imported"
                    sub="MP3, WAV, AAC, OGG"
                  />
                ) : (
                  <>
                    <p className="text-[10px] text-[#3a4a66]">Click to add at playhead · Drag to timeline</p>
                    <div className="space-y-1.5">
                      {audioFiles.map((f, i) => (
                        <div
                          key={i}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/video-editor-clip', audioDragData(f))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => addAudioToTimeline(f)}
                          className="flex items-center gap-2 p-2 rounded-lg bg-[#1c2535] hover:bg-[#232f48] border border-[#232a3b] hover:border-[#10B981]/40 transition-all cursor-grab active:cursor-grabbing group"
                        >
                          {/* Waveform icon */}
                          <div className="w-8 h-8 rounded-md bg-[#10B981]/15 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" d="M3 12h2l2-6 2 12 2-8 2 4 2-2h2"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-slate-300 font-medium truncate">{f.name}</p>
                            <p className="text-[10px] text-[#3a4a66]">{f.duration.toFixed(1)}s</p>
                          </div>
                          <svg className="w-3.5 h-3.5 text-[#2a3550] group-hover:text-[#10B981] transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── SHAPES TAB ── */}
            {dockTab === 'shapes' && (
              <>
                <p className="text-[10px] text-[#3a4a66] uppercase tracking-wider font-semibold pb-1">Color Fills</p>
                <div className="grid grid-cols-4 gap-2">
                  {SHAPE_COLORS.map((c) => (
                    <button key={c} onClick={() => addShape(c)}
                      className="aspect-square rounded-xl border-2 border-transparent hover:border-white/30 hover:scale-110 transition-all shadow-md"
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                <p className="text-[10px] text-[#2a3550] mt-1">Click to add to overlay track</p>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function EmptyPlaceholder({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-2xl bg-[#1c2535] flex items-center justify-center mx-auto mb-2">
        {icon}
      </div>
      <p className="text-[#3a4a66] text-xs">{text}</p>
      <p className="text-[#2a3550] text-[10px] mt-0.5">{sub}</p>
    </div>
  )
}
