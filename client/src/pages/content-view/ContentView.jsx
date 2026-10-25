import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FiAlertCircle, FiImage, FiMic, FiType } from 'react-icons/fi'
import * as noteApi from '../../api/note'
import * as imageApi from '../../api/image'
import * as audioApi from '../../api/audio'
import AudioPlayer from '../../components/media/AudioPlayer'

export default function ContentView({ type }) {
  const { id } = useParams()
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [skinImage, setSkinImage] = useState('')

  useEffect(() => {
    let objectUrl
    let cancelled = false
    const load = async () => {
      try {
        if (type === 'note') {
          const { data } = await noteApi.readNote(id)
          if (!cancelled) {
            setContent(data)
            setSkinImage(data.skin_image || '')
          }
        } else if (type === 'image') {
          const response = await imageApi.viewImage(id)
          const { data } = response
          objectUrl = URL.createObjectURL(data)
          if (!cancelled) {
            setImageUrl(objectUrl)
            setSkinImage(response.headers['x-skin-image'] || '')
            setContent({})
          }
        } else if (!cancelled) {
          setContent({ audioId: id })
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.response?.data?.error || 'This link may have expired or is only available to its recipient.')
      }
    }
    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, type])

  const icon = type === 'note' ? <FiType /> : type === 'image' ? <FiImage /> : <FiMic />
  const loadVoice = async () => {
    const result = await audioApi.fetchVoice(content.audioId)
    if (result.skinImage) setSkinImage(result.skinImage)
    return result.url
  }
  return (
    <main className={`content-view-page ${skinImage ? 'has-shared-skin' : ''}`} style={skinImage ? { backgroundImage: `linear-gradient(rgba(17, 16, 25, .68), rgba(17, 16, 25, .78)), url("${skinImage}")` } : undefined}>
      <a className="brand view-brand" href="/" aria-label="Showoff Links home"><span className="brand-mark">s.</span><span>showoff<span className="brand-muted">links</span></span></a>
      <article className={`view-card ${type === 'voice' ? 'voice-view-card' : ''}`}>
        <div className="view-card-icon">{icon}</div>
        {error ? <>
          <FiAlertCircle className="view-error-icon" />
          <h1>Moment unavailable</h1>
          <p>{error}</p>
        </> : !content ? <>
          <span className="spinner" />
          <p>Opening something made for you…</p>
        </> : <>
          <div className="section-kicker">A MOMENT, JUST FOR YOU</div>
          <h1>{type === 'note' ? 'A little note' : type === 'image' ? 'A favorite moment' : 'A voice hello'}</h1>
          {type === 'note' && <>
            <div className="note-content">{content.note_content}</div>
            <small className="view-count">This note has been opened {content.current_views} of {content.allowed_views} times.</small>
          </>}
          {type === 'image' && <img className="shared-image" src={imageUrl} alt="A shared photo" />}
          {type === 'voice' && <>
            <p className="voice-player-prompt">A little hello, shared just with you.</p>
            <AudioPlayer className="voice-player" loadSource={loadVoice} label="A voice hello" />
          </>}
          <div className="view-signoff">Sent with a little care · Showoff Links</div>
        </>}
      </article>
    </main>
  )
}
