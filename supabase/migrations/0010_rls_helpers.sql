-- ---------------------------------------------------------------------------
-- 0010_rls_helpers.sql — RLS yardimci fonksiyonlari
--
-- 0011'deki her politika bu fonksiyonlar uzerinden yazilir. Burada tablo
-- olusturulmaz, RLS acilmaz, politika tanimlanmaz.
--
-- NEDEN HEPSI `security definer`:
-- Bu fonksiyonlar public.profiles (ve parent_links, teacher_assignments,
-- subscriptions) tablolarini okur. Ayni tablolar RLS ile korunur ve kendi
-- politikalari da bu fonksiyonlari cagirir. `security definer` olmazsa
-- fonksiyonun icindeki select cagiran kullanicinin hakkiyla calisir, bu da
-- politikayi yeniden tetikler ve PostgreSQL "infinite recursion detected in
-- policy for relation" hatasi verir. Fonksiyon sahibinin hakkiyla calisinca
-- ic sorgu RLS'i atlar, dongu kirilir. Supabase'de RLS'i yanlis kurmanin en
-- yaygin yolu tam olarak budur.
--
-- NEDEN `set search_path = ''`:
-- `security definer` bir fonksiyonda arama yolu cagirandan devralinsaydi,
-- kullanici kendi semasina sahte bir `profiles` koyup fonksiyonu kandirabilirdi.
-- Bos arama yolu bunu imkansiz kilar; bedeli her nesnenin tam nitelikli
-- yazilmasidir (public.profiles, auth.uid(), pg_catalog.now()).
--
-- NEDEN `stable`: fonksiyonlar yalnizca okur ve tek bir ifade icinde ayni
-- sonucu verir; planlayici boylece satir basina tekrar tekrar calistirmak
-- yerine sonucu tasiyabilir.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Rol okuma
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid();
$$;

comment on function public.auth_role() is
  'Oturumdaki kullanicinin profiles.role degeri; giris yoksa null.';


create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Giris yapilmamissa auth_role() null doner; politikada null "yetkisiz"
  -- anlamina gelse de fonksiyon her zaman gercek bir boolean dondursun.
  select coalesce(public.auth_role() = 'admin', false);
$$;

comment on function public.is_admin() is
  'Oturumdaki kullanici admin mi.';


create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Admin, editorun yapabildigi her seyi yapabilir; her politikada ayrica
  -- is_admin() yazmamak icin admin buraya dahildir.
  select coalesce(public.auth_role() in ('editor', 'admin'), false);
$$;

comment on function public.is_editor() is
  'Icerik duzenleme yetkisi: role editor veya admin.';


create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() in ('teacher', 'admin'), false);
$$;

comment on function public.is_teacher() is
  'Ogretmen yetkisi: role teacher veya admin.';


create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Ogrencilik bir yetki degil bir kimlik; admin buraya DAHIL DEGIL, aksi
  -- halde adminin kendi ogrenci verisi varmis gibi davranan politikalar cikar.
  select coalesce(public.auth_role() = 'student', false);
$$;

comment on function public.is_student() is
  'Oturumdaki kullanici ogrenci mi (admin dahil degildir).';


-- ---------------------------------------------------------------------------
-- 2. Ogrenciyle iliski
-- ---------------------------------------------------------------------------
create or replace function public.is_linked_parent(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Iptal edilen baglantilar (status = 'revoked') tabloda kalir ama erisim
  -- vermez; bu yuzden yalnizca 'active' sayilir.
  select exists (
    select 1
      from public.parent_links pl
     where pl.parent_id = auth.uid()
       and pl.student_id = student
       and pl.status = 'active'
  );
$$;

comment on function public.is_linked_parent(uuid) is
  'Oturumdaki kullanici, verilen ogrencinin aktif velisi mi.';


create or replace function public.is_assigned_teacher(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.teacher_assignments ta
     where ta.teacher_id = auth.uid()
       and ta.student_id = student
  );
$$;

comment on function public.is_assigned_teacher(uuid) is
  'Oturumdaki kullanici, verilen ogrenciye atanmis ogretmen mi.';


create or replace function public.can_read_student_data(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Ogrenci verisi tutan HER tablonun okuma politikasi bu tek fonksiyonu
  -- cagirir. Kural (ogrencinin kendisi / aktif veli / atanmis ogretmen /
  -- admin) boylece tek noktadan degisir; 30'dan fazla politikayi tek tek
  -- guncelleme riski ortadan kalkar.
  select coalesce(student = auth.uid(), false)
      or public.is_linked_parent(student)
      or public.is_assigned_teacher(student)
      or public.is_admin();
$$;

comment on function public.can_read_student_data(uuid) is
  'Ogrenci verisini okuma hakki: kendisi, aktif velisi, atanmis ogretmeni veya admin.';


-- ---------------------------------------------------------------------------
-- 3. Abonelik
-- ---------------------------------------------------------------------------
create or replace function public.has_active_subscription(target_exam uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Icerigi ureten ve yoneten ekip odeme duvarina takilmaz.
  select public.is_editor()
      or exists (
        select 1
          from public.subscriptions s
          join public.packages pk on pk.id = s.package_id
         where s.user_id = auth.uid()
           and s.status = 'active'
           -- ends_at gecmisse abonelik bitmistir; 'expired' isaretlemesi
           -- gunluk bir cron isi, bu yuzden statuse guvenmek yetmez.
           and s.ends_at > pg_catalog.now()
           -- packages.exam_id null ise paket sinavdan bagimsizdir ve her
           -- sinavi kapsar; bu yuzden hedef sinavla eslesmis sayilir.
           and (
                target_exam is null
             or pk.exam_id is null
             or pk.exam_id = target_exam
           )
      );
$$;

comment on function public.has_active_subscription(uuid) is
  'Yururlukte abonelik var mi; target_exam verilirse paket o sinavi kapsamali. editor/admin daima true.';


-- ---------------------------------------------------------------------------
-- 4. Sahiplik
-- ---------------------------------------------------------------------------
create or replace function public.owns_test_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- attempts gibi oturuma bagli tablolar kendi user_id'lerini tasisa bile
  -- oturumun sahibi uzerinden dogrulanir; iki kayit birbirinden kopamaz.
  select exists (
    select 1
      from public.test_sessions ts
     where ts.id = session
       and ts.user_id = auth.uid()
  );
$$;

comment on function public.owns_test_session(uuid) is
  'Verilen test oturumu oturumdaki kullaniciya mi ait.';


-- ---------------------------------------------------------------------------
-- 5. Yetkilendirme
-- ---------------------------------------------------------------------------
-- Politikalar hem giris yapmamis (anon) hem yapmis (authenticated) istemcide
-- degerlendirildigi icin execute hakki her iki role de verilir; service_role
-- RLS'i baypas etse de ayni fonksiyonlari uygulama kodundan cagirabilmelidir.
grant execute on function public.auth_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_editor() to anon, authenticated, service_role;
grant execute on function public.is_teacher() to anon, authenticated, service_role;
grant execute on function public.is_student() to anon, authenticated, service_role;
grant execute on function public.is_linked_parent(uuid) to anon, authenticated, service_role;
grant execute on function public.is_assigned_teacher(uuid) to anon, authenticated, service_role;
grant execute on function public.can_read_student_data(uuid) to anon, authenticated, service_role;
grant execute on function public.has_active_subscription(uuid) to anon, authenticated, service_role;
grant execute on function public.owns_test_session(uuid) to anon, authenticated, service_role;
