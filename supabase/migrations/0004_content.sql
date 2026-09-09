-- ---------------------------------------------------------------------------
-- 0004_content.sql — Icerik katmani
--
-- Videolar, video ici kontrol noktalari, sorular, testler ve bilgi kartlari.
-- Mufredat (0003) uzerine oturur: her icerik parcasi bir konuya (topic) baglidir,
-- konu silindiginde altindaki icerik de anlamsiz kalir.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- videos
-- ===========================================================================
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  title text not null,
  type text not null default 'lecture',
  provider text not null default 'supabase',
  provider_video_id text,
  storage_path text,
  duration_seconds integer not null default 0,
  thumbnail_url text,
  order_index integer not null default 0,
  is_free_preview boolean not null default false,
  is_published boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_type_check check (type in ('lecture', 'solution', 'summary')),
  constraint videos_provider_check check (provider in ('supabase', 'bunny')),
  constraint videos_duration_seconds_check check (duration_seconds >= 0),
  -- Zorunlu kaynak alani saglayiciya gore degisir: bunny'de harici video kimligi,
  -- supabase'te storage yolu olmadan video oynatilamaz.
  constraint videos_source_check check (
    (provider = 'bunny' and provider_video_id is not null)
    or (provider = 'supabase' and storage_path is not null)
  )
);

comment on column public.videos.provider is 'Videonun barindirildigi yer; supabase storage veya bunny cdn.';
comment on column public.videos.provider_video_id is 'Bunny tarafindaki video kimligi; provider = ''bunny'' ise zorunlu.';
comment on column public.videos.storage_path is 'videos bucket''i icindeki nesne yolu; provider = ''supabase'' ise zorunlu.';
comment on column public.videos.duration_seconds is 'Toplam sure; ilerleme yuzdesi bu deger uzerinden hesaplanir.';
comment on column public.videos.order_index is 'Konu icindeki siralama; kucuk deger once gosterilir.';
comment on column public.videos.is_free_preview is 'Abonelik olmadan izlenebilen tanitim videosu.';

create index if not exists idx_videos_topic_order
  on public.videos (topic_id, order_index);

-- Ogrenci tarafi yalnizca yayindaki videolari listeler; kismi indeks taslak
-- iceriklerin indeksi sisirmesini onler.
create index if not exists idx_videos_topic_published
  on public.videos (topic_id)
  where is_published;

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- questions
-- ===========================================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  -- Kazanim eslesmesi opsiyoneldir; kazanim silinse de soru yasamaya devam eder.
  outcome_id uuid references public.outcomes (id) on delete set null,
  type text not null default 'multiple_choice',
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text not null,
  explanation text,
  solution_video_url text,
  image_url text,
  difficulty smallint not null default 3,
  expected_seconds integer,
  tags text[] not null default '{}',
  source text not null default 'original',
  is_published boolean not null default false,
  search_vector tsvector,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_type_check check (type in ('multiple_choice', 'true_false', 'fill_blank')),
  constraint questions_source_check check (source in ('original', 'exam_style')),
  constraint questions_difficulty_check check (difficulty between 1 and 5),
  constraint questions_expected_seconds_check check (expected_seconds is null or expected_seconds > 0),
  -- Siklar her zaman bir JSON dizisidir ve 2-5 secenek icerir. Varsayilan bos
  -- dizi yalnizca not null icin yer tutucudur; kayit eklerken siklar verilmelidir.
  constraint questions_options_check check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5
  )
);

comment on column public.questions.stem is 'Soru koku; markdown + KaTeX (LaTeX) icerebilir.';
comment on column public.questions.options is 'Siklar: [{"key":"A","text":"..."}, ...] biciminde 2-5 elemanli JSON dizisi.';
comment on column public.questions.correct_option is 'Dogru sikkin anahtari; options icindeki key degerlerinden biri olmak zorunda (trigger ile dogrulanir).';
comment on column public.questions.difficulty is 'Zorluk 1 (cok kolay) - 5 (cok zor); soru secimi ve puanlama agirligi bu degeri kullanir.';
comment on column public.questions.expected_seconds is 'Beklenen cozum suresi; null ise 60 + 20 * difficulty varsayilir.';
comment on column public.questions.source is '''original'' = ozgun soru; ''exam_style'' = cikmis soru tarzinda yazilmis ozgun soru. Telif nedeniyle gercek cikmis sorular saklanmaz.';
comment on column public.questions.search_vector is 'Benzer soru aramasi icin soru kokunden uretilen tsvector; trigger ile doldurulur.';

-- Dogru sikkin siklar arasinda bulunmasini garanti eder. Bir check constraint
-- jsonb dizisi icinde arama yapamadigi icin bu dogrulama trigger ile yapilir.
-- `search_path = ''` (Supabase lint kurali): arama yolu bos oldugu icin
-- govdedeki her cagri tam nitelikli yazilir.
create or replace function public.validate_question_options()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Bu trigger check constraint'lerden ONCE calisir; options dizi degilse
  -- jsonb_array_elements anlasilmaz bir hata firlatirdi, o yuzden once tur bakilir.
  if pg_catalog.jsonb_typeof(new.options) is distinct from 'array' then
    raise exception 'Siklar (options) bir JSON dizisi olmalidir.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
      from pg_catalog.jsonb_array_elements(new.options) as option
     where option ->> 'key' = new.correct_option
  ) then
    raise exception 'Dogru secenek "%" siklar arasinda bulunamadi.', new.correct_option
      using errcode = 'check_violation',
            hint = 'correct_option degeri options dizisindeki key alanlarindan biri olmalidir.';
  end if;

  return new;
end;
$$;

-- Arama vektoru 'simple' konfigurasyonu ile uretilir: PostgreSQL'de yerlesik bir
-- Turkce govdeleyici (stemmer) yok. 'english' Turkce metni yanlis kokluyor;
-- 'simple' + pg_trgm ikilisi Turkce icin belirgin sekilde daha iyi geri getirim
-- (recall) sagliyor.
create or replace function public.questions_search_vector_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Arama yolu bos oldugu icin metin arama konfigurasyonu da tam nitelikli
  -- verilir; aksi halde 'simple' cozumlenemez.
  new.search_vector := pg_catalog.to_tsvector('pg_catalog.simple', coalesce(new.stem, ''));
  return new;
end;
$$;

drop trigger if exists questions_validate_options on public.questions;
create trigger questions_validate_options
  before insert or update on public.questions
  for each row execute function public.validate_question_options();

drop trigger if exists questions_search_vector on public.questions;
create trigger questions_search_vector
  before insert or update on public.questions
  for each row execute function public.questions_search_vector_update();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

create index if not exists idx_questions_search
  on public.questions using gin (search_vector);

-- Yazim farkliliklarina dayanikli benzer soru aramasi (kopya soru tespiti).
create index if not exists idx_questions_stem_trgm
  on public.questions using gin (stem extensions.gin_trgm_ops);

create index if not exists idx_questions_topic
  on public.questions (topic_id);

create index if not exists idx_questions_outcome
  on public.questions (outcome_id);

-- Soru havuzundan zorluk hedefli secim; yalnizca yayindaki ve silinmemis sorular.
create index if not exists idx_questions_topic_difficulty
  on public.questions (topic_id, difficulty)
  where is_published and deleted_at is null;


-- ===========================================================================
-- video_checkpoints — video icinde belirli saniyede sorulan sorular
-- ===========================================================================
create table if not exists public.video_checkpoints (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  timestamp_seconds integer not null,
  order_index integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_checkpoints_timestamp_seconds_check check (timestamp_seconds >= 0),
  -- Ayni saniyede iki soru sorulamaz; oynatici tek bir duraklama noktasi bekler.
  -- Bu kisit (video_id, timestamp_seconds) indeksini de sagladigi icin ayrica
  -- indeks olusturulmadi.
  constraint video_checkpoints_video_timestamp_key unique (video_id, timestamp_seconds)
);

comment on column public.video_checkpoints.timestamp_seconds is 'Videonun kaciyesinde sorunun cikacagi; video basindan itibaren saniye.';
comment on column public.video_checkpoints.order_index is 'Ayni video icindeki gosterim sirasi; esit saniye olamadigi icin genelde saniye ile ayni sirayi verir.';

create index if not exists idx_video_checkpoints_question
  on public.video_checkpoints (question_id);

drop trigger if exists video_checkpoints_set_updated_at on public.video_checkpoints;
create trigger video_checkpoints_set_updated_at
  before update on public.video_checkpoints
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- tests — konu testi, unite testi, hizli pratik ve deneme sinavi
-- ===========================================================================
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  exam_id uuid references public.exams (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete cascade,
  duration_seconds integer,
  is_published boolean not null default false,
  publish_at timestamptz,
  live_window_start timestamptz,
  live_window_end timestamptz,
  config jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tests_type_check check (type in ('topic_test', 'unit_test', 'quick_practice', 'mock_exam')),
  constraint tests_duration_seconds_check check (duration_seconds is null or duration_seconds > 0),
  constraint tests_live_window_check check (
    live_window_end is null or live_window_start is null or live_window_end > live_window_start
  ),
  -- Deneme sinavi her zaman bir sinav turune (LGS, TYT, KPSS ...) aittir;
  -- siralama ve net hesabi bu bagdan turetilir.
  constraint tests_mock_exam_scope_check check (type <> 'mock_exam' or exam_id is not null)
);

comment on column public.tests.duration_seconds is 'Sinav suresi; null ise sure sinirsizdir.';
comment on column public.tests.publish_at is 'Planlanan yayin zamani; is_published ile birlikte gorunurlugu belirler.';
comment on column public.tests.live_window_start is 'Canli deneme penceresinin baslangici; oncesinde teste girilemez.';
comment on column public.tests.live_window_end is 'Canli deneme penceresinin bitisi; pencere kapandiktan sonra siralama acilir.';
comment on column public.tests.config is 'Teste ozel ayarlar (bolum sureleri, netlestirme kurallari, karistirma vb.).';

create index if not exists idx_tests_type_published
  on public.tests (type, is_published);

create index if not exists idx_tests_topic
  on public.tests (topic_id);

create index if not exists idx_tests_unit
  on public.tests (unit_id);

create index if not exists idx_tests_exam
  on public.tests (exam_id);

-- Ders kapsamli testler ("bu dersin unite testleri") ve ders silindiginde
-- FK denetiminin tests'i bastan sona taramamasi icin.
create index if not exists idx_tests_subject
  on public.tests (subject_id);

drop trigger if exists tests_set_updated_at on public.tests;
create trigger tests_set_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- test_questions — test ile soru arasindaki bag (birlesik anahtar, guncellenmez)
-- ===========================================================================
create table if not exists public.test_questions (
  test_id uuid not null references public.tests (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  order_index integer not null default 0,
  section text,
  created_at timestamptz not null default now(),
  primary key (test_id, question_id)
);

comment on column public.test_questions.section is 'Denemede sorunun ait oldugu ders bolumu (''Turkce'', ''Matematik'' ...); konu testinde null.';
comment on column public.test_questions.order_index is 'Test icindeki soru sirasi.';

create index if not exists idx_test_questions_test_order
  on public.test_questions (test_id, order_index);

-- Bir sorunun hangi testlerde kullanildigini bulmak icin ters yon.
create index if not exists idx_test_questions_question
  on public.test_questions (question_id);


-- ===========================================================================
-- flashcards — bilgi kartlari (editor uretimi veya yanlistan otomatik uretilen)
-- ===========================================================================
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  front text not null,
  back text not null,
  image_url text,
  auto_generated boolean not null default false,
  -- Kaynak soru silinse de kart ogrencide kalir.
  source_question_id uuid references public.questions (id) on delete set null,
  -- Editor kartlarinda null olur; profil silinirse kart sahipsiz kalir ama silinmez.
  created_by uuid references public.profiles (id) on delete set null,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.flashcards.front is 'Kartin on yuzu; markdown + gorsel icerebilir.';
comment on column public.flashcards.back is 'Kartin arka yuzu (cevap); markdown + gorsel icerebilir.';
comment on column public.flashcards.auto_generated is 'true ise ogrencinin yanlis yaptigi sorudan otomatik uretilmis kisisel karttir.';
comment on column public.flashcards.created_by is 'Karti ureten/olusturan kullanici. Otomatik kartlar kisiye ozeldir; editor karti (null) tum ogrencilere aciktir.';
comment on column public.flashcards.is_published is 'Yayin durumu; otomatik kartlar dogrudan sahibine gorunur oldugu icin varsayilan true.';

create index if not exists idx_flashcards_topic
  on public.flashcards (topic_id);

-- Kismi (where auto_generated) DEGIL: created_by bir yabanci anahtar ve profil
-- silindiginde "set null" denetimi tum satirlari tarar. Kismi indeks editor
-- kartlarini kapsamadigi icin o taramayi hizlandirmazdi.
create index if not exists idx_flashcards_created_by
  on public.flashcards (created_by);

-- Ayni ogrencinin ayni yanlisindan ikinci kez kart uretilmesini engeller.
create unique index if not exists uq_flashcards_created_by_source_question
  on public.flashcards (created_by, source_question_id)
  where auto_generated;

-- Soru silindiginde "set null" denetimi icin; null satirlar hicbir soruya
-- referans veremeyecegi icin kismi indeks yeterli.
create index if not exists idx_flashcards_source_question
  on public.flashcards (source_question_id)
  where source_question_id is not null;

drop trigger if exists flashcards_set_updated_at on public.flashcards;
create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();
