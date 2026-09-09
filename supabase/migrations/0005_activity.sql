-- ---------------------------------------------------------------------------
-- 0005_activity.sql — Kullanici aktivitesi: izleme, cozum, yetkinlik.
--
-- Bagimliliklar: 0002 (profiles), 0003 (topics), 0004 (videos, tests, questions).
-- RLS ve politikalar 0011'e aittir; burada acilmaz.
-- ---------------------------------------------------------------------------

-- video_progress -----------------------------------------------------------
-- Kullanici + video basina tek satir: kaldigi yer ve toplam izleme suresi.
create table if not exists public.video_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  last_position_seconds integer not null default 0,
  watch_time_seconds integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id),
  constraint video_progress_last_position_seconds_check check (last_position_seconds >= 0),
  constraint video_progress_watch_time_seconds_check check (watch_time_seconds >= 0)
);

comment on column public.video_progress.last_position_seconds is
  'Videonun kaldigi an; "kaldigin yerden devam et" bu degeri kullanir.';
comment on column public.video_progress.watch_time_seconds is
  'Kumulatif izleme suresi; calisma suresi raporunun kaynagi. Geri sarmada artmaz, ileri atlamada eklenmez.';
comment on column public.video_progress.completed_at is
  'Videonun %90''ina ulasildiginda bir kez yazilir; sonraki izlemelerde guncellenmez.';

create index if not exists idx_video_progress_user_updated_at
  on public.video_progress (user_id, updated_at desc);

-- Video bazli izlenme/tamamlanma raporlari ve FK temizligi icin.
create index if not exists idx_video_progress_video_id
  on public.video_progress (video_id);

drop trigger if exists video_progress_set_updated_at on public.video_progress;
create trigger video_progress_set_updated_at
  before update on public.video_progress
  for each row execute function public.set_updated_at();

-- video_notes --------------------------------------------------------------
-- Videonun belirli bir saniyesine dusulen kisisel not.
-- EKLEME-ONLY: not duzenlenmez, silinip yeniden yazilir. Bu yuzden
-- `updated_at` kolonu ve trigger'i yoktur.
create table if not exists public.video_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  timestamp_seconds integer not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint video_notes_timestamp_seconds_check check (timestamp_seconds >= 0)
);

comment on column public.video_notes.timestamp_seconds is
  'Notun bagli oldugu video ani; nota tiklayinca oynatici bu saniyeye atlar.';

-- Not listesi her zaman kullanici + video kirilimindadir ve zaman sirasi ile gosterilir.
create index if not exists idx_video_notes_user_video_timestamp
  on public.video_notes (user_id, video_id, timestamp_seconds);

-- Video silindiginde cascade denetiminin tabloyu bastan sona taramamasi icin.
create index if not exists idx_video_notes_video_id
  on public.video_notes (video_id);

-- test_sessions ------------------------------------------------------------
-- Bir testin tek bir cozum oturumu. Yarim kalan oturum surdurulebilir.
create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  test_id uuid not null references public.tests (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  question_order uuid[] not null default '{}'::uuid[],
  summary jsonb,
  percentile numeric(5,2),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  is_placement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Yuzdelik dilim disari sizmasin diye aralik sabitlenir; hesaplanmadiysa null kalir.
  constraint test_sessions_percentile_check
    check (percentile is null or percentile between 0 and 100)
);

comment on column public.test_sessions.finished_at is
  'Null ise oturum devam ediyor; bitis aninda summary ile birlikte yazilir.';
comment on column public.test_sessions.question_order is
  'Test basinda karistirilan soru sirasi; oturuma tekrar girildiginde ayni sira kullanilir.';
comment on column public.test_sessions.summary is
  'Bitiste hesaplanan ozet: dogru/yanlis/bos/net ve konu kirilimi. Denormalize — her raporda attempts taranmasin.';
comment on column public.test_sessions.percentile is
  'Yalnizca deneme sinavlarinda ve en az 20 katilimci varsa hesaplanir; aksi halde null.';
comment on column public.test_sessions.expires_at is
  'Yarim kalan oturum 24 saat icinde surdurulebilir (spec §M5); sonrasinda temizlik isi kapatir.';
comment on column public.test_sessions.is_placement is
  'Seviye tespit sinavi mi; ilk yetkinlik degerleri bu oturumdan uretilir.';

create index if not exists idx_test_sessions_user_finished_at
  on public.test_sessions (user_id, finished_at desc);

-- Deneme siralamasi/yuzdelik hesabi test + bitis kirilimindadir. Kismi
-- (where finished_at is not null) DEGIL: test_id bir yabanci anahtar ve test
-- silindiginde cascade denetimi yarim kalmis oturumlari da gormek zorunda.
create index if not exists idx_test_sessions_test_finished_at
  on public.test_sessions (test_id, finished_at);

-- Devam eden oturumu bulmak icin — acik oturum sayisi her zaman cok kucuk.
create index if not exists idx_test_sessions_user_test_active
  on public.test_sessions (user_id, test_id)
  where finished_at is null;

drop trigger if exists test_sessions_set_updated_at on public.test_sessions;
create trigger test_sessions_set_updated_at
  before update on public.test_sessions
  for each row execute function public.set_updated_at();

-- attempts -----------------------------------------------------------------
-- Tek soru cozumu. EKLEME-ONLY: guncellenmez, updated_at ve trigger yoktur.
-- Sistemin en sicak tablosu; indeksleri spec'te sabitlenmistir.
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  test_session_id uuid references public.test_sessions (id) on delete cascade,
  source text not null,
  selected_option text,
  is_correct boolean not null default false,
  time_spent_ms integer not null default 0,
  answered_at timestamptz not null default now(),
  repeat_index integer not null default 0,
  created_at timestamptz not null default now(),
  constraint attempts_source_check check (source in (
    'topic_test', 'unit_test', 'quick_practice', 'mock_exam', 'video_checkpoint', 'flashcard'
  )),
  constraint attempts_time_spent_ms_check check (time_spent_ms >= 0),
  constraint attempts_repeat_index_check check (repeat_index >= 0)
);

comment on column public.attempts.topic_id is
  'Denormalize: yetkinlik sorgusu her seferinde questions''a join atmasin.';
comment on column public.attempts.test_session_id is
  'Oturum disi cozumlerde (video checkpoint, flashcard) null olur.';
comment on column public.attempts.selected_option is
  'Isaretlenen sik; null = bos birakildi (yanlis degil, bos sayilir).';
comment on column public.attempts.time_spent_ms is
  'Soruda gecen sure; hiz analizinde ve sasirtma tespitinde kullanilir.';
comment on column public.attempts.repeat_index is
  'Ayni sorunun kacinci cozumu; 0''dan buyukse yetkinlige 0.3 agirlikla girer.';

-- Yetkinlik hesabinin ana sorgusu: kullanicinin bir konudaki son cozumleri.
create index if not exists idx_attempts_user_topic_answered
  on public.attempts (user_id, topic_id, answered_at desc);

create index if not exists idx_attempts_question
  on public.attempts (question_id);

create index if not exists idx_attempts_session
  on public.attempts (test_session_id);

-- repeat_index hesabi: bu kullanici bu soruyu daha once kac kez cozdu.
create index if not exists idx_attempts_user_question
  on public.attempts (user_id, question_id);

-- topic_mastery ------------------------------------------------------------
-- Kullanici + konu basina guncel yetkinlik. Attempts'ten periyodik hesaplanir.
create table if not exists public.topic_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  mastery smallint not null default 35,
  status text not null default 'unknown',
  attempts_count integer not null default 0,
  last_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id),
  constraint topic_mastery_mastery_check check (mastery between 0 and 100),
  constraint topic_mastery_status_check check (status in ('unknown', 'weak', 'medium', 'strong')),
  constraint topic_mastery_attempts_count_check check (attempts_count >= 0)
);

comment on column public.topic_mastery.mastery is
  '0-100 yetkinlik puani. Veri yokken notr baslangic 35''tir — konu "zayif" damgasi yemesin.';
comment on column public.topic_mastery.status is
  'Puandan turetilen kova; filtreleme ve rozet kurallari puan yerine bunu kullanir.';
comment on column public.topic_mastery.attempts_count is
  'Denormalize cozum sayisi; puanin guvenilirligini (yeterli ornek var mi) belirler.';
comment on column public.topic_mastery.last_calculated_at is
  'Son yeniden hesaplama ani; artimli hesap bu andan sonraki attempts''i okur.';

-- "Zayif konularim" listesi.
create index if not exists idx_topic_mastery_user_status
  on public.topic_mastery (user_id, status);

-- Yetkinlige gore siralama (en dusukten calismaya basla).
create index if not exists idx_topic_mastery_user_mastery
  on public.topic_mastery (user_id, mastery);

drop trigger if exists topic_mastery_set_updated_at on public.topic_mastery;
create trigger topic_mastery_set_updated_at
  before update on public.topic_mastery
  for each row execute function public.set_updated_at();

-- mastery_history ----------------------------------------------------------
-- Haftalik yetkinlik fotografi. EKLEME-ONLY: guncellenmez, trigger yoktur.
create table if not exists public.mastery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  mastery smallint not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint mastery_history_mastery_check check (mastery between 0 and 100)
);

comment on column public.mastery_history.recorded_at is
  'Fotografin ait oldugu an; gelisim grafiginin x ekseni. created_at yazma anidir, ikisi ayrisabilir.';

create index if not exists idx_mastery_history_user_recorded_at
  on public.mastery_history (user_id, recorded_at desc);

-- bookmarked_questions -----------------------------------------------------
-- Yanlis soru defteri: kullanicinin isaretledigi sorular.
create table if not exists public.bookmarked_questions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

comment on column public.bookmarked_questions.note is
  'Kullanicinin kendi notu (nerede takildim); opsiyonel.';

drop trigger if exists bookmarked_questions_set_updated_at on public.bookmarked_questions;
create trigger bookmarked_questions_set_updated_at
  before update on public.bookmarked_questions
  for each row execute function public.set_updated_at();
