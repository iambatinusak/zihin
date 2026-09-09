-- ---------------------------------------------------------------------------
-- 0006_planning.sql - Calisma plani ve aralikli tekrar (spaced repetition).
--
-- study_plans   : haftalik plan basligi (uretim parametreleri + uyarilar)
-- study_blocks  : plandaki tek tek calisma bloklari (gune ve saate degil,
--                 gune ve siraya baglidir)
-- card_reviews  : her kullanici-kart cifti icin SM-2 durumu
-- ---------------------------------------------------------------------------

-- study_plans ---------------------------------------------------------------
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  generated_at timestamptz not null default now(),
  week_start date not null,
  is_active boolean not null default true,
  template text not null default 'balanced',
  warnings text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_plans_template_check
    check (template in ('balanced', 'video_only', 'test_only', 'last_30_days'))
);

comment on column public.study_plans.generated_at is
  'Planin uretecin son calistigi an; created_at yeniden uretimde degismez.';
comment on column public.study_plans.week_start is
  'Planin kapsadigi haftanin Pazartesi gunu; tum sorgular bu tarihe gore gruplanir.';
comment on column public.study_plans.template is
  'Plan uretim sablonu: dengeli, yalniz video, yalniz test veya son 30 gun kampi.';
comment on column public.study_plans.warnings is
  'Kullaniciya gosterilecek Turkce uyarilar (orn. "Bu hafta hedefin cok yuksek").';
comment on column public.study_plans.stats is
  'Uretim ozeti: toplam dakika, blok sayisi, derse gore dagilim vb. Sema serbest.';

drop trigger if exists study_plans_set_updated_at on public.study_plans;
create trigger study_plans_set_updated_at
  before update on public.study_plans
  for each row execute function public.set_updated_at();

create index if not exists idx_study_plans_user_week
  on public.study_plans (user_id, week_start desc);

-- Bir kullanicinin bir hafta icin yalnizca bir aktif plani olur; eski planlar
-- silinmez, is_active=false yapilarak arsivlenir.
create unique index if not exists idx_study_plans_active_week
  on public.study_plans (user_id, week_start)
  where is_active;

-- study_blocks --------------------------------------------------------------
create table if not exists public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_date date not null,
  order_index integer not null default 0,
  type text not null,
  -- Konu silinirse onu isaret eden blok anlamsizlasir.
  topic_id uuid references public.topics (id) on delete cascade,
  -- Video/test kaldirilsa bile blok gunde durmali; kullanici plani bozulmasin.
  video_id uuid references public.videos (id) on delete set null,
  test_id uuid references public.tests (id) on delete set null,
  title text not null,
  estimated_minutes integer not null default 15,
  completed_at timestamptz,
  moved_from_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_blocks_type_check
    check (type in ('watch', 'solve', 'review', 'mock')),
  constraint study_blocks_estimated_minutes_check
    check (estimated_minutes between 1 and 600)
);

comment on column public.study_blocks.user_id is
  'Denormalize: RLS ve "bugunun bloklari" sorgusu study_plans join etmeden calissin.';
comment on column public.study_blocks.order_index is
  'Gun icindeki siralama; saat yok, blok sirasi vardir. Esitlikte id ile kirilir.';
comment on column public.study_blocks.type is
  'watch=video izle, solve=test coz, review=kart tekrari, mock=deneme sinavi.';
comment on column public.study_blocks.title is
  'Kullaniciya gosterilen Turkce baslik, orn. "Izle: Sayi Basamaklari".';
comment on column public.study_blocks.estimated_minutes is
  'Plan uretiminde hesaplanan tahmini sure; gunluk yuk dengesi buna gore kurulur.';
comment on column public.study_blocks.moved_from_date is
  'Kullanici blogu surukleyip tasidiysa ozgun gun; null ise blok hic tasinmamistir.';

drop trigger if exists study_blocks_set_updated_at on public.study_blocks;
create trigger study_blocks_set_updated_at
  before update on public.study_blocks
  for each row execute function public.set_updated_at();

-- Ana erisim deseni: "bu kullanicinin su gunku/su haftaki bloklari".
create index if not exists idx_study_blocks_user_date
  on public.study_blocks (user_id, scheduled_date);

create index if not exists idx_study_blocks_plan_id
  on public.study_blocks (plan_id);

-- Bekleyen isler paneli yalnizca tamamlanmamis bloklari okur.
create index if not exists idx_study_blocks_user_date_pending
  on public.study_blocks (user_id, scheduled_date)
  where completed_at is null;

-- Icerik silindiginde FK denetimi tarama yapmasin diye kismi indeksler.
create index if not exists idx_study_blocks_topic_id
  on public.study_blocks (topic_id)
  where topic_id is not null;

create index if not exists idx_study_blocks_video_id
  on public.study_blocks (video_id)
  where video_id is not null;

create index if not exists idx_study_blocks_test_id
  on public.study_blocks (test_id)
  where test_id is not null;

-- card_reviews --------------------------------------------------------------
-- SM-2 durumu. Her kullanici-kart cifti icin tek satir tutulur; tekrar gecmisi
-- degil, guncel durum saklanir.
create table if not exists public.card_reviews (
  user_id uuid not null references public.profiles (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_grade smallint,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, flashcard_id),
  -- SM-2 algoritmasinin alt siniri; bunun altina dusen kart sonsuz sikisir.
  constraint card_reviews_ease_factor_check check (ease_factor >= 1.30),
  constraint card_reviews_interval_days_check check (interval_days >= 0),
  constraint card_reviews_repetitions_check check (repetitions >= 0),
  constraint card_reviews_last_grade_check check (last_grade between 0 and 5)
);

comment on column public.card_reviews.ease_factor is
  'SM-2 kolaylik katsayisi; dogru cevapta artar, yanlista azalir. Alt sinir 1.30.';
comment on column public.card_reviews.interval_days is
  'Bir sonraki tekrara kadar gun sayisi; 0 ise kart ayni gun tekrar sorulur.';
comment on column public.card_reviews.repetitions is
  'Ust uste dogru bilme sayaci; yanlis cevapta 0''a doner.';
comment on column public.card_reviews.next_review_at is
  'Kartin tekrar gunu; varsayilan now() ile yeni kart hemen calisilabilir olur.';
comment on column public.card_reviews.last_grade is
  'Son verilen SM-2 notu 0-5 (0 hic hatirlamadi, 5 tam hatirladi).';

drop trigger if exists card_reviews_set_updated_at on public.card_reviews;
create trigger card_reviews_set_updated_at
  before update on public.card_reviews
  for each row execute function public.set_updated_at();

-- Gunun destesi: "bu kullanicinin vadesi gelmis kartlari".
create index if not exists idx_card_reviews_user_due
  on public.card_reviews (user_id, next_review_at);

create index if not exists idx_card_reviews_flashcard_id
  on public.card_reviews (flashcard_id);
