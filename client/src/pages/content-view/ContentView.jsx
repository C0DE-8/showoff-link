import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FiAlertCircle, FiImage, FiMic, FiType } from 'react-icons/fi'
import * as noteApi from '../../api/note'
import * as imageApi from '../../api/image'
import * as audioApi from '../../api/audio'
import * as skinApi from '../../api/skin'
import AudioPlayer from '../../components/media/AudioPlayer'

export default function ContentView({ type }) {
  const { id } = useParams()
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [skinImage, setSkinImage] = useState('')
  const skinObjectUrlRef = useRef('')

  useEffect(() => {
    let objectUrl
    let skinObjectUrl
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
          const skinId = response.headers['x-skin-id']
          if (skinId) {
            try {
              const skinResponse = await skinApi.getPublicSkin(skinId)
              skinObjectUrl = URL.createObjectURL(skinResponse.data)
            } catch {
              skinObjectUrl = ''
            }
          }
          if (!cancelled) {
            setImageUrl(objectUrl)
            if (skinObjectUrl) {
              skinObjectUrlRef.current = skinObjectUrl
              setSkinImage(skinObjectUrl)
            }
            setContent({})
          } else {
            if (objectUrl) URL.revokeObjectURL(objectUrl)
            if (skinObjectUrl) URL.revokeObjectURL(skinObjectUrl)
          }
        } else {
          if (!cancelled) setContent({ audioId: id })
          try {
            const { data } = await audioApi.getVoiceSkin(id)
            if (!cancelled && data.skin_id) {
              const response = await skinApi.getPublicSkin(data.skin_id)
              const nextSkinUrl = URL.createObjectURL(response.data)
              if (!cancelled) {
                skinObjectUrl = nextSkinUrl
                skinObjectUrlRef.current = nextSkinUrl
                setSkinImage(nextSkinUrl)
              } else {
                URL.revokeObjectURL(nextSkinUrl)
              }
            }
          } catch {
            // The share page and audio remain available when its optional skin is missing.
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.response?.data?.error || 'This link may have expired or is only available to its recipient.')
      }
    }
    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (skinObjectUrl) URL.revokeObjectURL(skinObjectUrl)
      if (skinObjectUrlRef.current) {
        URL.revokeObjectURL(skinObjectUrlRef.current)
        skinObjectUrlRef.current = ''
      }
    }
  }, [id, type])

  const icon = type === 'note' ? <FiType /> : type === 'image' ? <FiImage /> : <FiMic />
  const loadVoice = async () => {
    const result = await audioApi.fetchVoice(content.audioId)
    if (result.skinId) {
      skinApi.getPublicSkin(result.skinId).then((response) => {
        const nextSkinUrl = URL.createObjectURL(response.data)
        if (skinObjectUrlRef.current) URL.revokeObjectURL(skinObjectUrlRef.current)
        skinObjectUrlRef.current = nextSkinUrl
        setSkinImage(nextSkinUrl)
      }).catch(() => {})
    }
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
