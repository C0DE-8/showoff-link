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
    let contentObjectUrl = ''
    let skinObjectUrl = ''
    let cancelled = false

    const loadSkin = async (skinId) => {
      if (!skinId) return ''
      try {
        const response = await skinApi.getPublicSkin(skinId)
        const objectUrl = URL.createObjectURL(response.data)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return ''
        }
        skinObjectUrl = objectUrl
        skinObjectUrlRef.current = objectUrl
        setSkinImage(objectUrl)
        return objectUrl
      } catch {
        return ''
      }
    }

    const load = async () => {
      setContent(null)
      setError('')
      setImageUrl('')
      setSkinImage('')
      try {
        if (type === 'note') {
          const { data } = await noteApi.readNote(id)
          if (!cancelled) {
            setContent(data)
            setSkinImage(data.skin_image || '')
          }
        } else if (type === 'image') {
          const response = await imageApi.viewImage(id)
          contentObjectUrl = URL.createObjectURL(response.data)
          if (!cancelled) {
            setImageUrl(contentObjectUrl)
            setContent({})
          }
          await loadSkin(response.headers['x-skin-id'])
        } else {
          if (!cancelled) setContent({ audioId: id })
          try {
            const { data } = await audioApi.getVoiceSkin(id)
            await loadSkin(data.skin_id)
          } catch {
            // Voice playback remains available when the optional skin is missing.
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.response?.data?.error || 'This link may have expired or is only available to its recipient.')
        }
      }
    }

    load()
    return () => {
      cancelled = true
      if (contentObjectUrl) URL.revokeObjectURL(contentObjectUrl)
      if (skinObjectUrl) URL.revokeObjectURL(skinObjectUrl)
      if (skinObjectUrlRef.current === skinObjectUrl) skinObjectUrlRef.current = ''
    }
  }, [id, type])

  const loadVoice = async () => {
    const result = await audioApi.fetchVoice(content.audioId)
    if (result.skinId && !skinObjectUrlRef.current) {
      loadSkinAfterPlayback(result.skinId)
    }
    return result.url
  }

  const loadSkinAfterPlayback = async (skinId) => {
    try {
      const response = await skinApi.getPublicSkin(skinId)
      const nextSkinUrl = URL.createObjectURL(response.data)
      if (skinObjectUrlRef.current) URL.revokeObjectURL(skinObjectUrlRef.current)
      skinObjectUrlRef.current = nextSkinUrl
      setSkinImage(nextSkinUrl)
    } catch {
      // Voice playback remains available when the optional skin is missing.
    }
  }

  const icon = type === 'note' ? <FiType /> : type === 'image' ? <FiImage /> : <FiMic />
  const headings = { note: 'A little note', image: 'A favorite moment', voice: 'A voice hello' }
  const stageStyle = skinImage ? {
    backgroundImage: `linear-gradient(rgba(12, 11, 17, .18), rgba(12, 11, 17, .32)), url("${skinImage}")`
  } : undefined

  return (
    <main className={`share-view share-view-${type} ${skinImage ? 'has-share-skin' : ''}`} style={stageStyle}>
      <div className="share-vignette" aria-hidden="true" />
      <section className={`share-stage share-stage-${type}`} aria-live="polite">
        {error ? (
          <div className="share-error">
            <FiAlertCircle />
            <h1>Moment unavailable</h1>
            <p>{error}</p>
          </div>
        ) : !content ? (
          <div className="share-loading"><span className="spinner" /><p>Opening something made for you…</p></div>
        ) : (
          <>
            <div className="share-type-icon" aria-hidden="true">{icon}</div>
            <div className="share-eyebrow">A MOMENT, JUST FOR YOU</div>
            <h1 className="share-heading">{headings[type]}</h1>
            {type === 'note' && <blockquote className="share-quote">“{content.note_content}”</blockquote>}
            {type === 'image' && <img className="share-image" src={imageUrl} alt="A photo shared just for you" />}
            {type === 'voice' && <>
              <p className="share-caption">A little hello, shared just with you.</p>
              <AudioPlayer className="share-audio" loadSource={loadVoice} label="A voice hello" />
            </>}
            <div className="share-signoff">Sent with a little care</div>
          </>
        )}
      </section>
    </main>
  )
}
