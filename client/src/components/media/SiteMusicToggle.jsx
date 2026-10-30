import { useRef, useState } from 'react'
import { FiVolume2, FiVolumeX } from 'react-icons/fi'
import siteMusic from '../../assets/aud/Showoff link sound.mp3'

export default function SiteMusicToggle() {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      return
    }

    try {
      await audio.play()
      setFailed(false)
    } catch {
      setFailed(true)
      setPlaying(false)
    }
  }

  const label = playing ? 'Stop site music' : 'Play site music'

  return (
    <>
      <audio
        ref={audioRef}
        src={siteMusic}
        loop
        preload="none"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false) }}
      />
      <button
        type="button"
        className={`site-music-toggle ${playing ? 'is-playing' : ''}`}
        onClick={togglePlayback}
        aria-label={failed ? 'Site music unavailable' : label}
        aria-pressed={playing}
        title={failed ? 'Site music unavailable' : label}
      >
        {playing ? <FiVolume2 aria-hidden="true" /> : <FiVolumeX aria-hidden="true" />}
        <span>{failed ? 'Unavailable' : playing ? 'Sound on' : 'Sound off'}</span>
      </button>
    </>
  )
}