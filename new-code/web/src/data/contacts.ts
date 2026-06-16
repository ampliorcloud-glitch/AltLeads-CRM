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

/** Fetch all contacts with company + city joins (max 1000 which covers 607) */
export async function fetchAllContacts(): Promise<{
  contacts: Contact[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('contact_master')
    .select(`
      contact_id,
      full_name,
      email,
      mobile_no,
      alt_mobile_no,
      designation,
      linkedin_url,
      linkedin_clean,
      company_id,
      city_id,
      is_demo,
      created_by,
      created_date,
      company_master!contact_master_company_id_fkey(company_name),
      city_master!contact_master_city_id_fkey(city_name)
    `)
    .limit(1000)
    .order('full_name', { ascending: true });

  if (error) {
    // Fallback: join may fail if FK names differ — try without join
    const { data: flat, error: flatErr } = await supabase
      .from('contact_master')
      .select('*')
      .limit(1000)
      .order('full_name', { ascending: true });

    if (flatErr) {
      return { contacts: [], error: flatErr.message };
    }

    // We'll need to do a separate company lookup
    const { data: companies } = await supabase
      .from('company_master')
      .select('company_id, company_name')
      .limit(5000);

    const { data: cities } = await supabase
      .from('city_master')
      .select('city_id, city_name')
      .limit(5000);

    const companyMap = new Map<number, string>(
      (companies ?? []).map((c: CompanyOption) => [c.company_id, c.company_name])
    );
    const cityMap = new Map<number, string>(
      (cities ?? []).map((c: CityOption) => [c.city_id, c.city_name])
    );

    const contacts: Contact[] = (flat ?? []).map((row: Record<string, unknown>) => ({
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
      company_name: row.company_id ? (companyMap.get(row.company_id as number) ?? null) : null,
      city_name: row.city_id ? (cityMap.get(row.city_id as number) ?? null) : null,
    }));

    return { contacts, error: null };
  }

  // Parse joined result
  const contacts: Contact[] = (data ?? []).map((row: Record<string, unknown>) => {
    const companyRel = row.company_master as Record<string, unknown> | null;
    const cityRel = row.city_master as Record<string, unknown> | null;
    return {
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
      company_name: companyRel ? (companyRel.company_name as string) : null,
      city_name: cityRel ? (cityRel.city_name as string) : null,
    };
  });

  return { contacts, error: null };
}

/** Fetch a single contact by id */
export async function fetchContactById(contactId: number): Promise<Contact | null> {
  const { contacts } = await fetchAllContacts();
  return contacts.find((c) => c.contact_id === contactId) ?? null;
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

/** Helper: shape a partial dedup row into a Contact stub */
function dupRowToContact(row: Record<string, unknown>): Contact {
  const rel = row.company_master as Record<string, unknown> | null | undefined;
  const companyName = Array.isArray(rel)
    ? ((rel[0] as Record<string, unknown>)?.company_name as string | null) ?? null
    : (rel?.company_name as string | null) ?? null;
  return {
    contact_id: row.contact_id as number,
    full_name: (row.full_name as string) ?? '',
    email: null,
    mobile_no: null,
    alt_mobile_no: null,
    designation: null,
    linkedin_url: null,
    linkedin_clean: null,
    company_id: (row.company_id as number) ?? null,
    city_id: null,
    is_demo: false,
    created_by: null,
    created_date: null,
    company_name: companyName,
    city_name: null,
  };
}

/** Check for duplicate contact (real rows only) */
export async function findDuplicateContact(params: {
  email?: string;
  linkedinClean?: string;
  mobileNo?: string;
}): Promise<Contact | null> {
  if (params.email) {
    const { data } = await supabase
      .from('contact_master')
      .select('contact_id, full_name, company_id, company_master(company_name)')
      .eq('is_demo', false)
      .ilike('email', params.email)
      .limit(1)
      .maybeSingle();
    if (data) return dupRowToContact(data as Record<string, unknown>);
  }
  if (params.linkedinClean) {
    const { data } = await supabase
      .from('contact_master')
      .select('contact_id, full_name, company_id, company_master(company_name)')
      .eq('is_demo', false)
      .eq('linkedin_clean', params.linkedinClean)
      .limit(1)
      .maybeSingle();
    if (data) return dupRowToContact(data as Record<string, unknown>);
  }
  if (params.mobileNo) {
    const { data } = await supabase
      .from('contact_master')
      .select('contact_id, full_name, company_id, company_master(company_name)')
      .eq('is_demo', false)
      .eq('mobile_no', params.mobileNo)
      .limit(1)
      .maybeSingle();
    if (data) return dupRowToContact(data as Record<string, unknown>);
  }
  return null;
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
