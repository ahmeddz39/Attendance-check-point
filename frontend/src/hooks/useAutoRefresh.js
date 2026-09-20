import { useEffect, useRef } from 'react'

// Re-runs `callback` on a fixed interval without resetting the timer every time
// the callback identity changes (e.g. because it closes over filter state) --
// the ref always points at the latest version, so ticks stay on schedule while
// still picking up current filters/month/search whenever they fire.
export default function useAutoRefresh(callback, intervalMs = 60000) {
  const savedCallback = useRef(callback)

  useEffect(() => { savedCallback.current = callback }, [callback])

  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
