import { useEffect, useState } from 'react'
import { PlusCircle, CheckCircle, Clock, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { DEMO } from '../demo/demoData'

interface WishlistItem {
  wishlist_id: number
  client_assoc_id: number
  auth_uid: string
  company_name: string
  notes: string | null
  status: 'Pending' | 'In Review' | 'Added' | 'Declined'
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  Pending:   'bg-amber-50 text-amber-700 border-amber-200',
  'In Review': 'bg-blue-50 text-blue-700 border-blue-200',
  Added:     'bg-green-50 text-green-700 border-green-200',
  Declined:  'bg-red-50 text-red-700 border-red-200',
}

export default function Wishlist() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadItems = () => {
    // Wishlist requests are a client-side capture for now (routing the request to
    // the Amplior agent/TL is the deliberate next step). Demo seeds examples.
    setItems(DEMO ? [
      { wishlist_id: 1, client_assoc_id: 501, auth_uid: 'demo', company_name: 'Adani Group', notes: 'Large facilities footprint — worth targeting.', status: 'In Review', created_at: new Date(Date.now() - 4 * 86_400_000).toISOString() },
      { wishlist_id: 2, client_assoc_id: 501, auth_uid: 'demo', company_name: 'Zomato', notes: 'Tech HQ, big cafeteria.', status: 'Added', created_at: new Date(Date.now() - 9 * 86_400_000).toISOString() },
    ] : [])
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    setSubmitError(null)
    setSubmitting(true)
    setItems((prev) => [
      { wishlist_id: Date.now(), client_assoc_id: 501, auth_uid: 'me', company_name: companyName.trim(), notes: notes.trim() || null, status: 'Pending', created_at: new Date().toISOString() },
      ...prev,
    ])
    setSubmitting(false); setCompanyName(''); setNotes(''); setShowForm(false); setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Company Wishlist</h1>
          <p className="text-sm text-gray-500 mt-0.5">Request companies you&apos;d like us to reach out to.</p>
        </div>
        <button
          onClick={() => { setShowForm(o => !o); setSubmitError(null) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <PlusCircle size={16} />
          Request
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">
          <CheckCircle size={16} className="flex-shrink-0" />
          Request submitted. We&apos;ll review and get back to you.
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">New Company Request</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Company Name *</label>
              <input
                required type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Tata Consultancy Services"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Additional Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why this company? Any specific contact you know of?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>
            )}
            <button
              type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Wishlist items */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No requests yet</p>
          <p className="text-sm mt-1">Use the Request button to suggest a company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.wishlist_id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.company_name}</p>
                {item.notes && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.notes}</p>}
                <p className="text-xs text-gray-400 mt-1.5">
                  Requested {format(parseISO(item.created_at), 'dd MMM yyyy')}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLE[item.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
