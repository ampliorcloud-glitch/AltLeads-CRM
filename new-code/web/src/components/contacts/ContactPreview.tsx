/**
 * ContactPreview — compact "mini record" for a contact, rendered INSIDE the
 * generic RecordPreviewPanel (ALT-327/328). A denser mirror of ContactDetailPage:
 * header (avatar + name + designation + company), per-project Owner + Status chips,
 * quick contact methods (email / phone / LinkedIn with copy), key fields, linked
 * Leads + Colleagues counts, and a short recent-activity list.
 *
 * Read-only and dependency-light: it reuses the EXISTING data layer
 * (fetchContactById, fetchContactLeads, fetchContactInteractions from
 * data/contacts; getContactStatus from data/projectStatus; fetchCompanyContacts
 * from data/companies; fetchUserLabel from data/assignment) — no new data fns.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  Link2,
  ExternalLink,
  AlertCircle,
  Users,
  ClipboardList,
} from 'lucide-react';
import {
  fetchContactById,
  fetchContactLeads,
  fetchContactInteractions,
  type Contact,
  type ContactLead,
  type Interaction,
} from '../../data/contacts';
import { getContactStatus } from '../../data/projectStatus';
import { fetchCompanyContacts, type CompanyContact } from '../../data/companies';
import { fetchUserLabel } from '../../data/assignment';
import { CopyButton } from '../ui/CopyButton';
import { StatusBadge } from '../ui/StatusBadge';
import { StageBadge } from '../ui/Badge';
import { formatDate } from '../../data/account';

const BRAND = 'var(--color-brand, #1A7EE8)';

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* Compact label/value row with optional link + copy (mirrors detail page InfoRow). */
function Field({
  icon, label, value, href, copyValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  copyValue?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 28 }}>
      <span style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: BRAND, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value}
            </a>
          ) : (
            <span
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value || <span style={{ color: '#D1D5DB' }}>—</span>}
            </span>
          )}
          {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
      {children}
    </h3>
  );
}

function describeInteraction(it: Interaction): string {
  if (it.note_text) return it.note_text;
  if (it.disposition) return it.disposition;
  return it.type === 'status_change' ? 'Status updated' : it.type === 'call' ? 'Call logged' : it.type;
}

export function ContactPreview({
  contactId,
  projectId,
}: {
  contactId: number;
  projectId?: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [colleagues, setColleagues] = useState<CompanyContact[]>([]);
  const [activity, setActivity] = useState<Interaction[]>([]);
  const [statusValue, setStatusValue] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContact(null);
    setLeads([]);
    setColleagues([]);
    setActivity([]);
    setStatusValue(null);
    setOwnerName('');

    (async () => {
      try {
        const c = await fetchContactById(contactId);
        if (cancelled) return;
        if (!c) {
          setError('Contact not found.');
          setLoading(false);
          return;
        }
        setContact(c);
        setLoading(false);

        // Secondary data — load in parallel, non-blocking for the header.
        const [ld, sib, acts] = await Promise.all([
          fetchContactLeads(c.contact_id),
          c.company_id ? fetchCompanyContacts(c.company_id) : Promise.resolve([] as CompanyContact[]),
          fetchContactInteractions(c.contact_id),
        ]);
        if (cancelled) return;
        setLeads(ld);
        setColleagues(sib.filter((s) => s.id !== String(c.contact_id)));
        setActivity(acts);

        // Per-project status + owner (only when a project is active).
        if (projectId != null) {
          const ps = await getContactStatus(c.contact_id, projectId);
          if (cancelled) return;
          setStatusValue(ps?.contact_status ?? null);
          const label = await fetchUserLabel(ps?.owner_user_id ?? null);
          if (cancelled) return;
          setOwnerName(label);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this contact.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [contactId, projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Contact not found.'}</span>
      </div>
    );
  }

  const linkedinHref = contact.linkedin_url
    ? (contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://linkedin.com/in/${contact.linkedin_url}`)
    : undefined;

  const recentActivity = activity.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: avatar + name + designation + company */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: '#EBF4FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, flexShrink: 0, letterSpacing: 0.4,
          }}
        >
          {contactInitials(contact.full_name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {contact.full_name || 'Contact'}
            </h2>
            {contact.is_demo && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px' }}>
                DEMO
              </span>
            )}
          </div>
          {contact.designation && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>{contact.designation}</p>
          )}
          {contact.company_name && contact.company_id ? (
            <Link
              to={`/companies/${contact.company_id}`}
              target="_blank"
              rel="noreferrer noopener"
              title="Open company in a new tab"
              style={{ fontSize: 12.5, color: BRAND, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}
            >
              <Building2 size={12} />
              {contact.company_name}
              <ExternalLink size={10} style={{ opacity: 0.6 }} />
            </Link>
          ) : contact.company_name ? (
            <span style={{ fontSize: 12.5, color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Building2 size={12} /> {contact.company_name}
            </span>
          ) : null}
        </div>
      </div>

      {/* Owner + Status chips (per-project) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Owner (this project)</span>
          {projectId == null ? (
            <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>Select a project</span>
          ) : (
            <span style={{ fontSize: 12.5, color: ownerName ? '#18181b' : '#9CA3AF', fontWeight: 500 }}>
              {ownerName || 'Unassigned'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Contact Status</span>
          {projectId == null ? (
            <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>—</span>
          ) : (
            <StatusBadge value={statusValue} category="contact_status" />
          )}
        </div>
      </div>

      {/* Quick contact methods + key fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          icon={<Mail size={14} />}
          label="Email"
          value={contact.email}
          href={contact.email ? `mailto:${contact.email}` : undefined}
          copyValue={contact.email}
        />
        <Field
          icon={<Phone size={14} />}
          label="Phone"
          value={contact.mobile_no}
          href={contact.mobile_no ? `tel:${contact.mobile_no}` : undefined}
          copyValue={contact.mobile_no}
        />
        <Field
          icon={<Phone size={14} />}
          label="Alt Phone"
          value={contact.alt_mobile_no}
          href={contact.alt_mobile_no ? `tel:${contact.alt_mobile_no}` : undefined}
          copyValue={contact.alt_mobile_no}
        />
        <Field
          icon={<Link2 size={14} />}
          label="LinkedIn"
          value={contact.linkedin_clean || contact.linkedin_url}
          href={linkedinHref}
        />
        <Field icon={<MapPin size={14} />} label="City" value={contact.city_name} />
        <Field icon={<Briefcase size={14} />} label="Designation" value={contact.designation} />
      </div>

      {/* Linked Leads */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ClipboardList size={12} /> Leads ({leads.length})
          </span>
        </SectionTitle>
        {leads.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No leads linked.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leads.slice(0, 5).map((l) => (
              <a
                key={l.id}
                href={`/leads/${l.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px',
                  textDecoration: 'none', background: '#fff',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {l.leadName || 'Untitled lead'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                {l.stage && <StageBadge stage={l.stage} />}
              </a>
            ))}
            {leads.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>+{leads.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Colleagues */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Colleagues ({colleagues.length})
          </span>
        </SectionTitle>
        {!contact.company_id ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>Link a company to see colleagues.</p>
        ) : colleagues.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No other contacts at this company.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {colleagues.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to={`/contacts/${s.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  fontSize: 12.5, color: '#374151', textDecoration: 'none', padding: '4px 6px', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {s.fullName || '—'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                <span style={{ color: '#9CA3AF', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.designation || ''}
                </span>
              </Link>
            ))}
            {colleagues.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF', padding: '2px 6px' }}>+{colleagues.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Recent activity (last ~5) */}
      <div>
        <SectionTitle>Recent activity</SectionTitle>
        {recentActivity.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map((it) => (
              <li key={it.interaction_id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12.5, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {describeInteraction(it)}
                </span>
                <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                  {it.type === 'call' ? 'Call' : it.type === 'status_change' ? 'Status change' : it.type}
                  {' · '}
                  {formatDate(it.occurred_at ? String(it.occurred_at).substring(0, 10) : null)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ContactPreview;
