-- ---------------------------------------------------------------------------
-- 0008_gamification.sql - Oyunlastirma
--
-- Rozetler, XP olaylari ve gunluk aktivite ozeti.
--
-- Tasarim kurali: XP'nin tek gercek kaynagi `xp_events` tablosudur.
-- `profiles.xp` yalnizca hizli okuma icin tutulan toplamdir ve gerektiginde
-- bu tablodan yeniden uretilebilir.
-- ---------------------------------------------------------------------------

-- badges ---------------------------------------------------------------------
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  icon text,
  rule jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Kod, rozetin makine tarafindaki kimligidir; isim degisse bile sabit kalir.
  constraint badges_code_key unique (code),
  -- Kural degerlendirici daima bir nesne bekler; dizi/skaler kayit engellenir.
  constraint badges_rule_check check (jsonb_typeof(rule) = 'object')
);

comment on column public.badges.code is
  'Kalici makine kimligi (ornek: first_test). evaluateBadges bu kodla eslesir; isim degisse de degismez.';
comment on column public.badges.icon is
  'lucide-react ikon adi (ornek: trophy). Dosya yolu degil, bilesen adidir.';
comment on column public.badges.rule is
  'Kazanim kurali: {"metric":"tests_completed","threshold":10}. Degerlendirme uygulama katmaninda yapilir.';
comment on column public.badges.order_index is
  'Rozet listesindeki gorsel sira; kucukten buyuge dizilir.';
comment on column public.badges.deleted_at is
  'Yumusak silme. Dolu ise rozet listelerde gosterilmez ama kazanilmis kayitlar korunur.';

-- Rozet listesi daima siraya gore ve silinmemis kayitlarla okunur.
create index if not exists idx_badges_order_index
  on public.badges (order_index)
  where deleted_at is null;

drop trigger if exists badges_set_updated_at on public.badges;
create trigger badges_set_updated_at before update on public.badges
  for each row execute function public.set_updated_at();

-- user_badges ----------------------------------------------------------------
-- Saf birlestirme tablosu: bilesik birincil anahtar, `id` yok.
create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

comment on column public.user_badges.earned_at is
  'Rozetin kazanildigi an. created_at ile ayni olmayabilir: geriye donuk degerlendirmede kayit sonradan yazilir.';

-- Profil sayfasi: kullanicinin rozetleri, en yeni kazanilan ustte.
create index if not exists idx_user_badges_user_id_earned_at
  on public.user_badges (user_id, earned_at desc);

-- Ters yon: bir rozeti kac kullanicinin kazandigi. Bilesik anahtarin ikinci
-- kolonu oldugu icin ayri indekse ihtiyac var.
create index if not exists idx_user_badges_badge_id
  on public.user_badges (badge_id);

-- xp_events ------------------------------------------------------------------
-- Yalnizca ekleme yapilan olay tablosu: updated_at ve trigger yok.
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  -- Sifir puanli olay kayit kirliligidir; duzeltmeler negatif olabilir.
  constraint xp_events_amount_check check (amount <> 0),
  constraint xp_events_reason_check check (reason in (
    'video_completed',
    'test_completed',
    'correct_answer',
    'card_reviewed',
    'block_completed',
    'mock_completed',
    'placement_completed'
  ))
);

comment on table public.xp_events is
  'XP''nin tek gercek kaynagi. Yalnizca ekleme yapilir, hicbir satir guncellenmez; profiles.xp bu tablodan turetilen hizli okuma toplamidir.';
comment on column public.xp_events.amount is
  'Verilen XP. Negatif olabilir (duzeltme/geri alma), sifir olamaz.';
comment on column public.xp_events.ref_type is
  'Puani doguran kaydin turu (video, test, flashcard...). Cok bicimli referans oldugu icin foreign key ile baglanmaz.';
comment on column public.xp_events.ref_id is
  'Puani doguran kaydin kimligi. ref_type ile birlikte anlamlidir; silinen icerik icin kasitli olarak yetim kalabilir.';

-- Kullanicinin XP gecmisi, en yeni ustte.
create index if not exists idx_xp_events_user_id_created_at
  on public.xp_events (user_id, created_at desc);

-- Spec M3 AC: "Tamamlanma bir kez tetiklenir, puan bir kez verilir."
-- Bir video/blok/deneme ayni kullaniciya en fazla bir kez XP kazandirabilir.
-- Tekrar tekrar puan veren olaylar (correct_answer, card_reviewed) kapsam disi.
create unique index if not exists idx_xp_events_once
  on public.xp_events (user_id, reason, ref_id)
  where ref_id is not null and reason in ('video_completed', 'block_completed', 'mock_completed');

-- daily_activity -------------------------------------------------------------
-- Gun + kullanici basina tek satir: bilesik birincil anahtar, `id` yok.
create table if not exists public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  study_seconds integer not null default 0,
  videos_completed integer not null default 0,
  questions_answered integer not null default 0,
  cards_reviewed integer not null default 0,
  blocks_completed integer not null default 0,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint daily_activity_study_seconds_check check (study_seconds >= 0),
  -- Sayaclar yalnizca artar; negatif deger her zaman hatali yazimdir.
  -- xp_earned bilerek disarida: XP duzeltmeleri gunluk toplami negatife
  -- dusurebilir (bkz. xp_events.amount).
  constraint daily_activity_videos_completed_check check (videos_completed >= 0),
  constraint daily_activity_questions_answered_check check (questions_answered >= 0),
  constraint daily_activity_cards_reviewed_check check (cards_reviewed >= 0),
  constraint daily_activity_blocks_completed_check check (blocks_completed >= 0)
);

comment on table public.daily_activity is
  'Haftalik liderlik tablosu ve veli ozeti bu tablodan beslenir; her gun icin tek satir upsert edilir.';
comment on column public.daily_activity.date is
  'Turkiye yerel gunu (public.tr_today()). UTC gunu degildir: gece yarisi kaymasi ogrencinin gunlugunu bolmesin diye.';
comment on column public.daily_activity.study_seconds is
  'O gun toplam calisma suresi (saniye). Oturum bittikce uzerine eklenir.';
comment on column public.daily_activity.xp_earned is
  'O gun kazanilan XP toplami; xp_events''ten denormalize edilir. Liderlik tablosu olaylari taramasin diye tutulur.';

-- Ogrencinin son gunleri ve haftalik ozet sorgulari.
create index if not exists idx_daily_activity_user_id_date
  on public.daily_activity (user_id, date desc);

drop trigger if exists daily_activity_set_updated_at on public.daily_activity;
create trigger daily_activity_set_updated_at before update on public.daily_activity
  for each row execute function public.set_updated_at();
