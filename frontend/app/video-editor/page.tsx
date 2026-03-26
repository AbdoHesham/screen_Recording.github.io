'use client'
import dynamic from 'next/dynamic'

const EditorLayout = dynamic(() => import('./components/EditorLayout'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen bg-[#0a0d16] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#4F72EF]/20 border-t-[#4F72EF] animate-spin" />
        <span className="text-[#3a4f6a] text-sm font-medium">Loading Editor…</span>
      </div>
    </div>
  ),
})

export default function VideoEditorPage() {
  return <EditorLayout />
}
