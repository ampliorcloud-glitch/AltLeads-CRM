/**
 * LeadFormPage — shared Add Lead (/leads/new) and Edit Lead (/leads/:id/edit) form.
 *
 * Fields included vs old-app:
 *   INCLUDED: lead_name, mobile_no, alt_mobile_no, email, designation, title,
 *             company (dropdown + new company freeform), agent (owner), source,
 *             project, client_assoc, city, area_of_interest, value, description,
 *             linkedin_url, role_and_resp
 *   OMITTED (intentionally): address_line1/2, latitude/longitude, map_address
 *     (address fields were internal geocoding, not user-entered in modern flow),
 *     lead_designation_id (separate designation lookup not used in new UI),
 *     location_id (rarely filled), report_url/call_recording (media attachments,
 *     phase-3 feature), stage (managed via lead_report in detail view).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronRight, AlertCircle, Check } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import {
  fetchLeadDetail,
  fetchLookups,
  createLead,
  updateLead,
  type LeadFormData,
  type LookupOption,
} from '../lib/leadsApi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/* ── Shared styles ───────────────────────────────────────────────────────── */

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  background: '#fff',
  color: '#18181b',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
};

const inputError: React.CSSProperties = {
  borderColor: '#f87171',
};

const labelCls = 'block font-medium text-zinc-500 mb-1';
const labelStyle: React.CSSProperties = { fontSize: 12 };
const requiredMark = <span className="text-red-400 ml-0.5">*</span>;

/* ── Form field wrappers ─────────────────────────────────────────────────── */

function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls} style={labelStyle}>
        {label}{required && requiredMark}
      </label>
      {children}
      {error && (
        <p className="text-red-500" style={{ fontSize: 11 }}>{error}</p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  hasError,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        ...inputBase,
        ...(hasError ? inputError : {}),
        borderColor: focused ? '#1A7EE8' : hasError ? '#f87171' : '#d4d4d8',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...inputBase,
        height: 'auto',
        resize: 'vertical',
        borderColor: focused ? '#1A7EE8' : '#d4d4d8',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  hasError,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: LookupOption[];
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...inputBase,
        cursor: 'pointer',
        paddingRight: 28,
        borderColor: focused ? '#1A7EE8' : hasError ? '#f87171' : '#d4d4d8',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pb-2 border-b border-zinc-100">
      <h3 className="font-semibold text-zinc-700" style={{ fontSize: 13 }}>{title}</h3>
    </div>
  );
}

/* ── Empty form ──────────────────────────────────────────────────────────── */

const emptyForm: LeadFormData = {
  lead_name: '',
  mobile_no: '',
  alt_mobile_no: '',
  email: '',
  designation: '',
  title: '',
  company_id: null,
  new_company_name: '',
  agent_id: null,
  source_id: null,
  project_id: null,
  client_assoc_id: null,
  city_id: null,
  area_of_interest: '',
  value: '',
  description: '',
  linkedin_url: '',
  role_and_resp: '',
};

type Errors = Partial<Record<keyof LeadFormData | 'submit', string>>;

/* ── Main component ──────────────────────────────────────────────────────── */

export function LeadFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isEdit = Boolean(id);
  const leadId = id ? Number(id) : null;

  const [form, setForm] = useState<LeadFormData>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [lookups, setLookups] = useState<{
    companies: LookupOption[];
    users: LookupOption[];
    sources: LookupOption[];
    projects: LookupOption[];
    clients: LookupOption[];
    cities: LookupOption[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // For edit: keep existing address_id and resolved city_id
  const [existingAddressId, setExistingAddressId] = useState<number | null>(null);
  const [existingCityId, setExistingCityId] = useState<number | null>(null);
  // source_id and client_assoc_id are NOT NULL in the DB; remember the lead's
  // original values so we never write null back if the user clears the dropdown.
  const [origSourceId, setOrigSourceId] = useState<number | null>(null);
  const [origClientAssocId, setOrigClientAssocId] = useState<number | null>(null);

  // Audit columns (created_by / updated_by) MUST store the numeric user_id as text
  // (e.g. "114"), because lead ownership / RLS keys on created_by = user_id and
  // fetchLeadActivity resolves the creator by user_id. NEVER fall back to a name or
  // email — doing so wrote "Mohit Sharma" onto lead_id=1 (latent bug), producing an
  // un-ownable, mis-scoped lead. If user_id isn't loaded yet, byIdentifier is null
  // and the submit handler blocks the save until the profile is ready.
  const byIdentifier = profile?.user_id != null ? String(profile.user_id) : null;

  const load = useCallback(async () => {
    setLoading(true);
    const [lookupsData, leadData] = await Promise.all([
      fetchLookups(),
      isEdit && leadId ? fetchLeadDetail(leadId) : Promise.resolve(null),
    ]);

    setLookups(lookupsData);

    if (isEdit && leadData) {
      // Resolve the REAL city_id straight from the lead's address_master row.
      // City names are not unique (651 cities / 639 distinct names), so matching by
      // name is ambiguous and can pre-fill the wrong/blank city. Using the FK is exact.
      let cityId: number | null = null;
      if (leadData.address_id) {
        const { data: addr } = await supabase
          .from('address_master')
          .select('city_id')
          .eq('address_id', leadData.address_id)
          .maybeSingle();
        cityId = (addr as { city_id: number | null } | null)?.city_id ?? null;
      }
      // Fall back to a name match only if the FK lookup found nothing.
      if (cityId == null && leadData.city_name) {
        cityId = lookupsData.cities.find((c) => c.label === leadData.city_name)?.id ?? null;
      }

      setExistingAddressId(leadData.address_id);
      setExistingCityId(cityId);
      setOrigSourceId(leadData.source_id);
      setOrigClientAssocId(leadData.client_assoc_id);

      setForm({
        lead_name: leadData.lead_name,
        mobile_no: leadData.mobile_no,
        alt_mobile_no: leadData.alt_mobile_no,
        email: leadData.email,
        designation: leadData.designation,
        title: leadData.title,
        company_id: leadData.company_id,
        new_company_name: '',
        agent_id: leadData.agent_id,
        source_id: leadData.source_id,
        project_id: leadData.project_id,
        client_assoc_id: leadData.client_assoc_id,
        city_id: cityId,
        area_of_interest: leadData.area_of_interest,
        value: leadData.value === '0' ? '' : (leadData.value ?? ''),
        description: leadData.description,
        linkedin_url: leadData.linkedin_url,
        role_and_resp: leadData.role_and_resp,
      });
    } else if (!isEdit) {
      // Default the Agent (Owner) to the current user. Match by user_id (the lookup
      // option id IS user_master.user_id) — matching by full_name is ambiguous and
      // breaks for blank/duplicate names.
      if (profile?.user_id != null) {
        const currentUser = lookupsData.users.find((u) => u.id === profile.user_id);
        if (currentUser) {
          setForm((prev) => ({ ...prev, agent_id: currentUser.id }));
        }
      }
    }
    setLoading(false);
  }, [isEdit, leadId, profile]);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Errors = {};
    // Only truly required fields block save. Company is optional: ~79% of existing
    // leads have no company, and requiring one made Edit unsavable for them.
    if (!form.lead_name.trim()) e.lead_name = 'Contact name is required.';
    if (!form.mobile_no.trim()) e.mobile_no = 'Mobile number is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Enter a valid email address.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Audit fields require the numeric user_id. If the profile hasn't loaded its
    // user_id yet, block the save rather than writing a name/email as created_by
    // (which breaks lead ownership / RLS keying).
    if (byIdentifier == null) {
      setErrors({ submit: 'Your profile is still loading — please wait a moment and try again.' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    // Default source (Datalist = 8) and client_assoc (HungerBox = 3) as fallbacks
    const DEFAULT_SOURCE_ID = 8;
    const DEFAULT_CLIENT_ASSOC_ID = 3;

    if (isEdit && leadId) {
      // source_id / client_assoc_id are NOT NULL columns. updateLead writes them
      // verbatim (no fallback), so backfill from the lead's original values (then
      // the global defaults) if the user blanked either dropdown.
      const safeForm: LeadFormData = {
        ...form,
        source_id: form.source_id ?? origSourceId ?? DEFAULT_SOURCE_ID,
        client_assoc_id: form.client_assoc_id ?? origClientAssocId ?? DEFAULT_CLIENT_ASSOC_ID,
      };
      const result = await updateLead(
        leadId,
        safeForm,
        byIdentifier,
        existingAddressId,
        existingCityId
      );
      setSubmitting(false);
      if (result?.error) {
        setErrors({ submit: result.error });
      } else {
        setSubmitSuccess(true);
        setTimeout(() => navigate(`/leads/${leadId}`), 600);
      }
    } else {
      const result = await createLead(form, byIdentifier, DEFAULT_SOURCE_ID, DEFAULT_CLIENT_ASSOC_ID);
      setSubmitting(false);
      if ('error' in result) {
        setErrors({ submit: result.error });
      } else {
        setSubmitSuccess(true);
        setTimeout(() => navigate(`/leads/${result.lead_id}`), 600);
      }
    }
  };

  const pageTitle = isEdit ? 'Edit Lead' : 'New Lead';

  if (loading) {
    return (
      <AppShell title={pageTitle}>
        <div className="flex items-center justify-center h-64 gap-2 text-zinc-400">
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading...</span>
        </div>
      </AppShell>
    );
  }

  const companies = lookups?.companies ?? [];
  const users = lookups?.users ?? [];
  const sources = lookups?.sources ?? [];
  const projects = lookups?.projects ?? [];
  const clients = lookups?.clients ?? [];
  const cities = lookups?.cities ?? [];

  return (
    <AppShell title={pageTitle}>
      <div className="max-w-2xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-zinc-400 mb-4" style={{ fontSize: 12 }}>
          <button
            type="button"
            onClick={() => navigate(isEdit && leadId ? `/leads/${leadId}` : '/leads')}
            className="flex items-center gap-1 hover:text-zinc-700 transition-colors"
          >
            <ArrowLeft size={13} />
            {isEdit ? 'Lead Detail' : 'Leads'}
          </button>
          <ChevronRight size={11} />
          <span className="text-zinc-600">{pageTitle}</span>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-zinc-200 rounded-lg p-6 space-y-6"
          noValidate
        >
          <h2 className="font-semibold text-zinc-800" style={{ fontSize: 16 }}>{pageTitle}</h2>

          {/* --- Contact section --- */}
          <div className="space-y-4">
            <SectionHeading title="Contact Information" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup label="Contact Name" required error={errors.lead_name}>
                <TextInput
                  value={form.lead_name}
                  onChange={(v) => set('lead_name', v)}
                  placeholder="Full name"
                  hasError={Boolean(errors.lead_name)}
                />
              </FieldGroup>
              <FieldGroup label="Designation" error={errors.designation}>
                <TextInput
                  value={form.designation}
                  onChange={(v) => set('designation', v)}
                  placeholder="e.g. Admin Head"
                />
              </FieldGroup>
              <FieldGroup label="Title" error={errors.title}>
                <TextInput
                  value={form.title}
                  onChange={(v) => set('title', v)}
                  placeholder="e.g. Mr, Ms, Dr"
                />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup label="Mobile Number" required error={errors.mobile_no}>
                <TextInput
                  value={form.mobile_no}
                  onChange={(v) => set('mobile_no', v)}
                  placeholder="10-digit mobile"
                  type="tel"
                  hasError={Boolean(errors.mobile_no)}
                />
              </FieldGroup>
              <FieldGroup label="Alternate Mobile" error={errors.alt_mobile_no}>
                <TextInput
                  value={form.alt_mobile_no}
                  onChange={(v) => set('alt_mobile_no', v)}
                  placeholder="Optional"
                  type="tel"
                />
              </FieldGroup>
              <FieldGroup label="Email" error={errors.email}>
                <TextInput
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  placeholder="email@company.com"
                  type="email"
                  hasError={Boolean(errors.email)}
                />
              </FieldGroup>
              <FieldGroup label="LinkedIn URL" error={errors.linkedin_url}>
                <TextInput
                  value={form.linkedin_url}
                  onChange={(v) => set('linkedin_url', v)}
                  placeholder="linkedin.com/in/..."
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Role & Responsibility" error={errors.role_and_resp}>
              <TextInput
                value={form.role_and_resp}
                onChange={(v) => set('role_and_resp', v)}
                placeholder="e.g. Procurement and vendor management"
              />
            </FieldGroup>
          </div>

          {/* --- Company section --- */}
          <div className="space-y-4">
            <SectionHeading title="Company" />
            <FieldGroup label="Existing Company">
              <SelectInput
                value={form.company_id ?? ''}
                onChange={(v) => {
                  set('company_id', v ? Number(v) : null);
                  if (v) set('new_company_name', '');
                }}
                options={companies}
                placeholder="Search and select company..."
              />
            </FieldGroup>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-100" />
              <span className="text-zinc-400 font-medium" style={{ fontSize: 11 }}>OR</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            <FieldGroup label="New Company Name">
              <TextInput
                value={form.new_company_name}
                onChange={(v) => {
                  set('new_company_name', v);
                  if (v.trim()) set('company_id', null);
                }}
                placeholder="Type a new company name to create it"
                disabled={Boolean(form.company_id)}
              />
            </FieldGroup>
          </div>

          {/* --- Assignment section --- */}
          <div className="space-y-4">
            <SectionHeading title="Assignment" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup label="Agent (Owner)" error={errors.agent_id}>
                <SelectInput
                  value={form.agent_id ?? ''}
                  onChange={(v) => set('agent_id', v ? Number(v) : null)}
                  options={users}
                  placeholder="Select agent..."
                />
              </FieldGroup>
              <FieldGroup label="Source" error={errors.source_id}>
                <SelectInput
                  value={form.source_id ?? ''}
                  onChange={(v) => set('source_id', v ? Number(v) : null)}
                  options={sources}
                  placeholder="Select source..."
                />
              </FieldGroup>
              <FieldGroup label="Project" error={errors.project_id}>
                <SelectInput
                  value={form.project_id ?? ''}
                  onChange={(v) => set('project_id', v ? Number(v) : null)}
                  options={projects}
                  placeholder="Select project..."
                />
              </FieldGroup>
              <FieldGroup label="Client Association" error={errors.client_assoc_id}>
                <SelectInput
                  value={form.client_assoc_id ?? ''}
                  onChange={(v) => set('client_assoc_id', v ? Number(v) : null)}
                  options={clients}
                  placeholder="Select client..."
                />
              </FieldGroup>
              <FieldGroup label="City" error={errors.city_id}>
                <SelectInput
                  value={form.city_id ?? ''}
                  onChange={(v) => set('city_id', v ? Number(v) : null)}
                  options={cities}
                  placeholder="Select city..."
                />
              </FieldGroup>
            </div>
          </div>

          {/* --- Business details section --- */}
          <div className="space-y-4">
            <SectionHeading title="Business Details" />
            <FieldGroup label="Area of Interest" error={errors.area_of_interest}>
              <TextInput
                value={form.area_of_interest}
                onChange={(v) => set('area_of_interest', v)}
                placeholder="e.g. Cafeteria and F&B services"
              />
            </FieldGroup>
            <FieldGroup label="Value" error={errors.value}>
              <TextInput
                value={form.value}
                onChange={(v) => set('value', v)}
                placeholder="Estimated deal value"
              />
            </FieldGroup>
            <FieldGroup label="Description" error={errors.description}>
              <TextArea
                value={form.description}
                onChange={(v) => set('description', v)}
                placeholder="Any additional notes about this lead"
                rows={3}
              />
            </FieldGroup>
          </div>

          {/* Submit row */}
          <div className="pt-2 flex items-center justify-between gap-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => navigate(isEdit && leadId ? `/leads/${leadId}` : '/leads')}
              className="border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-600 font-medium rounded-lg transition-colors"
              style={{ fontSize: 13, padding: '7px 16px' }}
              disabled={submitting}
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {errors.submit && (
                <span className="flex items-center gap-1 text-red-500" style={{ fontSize: 12 }}>
                  <AlertCircle size={13} />
                  {errors.submit}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || submitSuccess}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                style={{ fontSize: 13, padding: '7px 20px' }}
              >
                {submitSuccess ? (
                  <>
                    <Check size={14} />
                    {isEdit ? 'Saved' : 'Created'}
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {isEdit ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  isEdit ? 'Save Changes' : 'Create Lead'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
