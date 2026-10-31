import type { Message } from '../types';
import { requireSupabase, supabase } from './client';
import { SupabaseRpcError } from './entries';

const COLUMNS = 'id, village_slug, author_name, body, is_admin, is_sticky, created_at';

/** Nachrichten eines Orts: angeheftete zuerst, sonst die neuesten oben. Ohne Supabase leer. */
export async function fetchMessages(villageSlug: string): Promise<Message[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('public_messages')
    .select(COLUMNS)
    .eq('village_slug', villageSlug)
    .order('is_sticky', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data as Message[];
}

export interface NewMessage {
  village_slug: string;
  author_name: string;
  body: string;
  /** Wird nur von der DB berücksichtigt, wenn der angemeldete User Admin ist. */
  as_admin: boolean;
}

/** Erstellt eine Nachricht über die RPC `create_message` (bereinigt und prüft in der DB). */
export async function createMessage(message: NewMessage): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_message', {
    p_village_slug: message.village_slug,
    p_author_name: message.author_name,
    p_body: message.body,
    p_as_admin: message.as_admin,
  });
  if (error) throw new SupabaseRpcError(error.message, error.code);
  return data as string;
}

/** Nur Admins (RLS). */
export async function setMessageSticky(id: string, sticky: boolean): Promise<void> {
  const { data, error } = await requireSupabase().from('messages').update({ is_sticky: sticky }).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error('Keine Berechtigung oder Nachricht nicht gefunden.');
}

/** Nur Admins (RLS). */
export async function deleteMessage(id: string): Promise<void> {
  const { data, error } = await requireSupabase().from('messages').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (data.length === 0) throw new Error('Keine Berechtigung oder Nachricht nicht gefunden.');
}
