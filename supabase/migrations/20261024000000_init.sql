-- HalloweenMap: Schema, RLS und RPCs
-- Einspielen: Supabase Dashboard → SQL Editor, oder `supabase db push`.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.entries (
  id                uuid primary key default gen_random_uuid(),
  village_slug      text not null,
  address_label     text not null,
  lat               double precision not null,
  lng               double precision not null,
  note              text,
  delete_token_hash text not null,
  created_at        timestamptz not null default now(),
  constraint entries_slug_format   check (village_slug ~ '^[a-z0-9-]{1,40}$'),
  constraint entries_address_len   check (char_length(address_label) between 3 and 200),
  constraint entries_note_len      check (note is null or char_length(note) <= 140),
  constraint entries_lat_range     check (lat between -90 and 90),
  constraint entries_lng_range     check (lng between -180 and 180)
);

create index entries_village_idx on public.entries (village_slug);
create unique index entries_token_hash_idx on public.entries (delete_token_hash);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Row Level Security: anon hat keinen direkten Zugriff auf entries
-- ---------------------------------------------------------------------------

alter table public.entries enable row level security;
alter table public.admins  enable row level security;

revoke all on public.entries from anon, authenticated;
revoke all on public.admins  from anon, authenticated;

-- Admins: volle Rechte auf entries (Policy prüft die Tabelle admins, nicht den Client)
grant select, insert, update, delete on public.entries to authenticated;
create policy entries_admin_all on public.entries
  for all to authenticated
  using      (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Eingeloggte Nutzer dürfen nur prüfen, ob sie selbst Admin sind
grant select on public.admins to authenticated;
create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Öffentliche Sicht ohne delete_token_hash
-- Läuft bewusst mit den Rechten des Owners (kein security_invoker), da anon
-- die Tabelle selbst nicht lesen darf.
-- ---------------------------------------------------------------------------

create view public.public_entries as
  select id, village_slug, address_label, lat, lng, note, created_at
  from public.entries;

revoke all on public.public_entries from anon, authenticated;
grant select on public.public_entries to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Eintrag erstellen
-- ---------------------------------------------------------------------------

create function public.create_entry(
  p_village_slug  text,
  p_address_label text,
  p_lat           double precision,
  p_lng           double precision,
  p_note          text,
  p_token         text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_label text := btrim(coalesce(p_address_label, ''));
  v_id uuid;
begin
  if p_village_slug is null or p_village_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Ungültiger Ort' using errcode = '22023';
  end if;
  if char_length(v_label) not between 3 and 200 then
    raise exception 'Ungültige Adresse' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 140 then
    raise exception 'Hinweis ist zu lang' using errcode = '22023';
  end if;
  -- Plausibilität: Schweiz inkl. Grenzregion
  if p_lat is null or p_lng is null
     or p_lat not between 45.5 and 48.0
     or p_lng not between 5.5 and 10.8 then
    raise exception 'Ungültige Koordinaten' using errcode = '22023';
  end if;
  if p_token is null or char_length(p_token) not between 16 and 100 then
    raise exception 'Ungültiger Token' using errcode = '22023';
  end if;

  -- Rate-Limit: max. 5 Einträge pro Minute und Ort
  if (select count(*) from public.entries
      where village_slug = p_village_slug
        and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Zu viele Einträge, bitte in einer Minute erneut versuchen' using errcode = '54000';
  end if;

  insert into public.entries (village_slug, address_label, lat, lng, note, delete_token_hash)
  values (
    p_village_slug, v_label, p_lat, p_lng, v_note,
    encode(extensions.digest(p_token, 'sha256'), 'hex')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Eintrag zu einem Löschtoken nachschlagen (für den Löschlink)
-- ---------------------------------------------------------------------------

create function public.get_entry_by_token(p_token text)
returns table (id uuid, village_slug text, address_label text, note text)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id, e.village_slug, e.address_label, e.note
  from public.entries e
  where e.delete_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- RPC: Eintrag löschen
-- ---------------------------------------------------------------------------

create function public.delete_entry(p_entry_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.entries
  where id = p_entry_id
    and delete_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.create_entry(text, text, double precision, double precision, text, text) from public;
revoke all on function public.get_entry_by_token(text) from public;
revoke all on function public.delete_entry(uuid, text) from public;
grant execute on function public.create_entry(text, text, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.get_entry_by_token(text) to anon, authenticated;
grant execute on function public.delete_entry(uuid, text) to anon, authenticated;
