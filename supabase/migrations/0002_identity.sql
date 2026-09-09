-- ---------------------------------------------------------------------------
-- 0002_identity.sql — Kimlik katmani
--
-- auth.users ile 1:1 eslesen profil tablosu, veli-ogrenci ve ogretmen-ogrenci
-- baglantilari. RLS bu dosyada ACILMAZ; tum politikalar 0011'e aittir.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  role text not null default 'student',
  full_name text,
  display_name text,
  avatar_url text,

  grade text,
  -- exam_id'nin FK'si 0003_curriculum.sql'de eklenir: bu asamada public.exams
  -- henuz yoktur.
  exam_id uuid,
  target_exam_date date,

  daily_minutes integer not null default 60,
  study_days integer[] not null default '{1,2,3,4,5,6}',

  invite_code text unique,

  onboarding_completed boolean not null default false,
  onboarding_step smallint not null default 0,

  leaderboard_opt_in boolean not null default true,
  notification_prefs jsonb not null default
    '{"email_reminders":true,"email_weekly_summary":true,"app_notifications":true}'::jsonb,

  xp integer not null default 0,
  level integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_study_date date,

  suspended_at timestamptz,
  kvkk_consent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('student', 'parent', 'teacher', 'editor', 'admin')),
  constraint profiles_grade_check
    check (grade is null or grade in ('8', '9', '10', '11', '12', 'mezun', 'yetiskin')),
  constraint profiles_daily_minutes_check
    check (daily_minutes between 15 and 720),
  -- En az bir calisma gunu secilmeli ve tum degerler 1..7 araliginda olmali.
  constraint profiles_study_days_check
    check (cardinality(study_days) between 1 and 7
           and study_days <@ array[1, 2, 3, 4, 5, 6, 7]),
  constraint profiles_xp_check check (xp >= 0),
  constraint profiles_level_check check (level between 1 and 50),
  constraint profiles_current_streak_check check (current_streak >= 0),
  constraint profiles_longest_streak_check check (longest_streak >= 0)
);

comment on table public.profiles is
  'auth.users ile 1:1; uygulamanin gordugu tum kullanici alanlari burada.';

comment on column public.profiles.grade is
  'Sinif duzeyi; mezun ve yetiskin (KPSS/DGS/ALES) adaylari icin sayisal degil.';
comment on column public.profiles.exam_id is
  'Ogrencinin hedefledigi sinav. FK 0003_curriculum.sql''de eklenir.';
comment on column public.profiles.target_exam_date is
  'Geri sayim ve plan yogunlugu hesabinda kullanilan hedef sinav tarihi.';
comment on column public.profiles.daily_minutes is
  'Gunluk calisma hedefi (dakika); plan olusturucu bu butceye gore doldurur.';
comment on column public.profiles.study_days is
  'Haftanin calisilan gunleri: 1=Pazartesi ... 7=Pazar.';
comment on column public.profiles.invite_code is
  '8 haneli benzersiz kod; veli baglantisi icin kullanilir.';
comment on column public.profiles.onboarding_step is
  'Yarida birakilan sihirbazin kaldigi adim; kullanici geri dondugunde buradan devam eder.';
comment on column public.profiles.leaderboard_opt_in is
  'Kapaliysa kullanici siralama tablolarinda hic gosterilmez.';
comment on column public.profiles.notification_prefs is
  'Bildirim tercihleri; anahtarlar: email_reminders, email_weekly_summary, app_notifications.';
comment on column public.profiles.xp is
  'Denormalize toplam puan; kaynak kayitlar xp_events tablosunda tutulur.';
comment on column public.profiles.level is
  'xp''den turetilen seviye (1-50); okumayi ucuzlatmak icin denormalize edilmistir.';
comment on column public.profiles.current_streak is
  'Kesintisiz calisilan gun sayisi; last_study_date ile birlikte guncellenir.';
comment on column public.profiles.longest_streak is
  'Simdiye kadarki en uzun seri; rozet kosullarinda kullanilir.';
comment on column public.profiles.last_study_date is
  'Seri hesabinin referans gunu; ayni gun icinde tekrar calismak seriyi artirmaz.';
comment on column public.profiles.suspended_at is
  'Doluysa hesap yonetici tarafindan askiya alinmistir.';
comment on column public.profiles.kvkk_consent_at is
  'KVKK acik riza zamani; bos ise riza henuz alinmamistir.';

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_exam_id on public.profiles (exam_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Davet kodu uretimi
-- ---------------------------------------------------------------------------
-- Karistirilmasi kolay karakterler (0/O, 1/I/L) alfabeden bilerek cikarildi:
-- kod telefonda sozlu olarak paylasilabiliyor.
create or replace function public.generate_invite_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate
        || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    exit when not exists (
      select 1 from public.profiles p where p.invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

comment on function public.generate_invite_code() is
  'Kullanilmayan 8 haneli davet kodu uretir; benzersizlik unique kisit ile de korunur.';

-- ---------------------------------------------------------------------------
-- Kayit sonrasi profil olusturma
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_role text;
begin
  meta_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'student');

  -- raw_user_meta_data kayit isteginde istemciden gelir. Yetkili roller
  -- (teacher/editor/admin) buradan atanamaz, yalnizca yonetici verir.
  -- Taninmayan bir deger de 'student'a duser; boylece bozuk meta veri
  -- yuzunden kayit basarisiz olmaz.
  if meta_role not in ('student', 'parent') then
    meta_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role, invite_code)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    meta_role,
    public.generate_invite_code()
  )
  -- Profil zaten varsa (yeniden deneme, seed) kayit akisini bozma.
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'auth.users insert sonrasi profil satirinin garanti olusmasi icin.';

-- Kayit sonrasi profil satirinin garanti olusmasi icin.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- parent_links — veli / ogrenci baglantisi
-- ---------------------------------------------------------------------------
create table if not exists public.parent_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (parent_id, student_id),
  constraint parent_links_status_check check (status in ('active', 'revoked')),
  -- Kullanici kendi kendisinin velisi olamaz.
  constraint parent_links_self_check check (parent_id <> student_id)
);

comment on table public.parent_links is
  'Veli-ogrenci baglantisi; ogrenci davet kodunu paylasarak kurulur.';
comment on column public.parent_links.status is
  'revoked baglanti gecmiste kurulup iptal edilmistir; silinmez ki tekrar davet izlenebilsin.';

create index if not exists idx_parent_links_student_id on public.parent_links (student_id);

drop trigger if exists parent_links_set_updated_at on public.parent_links;
create trigger parent_links_set_updated_at
  before update on public.parent_links
  for each row execute function public.set_updated_at();

-- Is kurali (spec M1 BR): bir ogrenciye en fazla 2 aktif veli baglanabilir.
-- Uygulama katmanina birakilmaz; dogrudan veritabaninda zorlanir.
create or replace function public.enforce_parent_link_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  -- Iptal edilmis baglantilar sinira dahil degildir.
  if new.status <> 'active' then
    return new;
  end if;

  select count(*)
    into active_count
    from public.parent_links pl
   where pl.student_id = new.student_id
     and pl.status = 'active'
     -- Guncellemede satirin kendisi iki kez sayilmasin.
     and pl.parent_id <> new.parent_id;

  if active_count >= 2 then
    raise exception 'Bir ogrenciye en fazla 2 veli baglanabilir.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_parent_link_limit() is
  'Ogrenci basina en fazla 2 aktif veli baglantisina izin verir.';

-- Yalnizca insert degil: iptal edilmis bir baglantinin tekrar aktiflestirilmesi
-- de siniri asabilirdi.
drop trigger if exists parent_links_enforce_limit on public.parent_links;
create trigger parent_links_enforce_limit
  before insert or update on public.parent_links
  for each row execute function public.enforce_parent_link_limit();

-- ---------------------------------------------------------------------------
-- teacher_assignments — ogretmen / ogrenci atamasi
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_assignments (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (teacher_id, student_id),
  -- Kullanici kendi kendisinin ogretmeni olamaz.
  constraint teacher_assignments_self_check check (teacher_id <> student_id)
);

comment on table public.teacher_assignments is
  'Ogretmenin takip ettigi ogrenciler; kurum/sinif panelinin dayanagi.';

create index if not exists idx_teacher_assignments_student_id
  on public.teacher_assignments (student_id);

drop trigger if exists teacher_assignments_set_updated_at on public.teacher_assignments;
create trigger teacher_assignments_set_updated_at
  before update on public.teacher_assignments
  for each row execute function public.set_updated_at();
