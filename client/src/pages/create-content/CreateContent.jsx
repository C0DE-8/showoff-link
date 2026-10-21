import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowUpRight, FiImage, FiMic, FiType, FiCopy, FiCheck } from 'react-icons/fi'
import * as noteApi from '../../api/note'
import * as imageApi from '../../api/image'
import * as audioApi from '../../api/audio'
import { useToast } from '../../context/ToastContext'

const details = { note: { title: 'Write a little note', description: 'A few words can make someone’s whole day.', icon: FiType, cost: '1 token' }, image: { title: 'Share a favorite photo', description: 'Save a memory and send them somewhere lovely.', icon: FiImage, cost: '2 tokens' }, voice: { title: 'Record a voice hello', description: 'Let them hear it from you, in your own words.', icon: FiMic, cost: '2 tokens' } }
export default function CreateContent() {
  const { type = 'note' } = useParams(); const navigate = useNavigate(); const recorder = useRef(null); const chunks = useRef([]); const audioContext = useRef(null); const analyser = useRef(null); const animationFrame = useRef(null); const streamRef = useRef(null); const startedAt = useRef(0)
  const [recipient, setRecipient] = useState(''); const [limit, setLimit] = useState(type === 'note' ? 1 : 5); const [note, setNote] = useState(''); const [file, setFile] = useState(null); const [recording, setRecording] = useState(false); const [recorded, setRecorded] = useState(null); const [recordedUrl, setRecordedUrl] = useState(''); const [elapsed, setElapsed] = useState(0); const [waveBars, setWaveBars] = useState(Array(36).fill(3)); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [url, setUrl] = useState(''); const [copied, setCopied] = useState(false)
  const [imagePreview, setImagePreview] = useState('')
  const { showToast } = useToast()
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.stop(); if (animationFrame.current) cancelAnimationFrame(animationFrame.current); streamRef.current?.getTracks().forEach(track => track.stop()); audioContext.current?.close(); if (recordedUrl) URL.revokeObjectURL(recordedUrl) }, [recordedUrl])
  useEffect(() => { if (!recording) return undefined; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 200); return () => window.clearInterval(timer) }, [recording])
  const data = details[type] || details.note; const Icon = data.icon
  const beginRecord = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const context = new window.AudioContext()
      audioContext.current = context
      const analyserNode = context.createAnalyser()
      analyserNode.fftSize = 128
      analyserNode.smoothingTimeConstant = 0.78
      context.createMediaStreamSource(stream).connect(analyserNode)
      analyser.current = analyserNode
      const bins = new Uint8Array(analyserNode.frequencyBinCount)
      let lastDraw = 0
      const drawWave = (now) => {
        if (!analyser.current) return
        animationFrame.current = requestAnimationFrame(drawWave)
        if (now - lastDraw < 60) return
        lastDraw = now
        analyserNode.getByteFrequencyData(bins)
        const bars = Array.from({ length: 36 }, (_, index) => {
          const start = Math.floor(index * bins.length / 36)
          const end = Math.max(start + 1, Math.floor((index + 1) * bins.length / 36))
          const average = bins.slice(start, end).reduce((sum, value) => sum + value, 0) / (end - start)
          return Math.max(3, Math.round((average / 255) * 38))
        })
        setWaveBars(bars)
      }
      animationFrame.current = requestAnimationFrame(drawWave)

      const rec = new MediaRecorder(stream)
      recorder.current = rec
      chunks.current = []
      rec.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data) }
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        if (recordedUrl) URL.revokeObjectURL(recordedUrl)
        setRecorded(new File([blob], 'voice-note.webm', { type: blob.type }))
        setRecordedUrl(URL.createObjectURL(blob))
        setWaveBars(Array(36).fill(3))
        if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
        analyser.current = null
        stream.getTracks().forEach(track => track.stop())
        context.close()
        streamRef.current = null
        audioContext.current = null
        setRecording(false)
      }
      rec.start(100)
      startedAt.current = Date.now()
      setElapsed(0)
      setRecorded(null)
      setRecordedUrl('')
      setRecording(true)
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop())
      setError('Allow microphone access to record a voice note.')
    }
  }
  const stopRecord = () => recorder.current?.stop()
  const chooseImage = (event) => { const selected = event.target.files?.[0]; if (!selected) return; if (selected.size > 10 * 1024 * 1024) { setError('Choose an image smaller than 10 MB.'); event.target.value = ''; return } setError(''); if (imagePreview) URL.revokeObjectURL(imagePreview); setFile(selected); setImagePreview(URL.createObjectURL(selected)) }
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { let result; if (type === 'note') result = await noteApi.uploadNote({ note_content: note, recipient_tagname: recipient.replace(/^@/, ''), allowed_views: limit }); else { const form = new FormData(); form.append(type === 'image' ? 'graphicAsset' : 'audio', type === 'image' ? file : recorded); form.append('recipient_tagname', recipient.replace(/^@/, '')); form.append(type === 'image' ? 'allowed_views' : 'allowed_plays', String(limit)); result = type === 'image' ? await imageApi.uploadImage(form) : await audioApi.uploadVoice(form) } const returnedUrl = new URL(result.data.shareableUrl); const shareId = result.data.id || returnedUrl.searchParams.get('viewId') || returnedUrl.searchParams.get('id') || returnedUrl.pathname.split('/').filter(Boolean).at(-1); if (!shareId) throw new Error('The upload succeeded but the share ID was missing.'); setUrl(`${window.location.origin}/${type}/${encodeURIComponent(shareId)}`); showToast('Your share link is ready.', 'success'); } catch (err) { const message = err.response?.data?.error || err.message || 'We could not create that link. Please try again.'; setError(message); showToast(message, 'error') } finally { setBusy(false) } }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); showToast('Share link copied.', 'success'); setTimeout(() => setCopied(false), 1800) } catch { showToast('Could not copy the share link.', 'error') } }
  if (url) return <section className="form-panel create-success"><span className="auth-mark">✳</span><div className="section-kicker">YOUR MOMENT IS READY</div><h2>Made with care.</h2><p>Send this link to the person you had in mind.</p><div className="share-url"><span>{url}</span><button className="button button-dark" onClick={copy}>{copied ? <FiCheck /> : <FiCopy />}{copied ? 'Copied' : 'Copy link'}</button></div><div className="success-actions"><button className="button button-quiet" onClick={() => navigate('/dashboard')}>Back to dashboard</button><button className="button button-quiet" onClick={() => { setUrl(''); setNote(''); setFile(null); setImagePreview(''); setRecorded(null) }}>Create another</button></div></section>
  return <><Link to="/dashboard" className="form-back"><FiArrowLeft /> Back to your space</Link><section className="form-panel create-form-panel"><div className="form-page-heading"><span className="create-icon"><Icon /></span><div><div className="section-kicker">A PERSONAL MOMENT · {data.cost.toUpperCase()}</div><h2>{data.title}</h2><p>{data.description}</p></div></div><div className="content-tabs">{Object.keys(details).map(key => <Link key={key} className={key === type ? 'content-tab active' : 'content-tab'} to={`/create/${key}`}>{key === 'note' ? <FiType /> : key === 'image' ? <FiImage /> : <FiMic />}{key}</Link>)}</div><form className="workspace-form" onSubmit={submit}>{error && <div className="form-error">{error}</div>}{type === 'note' && <label>Your message<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1500} placeholder="Write something that feels like you…" required rows={7}/><small>{note.length}/1500 characters</small></label>}{type === 'image' && (file ? <div className="image-upload-preview"><img src={imagePreview} alt={`Preview of ${file.name}`} /><div className="image-preview-caption"><span><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(1)} MB · Preview before sharing</small></span><label className="button button-quiet change-image-button">Change photo<input type="file" accept="image/*" onChange={chooseImage} /></label><button className="icon-button" type="button" onClick={() => { if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(''); setFile(null) }} aria-label="Remove selected photo">×</button></div></div> : <label className="upload-drop"><FiImage /><strong>Choose a photo to share</strong><span>JPG, PNG or WEBP · up to 10 MB</span><input type="file" accept="image/*" required onChange={chooseImage} /></label>)}{type === 'voice' && <div className={`record-box ${recording ? 'record-box-live' : ''}`}><div className="record-status"><span className={`record-indicator ${recording ? 'is-recording' : recorded ? 'is-ready' : ''}`} /><strong>{recording ? 'Recording in progress' : recorded ? 'Recording ready to preview' : 'Ready when you are'}</strong><span className="record-time">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span></div><div className={`live-waveform ${recording ? 'waveform-active' : ''}`} role="img" aria-label={recording ? 'Live microphone audio waveform' : recorded ? 'Recording waveform preview' : 'Audio waveform will appear while recording'}>{waveBars.map((height, index) => <span key={index} style={{ height: `${height}px`, '--bar-index': index }} />)}</div><p className="record-help">{recording ? 'Your microphone is live. Speak naturally and watch the waveform respond.' : recorded ? 'Listen back before sharing, or record a new take.' : 'Allow microphone access to start. Your voice level will appear here live.'}</p>{recordedUrl && <audio className="recording-preview" controls src={recordedUrl}>Audio playback is not supported by your browser.</audio>}{recording ? <button type="button" className="button button-stop" onClick={stopRecord}><span /> Stop recording</button> : <button type="button" className="button button-dark" onClick={beginRecord}><FiMic />{recorded ? 'Record again' : 'Start recording'}</button>}</div>}<div className="form-row"><label>Send to (optional)<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="@their_tag" /></label><label>{type === 'voice' ? 'Allowed plays' : 'Allowed views'}<select value={limit} onChange={e => setLimit(Number(e.target.value))}>{[1,2,3,5,10,20].map(n => <option key={n} value={n}>{n} {n === 1 ? 'view' : 'views'}</option>)}</select></label></div><div className="form-note">{recipient ? `Only @${recipient.replace(/^@/, '')} can open this link.` : 'Leave the recipient blank if anyone with the link can open it.'} The link will stop working after the view limit.</div><button disabled={busy || (type === 'voice' && !recorded)} className="button button-dark form-submit">{busy ? 'Making your link…' : 'Create share link'} <FiArrowUpRight /></button></form></section></>
}
