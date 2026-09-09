-- ===========================================================================
-- 0014_help_search.sql — Benzer soru aramasi (Soru Cozucu, spec §M11)
-- ===========================================================================
-- Ogrenci soruyu ogretmen kuyruguna gondermeden ONCE, ayni sorunun bankada
-- zaten cozulmus bir esi var mi diye bakariz. Eslesme bulunursa ogretmen
-- zamani harcanmaz; bu, modulun asil degeri.
--
-- NEDEN AYRI BIR SQL FONKSIYONU: siralama `extensions.similarity()` degerine
-- gore yapilmali ve `extensions.%` operatoru trigram indeksini kullanmali
-- (0004'teki idx_questions_stem_trgm). PostgREST bunlarin hicbirini ifade
-- edemez; supabase-js `order('similarity(...)')` yazamaz.
--
-- INDEKS GERCEKTEN KULLANILSIN DIYE IKI SEY GEREKIR:
--   1. WHERE'de `%` OPERATORU bulunmali. `similarity(a,b) >= 0.20` tek basina
--      bir fonksiyon cagrisidir; gin_trgm_ops onu tanimaz ve planlayici tum
--      yayimlanmis sorulari tarayip her satir icin benzerlik hesaplar. Soru
--      bankasi buyudukce her soru sorma islemi yavaslar.
--   2. `%` esigi bizim esigimizle AYNI olmali. Operator oturumdaki
--      `pg_trgm.similarity_threshold` degerine bakar ve varsayilani 0.3'tur —
--      yani 0.20 ile 0.3 arasindaki gercek eslesmeleri sessizce elerdi. Deger
--      fonksiyonun kendi SET yan tumcesiyle 0.20'ye sabitlenir; oturuma
--      bulasmaz ve cagiranin ayarindan etkilenmez.
--
-- GUVENLIK: `security invoker` — arama, cagiran ogrencinin kimligiyle calisir,
-- dolayisiyla public.questions uzerindeki RLS (yalnizca yayimlanmis ve
-- silinmemis sorular) aynen gecerlidir. Kaynak olarak dogrudan tablo degil
-- `public.questions_public` gorunumu okunur: correct_option, explanation ve
-- solution_video_url o gorunumde YOKTUR, yani bu fonksiyon yanlislikla bile
-- cevap sizdiramaz. `deleted_at` de bilerek kullanilmaz — o kolon
-- authenticated rolune verilmemistir (0011, Katman 2); satir suzmesini RLS
-- yapar.
-- ===========================================================================

-- Benzerlik tabani. 0.20 pratikte "ayni sorunun farkli yazimi"ni yakalayacak
-- kadar gevsek, alakasiz soruyu elemeye yetecek kadar sikidir.
create or replace function public.search_similar_questions(
  query text,
  target_topic uuid default null,
  max_results int default 3
)
returns table (
  id uuid,
  topic_id uuid,
  stem text,
  options jsonb,
  image_url text,
  difficulty smallint,
  similarity real
)
language sql
stable
security invoker
set search_path = ''
set pg_trgm.similarity_threshold = '0.2'
as $$
  select
    q.id,
    q.topic_id,
    q.stem,
    q.options,
    q.image_url,
    q.difficulty,
    extensions.similarity(q.stem, query) as similarity
  from public.questions_public q
  where
    -- Bos ya da cok kisa metinle arama yapmanin anlami yok: trigram uc harften
    -- kisa metinde her seye benzer.
    pg_catalog.length(pg_catalog.btrim(coalesce(query, ''))) >= 10
    and q.is_published
    and (target_topic is null or q.topic_id = target_topic)
    -- Indeksi ceken kosul (esik yukarida 0.20'ye sabitlendi).
    and q.stem operator(extensions.%) query
    -- Esigin acik hali: okuyan kisi sayiyi GUC'a bakmadan gorsun.
    and extensions.similarity(q.stem, query) >= 0.20
  order by extensions.similarity(q.stem, query) desc, q.id
  limit least(greatest(coalesce(max_results, 3), 1), 10)
$$;

comment on function public.search_similar_questions(text, uuid, int) is
  'Soru Cozucu icin trigram benzerlik aramasi: verilen metne en cok benzeyen yayimlanmis sorular. Yalnizca guvenli kolonlari doner (questions_public); cevap ve aciklama icermez.';

revoke all on function public.search_similar_questions(text, uuid, int) from public;
grant execute on function public.search_similar_questions(text, uuid, int)
  to authenticated, service_role;
