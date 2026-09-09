# Zihin — MVP Geliştirme Kontrol Listesi

Kaynak: proje şartnamesi (Bölüm 0–15). Her madde tamamlandıkça işaretlenir.
Durum: `[ ]` yapılmadı · `[~]` kısmen · `[x]` tamam

**Son güncelleme:** Faz 8 tamamlandı. Kalan tek iş: toplu içerik üretimi (297 konu).

---

## Faz 0 — İskelet

- [x] pnpm workspaces + Turborepo monorepo (`apps/web`, `packages/core`, `packages/db`, `packages/ui`)
- [x] Next.js 15 App Router + TypeScript (strict) + React 19
- [x] Tailwind CSS 3.4 + shadcn/ui (29 primitif) + lucide-react
- [x] Koyu/açık tema (`next-themes`), ana renk `NEXT_PUBLIC_BRAND_HUE` ile
- [x] Supabase yerel yapılandırması (`supabase/config.toml`, storage bucket'ları, e-posta şablonları)
- [x] Auth boilerplate: browser/server/admin istemcileri, `middleware.ts` oturum tazeleme
- [x] `requireUser` / `requireRole` / `assertRole` yardımcıları
- [x] Server Action zarfı: Zod doğrulama + `{ ok, data | error }` (`lib/action.ts`)
- [x] i18n altyapısı, tek dil `tr` (`i18n/tr.json`, `lib/i18n.ts`)
- [x] `.env.example` + Zod ile doğrulanan `lib/env.ts`
- [x] Landing sayfası (`/`)
- [x] PWA manifest
- [x] ESLint + Prettier + Husky pre-commit + lint-staged
- [x] CI (lint · typecheck · test · build · SQL lint)
- [x] `pnpm setup` tek komut kurulum betiği
- [x] README taslağı

## Faz 1 — Şema + Seed + Core

### Migration'lar

- [x] Uzantılar (`pgcrypto`, `pg_trgm`, `pg_cron`, `unaccent`)
- [x] `updated_at` trigger fonksiyonu + soft delete kolonları
- [x] Kimlik: `profiles`, `parent_links`, `teacher_assignments`
- [x] Müfredat: `exams`, `subjects`, `units`, `topics`, `outcomes`
- [x] İçerik: `videos`, `video_checkpoints`, `questions`, `tests`, `test_questions`, `flashcards`
- [x] Aktivite: `video_progress`, `video_notes`, `test_sessions`, `attempts`, `topic_mastery`, `mastery_history`, `bookmarked_questions`
- [x] Program: `study_plans`, `study_blocks`
- [x] Tekrar: `card_reviews`
- [x] Soru sor: `help_requests`, `help_messages`
- [x] Oyunlaştırma: `badges`, `user_badges`, `xp_events`, `daily_activity`
- [x] Ticari: `packages`, `subscriptions`, `payments`
- [x] Bildirim: `notifications`
- [x] Operasyon: `job_runs`
- [x] Zorunlu indeksler (attempts, card_reviews, study_blocks, questions GIN, test_sessions, subscriptions)
- [x] `questions.search_vector` tsvector trigger + `pg_trgm` benzerlik indeksi
- [x] Storage bucket politikaları

### RLS

- [x] Her tabloda `enable row level security`
- [x] `profiles`: kendi satırı; parent → `parent_links`; teacher → `teacher_assignments`; admin hepsi
- [x] İçerik tabloları: `is_published` okuma, yazma `editor|admin`
- [x] Kullanıcı verisi: `user_id = auth.uid()` (+ parent/teacher/admin okuma)
- [x] `questions.correct_option`/`explanation` test sırasında istemciye gitmez (güvenli view + server-side doğrulama)
- [x] Yardımcı SQL fonksiyonları: `auth_role()`, `is_admin()`, `is_linked_parent()`, `is_assigned_teacher()`

### `packages/core`

- [x] `calculateMastery` — recency + zorluk + hız + güven
- [x] `rankPriorityTopics`
- [x] `generateStudyPlan` — bin-packing, haftalık mini deneme, sıkışma uyarısı
- [x] `sm2` — SM-2 aralıklı tekrar
- [x] `calculateNet` — sınav tipine göre yanlış katsayısı
- [x] `calculateMockSummary`, `calculatePercentile`
- [x] `computeXp`, `updateStreak`, `evaluateBadges`, `levelForXp`
- [x] Vitest: %90+ satır kapsaması, sınır durumları

### Seed

- [x] 4 sınav (LGS, TYT, AYT, KPSS-Lisans)
- [x] Dersler → ≥3 ünite → ≥3 konu (gerçek MEB/ÖSYM başlıkları)
- [~] Konu başına hafıza notu (≥5 cümle, gerçek teknik) — 3/297 konu
- [~] Konu başına 2 video + video başına 2 checkpoint sorusu — 3/297 konu
- [~] Konu başına 12 özgün soru (zorluk dağılımı 2/4/4/2) — 3/297 konu
- [~] Konu başına 5 hafıza kartı — 3/297 konu
- [~] Konu başına `topic_test`, ünite başına `unit_test` — içerik olan konular için otomatik
- [x] 2 deneme (TYT 120/165dk, LGS 90/155dk)
- [x] 7 rozet, 4 paket
- [x] 5 test kullanıcısı + öğrenci için 2 haftalık gerçekçi aktivite geçmişi

### Doğrulama araçları (Docker'sız)

- [x] Gömülü PostgreSQL 17 koşumu (`packages/db/scripts/lib/harness.mjs`)
- [x] `pnpm --filter @zihin/db verify` — 13 migration + RLS kapsam denetimi
- [x] `pnpm --filter @zihin/db smoke` — şema davranış testleri (16 kontrol)
- [x] `pnpm --filter @zihin/db test:rls` — RLS rol matrisi (25 iddia)
- [x] `pnpm --filter @zihin/db test:seed` — seed uçtan uca (31 kontrol)
- [x] `pnpm --filter @zihin/db check:content` — içerik kural denetimi
- [x] `pnpm --filter @zihin/db db:types` — şemadan `Database` tipi üretimi

## Faz 2 — Kimlik & Onboarding & Katalog (M1, M2)

- [x] Kayıt (öğrenci/veli), giriş, çıkış
- [x] E-posta doğrulama akışı + doğrulanmamışken içerik erişimi yok
- [x] Şifremi unuttum / sıfırlama
- [x] Google OAuth
- [x] Onboarding sihirbazı 6 adım, kaldığı adımdan devam
- [x] KVKK açık rıza metni
- [x] Veli davet kodu ile bağlanma (öğrenci başına en fazla 2 veli)
- [x] Ders ağacı sayfaları (`/dersler` → ders → ünite → konu)
- [x] Konu sayfası sekmeleri (video · hafıza notu · testler · kartlar)

## Faz 3 — Video & Test (M3, M4, M5)

- [x] `VideoProvider` arayüzü (supabase | bunny) + signed URL (4 saat)
- [x] Oynatıcı: 0.75x–2x hız, ±10 sn, klavye kısayolları
- [x] İlerleme kaydı (debounce 10 sn), kaldığı yerden devam ±10 sn
- [x] `watch_time_seconds` kümülatif
- [x] %90'da tamamlandı, puan yalnızca bir kez
- [x] Zaman damgalı not alma
- [x] Checkpoint overlay: durdur → soru → geri bildirim → devam; "Atla"
- [x] Test motoru: `topic_test`, `unit_test`, `quick_practice`
- [x] Anlık cevap kaydı, 24 saat oturum devamı
- [x] Soru sırası session'da sabit, şıklar karıştırılmaz
- [x] Sonuç ekranı: kırılım, açıklama, çözüm videosu, işaretleme

## Faz 4 — Yetkinlik & Program & Kartlar (M6, M7, M8, M9)

- [x] Her attempt sonrası mastery yeniden hesabı (< 2 sn)
- [x] Tekrar çözülen soru ağırlığı 0.3
- [x] Panel: ısı haritası, öncelikli 5 konu, radar, 8 haftalık zaman serisi
- [x] Seviye tespit sınavı (20–30 soru, 30 dk, atlanabilir)
- [x] Program üretimi + haftalık takvim UI + sürükle-bırak + şablonlar
- [x] Bugün görünümü
- [x] Hafıza kartları + yanlıştan otomatik kart
- [x] SM-2 tekrar kuyruğu, günlük 50 limit
- [x] Cron: haftalık plan (Pazar 03:00), mastery snapshot, hatırlatma

## Faz 5 — Deneme & Soru Sor & Veli (M10, M11, M12)

- [x] Deneme tanımı (dersler, soru sayıları, süre, canlı pencere)
- [x] Sınav ekranı: sayaç, ders sekmeleri, navigasyon ızgarası, otomatik teslim
- [x] Net hesabı (TYT/AYT/KPSS/DGS/ALES ÷4, LGS ÷3)
- [x] Yüzdelik dilim (≥20 kullanıcı şartı)
- [x] Soru sor: görsel yükleme + benzer soru araması (`pg_trgm`)
- [x] Öğretmen yanıt paneli + sohbet (en fazla 5 mesaj)
- [x] Günlük soru limiti (paket bazlı)
- [x] Veli paneli: haftalık özet, zayıf konular, denemeler
- [x] Veli hiçbir içeriği izleyemez/çözemez

## Faz 6 — Oyunlaştırma & Abonelik & Bildirim (M13, M14, M16)

- [x] XP olayları ve seviye tablosu (1–50)
- [x] Streak (UTC+3 gün sınırı, ≥15 dk)
- [x] 7 rozet + kazanım tetikleyicileri
- [x] Haftalık liderlik tablosu (takma ad, opt-out)
- [x] Paketler + erişim kontrolü + ücretsiz önizleme
- [x] iyzico sandbox checkout + webhook
- [x] Admin manuel abonelik
- [x] Abonelik bitişi 7 gün önce e-posta
- [x] `notifications` + zil ikonu
- [x] E-posta şablonları (Resend) + bildirim tercihleri sayfası

## Faz 7 — Admin & İçerik Paneli (M15)

- [x] Müfredat ağacı CRUD + sürükle-bırak sıralama
- [x] Video yönetimi + zaman çubuğunda checkpoint ekleme
- [x] Soru editörü (markdown + KaTeX önizleme, görsel, şıklar)
- [x] Toplu soru import (CSV/JSON) + satır bazlı hata raporu
- [x] Test/deneme oluşturucu
- [x] Hafıza kartı editörü
- [x] Kullanıcı yönetimi (rol, abonelik, askıya alma, `anonymizeUser`)
- [x] Admin dashboard (aktif kullanıcı, video, soru, gelir)

## Dağıtım — Docker (Faz 8 ek)

- [x] `docker/docker-compose.yml` — tüm yığın tek komutla (db · auth · rest · storage ·
      nginx ağ geçidi · migrate · web · mailpit · studio)
- [x] Portlar 14xxx: 14000 web · 14001 API · 14002 db · 14003 studio · 14004/14005 mail
- [x] `scripts/generate-keys.mjs` — her kurulum için özgün JWT sırrı + anon/service anahtarı
- [x] `packages/db/scripts/migrate.mjs` — kalıcı veritabanına idempotent migration + seed,
      `schema_migrations` ile takip, değişmiş dosya tespiti
- [x] `pnpm --filter @zihin/db test:migrate` — migration koşucusu gerçek Postgres'e karşı
      test ediliyor (8 iddia, iki kez koşup idempotency kanıtlanıyor)
- [x] Next.js standalone çıktı (yalnızca `DOCKER_BUILD=1` iken; Windows'ta symlink kırıyor)
- [x] `docker/README.md` — VM kurulumu, sorun giderme, üretim öncesi kontrol listesi
- [ ] Yığın gerçek bir Docker ortamında çalıştırılıp doğrulanmadı (bu makinede Docker yok)

## Faz 8 — Kalite kapısı

- [~] E2E 1: kayıt → onboarding → seviye tespit → öncelikli konular — **yazıldı, çalıştırılmadı** (Docker yok)
- [~] E2E 2: video → checkpoint → test → sonuç → mastery → kart tekrarı — **yazıldı, çalıştırılmadı**
- [~] E2E 3: import → deneme oluştur → çöz → net/yüzdelik → veli paneli — **yazıldı, çalıştırılmadı**
- [x] RLS entegrasyon testleri
- [~] Performans: konu sayfası LCP < 2.5 sn (ölçülemedi — arka uç gerekir), cevap
  kaydı < 300 ms (ölçülemedi — arka uç gerekir), mastery < 200 ms **(ölçüldü:
  medyan 0,007 ms; bütçe testi `packages/core/src/performance.test.ts`)**
  - [x] ~~Markdown yığını sorunu~~ — kapandı. Markdown zaten sunucuda render
        ediliyordu; `/dersler/.../[topic]` 163 → 141 kB, `/video/[id]` 207 → 182 kB.
  - [x] **Asıl sorun buymuş:** `lib/i18n.ts` 24 bölüm dosyasının tamamını (94 kB)
        statik import ediyordu ve her Client Component onu istemciye çekiyordu.
        Dar sözlükler (`lib/i18n/<bölüm>`) + `@supabase/supabase-js`in tıklamaya
        ertelenmesi 37 rotada toplam ~1,28 MB düşürdü; 200 kB üstünde tek rota
        `/program` (dnd-kit, rotaya özel) kaldı. Gerileme bekçisi:
        `apps/web/lib/i18n/scope.test.ts`.
- [x] README finali (kurulum + mimari şeması + env açıklaması + Docker)
- [x] Tek komutla ayağa kalkıyor — `docker compose up -d` (birincil) ya da `pnpm setup && pnpm dev`

## Kesişen gereksinimler

- [x] Her tablo için RLS politikası
- [x] Her endpoint için Zod şeması
- [x] Her kritik core fonksiyonu için ≥1 test
- [x] Kullanıcıya görünen tüm metinler Türkçe, kod İngilizce
- [x] Marka bağımsızlığı: "Doping Hafıza" adı/logosu/içeriği kullanılmıyor (kaynak tarandı, temiz)
- [x] Gizli anahtar koda gömülmüyor (tarandı; `scripts/generate-keys.mjs` her kurulumda üretir)
- [x] Markdown sanitize (`rehype-sanitize`), XSS koruması
- [x] Rate limit (soru sor 3/gün · login 10/dk — `lib/rate-limit.ts`, 9 test)
- [x] Dosya yükleme tip/boyut kontrolü (sunucu tarafı; anahtar kullanıcının kendi klasörüne zorlanıyor)
- [x] KVKK: açık rıza, `anonymizeUser`
- [x] Erişilebilirlik: WCAG AA kontrast, form etiketleri, odak halkaları, klavye
- [~] Sentry + `job_runs` cron logu — `job_runs` tam, Sentry kurulmadı (opsiyonel)
- [x] `IAssistantService` arayüzü boş bırakıldı (MVP dışı) — `lib/assistant/index.ts`

## MVP dışı (kasıtlı olarak yapılmadı)

- [ ] ~~Canlı ders / birebir görüntülü ders~~
- [ ] ~~LLM sohbet asistanı~~ (yalnızca arayüz)
- [ ] ~~Mobil native uygulama~~ (PWA var)
- [ ] ~~Oyun formatlı serüven içerikler~~
- [ ] ~~Sosyal özellikler~~
- [ ] ~~Çoklu dil~~ (altyapı var, tek dil)
- [ ] ~~Video DRM~~ (signed URL var)
