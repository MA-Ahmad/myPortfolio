import { useCallback } from 'react'

const SOUND_SRC = '/assets/audios/lightswitch.mp3'

export function useSwitchSound() {
  return useCallback((id: 'on' | 'off') => {
    if (typeof window === 'undefined') return

    const audio = new Audio(SOUND_SRC)
    audio.volume = 0.05
    audio.currentTime = id === 'off' ? 0.5 : 0
    void audio.play().catch(() => undefined)
    window.setTimeout(() => {
      audio.pause()
    }, 300)
  }, [])
}
