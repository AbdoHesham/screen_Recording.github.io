export type ClipType = 'video' | 'audio' | 'text' | 'image' | 'shape'
export type TrackType = 'video' | 'audio' | 'overlay'
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3'

export interface ClipEffects {
  brightness: number   // 0-200, default 100
  contrast: number     // 0-200, default 100
  saturation: number   // 0-200, default 100
  hue: number          // -180 to 180, default 0
}

export interface Clip {
  id: string
  trackId: string
  name: string
  type: ClipType
  // Timeline position (seconds)
  startTime: number
  endTime: number
  // Source trim points
  srcIn: number
  srcOut: number
  speed: number       // 0.25 – 4.0, default 1
  // Canvas transform
  x: number
  y: number
  width: number
  height: number
  rotation: number    // degrees
  opacity: number     // 0–1
  // Text
  text?: string
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textAlign?: 'left' | 'center' | 'right'
  letterSpacing?: number
  lineHeight?: number
  // Source
  src?: string
  thumbnail?: string
  duration?: number   // source duration (seconds)
  // Audio
  volume?: number     // 0–1
  fadeIn?: number     // seconds
  fadeOut?: number    // seconds
  // Effects
  effects?: ClipEffects
  // Color
  color?: string
  bgColor?: string
}

export interface Track {
  id: string
  name: string
  type: TrackType
  visible: boolean
  muted: boolean
  locked: boolean
  solo: boolean
  clips: Clip[]
  height: number
  color: string
}

export interface ContextMenu {
  x: number
  y: number
  clipId: string
}

export const PIXELS_PER_SECOND = 100

export const ASPECT_RATIOS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: '16:9 Landscape' },
  '9:16': { w: 1080, h: 1920, label: '9:16 Portrait' },
  '1:1':  { w: 1080, h: 1080, label: '1:1 Square' },
  '4:3':  { w: 1440, h: 1080, label: '4:3 Standard' },
}

export const DEFAULT_EFFECTS: ClipEffects = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
}
