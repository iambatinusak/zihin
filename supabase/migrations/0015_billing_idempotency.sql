-- 0015 — Abonelik idempotensinin VERITABANI tarafi.
--
-- Faz 6'da webhook iki kez teslim edildiginde ikinci bir abonelik acilmasini
-- yalnizca uygulama katmani engelliyordu: `grantSubscription` once
-- `payment_ref` ile arama yapiyor, bulamazsa insert ediyordu. Bu bir
-- oku-sonra-yaz yarisidir. iyzico ayni webhook'u milisaniyeler arayla iki kez
-- teslim ederse iki istek de "bulamadim" deyip iki abonelik acabilir.
--
-- Asil kilit `payments (provider, provider_ref)` uzerindeki tekil indekstir ve
-- o zaten var (0009_commerce.sql). Ama `payments` satiri ile `subscriptions`
-- satiri ayri islemlerde yaziliyor; ikinci tabloyu koruyan bir sey yoktu.
-- Burada koyuluyor: bir odeme referansi en fazla BIR abonelik acar.
--
-- Kismi: elle tanimlanan abonelikler (`source = 'manual'`) `payment_ref`
-- tasimaz ve null'lar birbirine esit sayilmadigi icin zaten cakismazdi; yine
-- de niyeti okunur kilmak icin kosul aciktir.

create unique index if not exists idx_subscriptions_payment_ref_unique
  on public.subscriptions (payment_ref)
  where payment_ref is not null;

comment on index public.idx_subscriptions_payment_ref_unique is
  'Bir odeme referansi en fazla bir abonelik acar: iki kez teslim edilen webhook ikinci aboneligi yazamaz.';
