import { create } from 'zustand'
import {
  Clip, Track, TrackType, AspectRatio, ContextMenu,
} from '../app/video-editor/types'

let _id = 0
const uid = () => `c_${Date.now()}_${++_id}`
let _tid = 0
const tid = () => `t_${Date.now()}_${++_tid}`

/** ── Empty starter tracks (no demo clips) ── */
function makeEmptyTracks(): Track[] {
  return [
    {
      id: tid(), name: 'Video 1', type: 'video',
      visible: true, muted: false, locked: false, solo: false,
      height: 64, color: '#4F72EF', clips: [],
    },
    {
      id: tid(), name: 'Audio 1', type: 'audio',
      visible: true, muted: false, locked: false, solo: false,
      height: 48, color: '#10B981', clips: [],
    },
    {
      id: tid(), name: 'Overlay', type: 'overlay',
      visible: true, muted: false, locked: false, solo: false,
      height: 48, color: '#F59E0B', clips: [],
    },
  ]
}

/** ── Saved project shape (persisted to localStorage) ── */
export interface SavedProject {
  id: string
  name: string
  savedAt: string          // ISO string
  tracks: Track[]
  duration: number
  aspectRatio: AspectRatio
}

const LS_KEY = 'proscreen_saved_edits'

export const projectStorage = {
  list(): SavedProject[] {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    } catch { return [] }
  },
  save(project: SavedProject) {
    const all = projectStorage.list()
    const idx = all.findIndex((p) => p.id === project.id)
    if (idx >= 0) all[idx] = project
    else all.unshift(project)
    localStorage.setItem(LS_KEY, JSON.stringify(all.slice(0, 50)))
  },
  delete(id: string) {
    const all = projectStorage.list().filter((p) => p.id !== id)
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  },
  get(id: string): SavedProject | undefined {
    return projectStorage.list().find((p) => p.id === id)
  },
}

type DockTab = 'media' | 'text' | 'audio' | 'shapes' | null

interface EditorStore {
  // Playback
  currentTime: number
  duration: number
  playing: boolean

  // Project meta
  projectId: string
  projectName: string
  aspectRatio: AspectRatio
  lastSavedAt: string | null   // ISO or null

  // Timeline
  tracks: Track[]
  zoom: number
  snapEnabled: boolean

  // UI
  selectedClipId: string | null
  dockTab: DockTab
  contextMenu: ContextMenu | null

  // History
  history: Track[][]
  historyIndex: number

  // --- Actions ---
  setCurrentTime: (t: number) => void
  setPlaying: (v: boolean) => void
  togglePlay: () => void
  setDuration: (d: number) => void

  setProjectName: (name: string) => void
  setAspectRatio: (r: AspectRatio) => void
  setZoom: (z: number) => void
  setSnapEnabled: (v: boolean) => void

  selectClip: (id: string | null) => void
  setDockTab: (tab: DockTab) => void
  setContextMenu: (cm: ContextMenu | null) => void

  addTrack: (type: TrackType) => void
  removeTrack: (id: string) => void
  toggleTrackVisibility: (id: string) => void
  toggleTrackMute: (id: string) => void
  toggleTrackLock: (id: string) => void
  toggleTrackSolo: (id: string) => void

  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => void
  removeClip: (id: string) => void
  moveClip: (id: string, newTrackId: string, newStart: number) => void
  resizeClip: (id: string, newStart: number, newEnd: number) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  splitClip: (id: string, atTime: number) => void
  duplicateClip: (id: string) => void

  undo: () => void
  redo: () => void
  saveHistory: () => void

  /** Persist current state to localStorage */
  saveDraft: () => void
  /** Load a saved project into the store */
  loadProject: (project: SavedProject) => void
  /** Reset to blank project */
  newProject: () => void

  getClip: (id: string) => Clip | undefined
  getActiveClips: (time?: number) => Clip[]
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const defaultTracks = makeEmptyTracks()

  const snap = (t: number) => {
    if (!get().snapEnabled) return t
    return Math.round(t * 8) / 8
  }

  /** Auto-set duration to fit all clip endTimes (min 10s, 2s tail padding) */
  const syncDuration = () => {
    const { tracks } = get()
    const maxEnd = tracks.flatMap((t) => t.clips).reduce((m, c) => Math.max(m, c.endTime), 0)
    set({ duration: Math.max(10, Math.ceil(maxEnd) + 2) })
  }

  return {
    currentTime: 0,
    duration: 30,
    playing: false,
    projectId: `proj_${Date.now()}`,
    projectName: 'Untitled Project',
    aspectRatio: '16:9',
    lastSavedAt: null,
    tracks: defaultTracks,
    zoom: 1,
    snapEnabled: true,
    selectedClipId: null,
    dockTab: null,
    contextMenu: null,
    history: [JSON.parse(JSON.stringify(defaultTracks))],
    historyIndex: 0,

    setCurrentTime: (t) =>
      set({ currentTime: Math.max(0, Math.min(t, get().duration)) }),
    setPlaying: (v) => set({ playing: v }),
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    setDuration: (d) => set({ duration: Math.max(1, d) }),

    setProjectName: (name) => set({ projectName: name }),
    setAspectRatio: (r) => set({ aspectRatio: r }),
    setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(5, z)) }),
    setSnapEnabled: (v) => set({ snapEnabled: v }),

    selectClip: (id) => set({ selectedClipId: id }),
    setDockTab: (tab) =>
      set((s) => ({ dockTab: s.dockTab === tab ? null : tab })),
    setContextMenu: (cm) => set({ contextMenu: cm }),

    addTrack: (type) => {
      const colors: Record<TrackType, string> = {
        video: '#4F72EF', audio: '#10B981', overlay: '#F59E0B',
      }
      const heights: Record<TrackType, number> = {
        video: 64, audio: 48, overlay: 48,
      }
      const newTrack: Track = {
        id: tid(),
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
        type, visible: true, muted: false, locked: false, solo: false,
        height: heights[type], color: colors[type], clips: [],
      }
      set((s) => ({ tracks: [...s.tracks, newTrack] }))
      get().saveHistory()
    },

    removeTrack: (id) => {
      set((s) => ({
        tracks: s.tracks.filter((t) => t.id !== id),
        selectedClipId: s.tracks
          .find((t) => t.id === id)
          ?.clips.some((c) => c.id === s.selectedClipId)
          ? null
          : s.selectedClipId,
      }))
      syncDuration()
      get().saveHistory()
    },

    toggleTrackVisibility: (id) =>
      set((s) => ({
        tracks: s.tracks.map((t) => t.id === id ? { ...t, visible: !t.visible } : t),
      })),
    toggleTrackMute: (id) =>
      set((s) => ({
        tracks: s.tracks.map((t) => t.id === id ? { ...t, muted: !t.muted } : t),
      })),
    toggleTrackLock: (id) =>
      set((s) => ({
        tracks: s.tracks.map((t) => t.id === id ? { ...t, locked: !t.locked } : t),
      })),
    toggleTrackSolo: (id) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === id ? { ...t, solo: !t.solo } : { ...t, solo: false }
        ),
      })),

    addClip: (trackId, clipData) => {
      const newClip: Clip = { ...clipData, id: uid(), trackId }
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
        ),
      }))
      syncDuration()
      get().saveHistory()
    },

    removeClip: (id) => {
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t, clips: t.clips.filter((c) => c.id !== id),
        })),
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      }))
      syncDuration()
      get().saveHistory()
    },

    moveClip: (id, newTrackId, newStart) => {
      const snapped = snap(Math.max(0, newStart))
      set((s) => {
        let clip: Clip | undefined
        const tracks = s.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => {
            if (c.id === id) { clip = c; return false }
            return true
          }),
        }))
        if (!clip) return {}
        const dur = clip.endTime - clip.startTime
        const updated: Clip = {
          ...clip, trackId: newTrackId,
          startTime: snapped, endTime: snapped + dur,
        }
        return {
          tracks: tracks.map((t) =>
            t.id === newTrackId ? { ...t, clips: [...t.clips, updated] } : t
          ),
        }
      })
      syncDuration()
    },

    resizeClip: (id, newStart, newEnd) => {
      const s = snap(Math.max(0, newStart))
      const e = snap(Math.max(s + 0.25, newEnd))
      set((state) => ({
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === id ? { ...c, startTime: s, endTime: e } : c
          ),
        })),
      }))
      syncDuration()
    },

    updateClip: (id, updates) => {
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => c.id === id ? { ...c, ...updates } : c),
        })),
      }))
    },

    splitClip: (id, atTime) => {
      const clip = get().getClip(id)
      if (!clip || atTime <= clip.startTime || atTime >= clip.endTime) return
      const leftDur = atTime - clip.startTime
      const left: Clip = { ...clip, endTime: atTime, srcOut: clip.srcIn + leftDur }
      const right: Clip = { ...clip, id: uid(), startTime: atTime, srcIn: clip.srcIn + leftDur }
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (!t.clips.some((c) => c.id === id)) return t
          const idx = t.clips.findIndex((c) => c.id === id)
          const clips = [...t.clips]
          clips.splice(idx, 1, left, right)
          return { ...t, clips }
        }),
      }))
      syncDuration()
      get().saveHistory()
    },

    duplicateClip: (id) => {
      const clip = get().getClip(id)
      if (!clip) return
      const dur = clip.endTime - clip.startTime
      const newClip: Clip = {
        ...clip, id: uid(),
        startTime: clip.endTime,
        endTime: clip.endTime + dur,
      }
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === clip.trackId ? { ...t, clips: [...t.clips, newClip] } : t
        ),
        selectedClipId: newClip.id,
      }))
      syncDuration()
      get().saveHistory()
    },

    saveHistory: () => {
      const { tracks, history, historyIndex } = get()
      const next = history.slice(0, historyIndex + 1)
      next.push(JSON.parse(JSON.stringify(tracks)))
      set({ history: next.slice(-50), historyIndex: Math.min(next.length - 1, 49) })
    },

    undo: () => {
      const { historyIndex, history } = get()
      if (historyIndex <= 0) return
      set({
        tracks: JSON.parse(JSON.stringify(history[historyIndex - 1])),
        historyIndex: historyIndex - 1,
      })
    },

    redo: () => {
      const { historyIndex, history } = get()
      if (historyIndex >= history.length - 1) return
      set({
        tracks: JSON.parse(JSON.stringify(history[historyIndex + 1])),
        historyIndex: historyIndex + 1,
      })
    },

    saveDraft: () => {
      const { projectId, projectName, tracks, duration, aspectRatio } = get()
      const project: SavedProject = {
        id: projectId,
        name: projectName,
        savedAt: new Date().toISOString(),
        tracks: JSON.parse(JSON.stringify(tracks)),
        duration,
        aspectRatio,
      }
      projectStorage.save(project)
      set({ lastSavedAt: project.savedAt })
    },

    loadProject: (project) => {
      const tracks = JSON.parse(JSON.stringify(project.tracks))
      set({
        projectId: project.id,
        projectName: project.name,
        tracks,
        duration: project.duration,
        aspectRatio: project.aspectRatio,
        currentTime: 0,
        playing: false,
        selectedClipId: null,
        history: [JSON.parse(JSON.stringify(tracks))],
        historyIndex: 0,
        lastSavedAt: project.savedAt,
      })
    },

    newProject: () => {
      const tracks = makeEmptyTracks()
      set({
        projectId: `proj_${Date.now()}`,
        projectName: 'Untitled Project',
        tracks,
        duration: 30,
        aspectRatio: '16:9',
        currentTime: 0,
        playing: false,
        selectedClipId: null,
        zoom: 1,
        history: [JSON.parse(JSON.stringify(tracks))],
        historyIndex: 0,
        lastSavedAt: null,
      })
    },

    getClip: (id) => {
      for (const t of get().tracks) {
        const c = t.clips.find((c) => c.id === id)
        if (c) return c
      }
    },

    getActiveClips: (time) => {
      const t = time ?? get().currentTime
      return get()
        .tracks.filter((tr) => tr.visible)
        .flatMap((tr) => tr.clips.filter((c) => t >= c.startTime && t < c.endTime))
    },
  }
})
