-- ---------------------------------------------------------------------------
-- 0003_curriculum.sql — mufredat agaci
--
-- sinav (exams) -> ders (subjects) -> unite (units) -> konu (topics)
--   -> kazanim (outcomes)
--
-- Bu dosyadaki tablolarin tamami icerik tablosudur: silme islemi `deleted_at`
-- ile yumusak yapilir, satirlar fiziksel olarak kaldirilmaz. Boylece gecmis
-- denemeler ve ilerleme kayitlari kirik referansa dusmez.
--
-- RLS ve politikalar 0011'e aittir; burada acilmaz.
-- ---------------------------------------------------------------------------

-- Sinavlar -----------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  wrong_penalty_divisor smallint not null default 4,
  default_exam_date date,
  total_questions integer,
  duration_minutes integer,
  order_index integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exams_code_key unique (code),
  -- Yalnizca 3 ve 4 kullaniliyor: LGS'de 3 yanlis, digerlerinde 4 yanlis
  -- 1 dogruyu goturur. Serbest birakilirsa net hesabi sessizce bozulur.
  constraint exams_wrong_penalty_divisor_check check (wrong_penalty_divisor in (3, 4))
);

comment on column public.exams.code is
  'Kod anahtari: LGS, TYT, AYT, KPSS_LISANS, DGS, ALES. Uygulama tarafinda sabit olarak kullanilir.';
comment on column public.exams.wrong_penalty_divisor is
  'Net hesabinda kac yanlisin 1 dogruyu goturdugu. LGS 3, diger sinavlar 4.';
comment on column public.exams.default_exam_date is
  'Sinavin resmi tarihi; kullanici kendi tarihini girmediginde geri sayimda bu kullanilir.';
comment on column public.exams.order_index is
  'Listeleme sirasi; kucuk deger once gelir.';

drop trigger if exists exams_set_updated_at on public.exams;
create trigger exams_set_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- Dersler ------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  -- Sinav silinirse dersleri de anlamsiz kalir.
  exam_id uuid not null references public.exams (id) on delete cascade,
  name text not null,
  slug text not null,
  order_index integer not null default 0,
  color text,
  question_count integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_exam_id_slug_key unique (exam_id, slug)
);

comment on column public.subjects.slug is
  'URL parcasi; ayni sinav icinde benzersizdir.';
comment on column public.subjects.color is
  'Isi haritasi ve rozetlerde kullanilan HSL tonu, orn ''243 75% 52%''.';
comment on column public.subjects.question_count is
  'Sinavda bu dersten cikan soru sayisi; net ve hedef hesaplarinda kullanilir.';
comment on column public.subjects.order_index is
  'Ders listesindeki sira; kucuk deger once gelir.';

create index if not exists idx_subjects_exam_id_order_index
  on public.subjects (exam_id, order_index);

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- Uniteler -----------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  -- Ders silinirse uniteleri de anlamsiz kalir.
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  slug text not null,
  order_index integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_subject_id_slug_key unique (subject_id, slug)
);

comment on column public.units.slug is
  'URL parcasi; ayni ders icinde benzersizdir.';
comment on column public.units.order_index is
  'Unite sirasi; mufredat akisini belirler.';

create index if not exists idx_units_subject_id_order_index
  on public.units (subject_id, order_index);

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at before update on public.units
  for each row execute function public.set_updated_at();

-- Konular ------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  title text not null,
  slug text not null,
  order_index integer not null default 0,
  estimated_minutes integer not null default 30,
  difficulty smallint not null default 3,
  exam_weight numeric(3, 2) not null default 0.50,
  memory_note text,
  memory_image_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_unit_id_slug_key unique (unit_id, slug),
  -- Ust sinir 10 saat: plan olusturucu tek konuyu bir gune sigdirabilmeli.
  constraint topics_estimated_minutes_check check (estimated_minutes between 1 and 600),
  constraint topics_difficulty_check check (difficulty between 1 and 5),
  constraint topics_exam_weight_check check (exam_weight between 0 and 1)
);

comment on column public.topics.estimated_minutes is
  'Konunun tahmini calisma suresi (dakika); calisma plani bu sureye gore dagitilir.';
comment on column public.topics.difficulty is
  'Zorluk seviyesi 1-5; 1 en kolay, 5 en zor.';
comment on column public.topics.exam_weight is
  'Konunun sinavda cikma agirligi (0-1); onceliklendirme formulunde carpan olarak kullanilir.';
comment on column public.topics.memory_note is
  'Hafiza teknigi metni (markdown).';
comment on column public.topics.order_index is
  'Unite icindeki konu sirasi.';

create index if not exists idx_topics_unit_id_order_index
  on public.topics (unit_id, order_index);

-- Konu sayfalari slug ile aciliyor; unite bilinmeden tekil arama yapilir.
create index if not exists idx_topics_slug on public.topics (slug);

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();

-- Kazanimlar ---------------------------------------------------------------
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  code text not null,
  description text not null,
  order_index integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outcomes_topic_id_code_key unique (topic_id, code)
);

comment on table public.outcomes is
  'MEB kazanimlari; konularin olculebilir alt hedefleri.';
comment on column public.outcomes.code is
  'MEB kazanim kodu, orn ''M.9.1.1.1''. Ayni konu icinde benzersizdir.';

drop trigger if exists outcomes_set_updated_at on public.outcomes;
create trigger outcomes_set_updated_at before update on public.outcomes
  for each row execute function public.set_updated_at();

-- 0002'den ertelenen yabanci anahtar ---------------------------------------
-- profiles.exam_id, exams tablosundan once olusturuldugu icin kisit burada
-- eklenir. Sinav silinirse profil korunur, secim bosa duser: on delete set null.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_exam_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_exam_id_fkey
      foreign key (exam_id) references public.exams (id) on delete set null;
  end if;
end
$$;
