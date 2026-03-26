'use client'
import React, { useState, useRef, useCallback } from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'
import { Clip, ASPECT_RATIOS } from '../types'

type Quality = '1080p' | '720p' | '480p'
type Format  = 'webm' | 'mp4'

const QUALITY_MAP: Record<Quality, { w: number; h: number }> = {
  '1080p': { w: 1920, h: 1080 },
  '720p':  { w: 1280, h: 720  },
  '480p':  { w: 854,  h: 480  },
}

interface Props { onClose: () => void }

export default function ExportModal({ onClose }: Props) {
  const { tracks, duration, aspectRatio } = useEditorStore()

  const [quality, setQuality] = useState<Quality>('720p')
  const [format, setFormat]   = useState<Format>('webm')
  const [fps, setFps]         = useState(30)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle'|'rendering'|'done'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  const cancelRef  = useRef(false)
  const videoPool  = useRef<Map<string, HTMLVideoElement>>(new Map())
  const imagePool  = useRef<Map<string, HTMLImageElement>>(new Map())

  /* ── Video element pool ── */
  const getVid = useCallback((src: string) => {
    if (!videoPool.current.has(src)) {
      const v = document.createElement('video')
      v.src = src; v.muted = true; v.playsInline = true
      v.crossOrigin = 'anonymous'; v.preload = 'auto'
      videoPool.current.set(src, v)
    }
    return videoPool.current.get(src)!
  }, [])

  /* ── Image element pool ── */
  const getImg = useCallback((src: string) => {
    if (!imagePool.current.has(src)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = src
      imagePool.current.set(src, img)
    }
    return imagePool.current.get(src)!
  }, [])

  /* ── Draw one frame ── */
  const drawFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    time: number,
    cw: number, ch: number,
    nw: number, nh: number,
  ) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, cw, ch)

    const scaleX = cw / nw
    const scaleY = ch / nh

    // Render order: video tracks → overlay tracks (audio skipped)
    const ordered = [
      ...tracks.filter((t) => t.type === 'video'),
      ...tracks.filter((t) => t.type === 'overlay'),
    ]

    ordered.forEach((track) => {
      if (!track.visible) return
      track.clips.forEach((clip: Clip) => {
        if (time < clip.startTime || time >= clip.endTime) return

        ctx.save()
        ctx.globalAlpha = clip.opacity ?? 1

        const eff = clip.effects
        if (eff) {
          ctx.filter = `brightness(${eff.brightness}%) contrast(${eff.contrast}%) saturate(${eff.saturation}%) hue-rotate(${eff.hue}deg)`
        }

        const x = (clip.x ?? 0) * scaleX
        const y = (clip.y ?? 0) * scaleY
        const w = Math.max(1, (clip.width  ?? nw) * scaleX)
        const h = Math.max(1, (clip.height ?? nh) * scaleY)

        // Apply rotation around clip center
        if (clip.rotation) {
          ctx.translate(x + w / 2, y + h / 2)
          ctx.rotate((clip.rotation * Math.PI) / 180)
          ctx.translate(-(x + w / 2), -(y + h / 2))
        }

        if (clip.type === 'video' && clip.src) {
          const vid = getVid(clip.src)
          if (vid.readyState >= 2) ctx.drawImage(vid, x, y, w, h)
          else { ctx.fillStyle = clip.color || '#111'; ctx.fillRect(x, y, w, h) }

        } else if (clip.type === 'image' && clip.src) {
          const img = getImg(clip.src)
          if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, y, w, h)
          else { ctx.fillStyle = clip.color || '#222'; ctx.fillRect(x, y, w, h) }

        } else if (clip.type === 'text' && clip.text) {
          const fs = (clip.fontSize || 48) * Math.min(scaleX, scaleY)
          ctx.filter = 'none'
          ctx.font = `${clip.fontWeight || 'bold'} ${fs}px ${clip.fontFamily || 'Inter, sans-serif'}`
          ctx.fillStyle = clip.fontColor || '#fff'
          ctx.textBaseline = 'middle'
          ctx.textAlign = (clip.textAlign as CanvasTextAlign) || 'center'
          ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8
          const textX = clip.textAlign === 'left' ? x : clip.textAlign === 'right' ? x + w : x + w / 2
          ctx.fillText(clip.text, textX, y + h / 2, w)
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0

        } else {
          // Shape / solid fill
          ctx.fillStyle = clip.bgColor || clip.color || '#4F72EF'
          ctx.fillRect(x, y, w, h)
        }

        ctx.restore()
      })
    })
  }, [tracks, getVid, getImg])

  /* ── Pre-seek all video clips to t ── */
  const seekVideos = useCallback(async (time: number) => {
    const promises: Promise<void>[] = []
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.type === 'video' && clip.src && time >= clip.startTime && time < clip.endTime) {
          const vid = getVid(clip.src)
          const offset = time - clip.startTime + (clip.srcIn ?? 0)
          if (Math.abs(vid.currentTime - offset) < 0.05) return
          promises.push(new Promise((res) => {
            const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); res() }
            const onError  = () => { vid.removeEventListener('error',  onError);  res() }
            vid.addEventListener('seeked', onSeeked)
            vid.addEventListener('error',  onError)
            vid.currentTime = isFinite(offset) ? Math.max(0, offset) : 0
          }))
        }
      })
    })
    await Promise.all(promises)
  }, [tracks, getVid])

  /* ── Main export ── */
  const startExport = useCallback(async () => {
    setPhase('rendering')
    setProgress(0)
    cancelRef.current = false

    const { w: nw, h: nh } = ASPECT_RATIOS[aspectRatio]
    const { w: cw, h: ch } = QUALITY_MAP[quality]

    const canvas = document.createElement('canvas')
    canvas.width  = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) { setPhase('error'); setErrorMsg('Canvas 2D not available'); return }

    // Collect all sources
    const videoSrcs = new Set<string>()
    const imageSrcs = new Set<string>()
    tracks.forEach((t) => t.clips.forEach((c) => {
      if (c.src) {
        if (c.type === 'video') videoSrcs.add(c.src)
        if (c.type === 'image') imageSrcs.add(c.src)
      }
    }))

    // Preload videos
    await Promise.all([...videoSrcs].map((src) => new Promise<void>((res) => {
      const v = getVid(src)
      if (v.readyState >= 4) { res(); return }
      v.oncanplaythrough = () => { v.oncanplaythrough = null; res() }
      v.onerror = () => res()
      v.load()
    })))

    // Preload images
    await Promise.all([...imageSrcs].map((src) => new Promise<void>((res) => {
      const img = getImg(src)
      if (img.complete && img.naturalWidth > 0) { res(); return }
      img.onload  = () => res()
      img.onerror = () => res()
    })))

    // MediaRecorder setup
    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'

    const stream   = canvas.captureStream(fps)
    const bitrate  = quality === '1080p' ? 8_000_000 : quality === '720p' ? 4_000_000 : 2_000_000
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
      setDownloadUrl(URL.createObjectURL(blob))
      setProgress(100)
      setPhase('done')
    }

    recorder.onerror = () => {
      setPhase('error')
      setErrorMsg('MediaRecorder error. Try a different quality.')
    }

    recorder.start(100)

    const frameDt     = 1 / fps
    const frameDurMs  = 1000 / fps          // ms each frame must occupy in real time
    const totalFrames = Math.ceil(duration * fps)
    const exportStart = performance.now()   // anchor for wall-clock pacing

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (cancelRef.current) { recorder.stop(); setPhase('idle'); return }

      const time = frame * frameDt
      await seekVideos(time)
      drawFrame(ctx, time, cw, ch, nw, nh)
      setProgress(Math.round((frame / totalFrames) * 95))

      // Pace the loop so that wall-clock elapsed time matches video time.
      // captureStream records based on real time, so we must advance at
      // exactly 1/fps seconds per frame or the output will be shorter.
      const expectedElapsed = (frame + 1) * frameDurMs
      const actualElapsed   = performance.now() - exportStart
      const waitMs          = Math.max(1, expectedElapsed - actualElapsed)
      await new Promise((r) => setTimeout(r, waitMs))
    }

    recorder.stop()
  }, [tracks, duration, aspectRatio, quality, fps, drawFrame, seekVideos, getVid, getImg])

  const triggerDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `export-${Date.now()}.${format === 'mp4' ? 'mp4' : 'webm'}`
    a.click()
    URL.revokeObjectURL(downloadUrl)
    setDownloadUrl('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[420px] bg-[#141c2e] border border-[#252f47] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3e]">
          <div>
            <h2 className="text-sm font-semibold text-white">Export Video</h2>
            <p className="text-[11px] text-[#3a4f6a] mt-0.5">Render all timeline elements to video</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Settings */}
        <div className="p-5 space-y-4">
          {/* Quality */}
          <div>
            <label className="text-[11px] font-semibold text-[#4a5c7a] uppercase tracking-wider block mb-2">Quality</label>
            <div className="grid grid-cols-3 gap-2">
              {(['480p','720p','1080p'] as Quality[]).map((q) => (
                <button key={q} onClick={() => setQuality(q)} disabled={phase === 'rendering'}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all ${quality === q ? 'bg-[#4F72EF] text-white shadow-lg shadow-[#4F72EF]/20' : 'bg-[#1c2535] text-slate-400 hover:text-white border border-[#252f47]'}`}>
                  {q}
                  <span className="block text-[9px] font-normal opacity-60">{QUALITY_MAP[q].w}×{QUALITY_MAP[q].h}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-[11px] font-semibold text-[#4a5c7a] uppercase tracking-wider block mb-2">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'webm', label: 'WebM', sub: 'Native browser (VP8/VP9)' },
                { id: 'mp4',  label: 'MP4',  sub: 'Rename .webm → .mp4 after' },
              ] as { id: Format; label: string; sub: string }[]).map((f) => (
                <button key={f.id} onClick={() => setFormat(f.id)} disabled={phase === 'rendering'}
                  className={`py-2 px-3 rounded-xl text-left text-xs transition-all ${format === f.id ? 'bg-[#4F72EF] text-white shadow-lg shadow-[#4F72EF]/20' : 'bg-[#1c2535] text-slate-400 hover:text-white border border-[#252f47]'}`}>
                  <span className="font-semibold">{f.label}</span>
                  <span className="block text-[9px] opacity-60 mt-0.5">{f.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="text-[11px] font-semibold text-[#4a5c7a] uppercase tracking-wider block mb-2">Frame Rate</label>
            <div className="grid grid-cols-3 gap-2">
              {[24, 30, 60].map((f) => (
                <button key={f} onClick={() => setFps(f)} disabled={phase === 'rendering'}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all ${fps === f ? 'bg-[#4F72EF] text-white' : 'bg-[#1c2535] text-slate-400 hover:text-white border border-[#252f47]'}`}>
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-[#0f1520] rounded-xl px-3 py-2.5 text-[11px] text-[#3a4f6a] space-y-0.5">
            <p>Duration: <span className="text-slate-400">{duration}s</span></p>
            <p>Output: <span className="text-slate-400">{QUALITY_MAP[quality].w}×{QUALITY_MAP[quality].h} · {fps}fps</span></p>
            <p className="text-[#2a3550]">Export renders all tracks in real-time. A {duration}s video takes ~{duration}s to export.</p>
          </div>

          {/* Progress */}
          {(phase === 'rendering') && (
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-slate-400">Rendering frames…</span>
                <span className="text-[11px] font-mono text-[#4F72EF]">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1c2535] rounded-full overflow-hidden">
                <div className="h-full bg-[#4F72EF] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <p className="text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          {phase === 'done' ? (
            <button onClick={triggerDownload}
              className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download
            </button>
          ) : phase === 'rendering' ? (
            <button onClick={() => { cancelRef.current = true }}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold transition-all">
              Cancel
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-all">
                Cancel
              </button>
              <button onClick={startExport}
                className="flex-1 py-2.5 rounded-xl bg-[#4F72EF] hover:bg-[#6186F5] text-white text-sm font-semibold shadow-lg shadow-[#4F72EF]/20 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Start Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
