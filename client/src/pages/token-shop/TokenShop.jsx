import { useEffect, useState } from 'react'
import { FiCheck, FiCopy, FiCreditCard, FiImage, FiUpload, FiX, FiZap } from 'react-icons/fi'
import { paymentDetails, submitTopup } from '../../api/shop'

const packages = [
  { tokens: 7, amount: 500, label: 'A little boost' },
  { tokens: 15, amount: 1000, label: 'A few more moments', featured: true },
  { tokens: 60, amount: 5000, label: 'The generous bundle' }
]
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the receipt image.'))
    reader.readAsDataURL(file)
  })
}

export default function TokenShop() {
  const [bank, setBank] = useState(null)
  const [selected, setSelected] = useState(packages[0])
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptData, setReceiptData] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    paymentDetails()
      .then(({ data }) => setBank(data.data))
      .catch((requestError) => setError(requestError.response?.data?.error || 'Payment account details are unavailable right now.'))
  }, [])

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      setError('Could not copy the account number.')
    }
  }

  const selectReceipt = async (event) => {
    const file = event.target.files?.[0]
    setError('')
    if (!file) return
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptFile(null)
      setReceiptData('')
      setError('Choose a JPG, PNG, or WebP receipt image.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptFile(null)
      setReceiptData('')
      setError('Receipt images must be 10 MB or smaller.')
      event.target.value = ''
      return
    }
    try {
      setReceiptData(await readFileAsDataUrl(file))
      setReceiptFile(file)
    } catch (readError) {
      setReceiptFile(null)
      setReceiptData('')
      setError(readError.message)
    }
  }

  const removeReceipt = () => {
    setReceiptFile(null)
    setReceiptData('')
    const input = document.getElementById('topup-receipt')
    if (input) input.value = ''
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!receiptData) {
      setError('Upload your payment receipt before submitting.')
      return
    }
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const { data } = await submitTopup({
        tokensRequested: selected.tokens,
        amountNgn: selected.amount,
        receiptUrl: receiptData
      })
      setMessage(data.message)
      removeReceipt()
    } catch (submitError) {
      setError(submitError.response?.data?.error || 'Could not submit your payment receipt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="form-panel token-shop-panel">
      <div className="form-page-heading">
        <span className="create-icon"><FiZap /></span>
        <div>
          <div className="section-kicker">MORE ROOM FOR GOOD IDEAS</div>
          <h2>Top up your tokens</h2>
          <p>Choose a pack, make the transfer and upload your receipt.</p>
        </div>
      </div>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="package-grid">
        {packages.map((item) => (
          <button
            type="button"
            key={item.tokens}
            className={`package-card ${selected.tokens === item.tokens ? 'package-selected' : ''} ${item.featured ? 'package-featured' : ''}`}
            onClick={() => setSelected(item)}
            aria-pressed={selected.tokens === item.tokens}
          >
            <span>{item.label}</span>
            <strong>{item.tokens}<small> tokens</small></strong>
            <b>₦{item.amount.toLocaleString()}</b>
          </button>
        ))}
      </div>
      <div className="bank-card">
        <div className="bank-card-head"><FiCreditCard /><span>TRANSFER DETAILS</span></div>
        {bank ? (
          <div className="bank-details">
            <div><span>Bank</span><strong>{bank.bank_name}</strong></div>
            <div><span>Account name</span><strong>{bank.account_name}</strong></div>
            <div>
              <span>Account number</span>
              <strong>{bank.account_number}<button type="button" className="copy-button" onClick={() => copy(bank.account_number)} aria-label="Copy account number">{copied ? <FiCheck /> : <FiCopy />}</button></strong>
            </div>
          </div>
        ) : <p className="bank-loading">Payment details will appear here when configured by the admin.</p>}
      </div>
      <form className="workspace-form narrow-form" onSubmit={submit}>
        <label htmlFor="topup-receipt">Payment receipt</label>
        {receiptData ? (
          <div className="receipt-upload-preview">
            <img src={receiptData} alt="Selected payment receipt preview" />
            <div>
              <span>{receiptFile?.name}</span>
              <small>{(receiptFile.size / (1024 * 1024)).toFixed(1)} MB</small>
              <button type="button" className="icon-button" onClick={removeReceipt} aria-label="Remove receipt"><FiX /></button>
            </div>
          </div>
        ) : (
          <label className="receipt-upload" htmlFor="topup-receipt">
            <FiImage aria-hidden="true" />
            <strong>Choose receipt image</strong>
            <small>JPG, PNG, or WebP · up to 10 MB</small>
            <span className="button button-quiet"><FiUpload /> Browse files</span>
          </label>
        )}
        <input id="topup-receipt" className="receipt-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectReceipt} />
        <button className="button button-dark" disabled={busy || !bank || !receiptData}>
          {busy ? 'Submitting…' : `Request ${selected.tokens} tokens`} <FiCheck />
        </button>
      </form>
    </section>
  )
}
