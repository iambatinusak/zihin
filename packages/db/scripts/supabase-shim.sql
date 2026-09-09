-- ---------------------------------------------------------------------------
-- Supabase taklidi (yalnizca YEREL DOGRULAMA icindir).
--
-- Gomulu bir PostgreSQL ornegi uzerinde migration'lari ve RLS politikalarini
-- calistirabilmek icin Supabase'in sagladigi sema, rol ve fonksiyonlarin en az
-- karsiligini olusturur. Uretimde bu dosya CALISTIRILMAZ; Supabase bunlari
-- kendisi saglar.
--
-- Kapsam bilerek dardir: kimlik dogrulama mantigi yoktur, yalnizca
-- migration'larin bagli oldugu yuzey vardir.
-- ---------------------------------------------------------------------------

-- Roller ------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin superuser;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

-- Semalar ------------------------------------------------------------------
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create schema if not exists graphql_public;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- Uzantilar ----------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists btree_gin with schema extensions;

-- Supabase, uzanti fonksiyonlarini arama yolunda tutar.
alter database postgres set search_path to public, extensions;

-- auth.users ---------------------------------------------------------------
-- Gercek tabloda cok daha fazla kolon var; burada yalnizca migration'larin ve
-- seed'in dokundugu alanlar tanimli.
create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  instance_id uuid,
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token text,
  recovery_token text,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean default false,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (provider, provider_id)
);

-- auth yardimci fonksiyonlari ---------------------------------------------
-- Supabase bunlari `request.jwt.claims` GUC'undan okur. Testlerde
-- `select set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', true)`
-- ile kullanici taklit edilir.
create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon')
$$;

create or replace function auth.email() returns text
language sql stable
as $$
  select nullif(auth.jwt() ->> 'email', '')
$$;

grant execute on function auth.jwt, auth.uid, auth.role, auth.email
  to anon, authenticated, service_role;

-- storage ------------------------------------------------------------------
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select string_to_array(name, '/')
$$;

grant all on storage.objects, storage.buckets to service_role;
grant select on storage.buckets to anon, authenticated;

-- Yerel yigin ile ayni bucket'lar (bkz. supabase/config.toml)
insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', false),
  ('question-images', 'question-images', true),
  ('help-uploads', 'help-uploads', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Supabase'in varsayilan yetkileri ----------------------------------------
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
