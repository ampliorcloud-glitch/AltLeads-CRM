import { supabase } from '../lib/supabase';

export interface Contact {
  contact_id: number;
  full_name: string;
  email: string | null;
  mobile_no: string | null;
  alt_mobile_no: string | null;
  designation: string | null;
  linkedin_url: string | null;
  linkedin_clean: string | null;
  company_id: number | null;
  city_id: number | null;
  is_demo: boolean;
  created_by: string | null;
  created_date: string | null;
  // joined
  company_name: string | null;
  city_name: string | null;
}

export interface Interaction {
  interaction_id: number;
  record_type: string;
  record_id: number;
  project_id: number | null;
  owner_user_id: number | null;
  type: string;
  disposition: string | null;
  note_text: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
}

export interface CompanyOption {
  company_id: number;
  company_name: string;
}

export interface CityOption {
  city_id: number;
  city_name: string;
}

/** Derive linkedin_clean from a linkedin_url */
export function deriveLinkedinClean(url: string | null | undefined): string | null {
  if (!url) return null;
  const cleaned = url
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
    .replace(/\/$/, '')
    .trim();
  return cleaned || null;
}

/** Fetch all contacts via the masked view (company_name + city_name are flat columns). */
export async function fetchAllContacts(): Promise<{
  contacts: Contact[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('contact_master_masked')
    .select(
      'contact_id, full_name, email, mobile_no, alt_mobile_no, designation, linkedin_url, linkedin_clean, company_id, city_id, is_demo, created_by, created_date, company_name, city_name',
    )
    .limit(1000)
    .order('full_name', { ascending: true });

  if (error) {
    return { contacts: [], error: error.message };
  }

  const contacts: Contact[] = (data ?? []).map((row: Record<string, unknown>) => ({
    contact_id: row.contact_id as number,
    full_name: (row.full_name as string) ?? '',
    email: row.email as string | null,
    mobile_no: row.mobile_no as string | null,
    alt_mobile_no: row.alt_mobile_no as string | null,
    designation: row.designation as string | null,
    linkedin_url: row.linkedin_url as string | null,
    linkedin_clean: row.linkedin_clean as string | null,
    company_id: row.company_id as number | null,
    city_id: row.city_id as number | null,
    is_demo: (row.is_demo as boolean) ?? false,
    created_by: row.created_by as string | null,
    created_date: row.created_date as string | null,
    company_name: (row.company_name as string | null) ?? null,
    city_name: (row.city_name as string | null) ?? null,
  }));

  return { contacts, error: null };
}

/** Fetch a single contact by id */
export async function fetchContactById(contactId: number): Promise<Contact | null> {
  const { contacts } = await fetchAllContacts();
  return contacts.find((c) => c.contact_id === contactId) ?? null;
}

/** A lead associated with a contact (HubSpot-style "associated leads" panel). */
export interface ContactLead {
  id: string;
  leadNumber: string;
  leadName: string;
  stage: string;
  createdDate: string;
}

/**
 * Leads directly associated with a contact.
 * Primary link is lead_master.contact_id (set when a lead is created from a
 * contact). If the contact was migrated from a lead, source_lead_id points back
 * at that originating lead, so include it too.
 */
export async function fetchContactLeads(
  contactId: number,
  sourceLeadId?: number | null,
): Promise<ContactLead[]> {
  const ors = [`contact_id.eq.${contactId}`];
  if (sourceLeadId != null) ors.push(`lead_id.eq.${sourceLeadId}`);

  const { data, error } = await supabase
    .from('lead_master')
    .select('lead_id, lead_number, lead_name, stage, created_date')
    .or(ors.join(','))
    .is('deleted_date', null)
    .order('created_date', { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.lead_id),
    leadNumber: (r.lead_number as string | null) ?? '',
    leadName: (r.lead_name as string | null) ?? '',
    stage: (r.stage as string | null) ?? '',
    createdDate: r.created_date ? String(r.created_date).substring(0, 10) : '',
  }));
}

/** Fetch interactions for a contact */
export async function fetchContactInteractions(contactId: number): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from('interaction')
    .select('*')
    .eq('record_type', 'contact')
    .eq('record_id', contactId)
    .order('occurred_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as Interaction[];
}

/** Log a call interaction */
export async function logCallInteraction(params: {
  contactId: number;
  disposition: string;
  noteText: string;
  ownerUserId: number | null;
  createdBy: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('interaction').insert({
    record_type: 'contact',
    record_id: params.contactId,
    project_id: null,
    owner_user_id: params.ownerUserId,
    type: 'call',
    disposition: params.disposition,
    note_text: params.noteText,
    occurred_at: new Date().toISOString(),
    created_by: params.createdBy,
  });
  return { error: error ? error.message : null };
}

/** Fetch companies for dropdown */
export async function fetchCompanyOptions(): Promise<CompanyOption[]> {
  const { data } = await supabase
    .from('company_master')
    .select('company_id, company_name')
    .order('company_name', { ascending: true })
    .limit(5000);
  return (data ?? []) as CompanyOption[];
}

/** Fetch cities for dropdown */
export async function fetchCityOptions(): Promise<CityOption[]> {
  const { data } = await supabase
    .from('city_master')
    .select('city_id, city_name')
    .order('city_name', { ascending: true })
    .limit(5000);
  return (data ?? []) as CityOption[];
}

/** Check for duplicate contact via the find_contact_dup RPC (SECURITY DEFINER, no detail leak). */
export async function findDuplicateContact(params: {
  email?: string;
  linkedinClean?: string;
  mobileNo?: string;
}): Promise<Contact | null> {
  if (!params.email && !params.linkedinClean && !params.mobileNo) return null;

  const { data, error } = await supabase.rpc('find_contact_dup', {
    p_email: params.email ?? null,
    p_linkedin: params.linkedinClean ?? null,
    p_mobile: params.mobileNo ?? null,
  });

  if (error || !data || (data as unknown[]).length === 0) return null;

  const row = (data as { contact_id: number; full_name: string; company_id: number; company_name: string }[])[0];
  return {
    contact_id: row.contact_id,
    full_name: row.full_name ?? '',
    email: null,
    mobile_no: null,
    alt_mobile_no: null,
    designation: null,
    linkedin_url: null,
    linkedin_clean: null,
    company_id: row.company_id ?? null,
    city_id: null,
    is_demo: false,
    created_by: null,
    created_date: null,
    company_name: row.company_name ?? null,
    city_name: null,
  };
}

/** Update company_id on an existing contact (set null to unlink) */
export async function updateContactCompany(
  contactId: number,
  companyId: number | null,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('contact_master')
    .update({
      company_id: companyId,
      updated_date: new Date().toISOString(),
    })
    .eq('contact_id', contactId)
    .select('contact_id');

  if (error) {
    if (error.code === '42501') {
      return { error: "You can only edit records you own (ask an admin or the owner's manager)." };
    }
    return { error: error.message };
  }
  if (!data || (data as { contact_id: number }[]).length === 0) {
    return { error: "You can only edit records you own (ask an admin or the owner's manager)." };
  }
  return { error: null };
}

/** Insert a new contact */
export async function insertContact(params: {
  fullName: string;
  designation: string;
  email: string;
  mobileNo: string;
  altMobileNo: string;
  linkedinUrl: string;
  linkedinClean: string | null;
  companyId: number | null;
  cityId: number | null;
  isDemo: boolean;
  createdBy: string;
}): Promise<{ contactId: number | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contact_master')
    .insert({
      full_name: params.fullName,
      designation: params.designation || null,
      email: params.email || null,
      mobile_no: params.mobileNo || null,
      alt_mobile_no: params.altMobileNo || null,
      linkedin_url: params.linkedinUrl || null,
      linkedin_clean: params.linkedinClean,
      company_id: params.companyId,
      city_id: params.cityId,
      is_demo: params.isDemo,
      created_by: params.createdBy,
      created_date: new Date().toISOString(),
    })
    .select('contact_id')
    .single();

  if (error) return { contactId: null, error: error.message };
  return { contactId: (data as { contact_id: number }).contact_id, error: null };
}
