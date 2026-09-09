-- ---------------------------------------------------------------------------
-- 0007_support.sql — Soru Cozucu (ask-a-question) ve bildirimler
--
-- Ogrenci bir soruyu fotograf ve/veya metin olarak gonderir; ogretmen kuyruguna
-- duser, atanir ve yanitlanir. Yazisma help_messages'ta tutulur ve spec §M11
-- geregi soru basina en fazla 5 mesajla sinirlidir.
-- ---------------------------------------------------------------------------

-- help_requests -------------------------------------------------------------
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Ders/konu silinse bile soru gecmisi durmali: set null.
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  body text,
  image_url text,
  status text not null default 'open',
  -- Ogretmen profili silinirse soru kuyruga geri duser, silinmez.
  assigned_teacher_id uuid references public.profiles (id) on delete set null,
  matched_question_ids uuid[] not null default '{}',
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_requests_status_check
    check (status in ('open', 'answered', 'closed')),
  -- Metin ve gorsel ikisi birden bos olamaz; en az biri dolu olmali.
  constraint help_requests_body_image_url_check
    check (body is not null or image_url is not null)
);

comment on column public.help_requests.status is
  'Soru yasam dongusu: open = ogretmen kuyrugunda, answered = yanitlandi, closed = ogrenci kapatti.';
comment on column public.help_requests.assigned_teacher_id is
  'Soruyu ustlenen ogretmen; kuyruktan alinana kadar null kalir.';
comment on column public.help_requests.matched_question_ids is
  'pg_trgm ile bulunan benzer sorular; ogrenciye "bunlardan biri mi?" diye gosterilir. Dizi oldugu icin FK kurulamaz.';
comment on column public.help_requests.answered_at is
  'Ilk ogretmen yanitinin zamani; yanit suresi (SLA) raporlari bu kolondan hesaplanir.';

create index if not exists idx_help_requests_student_id_created_at
  on public.help_requests (student_id, created_at desc);

-- Ogretmen kuyrugu: yalnizca acik sorular, en eskiden yeniye.
create index if not exists idx_help_requests_status_created_at
  on public.help_requests (status, created_at)
  where status = 'open';

create index if not exists idx_help_requests_assigned_teacher_id
  on public.help_requests (assigned_teacher_id)
  where assigned_teacher_id is not null;

-- Gunluk soru sorma limiti sayimi (student_id + tarih araligi) icin artan sirali.
create index if not exists idx_help_requests_student_id_created_at_asc
  on public.help_requests (student_id, created_at);

create index if not exists idx_help_requests_subject_id
  on public.help_requests (subject_id);

create index if not exists idx_help_requests_topic_id
  on public.help_requests (topic_id);

drop trigger if exists help_requests_set_updated_at on public.help_requests;
create trigger help_requests_set_updated_at
  before update on public.help_requests
  for each row execute function public.set_updated_at();

-- help_messages -------------------------------------------------------------
-- Salt-ekleme (append-only): mesajlar duzenlenmez, bu yuzden updated_at yok.
create table if not exists public.help_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  image_url text,
  created_at timestamptz not null default now(),
  -- Metin ve gorsel ikisi birden bos olamaz; en az biri dolu olmali.
  constraint help_messages_body_image_url_check
    check (body is not null or image_url is not null)
);

comment on column public.help_messages.sender_id is
  'Mesaji yazan profil; hem ogrenci hem atanan ogretmen olabilir.';

create index if not exists idx_help_messages_request_id_created_at
  on public.help_messages (request_id, created_at);

create index if not exists idx_help_messages_sender_id
  on public.help_messages (sender_id);

-- spec §M11: bir soru altinda karsilikli en fazla 5 mesaj gonderilebilir.
create or replace function public.enforce_help_message_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_count integer;
begin
  select count(*)
    into v_message_count
    from public.help_messages
   where request_id = new.request_id;

  if v_message_count >= 5 then
    raise exception 'Bir soru altinda en fazla 5 mesaj gonderilebilir.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_help_message_limit() is
  'help_messages icin soru basina 5 mesaj ust siniri (spec §M11).';

drop trigger if exists help_messages_enforce_limit on public.help_messages;
create trigger help_messages_enforce_limit
  before insert on public.help_messages
  for each row execute function public.enforce_help_message_limit();

-- notifications -------------------------------------------------------------
-- Salt-ekleme (append-only) olay tablosu: bildirim metni hicbir zaman
-- degismez, yalnizca read_at bir kez damgalanir. Ayri bir `updated_at`
-- tutmak read_at'i tekrarlamak olurdu; bu yuzden kolon ve trigger yok.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check
    check (type in (
      'review_due',
      'plan_reminder',
      'help_answered',
      'weekly_summary',
      'subscription_ending',
      'badge_earned',
      'mock_published'
    ))
);

comment on column public.notifications.type is
  'Bildirim turu; istemci ikon/yonlendirme secimini bu degere gore yapar.';
comment on column public.notifications.link is
  'Uygulama ici goreli yol (orn. /plan/2026-09-08); harici URL beklenmez.';
comment on column public.notifications.read_at is
  'Okunma zamani; null ise bildirim okunmamis sayilir (rozet sayaci bunu kullanir).';

create index if not exists idx_notifications_user_id_created_at
  on public.notifications (user_id, created_at desc);

-- Okunmamis bildirim sayaci: cok kucuk kismi indeks.
create index if not exists idx_notifications_user_id_unread
  on public.notifications (user_id)
  where read_at is null;
