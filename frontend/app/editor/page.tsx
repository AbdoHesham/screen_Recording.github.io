'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EditorRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/video-editor')
  }, [router])
  return null
}
