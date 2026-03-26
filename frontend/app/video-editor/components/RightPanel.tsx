'use client'
import React from 'react'
import { useEditorStore } from '../../../store/videoEditorStore'
import { Clip, DEFAULT_EFFECTS } from '../types'

export default function RightPanel() {
  const { selectedClipId, tracks } = useEditorStore()

  const clip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null

  return (
    <aside className="w-[260px] h-full bg-[#12151f] border-l border-[#1e2535] flex flex-col shrink-0 overflow-hidden">
      {clip ? (
        <ClipInspector clip={clip} />
      ) : (
        <EmptyState />
      )}
    </aside>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <h4 className="text-[10px] font-semibold text-[#3e4f6e] uppercase tracking-widest">{title}</h4>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center px-3 py-1 gap-2">
      <span className="text-[11px] text-[#4a5c7a] w-16 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Slider({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-[#4F72EF] cursor-pointer" />
      <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{Math.round(value)}</span>
    </div>
  )
}

function NumberInput({ value, min, max, onChange }: {
  value: number; min?: number; max?: number; onChange: (v: number) => void
}) {
  return (
    <input type="number" value={Math.round(value)} min={min} max={max}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full bg-[#1c2535] border border-[#2a3550] rounded-md px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#4F72EF]/60 text-right" />
  )
}

function ClipInspector({ clip }: { clip: Clip }) {
  const { updateClip, removeClip, duplicateClip, splitClip, currentTime } = useEditorStore()

  const update = (updates: Partial<Clip>) => updateClip(clip.id, updates)
  const eff = clip.effects || { ...DEFAULT_EFFECTS }

  const FONTS = ['Inter, sans-serif', 'Georgia, serif', 'Courier New, monospace', 'Arial, sans-serif', 'Trebuchet MS, sans-serif']

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1e2535] bg-[#151b29]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clip.color || '#4F72EF' }} />
          <p className="text-xs font-semibold text-white truncate flex-1">{clip.name}</p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1c2535] text-[#4a5c7a] uppercase">{clip.type}</span>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-1 mt-2">
          {[
            { label: 'Split', action: () => splitClip(clip.id, currentTime) },
            { label: 'Dupe', action: () => duplicateClip(clip.id) },
            { label: 'Delete', action: () => removeClip(clip.id), danger: true },
          ].map((b) => (
            <button key={b.label} onClick={b.action}
              className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                b.danger
                  ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                  : 'text-slate-300 bg-white/5 hover:bg-white/10'
              }`}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Timing */}
        <SectionHeader title="Timing" />
        <Row label="Start">
          <NumberInput value={clip.startTime} min={0} onChange={(v) => update({ startTime: v })} />
        </Row>
        <Row label="End">
          <NumberInput value={clip.endTime} min={clip.startTime + 0.1} onChange={(v) => update({ endTime: v })} />
        </Row>
        <Row label="Duration">
          <span className="text-[11px] text-slate-500 font-mono">{(clip.endTime - clip.startTime).toFixed(2)}s</span>
        </Row>
        <Row label="Speed">
          <Slider value={clip.speed * 100} min={25} max={400} onChange={(v) => update({ speed: v / 100 })} />
        </Row>

        {/* Transform */}
        <SectionHeader title="Transform" />
        <div className="grid grid-cols-2 gap-x-2 px-3 pb-1">
          {[
            { label: 'X', value: clip.x, key: 'x' as const },
            { label: 'Y', value: clip.y, key: 'y' as const },
            { label: 'W', value: clip.width, key: 'width' as const },
            { label: 'H', value: clip.height, key: 'height' as const },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[10px] text-[#4a5c7a] w-4">{label}</span>
              <NumberInput value={value} onChange={(v) => update({ [key]: v })} />
            </div>
          ))}
        </div>
        <Row label="Rotation">
          <Slider value={clip.rotation} min={-180} max={180} onChange={(v) => update({ rotation: v })} />
        </Row>
        <Row label="Opacity">
          <Slider value={clip.opacity * 100} min={0} max={100} onChange={(v) => update({ opacity: v / 100 })} />
        </Row>

        {/* Text props */}
        {clip.type === 'text' && (
          <>
            <SectionHeader title="Typography" />
            <div className="px-3 pb-1 space-y-1.5">
              <textarea value={clip.text || ''} rows={2}
                onChange={(e) => update({ text: e.target.value })}
                className="w-full bg-[#1c2535] border border-[#2a3550] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#4F72EF]/60 resize-none" />

              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="text-[10px] text-[#3e4f6e] mb-0.5 block">Font</label>
                  <select value={clip.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}
                    className="w-full bg-[#1c2535] border border-[#2a3550] rounded-md px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-[#4F72EF]/60">
                    {FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</option>
                    ))}
                  </select>
                </div>
                <div className="w-16">
                  <label className="text-[10px] text-[#3e4f6e] mb-0.5 block">Size</label>
                  <NumberInput value={clip.fontSize || 48} min={8} max={400} onChange={(v) => update({ fontSize: v })} />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex-1">
                  <label className="text-[10px] text-[#3e4f6e] mb-0.5 block">Color</label>
                  <input type="color" value={clip.fontColor || '#ffffff'}
                    onChange={(e) => update({ fontColor: e.target.value })}
                    className="w-full h-7 rounded-md border border-[#2a3550] cursor-pointer bg-[#1c2535]" />
                </div>
                {/* Weight / Style */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#3e4f6e]">Style</label>
                  <div className="flex gap-1">
                    <button onClick={() => update({ fontWeight: clip.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${clip.fontWeight === 'bold' ? 'bg-[#4F72EF] text-white' : 'bg-[#1c2535] text-slate-400 hover:text-white'}`}>B</button>
                    <button onClick={() => update({ fontStyle: clip.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`w-7 h-7 rounded-md text-xs italic transition-colors ${clip.fontStyle === 'italic' ? 'bg-[#4F72EF] text-white' : 'bg-[#1c2535] text-slate-400 hover:text-white'}`}>I</button>
                  </div>
                </div>
              </div>

              {/* Alignment */}
              <div>
                <label className="text-[10px] text-[#3e4f6e] mb-0.5 block">Align</label>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button key={a} onClick={() => update({ textAlign: a })}
                      className={`flex-1 py-1 rounded-md text-xs transition-colors ${clip.textAlign === a ? 'bg-[#4F72EF] text-white' : 'bg-[#1c2535] text-slate-400 hover:text-white'}`}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Row label="Spacing">
                <Slider value={clip.letterSpacing || 0} min={-5} max={20} onChange={(v) => update({ letterSpacing: v })} />
              </Row>
            </div>
          </>
        )}

        {/* Audio props */}
        {clip.type === 'audio' && (
          <>
            <SectionHeader title="Audio" />
            <Row label="Volume">
              <Slider value={(clip.volume || 1) * 100} min={0} max={100} onChange={(v) => update({ volume: v / 100 })} />
            </Row>
            <Row label="Fade In">
              <Slider value={clip.fadeIn || 0} min={0} max={5} step={0.1} onChange={(v) => update({ fadeIn: v })} />
            </Row>
            <Row label="Fade Out">
              <Slider value={clip.fadeOut || 0} min={0} max={5} step={0.1} onChange={(v) => update({ fadeOut: v })} />
            </Row>
          </>
        )}

        {/* Effects */}
        {clip.type !== 'audio' && (
          <>
            <SectionHeader title="Adjustments" />
            <Row label="Brightness">
              <Slider value={eff.brightness} min={0} max={200} onChange={(v) => update({ effects: { ...eff, brightness: v } })} />
            </Row>
            <Row label="Contrast">
              <Slider value={eff.contrast} min={0} max={200} onChange={(v) => update({ effects: { ...eff, contrast: v } })} />
            </Row>
            <Row label="Saturation">
              <Slider value={eff.saturation} min={0} max={200} onChange={(v) => update({ effects: { ...eff, saturation: v } })} />
            </Row>
            <Row label="Hue">
              <Slider value={eff.hue} min={-180} max={180} onChange={(v) => update({ effects: { ...eff, hue: v } })} />
            </Row>
            <div className="px-3 pb-3">
              <button onClick={() => update({ effects: { ...DEFAULT_EFFECTS } })}
                className="w-full py-1 text-[11px] text-[#4a5c7a] hover:text-slate-300 bg-white/3 hover:bg-white/6 rounded-lg transition-colors">
                Reset adjustments
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#1c2535] flex items-center justify-center">
        <svg className="w-6 h-6 text-[#2a3550]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 3h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#3e4f6e]">Inspector</p>
        <p className="text-[11px] text-[#2a3550] mt-0.5">Select a clip to edit its properties</p>
      </div>
    </div>
  )
}
