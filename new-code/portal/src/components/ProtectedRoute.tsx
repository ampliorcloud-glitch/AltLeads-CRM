import { Navigate, Outlet } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'

export default function ProtectedRoute() {
  const { session, portalUser, loading, error } = usePortalAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2FF]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (error || !portalUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2FF]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">
            {error ?? 'Your account does not have portal access. Please contact your Amplior administrator.'}
          </p>
          <button
            onClick={() => { void import('../lib/supabase').then(m => m.supabase.auth.signOut()) }}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
