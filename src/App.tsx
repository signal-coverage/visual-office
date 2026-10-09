import { useEffect, useRef } from 'react'
import { Game } from './game/Game'
import './App.css'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = new Game(canvas)
    return () => game.dispose()
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="hint">Click to play · WASD to move · Shift to run · Esc to release the mouse</div>
    </>
  )
}
