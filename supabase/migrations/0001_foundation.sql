-- ---------------------------------------------------------------------------
-- 0001_foundation.sql — Zihin
--
-- Butun semanin dayandigi temel katman: uzantilar, ortak trigger fonksiyonu,
-- is (job) denetim kaydi ve sistem genelinde tek "bugun" tanimi.
-- Bu dosya ILK calisir; diger migration'lar buradaki nesnelere baglidir.
--
-- Not: RLS ve politikalar bu dosyanin kapsaminda degil (bkz. 0010/0011).
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Uzantilar
-- ---------------------------------------------------------------------------
-- Supabase uzantilari `public` yerine `extensions` semasinda tutar; boylece
-- kullanici tablolariyla ad cakismasi olmaz ve sema dokumu temiz kalir.
create schema if not exists extensions;

create extension if not exists pgcrypto  with schema extensions;  -- crypt(), gen_salt()
create extension if not exists pg_trgm   with schema extensions;  -- soru metni benzerlik aramasi
create extension if not exists unaccent  with schema extensions;  -- aramada Turkce aksan/duzeltme isareti duyarsizligi
create extension if not exists btree_gin with schema extensions;  -- GIN indekste tsvector + skaler kolon birlikte


-- ---------------------------------------------------------------------------
-- 2. Ortak updated_at trigger fonksiyonu
-- ---------------------------------------------------------------------------
-- `updated_at` kolonu olan her tablo bu fonksiyonu bir BEFORE UPDATE trigger'i
-- ile kullanir; zaman damgasini istemciye birakmayiz.
--
-- `security definer` BILEREK kullanilmiyor: fonksiyon yalnizca kendisine
-- verilen NEW kaydini degistirir, yukseltilmis yetkiye ihtiyaci yoktur.
-- `search_path = ''` ise Supabase'in "mutable search_path" lint kuralini
-- karsilar ve arama yolu zehirlenmesine kapiyi kapatir; bu nedenle fonksiyon
-- govdesindeki her sey tam nitelikli yazilir.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger''i: updated_at kolonunu sunucu saatiyle tazeler.';


-- ---------------------------------------------------------------------------
-- 3. public.job_runs — cron / arka plan isi denetim kaydi
-- ---------------------------------------------------------------------------
-- Zamanlanmis islerin (haftalik plan uretimi, mastery anlik goruntusu,
-- hatirlatma bildirimleri) her kosumu buraya yazilir; gozlemlenebilirligin
-- tek kaynagi budur.
--
-- Append-only bir olay tablosu: satirlar yalnizca is biterken bir kez
-- guncellenir, gecmise donuk degistirilmez. Bu yuzden `updated_at` yok.
create table if not exists public.job_runs (
  id             uuid primary key default gen_random_uuid(),
  job_name       text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running',
  affected_rows  integer,
  error_message  text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),

  -- Postgres enum yerine check: yeni bir durum eklemek tek satirlik bir
  -- kisit degisikligi, enum'da ise tur degisikligi gerektirirdi.
  constraint job_runs_status_check check (status in ('running', 'success', 'error'))
);

comment on table public.job_runs is
  'Cron/arka plan islerinin kosum gecmisi. Yalnizca eklenir, gecmise donuk guncellenmez.';

comment on column public.job_runs.job_name is
  'Isin mantiksal adi (or. weekly_plan_generation). Kod tarafinda sabit tutulur.';
comment on column public.job_runs.started_at is
  'Kosumun basladigi an; satir is baslarken status=running ile acilir.';
comment on column public.job_runs.finished_at is
  'Kosumun bittigi an. null ise is halen calisiyor ya da cokup kaydi kapatamamistir.';
comment on column public.job_runs.status is
  'running: devam ediyor · success: sorunsuz bitti · error: hata ile sonlandi.';
comment on column public.job_runs.affected_rows is
  'Isin dokundugu satir sayisi (uretilen plan, gonderilen bildirim vb.). Bilinmiyorsa null.';
comment on column public.job_runs.error_message is
  'status=error oldugunda yakalanan hata metni; basarili kosumlarda null.';
comment on column public.job_runs.metadata is
  'Ise ozgu serbest baglam (parametreler, sayaclar). Sema disi kaldigi icin jsonb.';

-- "Su isin son kosumlari" sorgusu en sik erisim deseni.
create index if not exists idx_job_runs_job_name_started_at
  on public.job_runs (job_name, started_at desc);


-- ---------------------------------------------------------------------------
-- 4. public.tr_today() — sistemdeki tek "bugun" tanimi
-- ---------------------------------------------------------------------------
-- Turkiye 2016'dan beri kalici olarak UTC+3'tur; yaz saati uygulamasi
-- kaldirildigi icin sabit ofset guvenlidir ve 'Europe/Istanbul' tabanli
-- hesaplamaya gore tz veritabani guncellemelerinden etkilenmez.
--
-- Seri (streak) sayaci, gunluk aktivite ve plan gunleri BU fonksiyona bagli
-- olmali; "bugun" tanimi tek yerde kalmazsa gun sinirinda tutarsizlik olusur.
create or replace function public.tr_today()
returns date
language sql
stable
set search_path = ''
as $$
  select ((pg_catalog.now() at time zone 'UTC') + interval '3 hours')::date
$$;

comment on function public.tr_today() is
  'Turkiye saatine (UTC+3, yaz saati yok) gore gecerli tarih. Gunluk sayaclarin tek referansi.';
