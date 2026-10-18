import { useEffect, useRef } from 'react'

/** Calls `onFrame` with the seconds since the last frame, every animation frame. */
export function useAnimationFrame(onFrame: (seconds: number) => void) {
  const callback = useRef(onFrame)
  useEffect(() => {
    callback.current = onFrame
  })

  useEffect(() => {
    let last = performance.now()
    let id = requestAnimationFrame(function loop(now) {
      callback.current((now - last) / 1000)
      last = now
      id = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [])
}
