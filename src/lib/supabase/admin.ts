import type { Entry } from '../types';
import { requireSupabase } from './client';

const COLUMNS = 'id, village_slug, address_label, lat, lng, note, created_at';

/** Meldet an. Wirft bei falschen Zugangsdaten. */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}

/** Die angemeldete Nutzer-ID, oder `null`. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await requireSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Berechtigung kommt aus der Tabelle `admins` (RLS: man sieht nur die eigene Zeile). */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase().from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Alle Einträge (nur mit Admin-Rechten, sonst liefert RLS eine leere Liste). */
export async function fetchAllEntries(): Promise<Entry[]> {
  const { data, error } = await requireSupabase().from('entries').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Entry[];
}

export interface EntryUpdate {
  address_label: string;
  lat: number;
  lng: number;
  note: string | null;
}

export async function updateEntry(id: string, update: EntryUpdate): Promise<void> {
  const { data, error } = await requireSupabase().from('entries').update(update).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error('Keine Berechtigung oder Eintrag nicht gefunden.');
}

export async function deleteEntryAsAdmin(id: string): Promise<void> {
  const { data, error } = await requireSupabase().from('entries').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error('Keine Berechtigung oder Eintrag nicht gefunden.');
}
