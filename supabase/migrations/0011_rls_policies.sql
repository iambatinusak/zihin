-- ---------------------------------------------------------------------------
-- 0011_rls_policies.sql — Row Level Security: acma + tum politikalar
--
-- Semadaki TEK yetkilendirme dosyasi budur. 0001-0009 tablolari kurar ama
-- RLS'e dokunmaz; 0010 yardimci fonksiyonlari tanimlar; burada RLS acilir ve
-- her tablo icin kural yazilir.
--
-- ---------------------------------------------------------------------------
-- TEMEL KURALLAR
-- ---------------------------------------------------------------------------
-- 1. Her politikada rol ACIKCA yazilir (`to authenticated`). Rol
--    belirtilmezse politika `public` role'e baglanir ve giris yapmamis
--    `anon` istemciyi de kapsar — Supabase'de en sik yapilan sizinti budur.
--    Bu dosyada `anon` icin TEK BIR politika bile yoktur: giris yapmamis
--    istemci hicbir satiri goremez.
--
-- 2. `service_role` icin de politika yazilmaz. O rol BYPASSRLS tasir;
--    politikalar onun icin hic degerlendirilmez. Sunucu tarafi (Server
--    Action / webhook / cron) bu rolle calisir ve tum tabloya erisir.
--
-- 3. Politika ifadelerinde `auth.uid()` daima `(select auth.uid())` olarak
--    sarmalanir. Ciplak cagri STABLE bir fonksiyon oldugu icin planlayici onu
--    satir basina yeniden calistirir; alt sorgu olarak yazildiginda tek sefer
--    calisip InitPlan olarak sabitlenir. attempts gibi milyonlarca satirlik
--    tablolarda bu fark birkac milisaniye ile birkac saniye arasindadir.
--
-- 4. SELECT/DELETE icin `using`, INSERT icin `with check`, UPDATE icin IKISI
--    birden yazilir. UPDATE'te yalniz `using` yazmak, satiri baskasinin
--    uzerine tasimaya (user_id degistirmeye) izin verir.
--
-- 5. Dosya yeniden calistirilabilir: her `create policy` oncesinde
--    `drop policy if exists` vardir.
--
-- ---------------------------------------------------------------------------
-- ERISIM MODELI (ozet)
-- ---------------------------------------------------------------------------
--   Icerik tablolari : yayindaki + silinmemis satirlari her giris yapmis
--                      kullanici okur; yazma yalnizca editor/admin.
--   Kullanici verisi : okuma `can_read_student_data()` (kendisi + aktif veli
--                      + atanmis ogretmen + admin), yazma YALNIZCA sahibi.
--                      Veli asla yazamaz.
--   Puan/para/rozet  : istemci yazamaz. Bu satirlari yalnizca sunucu uretir.
--
-- ---------------------------------------------------------------------------
-- BRIEF'TEN BILINCLI SAPMALAR (hepsi daraltma yonunde)
-- ---------------------------------------------------------------------------
--   a) flashcards: `auto_generated` kartlar ogrenciye ozeldir (bkz. 0004
--      yorumu). Duz "yayinda olan herkes okur" kurali bir ogrencinin yanlis
--      yaptigi konulari tum kullanicilara acardi.
--   b) daily_activity: haftalik liderlik tablosunun kaynagi. Istemci
--      yazabilseydi ogrenci kendi xp_earned degerini yazip tabloyu bozardi.
--      xp_events ile ayni gerekce, o yuzden ayni muamele.
--   c) user_badges: rozet profilde baskasina gorunur; kazanimi sunucu verir.
--   d) payments / subscriptions okumasi: `can_read_student_data()` atanmis
--      ogretmeni de kapsar. Ogretmenin ogrencinin odeme gecmisini gormesi
--      icin bir gerekce yok (KVKK veri minimizasyonu), bu iki tabloda okuma
--      kendisi + aktif veli + admin ile sinirlandi.
--   e) parent_links'e UPDATE politikasi eklendi: 0002 baglantiyi silmez,
--      status='revoked' yapar. Politika yalnizca IPTAL yonune izin verir.
--   f) attempts / video_notes / notifications gibi salt-ekleme tablolarinda
--      anlamsiz komutlar icin politika yazilmadi (bkz. ilgili bolumler).
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1. RLS'i her tabloda ac
-- ===========================================================================
-- RLS acik ama politikasiz bir tablo "hicbir satir gorunmez" demektir; bu
-- guvenli varsayilan bilerek secildi. Politikasi asagida yazilmayan hicbir
-- tablo yok, ama yeni bir tablo eklendiginde de kapali kalir, acik degil.

alter table public.exams                enable row level security;
alter table public.subjects             enable row level security;
alter table public.units                enable row level security;
alter table public.topics               enable row level security;
alter table public.outcomes             enable row level security;

alter table public.videos               enable row level security;
alter table public.video_checkpoints    enable row level security;
alter table public.questions            enable row level security;
alter table public.tests                enable row level security;
alter table public.test_questions       enable row level security;
alter table public.flashcards           enable row level security;

alter table public.profiles             enable row level security;
alter table public.parent_links         enable row level security;
alter table public.teacher_assignments  enable row level security;

alter table public.video_progress       enable row level security;
alter table public.video_notes          enable row level security;
alter table public.test_sessions        enable row level security;
alter table public.attempts             enable row level security;
alter table public.topic_mastery        enable row level security;
alter table public.mastery_history      enable row level security;
alter table public.bookmarked_questions enable row level security;

alter table public.study_plans          enable row level security;
alter table public.study_blocks         enable row level security;
alter table public.card_reviews         enable row level security;

alter table public.help_requests        enable row level security;
alter table public.help_messages        enable row level security;
alter table public.notifications        enable row level security;

alter table public.badges               enable row level security;
alter table public.user_badges          enable row level security;
alter table public.xp_events            enable row level security;
alter table public.daily_activity       enable row level security;

alter table public.packages             enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.payments             enable row level security;

alter table public.job_runs             enable row level security;


-- ===========================================================================
-- 2. Icerik tablolari — mufredat agaci
-- ===========================================================================
-- Kalip: okuma = "editor" VEYA "yayinda + silinmemis"; yazma = yalniz editor.
-- `public.is_editor()` admini de kapsar (0010), bu yuzden politikalarda
-- ayrica `is_admin()` yazilmaz.

-- exams ---------------------------------------------------------------------
drop policy if exists exams_select_published on public.exams;
create policy exams_select_published on public.exams
  for select to authenticated
  using (public.is_editor() or (is_active and deleted_at is null));

drop policy if exists exams_insert_editor on public.exams;
create policy exams_insert_editor on public.exams
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists exams_update_editor on public.exams;
create policy exams_update_editor on public.exams
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists exams_delete_editor on public.exams;
create policy exams_delete_editor on public.exams
  for delete to authenticated
  using (public.is_editor());

-- subjects ------------------------------------------------------------------
-- Yayin bayragi yok: ders/unite/konu/kazanim satirlari mufredat iskeletidir,
-- silinmemis olmalari yeterlidir.
drop policy if exists subjects_select_authenticated on public.subjects;
create policy subjects_select_authenticated on public.subjects
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists subjects_insert_editor on public.subjects;
create policy subjects_insert_editor on public.subjects
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists subjects_update_editor on public.subjects;
create policy subjects_update_editor on public.subjects
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists subjects_delete_editor on public.subjects;
create policy subjects_delete_editor on public.subjects
  for delete to authenticated
  using (public.is_editor());

-- units ---------------------------------------------------------------------
drop policy if exists units_select_authenticated on public.units;
create policy units_select_authenticated on public.units
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists units_insert_editor on public.units;
create policy units_insert_editor on public.units
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists units_update_editor on public.units;
create policy units_update_editor on public.units
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists units_delete_editor on public.units;
create policy units_delete_editor on public.units
  for delete to authenticated
  using (public.is_editor());

-- topics --------------------------------------------------------------------
drop policy if exists topics_select_authenticated on public.topics;
create policy topics_select_authenticated on public.topics
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists topics_insert_editor on public.topics;
create policy topics_insert_editor on public.topics
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists topics_update_editor on public.topics;
create policy topics_update_editor on public.topics
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists topics_delete_editor on public.topics;
create policy topics_delete_editor on public.topics
  for delete to authenticated
  using (public.is_editor());

-- outcomes ------------------------------------------------------------------
drop policy if exists outcomes_select_authenticated on public.outcomes;
create policy outcomes_select_authenticated on public.outcomes
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists outcomes_insert_editor on public.outcomes;
create policy outcomes_insert_editor on public.outcomes
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists outcomes_update_editor on public.outcomes;
create policy outcomes_update_editor on public.outcomes
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists outcomes_delete_editor on public.outcomes;
create policy outcomes_delete_editor on public.outcomes
  for delete to authenticated
  using (public.is_editor());


-- ===========================================================================
-- 3. Icerik tablolari — videolar ve testler
-- ===========================================================================

-- videos --------------------------------------------------------------------
-- Odeme duvari (has_active_subscription) BURADA uygulanmaz: is_free_preview
-- videolarinin ve video listelerinin herkese gorunmesi gerekir. Imzali video
-- URL'i uretimi sunucuda ve abonelik kontrolunden sonra yapilir (bkz. 0012).
drop policy if exists videos_select_published on public.videos;
create policy videos_select_published on public.videos
  for select to authenticated
  using (public.is_editor() or (is_published and deleted_at is null));

drop policy if exists videos_insert_editor on public.videos;
create policy videos_insert_editor on public.videos
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists videos_update_editor on public.videos;
create policy videos_update_editor on public.videos
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists videos_delete_editor on public.videos;
create policy videos_delete_editor on public.videos
  for delete to authenticated
  using (public.is_editor());

-- video_checkpoints ---------------------------------------------------------
drop policy if exists video_checkpoints_select_authenticated on public.video_checkpoints;
create policy video_checkpoints_select_authenticated on public.video_checkpoints
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists video_checkpoints_insert_editor on public.video_checkpoints;
create policy video_checkpoints_insert_editor on public.video_checkpoints
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists video_checkpoints_update_editor on public.video_checkpoints;
create policy video_checkpoints_update_editor on public.video_checkpoints
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists video_checkpoints_delete_editor on public.video_checkpoints;
create policy video_checkpoints_delete_editor on public.video_checkpoints
  for delete to authenticated
  using (public.is_editor());

-- tests ---------------------------------------------------------------------
drop policy if exists tests_select_published on public.tests;
create policy tests_select_published on public.tests
  for select to authenticated
  using (public.is_editor() or (is_published and deleted_at is null));

drop policy if exists tests_insert_editor on public.tests;
create policy tests_insert_editor on public.tests
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists tests_update_editor on public.tests;
create policy tests_update_editor on public.tests
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists tests_delete_editor on public.tests;
create policy tests_delete_editor on public.tests
  for delete to authenticated
  using (public.is_editor());

-- test_questions ------------------------------------------------------------
-- Bu tabloda ne `is_published` ne `deleted_at` var; gorunurluk bagli oldugu
-- testten turetilir. Alt sorgu cagiran haklariyla calistigi icin tests
-- uzerindeki politika da uygulanir, sonuc iki kez suzulur.
drop policy if exists test_questions_select_published_test on public.test_questions;
create policy test_questions_select_published_test on public.test_questions
  for select to authenticated
  using (
    public.is_editor()
    or exists (
      select 1
        from public.tests t
       where t.id = test_questions.test_id
         and t.is_published
         and t.deleted_at is null
    )
  );

drop policy if exists test_questions_insert_editor on public.test_questions;
create policy test_questions_insert_editor on public.test_questions
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists test_questions_update_editor on public.test_questions;
create policy test_questions_update_editor on public.test_questions
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists test_questions_delete_editor on public.test_questions;
create policy test_questions_delete_editor on public.test_questions
  for delete to authenticated
  using (public.is_editor());

-- flashcards ----------------------------------------------------------------
-- Iki farkli kart turu tek tabloda:
--   auto_generated = false -> editor uretimi ORTAK icerik, herkese acik.
--   auto_generated = true  -> ogrencinin yanlisindan uretilmis KISISEL kart.
-- Duz "yayinda olan herkese acik" kurali ikinci grubu da acar ve bir
-- ogrencinin hangi sorularda takildigini tum kullanicilara gosterirdi.
-- Bu yuzden kisisel kartlar yalnizca sahibine gorunur.
drop policy if exists flashcards_select_shared_or_owner on public.flashcards;
create policy flashcards_select_shared_or_owner on public.flashcards
  for select to authenticated
  using (
    public.is_editor()
    or created_by = (select auth.uid())
    or (deleted_at is null and is_published and not auto_generated)
  );

-- Otomatik kartlari da sunucu uretir (yanlis cevap dogrulamasi zaten
-- service_role ile yapiliyor, bkz. bolum 4); istemciye yazma acilmadi.
drop policy if exists flashcards_insert_editor on public.flashcards;
create policy flashcards_insert_editor on public.flashcards
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists flashcards_update_editor on public.flashcards;
create policy flashcards_update_editor on public.flashcards
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists flashcards_delete_editor on public.flashcards;
create policy flashcards_delete_editor on public.flashcards
  for delete to authenticated
  using (public.is_editor());


-- ===========================================================================
-- 4. questions — UC KATMANLI SAVUNMA (semanin en kritik yeri)
-- ===========================================================================
-- SPEC: "questions.correct_option ve explanation ISTEMCIYE TEST SIRASINDA
-- GONDERILMEZ — cevap dogrulamasi Server Action'da yapilir."
--
-- SORUN: RLS satir duzeyindedir, kolon duzeyinde degil. Bir SELECT politikasi
-- "bu satiri gor ama su iki kolonu gorme" diyemez. `select *` yapan bir
-- istemci dogru cevabi da alir; testin tamami degersizlesir.
--
-- COZUM — birbirinden bagimsiz uc katman. Herhangi biri delinse digerleri
-- ayakta kalir:
--
--   KATMAN 1 (yetki) : `revoke select on public.questions from authenticated`.
--                      Tablonun tamamina okuma hakki YALNIZCA service_role'de.
--                      PostgREST'in `/rest/v1/questions` ucu giris yapmis
--                      kullaniciya "permission denied" verir.
--
--   KATMAN 2 (kolon) : Guvenli kolonlar icin ayri ayri kolon bazli
--                      `grant select (...)`. Bir gun Katman 1 yanlislikla
--                      geri alinsa bile correct_option/explanation kolonlarina
--                      hicbir hak verilmemistir.
--
--   KATMAN 3 (arayuz): `public.questions_public` gorunumu. Yalnizca guvenli
--                      kolonlari secer ve `security_invoker = true` ile
--                      tanimlanir; boylece alttaki tablonun RLS'i cagiranin
--                      kimligiyle calismaya devam eder. Gorunum, view
--                      sahibinin haklarini odunc vererek RLS'i baypas eden
--                      klasik tuzaga DUSMEZ.
--
-- Editor paneli de dogru cevabi istemciden okuyamaz; soru duzenleme akisi
-- service_role ile calisan Server Action uzerinden gider. Bu bilincli bir
-- tercihtir: "editorler icin istisna" acmak, ayni ucu ogrenciye de acmanin
-- en kisa yoludur.

-- Satir duzeyi (gorunum bu politika uzerinden suzulur) ----------------------
drop policy if exists questions_select_published on public.questions;
create policy questions_select_published on public.questions
  for select to authenticated
  using (public.is_editor() or (is_published and deleted_at is null));

drop policy if exists questions_insert_editor on public.questions;
create policy questions_insert_editor on public.questions
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists questions_update_editor on public.questions;
create policy questions_update_editor on public.questions
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists questions_delete_editor on public.questions;
create policy questions_delete_editor on public.questions
  for delete to authenticated
  using (public.is_editor());

-- KATMAN 1: tablo geneli okuma hakkini kaldir ------------------------------
-- Supabase `alter default privileges` ile public semasindaki her tabloya
-- anon/authenticated icin tum haklari verir; bu tabloda okuma hakkini geri
-- aliyoruz. Once revoke, sonra kolon bazli grant: sira onemli, ters sirada
-- tablo geneli hak kolon haklarini golgeler.
revoke select on public.questions from anon;
revoke select on public.questions from authenticated;
grant select on public.questions to service_role;

-- KATMAN 2: yalnizca guvenli kolonlar --------------------------------------
-- Listede olmayan kolonlar bilerek disarida:
--   correct_option, explanation  -> cevap; spec geregi istemciye gitmez.
--   solution_video_url           -> cozum videosu de cevabi ele verir.
--   search_vector                -> ic arama yapisi, istemciye bir sey katmaz.
--   deleted_at, updated_at       -> ic defter tutma alanlari.
grant select (
  id,
  topic_id,
  outcome_id,
  type,
  stem,
  options,
  image_url,
  difficulty,
  expected_seconds,
  tags,
  source,
  is_published,
  created_at
) on public.questions to authenticated;

-- KATMAN 3: guvenli gorunum -------------------------------------------------
-- `drop + create`, `create or replace` degil: kolon listesi degistiginde
-- replace hata verir, bu dosyanin yeniden calistirilabilir kalmasi gerekiyor.
drop view if exists public.questions_public;

create view public.questions_public
with (security_invoker = true)
as
  select
    q.id,
    q.topic_id,
    q.outcome_id,
    q.type,
    q.stem,
    q.options,
    q.image_url,
    q.difficulty,
    q.expected_seconds,
    q.tags,
    q.source,
    q.is_published,
    q.created_at
  from public.questions q;

comment on view public.questions_public is
  'Sorularin istemciye acik yuzu: correct_option, explanation ve solution_video_url HARIC tum alanlar. security_invoker=true oldugu icin questions uzerindeki RLS cagiranin kimligiyle uygulanir.';

-- Gorunum de `alter default privileges` yuzunden anon''a acik dogar; kapat.
revoke all on public.questions_public from anon;
grant select on public.questions_public to authenticated, service_role;


-- ===========================================================================
-- 5. profiles — kimlik
-- ===========================================================================
-- Okuma kurali `can_read_student_data()` ile bire bir ayni (kendisi + aktif
-- veli + atanmis ogretmen + admin), tek noktadan degissin diye o fonksiyon
-- cagriliyor. Liderlik tablosunda baskalarinin adini gostermek icin buraya
-- ek bir kural konmadi: siralama sunucuda (service_role) uretilir, boylece
-- leaderboard_opt_in = false olan kullanicilar hicbir sekilde sizmaz.
drop policy if exists profiles_select_self_or_guardian on public.profiles;
create policy profiles_select_self_or_guardian on public.profiles
  for select to authenticated
  using (public.can_read_student_data(id));

-- `using` VE `with check` birlikte: yalniz `using` yazilsaydi kullanici kendi
-- satirinin id'sini degistirip baskasinin satirina donusturebilirdi.
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- INSERT politikasi BILEREK YOK: profil satirini yalnizca 0002'deki
-- `on_auth_user_created` trigger'i (security definer) olusturur. Istemciye
-- insert acmak, kullanicinin kendine istedigi rolde ikinci bir profil
-- yazmasina kapi aralardi.

-- ---------------------------------------------------------------------------
-- Kolon koruma trigger'i
-- ---------------------------------------------------------------------------
-- RLS bir politikada "su kolonlara dokunma" diyemez. profiles_update politikasi
-- kullanicinin KENDI satirini guncellemesine izin verdigi icin, ekstra bir
-- onlem olmadan ogrenci kendi rolunu 'admin' yapabilir, XP'sini istedigi
-- degere cekebilir veya askiya alinmayi kaldirabilir.
--
-- Bu trigger korunan kolonlari sessizce ESKI degerlerine dondurur (hata
-- firlatmaz): istemci diger alanlari guncellemeye devam eder, sadece bu
-- alanlardaki degisiklik yok sayilir.
--
-- `security definer` DEGIL: fonksiyonun `current_user`'i gercekten cagiran
-- rol olarak gormesi gerekiyor. Definer olsaydi herkes sahip (postgres) gibi
-- gorunur ve koruma tamamen devre disi kalirdi.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sunucu tarafi (service_role), migration/seed (postgres) ve yoneticiler
  -- bu alanlari degistirebilmeli: XP'yi veren, seriyi isleyen ve hesabi
  -- askiya alan zaten onlar.
  if current_user in ('service_role', 'supabase_admin', 'postgres')
     or public.is_admin() then
    return new;
  end if;

  new.role           := old.role;            -- yetki yukseltme
  new.xp             := old.xp;              -- puan uydurma
  new.level          := old.level;           -- xp'den turer, elle yazilmaz
  new.current_streak := old.current_streak;  -- seri uydurma
  new.longest_streak := old.longest_streak;  -- rozet kosulu
  new.last_study_date := old.last_study_date; -- seri hesabinin referansi
  new.suspended_at   := old.suspended_at;    -- askiyi kendi kaldirma

  return new;
end;
$$;

comment on function public.protect_profile_fields() is
  'profiles UPDATE''inde rol/puan/seri/askiya alma kolonlarini istemci degisikligine karsi eski degerine dondurur.';

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();


-- ===========================================================================
-- 6. parent_links / teacher_assignments — iliskiler
-- ===========================================================================

-- parent_links --------------------------------------------------------------
drop policy if exists parent_links_select_either_side on public.parent_links;
create policy parent_links_select_either_side on public.parent_links
  for select to authenticated
  using (
    parent_id = (select auth.uid())
    or student_id = (select auth.uid())
    or public.is_admin()
  );

-- Davet kodu dogrulamasi Server Action'da yapilir; veritabani burada yalnizca
-- "baglantiyi kuran kisi gercekten veli mi" sorusunu cevaplar. Ogrenci basina
-- 2 aktif veli siniri 0002'deki trigger ile zorlanir.
drop policy if exists parent_links_insert_parent on public.parent_links;
create policy parent_links_insert_parent on public.parent_links
  for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    and public.auth_role() = 'parent'
  );

-- 0002 baglantiyi silmez, status='revoked' yapar; iptal bir UPDATE'tir.
-- `with check` yalnizca 'revoked' hedefine izin verir: aksi halde veli, ogrenci
-- tarafindan kesilen baglantiyi tek basina 'active' yapip erisimini geri
-- alabilirdi. Yeniden baglanma yeni bir davet kodu ister ve sunucuda yapilir.
drop policy if exists parent_links_update_revoke_only on public.parent_links;
create policy parent_links_update_revoke_only on public.parent_links
  for update to authenticated
  using (
    parent_id = (select auth.uid())
    or student_id = (select auth.uid())
    or public.is_admin()
  )
  with check (status = 'revoked' or public.is_admin());

-- Ogrenci istedigi an veli baglantisini kesebilir (KVKK); veli de kendi
-- tarafindan cikabilir.
drop policy if exists parent_links_delete_either_side on public.parent_links;
create policy parent_links_delete_either_side on public.parent_links
  for delete to authenticated
  using (
    parent_id = (select auth.uid())
    or student_id = (select auth.uid())
    or public.is_admin()
  );

-- teacher_assignments -------------------------------------------------------
-- Atamayi yalnizca kurum yoneticisi yapar; ogretmen kendini bir ogrenciye
-- atayamaz, ogrenci de bir ogretmeni kendine ekleyemez.
drop policy if exists teacher_assignments_select_either_side on public.teacher_assignments;
create policy teacher_assignments_select_either_side on public.teacher_assignments
  for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or student_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists teacher_assignments_insert_admin on public.teacher_assignments;
create policy teacher_assignments_insert_admin on public.teacher_assignments
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists teacher_assignments_update_admin on public.teacher_assignments;
create policy teacher_assignments_update_admin on public.teacher_assignments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists teacher_assignments_delete_admin on public.teacher_assignments;
create policy teacher_assignments_delete_admin on public.teacher_assignments
  for delete to authenticated
  using (public.is_admin());


-- ===========================================================================
-- 7. Kullanici verisi — izleme, cozum, yetkinlik
-- ===========================================================================
-- Okuma her yerde `can_read_student_data(user_id)`; yazma her yerde
-- `user_id = (select auth.uid())`. VELI VE OGRETMEN ASLA YAZAMAZ: okuma
-- hakkini yazma hakkina cevirmek, velinin cocugunun ilerlemesini
-- "duzeltmesine" izin vermek olurdu.

-- video_progress ------------------------------------------------------------
drop policy if exists video_progress_select_owner_or_guardian on public.video_progress;
create policy video_progress_select_owner_or_guardian on public.video_progress
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists video_progress_insert_owner on public.video_progress;
create policy video_progress_insert_owner on public.video_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists video_progress_update_owner on public.video_progress;
create policy video_progress_update_owner on public.video_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists video_progress_delete_owner on public.video_progress;
create policy video_progress_delete_owner on public.video_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- video_notes ---------------------------------------------------------------
-- 0005: "not duzenlenmez, silinip yeniden yazilir" — bu yuzden UPDATE
-- politikasi yok, DELETE var.
drop policy if exists video_notes_select_owner_or_guardian on public.video_notes;
create policy video_notes_select_owner_or_guardian on public.video_notes
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists video_notes_insert_owner on public.video_notes;
create policy video_notes_insert_owner on public.video_notes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists video_notes_delete_owner on public.video_notes;
create policy video_notes_delete_owner on public.video_notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- test_sessions -------------------------------------------------------------
drop policy if exists test_sessions_select_owner_or_guardian on public.test_sessions;
create policy test_sessions_select_owner_or_guardian on public.test_sessions
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists test_sessions_insert_owner on public.test_sessions;
create policy test_sessions_insert_owner on public.test_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists test_sessions_update_owner on public.test_sessions;
create policy test_sessions_update_owner on public.test_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists test_sessions_delete_owner on public.test_sessions;
create policy test_sessions_delete_owner on public.test_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- attempts ------------------------------------------------------------------
-- 0005 bu tabloyu salt-ekleme olarak tanimlar: UPDATE ve DELETE politikasi
-- bilerek yazilmadi. Ogrenci yanlis cozumlerini silebilseydi yetkinlik
-- (topic_mastery) hesabini sessizce sisirirdi; hesap silme ve temizlik
-- sunucuda service_role ile yapilir.
--
-- INSERT'te `user_id` kontrolu tek basina yetmez: test_session_id dolu ise
-- oturumun da cagirana ait olmasi aranir, aksi halde bir ogrenci baskasinin
-- oturumuna cozum yazip ozetini bozabilirdi.
drop policy if exists attempts_select_owner_or_guardian on public.attempts;
create policy attempts_select_owner_or_guardian on public.attempts
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists attempts_insert_owner on public.attempts;
create policy attempts_insert_owner on public.attempts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (test_session_id is null or public.owns_test_session(test_session_id))
  );

-- topic_mastery -------------------------------------------------------------
-- Yetkinlik yalnizca sahibini etkiler (plan sirasi, zayif konu listesi); bir
-- siralamaya girmedigi icin istemci yazmasi serbest birakildi.
drop policy if exists topic_mastery_select_owner_or_guardian on public.topic_mastery;
create policy topic_mastery_select_owner_or_guardian on public.topic_mastery
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists topic_mastery_insert_owner on public.topic_mastery;
create policy topic_mastery_insert_owner on public.topic_mastery
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists topic_mastery_update_owner on public.topic_mastery;
create policy topic_mastery_update_owner on public.topic_mastery
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists topic_mastery_delete_owner on public.topic_mastery;
create policy topic_mastery_delete_owner on public.topic_mastery
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- mastery_history -----------------------------------------------------------
-- Haftalik fotograflar cron isi tarafindan yazilir; istemciye YAZMA YOK.
-- Gecmisi degistirilebilir bir gelisim grafiginin hicbir anlami olmaz.
drop policy if exists mastery_history_select_owner_or_guardian on public.mastery_history;
create policy mastery_history_select_owner_or_guardian on public.mastery_history
  for select to authenticated
  using (public.can_read_student_data(user_id));

-- bookmarked_questions ------------------------------------------------------
drop policy if exists bookmarked_questions_select_owner_or_guardian on public.bookmarked_questions;
create policy bookmarked_questions_select_owner_or_guardian on public.bookmarked_questions
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists bookmarked_questions_insert_owner on public.bookmarked_questions;
create policy bookmarked_questions_insert_owner on public.bookmarked_questions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists bookmarked_questions_update_owner on public.bookmarked_questions;
create policy bookmarked_questions_update_owner on public.bookmarked_questions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bookmarked_questions_delete_owner on public.bookmarked_questions;
create policy bookmarked_questions_delete_owner on public.bookmarked_questions
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ===========================================================================
-- 8. Planlama ve tekrar
-- ===========================================================================

-- study_plans ---------------------------------------------------------------
drop policy if exists study_plans_select_owner_or_guardian on public.study_plans;
create policy study_plans_select_owner_or_guardian on public.study_plans
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists study_plans_insert_owner on public.study_plans;
create policy study_plans_insert_owner on public.study_plans
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists study_plans_update_owner on public.study_plans;
create policy study_plans_update_owner on public.study_plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists study_plans_delete_owner on public.study_plans;
create policy study_plans_delete_owner on public.study_plans
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- study_blocks --------------------------------------------------------------
-- user_id 0006'da tam da bu politika icin denormalize edildi: study_plans'a
-- join atmadan sahiplik dogrulanabiliyor.
drop policy if exists study_blocks_select_owner_or_guardian on public.study_blocks;
create policy study_blocks_select_owner_or_guardian on public.study_blocks
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists study_blocks_insert_owner on public.study_blocks;
create policy study_blocks_insert_owner on public.study_blocks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists study_blocks_update_owner on public.study_blocks;
create policy study_blocks_update_owner on public.study_blocks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists study_blocks_delete_owner on public.study_blocks;
create policy study_blocks_delete_owner on public.study_blocks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- card_reviews --------------------------------------------------------------
drop policy if exists card_reviews_select_owner_or_guardian on public.card_reviews;
create policy card_reviews_select_owner_or_guardian on public.card_reviews
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists card_reviews_insert_owner on public.card_reviews;
create policy card_reviews_insert_owner on public.card_reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists card_reviews_update_owner on public.card_reviews;
create policy card_reviews_update_owner on public.card_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists card_reviews_delete_owner on public.card_reviews;
create policy card_reviews_delete_owner on public.card_reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ===========================================================================
-- 9. Destek — Soru Cozucu ve bildirimler
-- ===========================================================================

-- help_requests -------------------------------------------------------------
-- Ogretmen kuyrugu tum acik sorulari gormek zorunda; bu yuzden okuma hakki
-- ogrencinin kendisi VEYA herhangi bir ogretmendir (is_teacher() admini de
-- kapsar, 0010). Veli cocugunun sordugu soruyu gormez: soru metni ve fotografi
-- ogrencinin ozel calisma alanidir.
drop policy if exists help_requests_select_student_or_teacher on public.help_requests;
create policy help_requests_select_student_or_teacher on public.help_requests
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.is_teacher()
  );

-- Yalnizca ogrenci soru sorar; veli/ogretmen adina soru acamaz.
drop policy if exists help_requests_insert_student on public.help_requests;
create policy help_requests_insert_student on public.help_requests
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.is_student()
  );

-- Ogrenci kendi sorusunu kapatabilir; ogretmen kuyruktan alip yanitlar.
-- `with check` student_id'yi sabitler: soru baska bir ogrenciye devredilemez.
drop policy if exists help_requests_update_student_or_teacher on public.help_requests;
create policy help_requests_update_student_or_teacher on public.help_requests
  for update to authenticated
  using (
    student_id = (select auth.uid())
    or public.is_teacher()
  )
  with check (
    student_id = (select auth.uid())
    or public.is_teacher()
  );

-- help_messages -------------------------------------------------------------
-- Gorunurluk bagli oldugu sorudan turer. Alt sorgu cagiranin haklariyla
-- calisir; help_requests uzerindeki politika oradan da uygulanir.
drop policy if exists help_messages_select_participant on public.help_messages;
create policy help_messages_select_participant on public.help_messages
  for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1
        from public.help_requests hr
       where hr.id = help_messages.request_id
         and hr.student_id = (select auth.uid())
    )
  );

-- Mesaji ya sorunun sahibi ogrenci ya da bir ogretmen yazabilir; sender_id
-- her zaman cagiranin kendisidir (baskasi adina mesaj yazilamaz).
-- Soru basina 5 mesaj siniri 0007'deki trigger ile zorlanir.
drop policy if exists help_messages_insert_participant on public.help_messages;
create policy help_messages_insert_participant on public.help_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_teacher()
      or exists (
        select 1
          from public.help_requests hr
         where hr.id = help_messages.request_id
           and hr.student_id = (select auth.uid())
      )
    )
  );

-- Salt-ekleme tablo (0007): gonderilmis mesaj duzenlenmez ve silinmez.
-- UPDATE/DELETE politikasi bilerek yok.

-- notifications -------------------------------------------------------------
-- Bildirimleri sistem uretir; INSERT politikasi yok. UPDATE yalnizca read_at
-- damgasi icin gerekli, DELETE ise kullanicinin bildirimi listesinden
-- kaldirmasi icin.
drop policy if exists notifications_select_owner_or_guardian on public.notifications;
create policy notifications_select_owner_or_guardian on public.notifications
  for select to authenticated
  using (public.can_read_student_data(user_id));

drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_update_owner on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notifications_delete_owner on public.notifications;
create policy notifications_delete_owner on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ===========================================================================
-- 10. Oyunlastirma
-- ===========================================================================
-- ORTAK GEREKCE: bu bolumdeki uc kullanici tablosunun (xp_events,
-- user_badges, daily_activity) tamami DISARIYA GORUNEN degerler uretir —
-- haftalik liderlik tablosu ve profildeki rozetler. Istemciye yazma acmak,
-- "kendine puan ver" dugmesi koymakla ayni sey olurdu. Uceni de yalnizca
-- sunucu (service_role) yazar; istemci icin sadece okuma politikasi var.

-- badges (icerik tablosu) ---------------------------------------------------
drop policy if exists badges_select_authenticated on public.badges;
create policy badges_select_authenticated on public.badges
  for select to authenticated
  using (public.is_editor() or deleted_at is null);

drop policy if exists badges_insert_editor on public.badges;
create policy badges_insert_editor on public.badges
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists badges_update_editor on public.badges;
create policy badges_update_editor on public.badges
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists badges_delete_editor on public.badges;
create policy badges_delete_editor on public.badges
  for delete to authenticated
  using (public.is_editor());

-- user_badges ---------------------------------------------------------------
drop policy if exists user_badges_select_owner_or_guardian on public.user_badges;
create policy user_badges_select_owner_or_guardian on public.user_badges
  for select to authenticated
  using (public.can_read_student_data(user_id));

-- xp_events -----------------------------------------------------------------
drop policy if exists xp_events_select_owner_or_guardian on public.xp_events;
create policy xp_events_select_owner_or_guardian on public.xp_events
  for select to authenticated
  using (public.can_read_student_data(user_id));

-- daily_activity ------------------------------------------------------------
drop policy if exists daily_activity_select_owner_or_guardian on public.daily_activity;
create policy daily_activity_select_owner_or_guardian on public.daily_activity
  for select to authenticated
  using (public.can_read_student_data(user_id));


-- ===========================================================================
-- 11. Ticaret
-- ===========================================================================

-- packages (icerik tablosu) -------------------------------------------------
-- Fiyat sayfasi giris yapmamis ziyaretciye de gosterilecekse icerik sunucu
-- tarafinda (service_role) cekilir; `anon` icin politika acilmadi.
drop policy if exists packages_select_active on public.packages;
create policy packages_select_active on public.packages
  for select to authenticated
  using (public.is_editor() or (is_active and deleted_at is null));

drop policy if exists packages_insert_editor on public.packages;
create policy packages_insert_editor on public.packages
  for insert to authenticated
  with check (public.is_editor());

drop policy if exists packages_update_editor on public.packages;
create policy packages_update_editor on public.packages
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists packages_delete_editor on public.packages;
create policy packages_delete_editor on public.packages
  for delete to authenticated
  using (public.is_editor());

-- subscriptions / payments --------------------------------------------------
-- Okuma `can_read_student_data()` DEGIL: o fonksiyon atanmis ogretmeni de
-- kapsar ve ogretmenin ogrencinin fatura gecmisini gormesi icin bir gerekce
-- yok (KVKK veri minimizasyonu). Odemeyi yapan veli ile ogrencinin kendisi
-- yeter.
--
-- YAZMA POLITIKASI YOK: abonelik durumunu ve odemeyi yalnizca odeme
-- saglayicisinin webhook'u (service_role) degistirir. Istemciye tek satirlik
-- bir insert hakki verilse, ucretsiz "active" abonelik yazmak bir istek
-- kadar uzakta olurdu.
drop policy if exists subscriptions_select_owner_or_parent on public.subscriptions;
create policy subscriptions_select_owner_or_parent on public.subscriptions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_linked_parent(user_id)
    or public.is_admin()
  );

drop policy if exists payments_select_owner_or_parent on public.payments;
create policy payments_select_owner_or_parent on public.payments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_linked_parent(user_id)
    or public.is_admin()
  );


-- ===========================================================================
-- 12. Sistem — job_runs
-- ===========================================================================
-- Cron kayitlarini yalnizca cron isinin kendisi (service_role) yazar. Admin
-- icin okuma politikasi var: yonetim panelinde is gecmisi gorulebilsin.
drop policy if exists job_runs_select_admin on public.job_runs;
create policy job_runs_select_admin on public.job_runs
  for select to authenticated
  using (public.is_admin());
