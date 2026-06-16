import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  PhoneCall,
  Clock,
  User,
  Link2,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchContactById,
  fetchContactInteractions,
  logCallInteraction,
  type Contact,
  type Interaction,
} from '../data/contacts';
import { SectionCard } from '../components/admin/primitives';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const DISPOSITIONS = [
  'Connected',
  'No answer',
  'Call back',
  'Busy',
  'Wrong number',
  'Not interested',
  'Interested',
];

const DISPOSITION_COLORS: Record<string, { bg: string; text: string }> = {
  'Connected':      { bg: '#EBF4FD', text: '#1A7EE8' },
  'Interested':     { bg: '#F0FDF4', text: '#16A34A' },
  'No answer':      { bg: '#FFFBEB', text: '#D97706' },
  'Call back':      { bg: '#FFFBEB', text: '#D97706' },
  'Busy':           { bg: '#F5F3FF', text: '#7C3AED' },
  'Wrong number':   { bg: '#FEF2F2', text: '#DC2626' },
  'Not interested': { bg: '#FEF2F2', text: '#DC2626' },
};

function dispositionBadge(d: string | null) {
  if (!d) return null;
  const style = DISPOSITION_COLORS[d] ?? { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 4,
      padding: '2px 8px', background: style.bg, color: style.text,
      display: 'inline-flex', alignItems: 'center',
    }}>
      {d}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Info row helper                                                     */
/* ------------------------------------------------------------------ */

function InfoRow({ icon, label, value, href }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3" style={{ minHeight: 32 }}>
      <span style={{ color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none' }}>
            {value}
          </a>
        ) : (
          <span style={{ fontSize: 13, color: '#111827' }}>{value || <span style={{ color: '#D1D5DB' }}>—</span>}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Call log panel
  const [disposition, setDisposition] = useState('');
  const [noteText, setNoteText] = useState('');
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState(false);

  const contactId = id ? Number(id) : null;

  const loadData = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setError(null);
    const c = await fetchContactById(contactId);
    if (!c) {
      setError('Contact not found.');
      setLoading(false);
      return;
    }
    setContact(c);
    const ints = await fetchContactInteractions(contactId);
    setInteractions(ints);
    setLoading(false);
  }, [contactId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLog = async () => {
    if (!contactId) return;
    if (!disposition) { setLogError('Please select a disposition.'); return; }
    setLogging(true);
    setLogError(null);
    setLogSuccess(false);

    const ownerUserId = profile?.user_id ?? null;
    const createdBy = user?.email ?? profile?.email ?? 'unknown';

    const { error: err } = await logCallInteraction({
      contactId,
      disposition,
      noteText,
      ownerUserId,
      createdBy,
    });

    if (err) {
      setLogError(err);
      setLogging(false);
      return;
    }

    setDisposition('');
    setNoteText('');
    setLogSuccess(true);
    setLogging(false);
    // Reload interactions
    const ints = await fetchContactInteractions(contactId);
    setInteractions(ints);
    setTimeout(() => setLogSuccess(false), 3000);
  };

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <AppShell title="Contact">
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <Loader2 size={22} className="animate-spin text-zinc-400" />
        </div>
      </AppShell>
    );
  }

  if (error || !contact) {
    return (
      <AppShell title="Contact">
        <div className="space-y-3">
          <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors" style={{ fontSize: 13 }}>
            <ArrowLeft size={15} /> Back to Contacts
          </button>
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#EF4444', fontSize: 14 }}>
            {error ?? 'Contact not found.'}
          </div>
        </div>
      </AppShell>
    );
  }

  const linkedinHref = contact.linkedin_url
    ? (contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://linkedin.com/in/${contact.linkedin_url}`)
    : undefined;

  return (
    <AppShell title={contact.full_name || 'Contact'}>
      <div className="space-y-4">
        {/* Back nav */}
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          Back to Contacts
        </button>

        {/* Header card */}
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
          padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20,
        }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#EBF4FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5,
          }}>
            {contactInitials(contact.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
                {contact.full_name}
              </h1>
              {contact.is_demo && (
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                  background: '#F3F4F6', color: '#9CA3AF',
                  borderRadius: 4, padding: '2px 7px',
                }}>DEMO</span>
              )}
            </div>
            {contact.designation && (
              <p style={{ fontSize: 14, color: '#6B7280', margin: '3px 0 0' }}>{contact.designation}</p>
            )}
            {contact.company_name && contact.company_id && (
              <Link
                to={`/companies/${contact.company_id}`}
                style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
              >
                <Building2 size={13} />
                {contact.company_name}
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Contact Info */}
          <SectionCard title="Contact Details">
            <div className="space-y-3">
              <InfoRow icon={<Mail size={15} />} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
              <InfoRow icon={<Phone size={15} />} label="Phone" value={contact.mobile_no} />
              <InfoRow icon={<Phone size={15} />} label="Alt Phone" value={contact.alt_mobile_no} />
              <InfoRow
                icon={<Link2 size={15} />}
                label="LinkedIn"
                value={contact.linkedin_clean || contact.linkedin_url}
                href={linkedinHref}
              />
              <InfoRow icon={<MapPin size={15} />} label="City" value={contact.city_name} />
              <InfoRow icon={<Briefcase size={15} />} label="Designation" value={contact.designation} />
              <InfoRow
                icon={<Building2 size={15} />}
                label="Company"
                value={contact.company_name}
                href={contact.company_id ? `/companies/${contact.company_id}` : undefined}
              />
            </div>
          </SectionCard>

          {/* Call & Disposition */}
          <SectionCard title="Log a Call">
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>Disposition *</label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  style={{
                    fontSize: 13, padding: '7px 10px',
                    border: '1px solid #E5E7EB', borderRadius: 6,
                    background: '#fff', color: '#111827', outline: 'none',
                    cursor: 'pointer',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                >
                  <option value="">Select disposition...</option>
                  {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>Notes</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add call notes..."
                  rows={3}
                  style={{
                    fontSize: 13, padding: '7px 10px', resize: 'vertical',
                    border: '1px solid #E5E7EB', borderRadius: 6,
                    background: '#fff', color: '#111827', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </div>
              {logError && (
                <p style={{ fontSize: 12, color: '#EF4444' }}>{logError}</p>
              )}
              {logSuccess && (
                <p style={{ fontSize: 12, color: '#16A34A' }}>Call logged successfully.</p>
              )}
              <button
                onClick={handleLog}
                disabled={logging}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#1A7EE8', color: '#fff',
                  fontSize: 13, fontWeight: 500,
                  borderRadius: 6, border: 'none',
                  padding: '8px 18px', cursor: logging ? 'not-allowed' : 'pointer',
                  opacity: logging ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!logging) (e.currentTarget as HTMLElement).style.background = '#1568C8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1A7EE8'; }}
              >
                {logging ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
                {logging ? 'Logging...' : 'Log Call'}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Activity Timeline */}
        <SectionCard title="Activity Timeline">
          {interactions.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              No interactions logged yet. Use the call panel above to log the first one.
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((item) => (
                <div
                  key={item.interaction_id}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 0', borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#EBF4FD', color: '#1A7EE8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <PhoneCall size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {dispositionBadge(item.disposition)}
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {formatDateTime(item.occurred_at)}
                      </span>
                      {item.created_by && (
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                          <User size={11} style={{ display: 'inline', marginRight: 3 }} />
                          {item.created_by}
                        </span>
                      )}
                    </div>
                    {item.note_text && (
                      <p style={{ fontSize: 13, color: '#374151', marginTop: 4, marginBottom: 0 }}>
                        {item.note_text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

export default ContactDetailPage;
