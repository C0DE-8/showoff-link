import { useEffect, useRef, useState } from 'react'
import { FiPause, FiPlay, FiVolume2 } from 'react-icons/fi'

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const seconds = Math.floor(value)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AudioPlayer({ src, loadSource, label = 'Voice recording', className = '' }) {
  const audioRef = useRef(null)
  const loadedUrlRef = useRef('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => () => {
    if (loadedUrlRef.current) URL.revokeObjectURL(loadedUrlRef.current)
  }, [])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || loading || (!src && !loadSource)) return
    setError('')
    if (audio.paused) {
      setLoading(true)
      try {
        if (!audio.currentSrc && !audio.src && loadSource) {
          const loadedUrl = await loadSource()
          loadedUrlRef.current = loadedUrl
          audio.src = loadedUrl
        }
        await audio.play()
      } catch (playError) {
        setLoading(false)
        setError(playError.message || 'This recording could not be played. It may be unavailable or in an unsupported format.')
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
        onError={(event) => {
          setPlaying(false)
          setLoading(false)
          const code = event.currentTarget.error?.code
          setError(code === 4
            ? 'This audio format is not supported by your browser.'
            : 'Audio could not be decoded. Please record and upload it again.')
        }}
      />
      <button className="audio-play-button" type="button" onClick={togglePlayback} aria-label={playing ? 'Pause voice recording' : 'Play voice recording'} disabled={loading || (!src && !loadSource)}>
        {playing ? <FiPause /> : loading ? <span className="audio-loading-dot" /> : <FiPlay />}
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
