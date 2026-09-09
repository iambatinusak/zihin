-- ---------------------------------------------------------------------------
-- 0009 — Ticaret: paketler, abonelikler, odemeler.
--
-- Akis: kullanici bir `package` secer -> `payment` kaydi acilir (pending) ->
-- saglayici webhook'u 'success' der -> `subscription` 'active' olur.
-- Paraya dokunan her sey silinmez; paketler soft-delete, odemeler append-only.
-- ---------------------------------------------------------------------------

-- Paketler -------------------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  -- Satista olan bir paketin sinavi silinemez; once paket pasife alinmali.
  exam_id uuid references public.exams (id) on delete restrict,
  name text not null,
  description text,
  duration_days integer not null,
  price_try numeric(10, 2) not null,
  features jsonb not null default
    '{"daily_question_limit":3,"mock_exam_access":true,"coaching":false}'::jsonb,
  order_index integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_duration_days_check check (duration_days > 0),
  -- Ucretsiz paket (0 TL) gecerli; negatif fiyat degil.
  constraint packages_price_try_check check (price_try >= 0)
);

comment on column public.packages.exam_id is
  'null ise paket sinavdan bagimsizdir (tum sinavlar icin gecerli)';
comment on column public.packages.duration_days is
  'Abonelik suresi (gun); subscriptions.ends_at bu degerden hesaplanir';
comment on column public.packages.price_try is 'Etiket fiyati, Turk Lirasi';
comment on column public.packages.features is
  'Paketin actigi yetkiler; uygulama tarafinda limit kontrolu bu anahtarlardan okunur';
comment on column public.packages.order_index is
  'Fiyatlandirma sayfasindaki gorunum sirasi; kucuk olan once';
comment on column public.packages.is_active is
  'false ise yeni satis kapali, mevcut abonelikler etkilenmez';
comment on column public.packages.deleted_at is
  'Yumusak silme; dolu ise paket hicbir listede gorunmez';

create index if not exists idx_packages_exam_id_is_active
  on public.packages (exam_id, is_active);

drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- Abonelikler ----------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Abonesi olan paket silinemez; gecmis abonelik kaydi paketsiz kalmamali.
  package_id uuid not null references public.packages (id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'pending',
  source text not null default 'iyzico',
  payment_ref text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check
    check (status in ('active', 'expired', 'cancelled', 'pending')),
  constraint subscriptions_source_check check (source in ('iyzico', 'manual')),
  constraint subscriptions_period_check check (ends_at > starts_at)
);

comment on column public.subscriptions.status is
  'pending: odeme bekleniyor · active: yururlukte · expired: suresi doldu · cancelled: iptal';
comment on column public.subscriptions.source is
  'manual: destek ekibinin elle tanimladigi abonelik (odeme kaydi olmayabilir)';
comment on column public.subscriptions.payment_ref is
  'Aboneligi baslatan odemenin saglayici referansi; payments.provider_ref ile eslesir';
comment on column public.subscriptions.cancelled_at is
  'Iptal ani; ends_at degismez, kullanici sure sonuna kadar erisimi surdurur';

-- "Bu kullanicinin gecerli aboneligi var mi?" sorgusunun tasidigi indeks.
create index if not exists idx_subscriptions_user_status_ends
  on public.subscriptions (user_id, status, ends_at);

-- Bitisi yaklasan abonelikler (hatirlatma ve suresi doldu isaretleme isleri).
create index if not exists idx_subscriptions_status_ends
  on public.subscriptions (status, ends_at)
  where status = 'active';

create index if not exists idx_subscriptions_package_id
  on public.subscriptions (package_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Odemeler -------------------------------------------------------------------
-- Salt-ekleme defteri: kayitlar guncellenmez, durum degisimi yeni satir olur.
-- Bu yuzden updated_at kolonu ve trigger'i yok.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Paket silinse bile odeme kaydi durur; yalnizca baglantisi kopar.
  package_id uuid references public.packages (id) on delete set null,
  amount numeric(10, 2) not null,
  currency text not null default 'TRY',
  provider text not null default 'iyzico',
  provider_ref text,
  status text not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount >= 0),
  constraint payments_provider_check check (provider in ('iyzico', 'manual', 'mock')),
  constraint payments_status_check
    check (status in ('pending', 'success', 'failed', 'refunded'))
);

comment on column public.payments.amount is 'Tahsil edilen tutar, currency para biriminde';
comment on column public.payments.provider is
  'mock: gelistirme/test odemesi · manual: havale-EFT gibi elle islenen tahsilat';
comment on column public.payments.provider_ref is
  'Saglayicinin islem kimligi; webhook eslestirmesi bu alan uzerinden yapilir';
comment on column public.payments.raw is
  'Saglayici yanitinin tamami; hata ayiklama ve mutabakat icin saklanir';

create index if not exists idx_payments_user_id_created_at
  on public.payments (user_id, created_at desc);

-- Pakete gore ciro raporu; ayrica paket silindiginde "set null" denetimi
-- odemeleri bastan sona taramasin.
create index if not exists idx_payments_package_id
  on public.payments (package_id)
  where package_id is not null;

-- Ayni webhook'un iki kez islenip mukerrer tahsilat yaratmasini engeller.
create unique index if not exists idx_payments_provider_provider_ref
  on public.payments (provider, provider_ref)
  where provider_ref is not null;
