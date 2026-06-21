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
  Link2,
  Pencil,
  Check,
  X,
  Save,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchContactById,
  fetchCompanyOptions,
  fetchCityOptions,
  fetchContactLeads,
  updateContactCompany,
  deriveLinkedinClean,
  type Contact,
  type CompanyOption,
  type CityOption,
  type ContactLead,
} from '../data/contacts';
import { fetchCompanyContacts, type CompanyContact } from '../data/companies';
import { CopyButton } from '../components/ui/CopyButton';
import { StageBadge } from '../components/ui/Badge';
import {
  getContactStatus,
  upsertContactStatus,
  fetchActivity,
  type ContactProjectStatus,
} from '../data/projectStatus';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { supabase } from '../lib/supabase';
import { SectionCard } from '../components/admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../components/ui/SearchSelect';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { DispositionForm } from '../components/ui/DispositionForm';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { Interaction } from '../data/contacts';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Inline field editor sub-component                                  */
/* ------------------------------------------------------------------ */

function FieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 13,
          padding: '6px 10px',
          border: '1px solid #d4d4d8',
          borderRadius: 6,
          background: '#fff',
          color: '#18181b',
          outline: 'none',
          width: '100%',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info row helper (read-only display)                                */
/* ------------------------------------------------------------------ */

function InfoRow({ icon, label, value, href, copyValue }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  /** When set, shows a copy-to-clipboard button next to the value. */
  copyValue?: string | null;
}) {
  return (
    <div className="flex items-start gap-3" style={{ minHeight: 32 }}>
      <span style={{ color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span className="flex items-center gap-1.5 min-w-0">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" title={copyValue ?? (typeof value === 'string' ? value : undefined)} style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </a>
          ) : (
            <span title={copyValue ?? (typeof value === 'string' ? value : undefined)} style={{ fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || <span style={{ color: '#D1D5DB' }}>—</span>}</span>
          )}
          {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
        </span>
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
  const { profile, canCreateData } = useAuth();

  const contactId = id ? Number(id) : null;

  // Core contact data
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for contact fields
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    full_name: string;
    designation: string;
    email: string;
    mobile_no: string;
    alt_mobile_no: string;
    linkedin_url: string;
    city_id: number | null;
    company_id: number | null;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Company / city option lists
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);

  // Per-project working panel state
  // TODO visibility: per-project status/notes are owner + admin only (security pass)
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectStatus, setProjectStatus] = useState<ContactProjectStatus | null>(null);
  const [statusOptions, setStatusOptions] = useState<DropdownOption[]>([]);
  const [statusDraft, setStatusDraft] = useState<{
    contact_status: string;
    description: string;
    comments: string;
  }>({ contact_status: '', description: '', comments: '' });
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState(false);

  // Activity timeline
  const [activity, setActivity] = useState<Interaction[]>([]);

  // Associations (HubSpot-style): leads for this contact + colleagues at the same company
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [siblings, setSiblings] = useState<CompanyContact[]>([]);

  /* ---------------------------------------------------------------- */
  /*  Load contact + reference data                                    */
  /* ---------------------------------------------------------------- */

  const loadContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, companies, cities] = await Promise.all([
        fetchContactById(contactId),
        fetchCompanyOptions(),
        fetchCityOptions(),
      ]);
      if (!c) {
        setError('Contact not found.');
        setLoading(false);
        return;
      }
      setContact(c);
      setCompanyOptions(companies);
      setCityOptions(cities);
      setLoading(false);
    } catch {
      setError('Could not load this contact.');
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { loadContact(); }, [loadContact]);

  // Load associated leads + colleagues once the contact (and its company) is known.
  useEffect(() => {
    if (!contact) return;
    let cancelled = false;
    (async () => {
      const [ld, sib] = await Promise.all([
        fetchContactLeads(contact.contact_id),
        contact.company_id ? fetchCompanyContacts(contact.company_id) : Promise.resolve([] as CompanyContact[]),
      ]);
      if (cancelled) return;
      setLeads(ld);
      setSiblings(sib.filter((s) => s.id !== String(contact.contact_id)));
    })();
    return () => { cancelled = true; };
  }, [contact]);

  // Load contact_status dropdown options once
  useEffect(() => {
    fetchOptions('contact_status').then(setStatusOptions);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Load per-project status whenever project changes                 */
  /* ---------------------------------------------------------------- */

  const loadProjectStatus = useCallback(async () => {
    if (!contactId || !projectId) return;
    const ps = await getContactStatus(contactId, projectId);
    setProjectStatus(ps);
    setStatusDraft({
      contact_status: ps?.contact_status ?? '',
      description: ps?.description ?? '',
      comments: ps?.comments ?? '',
    });
  }, [contactId, projectId]);

  useEffect(() => { loadProjectStatus(); }, [loadProjectStatus]);

  /* ---------------------------------------------------------------- */
  /*  Load activity timeline (all projects for this contact)          */
  /* ---------------------------------------------------------------- */

  const loadActivity = useCallback(async () => {
    if (!contactId) return;
    const rows = await fetchActivity('contact', contactId);
    setActivity(rows);
  }, [contactId]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  /* ---------------------------------------------------------------- */
  /*  Edit contact fields                                              */
  /* ---------------------------------------------------------------- */

  function startEdit() {
    if (!contact) return;
    setEditDraft({
      full_name: contact.full_name ?? '',
      designation: contact.designation ?? '',
      email: contact.email ?? '',
      mobile_no: contact.mobile_no ?? '',
      alt_mobile_no: contact.alt_mobile_no ?? '',
      linkedin_url: contact.linkedin_url ?? '',
      city_id: contact.city_id,
      company_id: contact.company_id,
    });
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!contactId || !editDraft || !contact) return;
    setSavingEdit(true);
    setEditError(null);

    const linkedinClean = deriveLinkedinClean(editDraft.linkedin_url);

    // If company changed, use the shared helper; otherwise skip
    const companyChanged = editDraft.company_id !== contact.company_id;

    // Update all scalar fields directly on contact_master
    const { data: updatedRows, error: updateErr } = await supabase
      .from('contact_master')
      .update({
        full_name: editDraft.full_name.trim() || null,
        designation: editDraft.designation.trim() || null,
        email: editDraft.email.trim() || null,
        mobile_no: editDraft.mobile_no.trim() || null,
        alt_mobile_no: editDraft.alt_mobile_no.trim() || null,
        linkedin_url: editDraft.linkedin_url.trim() || null,
        linkedin_clean: linkedinClean,
        city_id: editDraft.city_id,
        company_id: editDraft.company_id,
        updated_date: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .select('contact_id');

    if (updateErr) {
      setEditError(
        updateErr.code === '42501'
          ? "You can only edit records you own (ask an admin or the owner's manager)."
          : updateErr.message,
      );
      setSavingEdit(false);
      return;
    }
    if (!updatedRows || (updatedRows as { contact_id: number }[]).length === 0) {
      setEditError("You can only edit records you own (ask an admin or the owner's manager).");
      setSavingEdit(false);
      return;
    }

    // If company changed, also run the dedicated helper (it may do extra work)
    if (companyChanged) {
      await updateContactCompany(contactId, editDraft.company_id);
    }

    // Refresh contact
    await loadContact();
    setSavingEdit(false);
    setEditing(false);
    setEditDraft(null);
  }

  /* ---------------------------------------------------------------- */
  /*  Save project status                                              */
  /* ---------------------------------------------------------------- */

  async function saveProjectStatus() {
    if (!contactId || !projectId) return;
    setSavingStatus(true);
    setStatusError(null);
    setStatusSuccess(false);
    const actorId = profile?.user_id != null ? String(profile.user_id) : null;
    const { error: err } = await upsertContactStatus(
      contactId,
      projectId,
      {
        contact_status: statusDraft.contact_status || null,
        description: statusDraft.description.trim() || null,
        comments: statusDraft.comments.trim() || null,
      },
      actorId,
    );
    setSavingStatus(false);
    if (err) {
      setStatusError(err);
      return;
    }
    setStatusSuccess(true);
    setTimeout(() => setStatusSuccess(false), 3000);
    // Refresh both status and activity (status_change interaction is appended)
    await Promise.all([loadProjectStatus(), loadActivity()]);
  }

  /* ---------------------------------------------------------------- */
  /*  Build SearchSelect option lists                                  */
  /* ---------------------------------------------------------------- */

  const companySelectOptions: SearchSelectOption[] = companyOptions.map((c) => ({
    id: c.company_id,
    label: c.company_name,
  }));

  const citySelectOptions: SearchSelectOption[] = cityOptions.map((c) => ({
    id: c.city_id,
    label: c.city_name,
  }));

  /* ---------------------------------------------------------------- */
  /*  Render: loading / error states                                   */
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

  const actorId = profile?.user_id != null ? String(profile.user_id) : null;
  const ownerUserId = profile?.user_id ?? null;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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
                target="_blank"
                rel="noreferrer noopener"
                title="Open company in a new tab"
                style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
              >
                <Building2 size={13} />
                {contact.company_name}
                <ExternalLink size={11} style={{ opacity: 0.6 }} />
              </Link>
            )}
          </div>

          {/* New Lead / Edit / Save / Cancel buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!editing ? (
              <>
                {/* Create is admin-only by default (ADR-21); hidden from outreach roles. */}
                {canCreateData && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/leads/new?contact=${contact.contact_id}` +
                        (contact.company_id ? `&company=${contact.company_id}` : ''),
                    )
                  }
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#1A7EE8', color: '#fff',
                    border: 'none', borderRadius: 6,
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> New Lead
                </button>
                )}
                <button
                  type="button"
                  onClick={startEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#F3F4F6', color: '#374151',
                    border: '1px solid #E5E7EB', borderRadius: 6,
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#1A7EE8', color: '#fff',
                    border: 'none', borderRadius: 6,
                    padding: '6px 12px',
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                    opacity: savingEdit ? 0.6 : 1,
                  }}
                >
                  {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: 'none', color: '#6B7280',
                    border: '1px solid #d4d4d8', borderRadius: 6,
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <X size={12} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit error banner */}
        {editError && (
          <div style={{ fontSize: 13, color: '#EF4444', padding: '8px 14px', background: '#FEF2F2', borderRadius: 6, border: '1px solid #FECACA' }}>
            {editError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Contact Details — read view OR edit form */}
          <SectionCard title="Contact Details">
            {!editing ? (
              <div className="space-y-3">
                <InfoRow
                  icon={<Mail size={15} />}
                  label="Email"
                  value={contact.email}
                  href={contact.email ? `mailto:${contact.email}` : undefined}
                  copyValue={contact.email}
                />
                <InfoRow
                  icon={<Phone size={15} />}
                  label="Phone"
                  value={contact.mobile_no}
                  href={contact.mobile_no ? `tel:${contact.mobile_no}` : undefined}
                  copyValue={contact.mobile_no}
                />
                <InfoRow
                  icon={<Phone size={15} />}
                  label="Alt Phone"
                  value={contact.alt_mobile_no}
                  href={contact.alt_mobile_no ? `tel:${contact.alt_mobile_no}` : undefined}
                  copyValue={contact.alt_mobile_no}
                />
                <InfoRow
                  icon={<Link2 size={15} />}
                  label="LinkedIn"
                  value={contact.linkedin_clean || contact.linkedin_url}
                  href={linkedinHref}
                />
                <InfoRow icon={<MapPin size={15} />} label="City" value={contact.city_name} />
                <InfoRow icon={<Briefcase size={15} />} label="Designation" value={contact.designation} />
                {/* Company (read) */}
                <div className="flex items-start gap-3" style={{ minHeight: 32 }}>
                  <span style={{ color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}><Building2 size={15} /></span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Company</span>
                    {contact.company_name && contact.company_id ? (
                      <Link
                        to={`/companies/${contact.company_id}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="Open company in a new tab"
                        style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {contact.company_name}
                        <ExternalLink size={11} style={{ opacity: 0.6 }} />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13, color: '#D1D5DB' }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit form */
              editDraft && (
                <div className="space-y-3">
                  <FieldEditor
                    label="Full Name *"
                    value={editDraft.full_name}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, full_name: v } : d)}
                  />
                  <FieldEditor
                    label="Designation"
                    value={editDraft.designation}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, designation: v } : d)}
                  />
                  <FieldEditor
                    label="Email"
                    value={editDraft.email}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, email: v } : d)}
                  />
                  <FieldEditor
                    label="Phone"
                    value={editDraft.mobile_no}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, mobile_no: v } : d)}
                  />
                  <FieldEditor
                    label="Alt Phone"
                    value={editDraft.alt_mobile_no}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, alt_mobile_no: v } : d)}
                  />
                  <FieldEditor
                    label="LinkedIn URL"
                    value={editDraft.linkedin_url}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, linkedin_url: v } : d)}
                  />

                  {/* City picker */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>City</label>
                    <SearchSelect
                      options={citySelectOptions}
                      value={editDraft.city_id}
                      onChange={(v) => setEditDraft((d) => d ? { ...d, city_id: v } : d)}
                      placeholder="Search city…"
                    />
                  </div>

                  {/* Company picker */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Company</label>
                    <SearchSelect
                      options={companySelectOptions}
                      value={editDraft.company_id}
                      onChange={(v) => setEditDraft((d) => d ? { ...d, company_id: v } : d)}
                      placeholder="Search company…"
                    />
                  </div>

                  {/* Inline save / cancel (mirrors header buttons) */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 500,
                        background: '#1A7EE8', color: '#fff',
                        border: 'none', borderRadius: 5, padding: '5px 12px',
                        cursor: savingEdit ? 'not-allowed' : 'pointer',
                        opacity: savingEdit ? 0.6 : 1,
                      }}
                    >
                      {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, color: '#6B7280',
                        background: 'none', border: '1px solid #d4d4d8',
                        borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
                      }}
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </SectionCard>

          {/* Per-project working panel */}
          {/* TODO visibility: per-project status/notes are owner + admin only (security pass) */}
          <SectionCard
            title="Project Status"
            action={
              <ProjectSelect
                value={projectId}
                onChange={setProjectId}
              />
            }
          >
            <div className="space-y-3">
              {/* Current status badge */}
              {projectStatus?.contact_status && (
                <div style={{ marginBottom: 4 }}>
                  <StatusBadge value={projectStatus.contact_status} category="contact_status" />
                </div>
              )}

              {/* Status dropdown */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Contact Status</label>
                <select
                  value={statusDraft.contact_status}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, contact_status: e.target.value }))}
                  style={{
                    fontSize: 13, padding: '6px 10px',
                    border: '1px solid #d4d4d8', borderRadius: 6,
                    background: '#fff', color: '#18181b', outline: 'none',
                    cursor: 'pointer', height: 34, appearance: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                >
                  <option value="">— none —</option>
                  {statusOptions.map((o) => (
                    <option key={o.option_id} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Description</label>
                <textarea
                  value={statusDraft.description}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Short description…"
                  rows={2}
                  style={{
                    fontSize: 13, padding: '6px 10px', resize: 'vertical',
                    border: '1px solid #d4d4d8', borderRadius: 6,
                    background: '#fff', color: '#18181b', outline: 'none',
                    fontFamily: 'inherit', width: '100%',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
              </div>

              {/* Comments */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Comments</label>
                <textarea
                  value={statusDraft.comments}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, comments: e.target.value }))}
                  placeholder="Internal comments…"
                  rows={2}
                  style={{
                    fontSize: 13, padding: '6px 10px', resize: 'vertical',
                    border: '1px solid #d4d4d8', borderRadius: 6,
                    background: '#fff', color: '#18181b', outline: 'none',
                    fontFamily: 'inherit', width: '100%',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
              </div>

              {statusError && (
                <p style={{ fontSize: 12, color: '#EF4444' }}>{statusError}</p>
              )}
              {statusSuccess && (
                <p style={{ fontSize: 12, color: '#16A34A' }}>Status saved.</p>
              )}

              <button
                type="button"
                onClick={saveProjectStatus}
                disabled={savingStatus || !projectId}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 500,
                  background: '#1A7EE8', color: '#fff',
                  border: 'none', borderRadius: 6,
                  padding: '6px 14px',
                  cursor: (savingStatus || !projectId) ? 'not-allowed' : 'pointer',
                  opacity: (savingStatus || !projectId) ? 0.6 : 1,
                }}
              >
                {savingStatus ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save status
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Associations — leads for this contact + colleagues at the same company */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SectionCard
            title={`Leads (${leads.length})`}
            action={
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/leads/new?contact=${contact.contact_id}` +
                      (contact.company_id ? `&company=${contact.company_id}` : ''),
                  )
                }
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500, color: '#1A7EE8',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <Plus size={13} /> New
              </button>
            }
          >
            {leads.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No leads linked to this contact yet.
              </p>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <a
                    key={l.id}
                    href={`/leads/${l.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 cursor-pointer"
                    style={{ border: '1px solid #E5E7EB', background: '#fff', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                  >
                    <div className="min-w-0">
                      <p className="truncate inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>
                        {l.leadName || <span style={{ color: '#9CA3AF' }}>Untitled lead</span>}
                        <ExternalLink size={11} style={{ color: '#9CA3AF' }} />
                      </p>
                      {l.leadNumber && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>
                          {l.leadNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {l.stage && <StageBadge stage={l.stage} />}
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{l.createdDate || '—'}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Colleagues${contact.company_name ? ' · ' + contact.company_name : ''} (${siblings.length})`}
          >
            {!contact.company_id ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                Link a company to see colleagues.
              </p>
            ) : siblings.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No other contacts at this company yet.
              </p>
            ) : (
              <div className="space-y-1">
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    to={`/contacts/${s.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    title="Open contact in a new tab"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      fontSize: 13, color: '#374151', textDecoration: 'none',
                      padding: '6px 8px', borderRadius: 6,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span className="truncate inline-flex items-center gap-1" style={{ fontWeight: 500, color: '#111827' }}>
                      {s.fullName || '—'}
                      <ExternalLink size={11} style={{ color: '#9CA3AF' }} />
                    </span>
                    <span className="truncate" style={{ color: '#9CA3AF', fontSize: 12 }}>
                      {s.designation || ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Call Disposition Logger */}
        <SectionCard title="Log a Call">
          <DispositionForm
            recordType="contact"
            recordId={contactId!}
            projectId={projectId}
            ownerUserId={ownerUserId}
            actorId={actorId}
            onLogged={loadActivity}
          />
        </SectionCard>

        {/* Activity Timeline */}
        <SectionCard title="Activity Timeline">
          <ActivityTimeline
            items={activity}
            emptyText="No activity yet. Use Log a Call above to record the first interaction."
          />
        </SectionCard>

      </div>
    </AppShell>
  );
}

export default ContactDetailPage;
