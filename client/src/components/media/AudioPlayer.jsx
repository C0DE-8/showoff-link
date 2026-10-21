import { useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2 } from 'react-icons/fi'

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const seconds = Math.floor(value)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AudioPlayer({ src, label = 'Voice recording', className = '' }) {
  const audioRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || !src) return
    setError('')
    if (audio.paused) {
      setLoading(true)
      try {
        await audio.play()
      } catch {
        setLoading(false)
        setError('This recording could not be played. It may be unavailable or in an unsupported format.')
      }
    } else {
      audio.pause()
    }
  }

  const seek = (event) => {
    if (audioRef.current && duration) {
      const nextTime = Number(event.target.value)
      audioRef.current.currentTime = nextTime
      setCurrentTime(nextTime)
    }
  }

  return (
    <div className={`audio-player ${className}`}>
      <audio
        ref={audioRef}
        src={src || undefined}
        preload="none"
        onLoadStart={() => { setLoading(true); setError('') }}
        onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); setLoading(false) }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlaying={() => { setPlaying(true); setLoading(false) }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        onError={() => { setPlaying(false); setLoading(false); setError('Audio could not be loaded. Check your connection or try recording again.') }}
      />
      <button className="audio-play-button" type="button" onClick={togglePlayback} aria-label={playing ? 'Pause voice recording' : 'Play voice recording'} disabled={!src}>
        {playing ? <FiPause /> : <FiPlay />}
      </button>
      <div className="audio-player-main">
        <div className="audio-player-title">{label}</div>
        <input
          className="audio-seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          aria-label="Seek through voice recording"
          style={{ '--audio-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
        <div className="audio-time"><span>{formatTime(currentTime)}</span><span>{loading ? 'Loading…' : formatTime(duration)}</span></div>
        {error && <div className="audio-player-error" role="status">{error}</div>}
      </div>
      <FiVolume2 className="audio-volume-icon" aria-hidden="true" />
    </div>
  )
}
