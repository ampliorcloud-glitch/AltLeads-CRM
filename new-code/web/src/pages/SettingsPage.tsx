import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchUserProfile,
  updateUserProfile,
  type UserProfile,
  type ProfileUpdate,
} from '../data/account';
import { Loader2, Check, Lock, User as UserIcon } from 'lucide-react';

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 9px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  background: '#fff',
  color: '#18181b',
  outline: 'none',
  height: 34,
  width: '100%',
  transition: 'border-color 0.15s',
};

const readonlyBase: React.CSSProperties = {
  ...inputBase,
  background: '#f4f4f5',
  color: '#52525b',
  cursor: 'not-allowed',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-medium text-zinc-500" style={{ fontSize: 11 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputBase, ...(props.style ?? {}) }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#1A7EE8';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#d4d4d8';
        props.onBlur?.(e);
      }}
    />
  );
}

export function SettingsPage() {
  const { profile, userEmail } = useAuth();
  const userId = profile?.user_id ?? null;
  const actor = userEmail || profile?.full_name || 'system';

  const [loaded, setLoaded] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Profile form state
  const [form, setForm] = useState<ProfileUpdate>({
    fullName: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    linkedinUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Password form state
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (userId == null) {
      setLoading(false);
      setLoadError('No linked user profile found for this account.');
      return;
    }
    setLoading(true);
    fetchUserProfile(userId).then((res) => {
      if (cancelled) return;
      if (res.profile) {
        setLoaded(res.profile);
        setForm({
          fullName: res.profile.fullName,
          firstName: res.profile.firstName,
          lastName: res.profile.lastName,
          mobileNumber: res.profile.mobileNumber,
          linkedinUrl: res.profile.linkedinUrl,
        });
      }
      setLoadError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setField = <K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveOk(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userId == null) return;
    setSaveError(null);
    setSaveOk(false);
    if (!form.fullName.trim()) {
      setSaveError('Full name is required.');
      return;
    }
    setSaving(true);
    const { error } = await updateUserProfile(userId, form, actor);
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaveOk(true);
    setLoaded((prev) => (prev ? { ...prev, ...form } : prev));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (pw.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    if (pw !== pwConfirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('should be different') || msg.includes('same as')) {
        setPwError('Please choose a password different from your current one.');
      } else {
        setPwError('We could not update your password. Please try again.');
      }
      return;
    }
    setPwOk(true);
    setPw('');
    setPwConfirm('');
  };

  const role = profile?.role ?? '—';
  const displayName = loaded?.fullName || profile?.full_name || '';

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div
            className="bg-white border border-zinc-200 rounded-lg flex items-center justify-center gap-2 text-zinc-400"
            style={{ fontSize: 13, padding: '56px 16px' }}
          >
            <Loader2 size={16} className="animate-spin" />
            Loading your profile...
          </div>
        ) : loadError ? (
          <div
            className="bg-white border border-zinc-200 rounded-lg text-center text-zinc-500"
            style={{ fontSize: 13, padding: '48px 16px' }}
          >
            {loadError}
          </div>
        ) : (
          <>
            {/* Identity card */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
              <div className="flex items-center gap-4">
                <div
                  className="rounded-full flex items-center justify-center font-semibold shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    background: '#EBF4FD',
                    color: '#1A7EE8',
                    fontSize: 18,
                    letterSpacing: '0.02em',
                  }}
                >
                  {initials(displayName || userEmail)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 truncate" style={{ fontSize: 15 }}>
                    {displayName || '—'}
                  </p>
                  <p className="text-zinc-500 truncate" style={{ fontSize: 12, marginTop: 1 }}>
                    {userEmail || '—'}
                  </p>
                  <span
                    className="inline-flex items-center font-medium rounded mt-1.5"
                    style={{
                      fontSize: 11,
                      padding: '1px 7px',
                      background: '#EBF4FD',
                      color: '#1568C8',
                      boxShadow: 'inset 0 0 0 1px rgba(26,126,232,0.25)',
                      borderRadius: 4,
                    }}
                  >
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile form */}
            <form onSubmit={handleSaveProfile} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 20px',
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                <span style={{ display: 'block', width: 4, height: 20, background: '#1A7EE8', borderRadius: 2, flexShrink: 0 }} />
                <UserIcon size={15} strokeWidth={1.75} style={{ color: '#6B7280' }} />
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Profile
                </h2>
              </div>
              <div className="p-5 space-y-4">

              <Field label="Full name">
                <TextInput
                  value={form.fullName}
                  onChange={(e) => setField('fullName', e.target.value)}
                  placeholder="Full name"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <TextInput
                    value={form.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                  />
                </Field>
                <Field label="Last name">
                  <TextInput
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile number">
                  <TextInput
                    value={form.mobileNumber}
                    onChange={(e) => setField('mobileNumber', e.target.value)}
                    placeholder="—"
                    inputMode="tel"
                  />
                </Field>
                <Field label="Designation">
                  <input
                    value={loaded?.designationName ?? '—'}
                    readOnly
                    style={readonlyBase}
                  />
                </Field>
              </div>

              <Field label="LinkedIn URL">
                <TextInput
                  value={form.linkedinUrl}
                  onChange={(e) => setField('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email (read-only)">
                  <input value={userEmail || '—'} readOnly style={readonlyBase} />
                </Field>
                <Field label="Role (read-only)">
                  <input value={role} readOnly style={readonlyBase} />
                </Field>
              </div>

              {saveError && (
                <p style={{ fontSize: 12, color: '#b91c1c' }}>{saveError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  style={{ fontSize: 12, padding: '6px 14px', height: 32, borderRadius: 6, background: '#1A7EE8', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#1568C8'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save changes
                </button>
                {saveOk && (
                  <span className="flex items-center gap-1 text-green-600" style={{ fontSize: 12 }}>
                    <Check size={14} strokeWidth={2} />
                    Saved
                  </span>
                )}
              </div>
            </div>
            </form>

            {/* Change password */}
            <form onSubmit={handleChangePassword} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 20px',
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                <span style={{ display: 'block', width: 4, height: 20, background: '#1A7EE8', borderRadius: 2, flexShrink: 0 }} />
                <Lock size={15} strokeWidth={1.75} style={{ color: '#6B7280' }} />
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Change password
                </h2>
              </div>
              <div className="p-5 space-y-4">
              <p className="text-zinc-400" style={{ fontSize: 12 }}>
                Updates the password for your sign-in account. Minimum 8 characters.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="New password">
                  <TextInput
                    type="password"
                    value={pw}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setPwOk(false);
                    }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </Field>
                <Field label="Confirm new password">
                  <TextInput
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => {
                      setPwConfirm(e.target.value);
                      setPwOk(false);
                    }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </Field>
              </div>

              {pwError && <p style={{ fontSize: 12, color: '#b91c1c' }}>{pwError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pwSaving || !pw || !pwConfirm}
                  className="flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: 12, padding: '6px 14px', height: 32 }}
                >
                  {pwSaving && <Loader2 size={13} className="animate-spin" />}
                  Update password
                </button>
                {pwOk && (
                  <span className="flex items-center gap-1 text-green-600" style={{ fontSize: 12 }}>
                    <Check size={14} strokeWidth={2} />
                    Password updated
                  </span>
                )}
              </div>
              </div>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default SettingsPage;
