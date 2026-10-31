-- HalloweenMap: Nachrichten pro Ort (Pinnwand)
-- Einspielen: Supabase Dashboard → SQL Editor, oder `supabase db push`.

-- ---------------------------------------------------------------------------
-- Text bereinigen: nur Klartext. HTML-Tags, BBCode, Steuer- und unsichtbare
-- Zeichen werden entfernt. Der Client macht dasselbe (src/lib/sanitize.ts),
-- verbindlich ist aber diese Funktion.
-- ---------------------------------------------------------------------------

create function public.sanitize_plain_text(p_text text, p_multiline boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := coalesce(p_text, '');
begin
  v := normalize(v, NFC);
  v := regexp_replace(v, E'\r\n?', E'\n', 'g');
  v := replace(v, E'\t', ' ');
  if not p_multiline then
    v := replace(v, E'\n', ' ');
  end if;
  -- Steuerzeichen (ausser Zeilenumbruch), Zero-Width- und Bidi-Steuerzeichen
  v := regexp_replace(v, '[\x01-\x09\x0B-\x1F\x7F​-‏‪-‮⁦-⁩﻿]', '', 'g');
  -- HTML-Tags, danach übrige spitze Klammern
  v := regexp_replace(v, '</?[a-zA-Z!][^>]*>', '', 'g');
  v := regexp_replace(v, '[<>]', '', 'g');
  -- BBCode-Tags
  v := regexp_replace(v, '\[/?(b|i|u|s|url|img|quote|code|color|size|font|list|center|left|right|spoiler|email|\*)(=[^\]]*)?\]', '', 'gi');
  -- Leerraum
  v := regexp_replace(v, ' {2,}', ' ', 'g');
  v := regexp_replace(v, ' *\n *', E'\n', 'g');
  v := regexp_replace(v, '\n{3,}', E'\n\n', 'g');
  return btrim(v, E' \n');
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  village_slug text not null,
  author_name  text not null,
  body         text not null,
  is_admin     boolean not null default false,
  is_sticky    boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint messages_slug_format check (village_slug ~ '^[a-z0-9-]{1,40}$'),
  constraint messages_name_len    check (char_length(author_name) between 1 and 30),
  constraint messages_body_len    check (char_length(body) between 1 and 500)
);

create index messages_village_idx on public.messages (village_slug, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: anon hat keinen direkten Zugriff; Admins dürfen alles (anheften, löschen)
-- ---------------------------------------------------------------------------

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;

grant select, insert, update, delete on public.messages to authenticated;
create policy messages_admin_all on public.messages
  for all to authenticated
  using      (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Öffentliche Sicht (läuft wie public_entries mit den Rechten des Owners)
create view public.public_messages as
  select id, village_slug, author_name, body, is_admin, is_sticky, created_at
  from public.messages;

revoke all on public.public_messages from anon, authenticated;
grant select on public.public_messages to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: Nachricht erstellen. is_admin wird hier bestimmt, nicht vom Client.
-- ---------------------------------------------------------------------------

create function public.create_message(
  p_village_slug text,
  p_author_name  text,
  p_body         text,
  p_as_admin     boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.sanitize_plain_text(p_author_name, false);
  v_body text := public.sanitize_plain_text(p_body, true);
  v_is_admin boolean := exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
  v_id uuid;
begin
  if p_village_slug is null or p_village_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Ungültiger Ort' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 30 then
    raise exception 'Bitte einen Namen mit höchstens 30 Zeichen angeben' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 500 then
    raise exception 'Die Nachricht muss 1 bis 500 Zeichen lang sein' using errcode = '22023';
  end if;

  -- Rate-Limit: max. 10 Nachrichten pro Minute und Ort (Admins ausgenommen)
  if not v_is_admin and (select count(*) from public.messages
      where village_slug = p_village_slug
        and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Zu viele Nachrichten, bitte in einer Minute erneut versuchen' using errcode = '54000';
  end if;

  insert into public.messages (village_slug, author_name, body, is_admin)
  values (p_village_slug, v_name, v_body, v_is_admin and coalesce(p_as_admin, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.sanitize_plain_text(text, boolean) from public;
revoke all on function public.create_message(text, text, text, boolean) from public;
grant execute on function public.create_message(text, text, text, boolean) to anon, authenticated;
