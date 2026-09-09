# Zihin

**Hafıza teknikli sınav hazırlık platformu.** Video ders, video içi interaktif soru, konu bazlı
yetkinlik ölçümü, kişiye özel çalışma programı ve aralıklı tekrar bir arada.

Desteklenen sınavlar: **LGS · YKS (TYT/AYT) · KPSS · DGS · ALES**

> Marka adı `NEXT_PUBLIC_APP_NAME` ile değiştirilebilir. Bu ürün özgündür; hiçbir mevcut
> platformun adı, logosu, sloganı veya içeriği kullanılmamıştır.

---

## Hızlı başlangıç

**En kolay yol — Docker (önerilen).** Uygulama, Supabase, veritabanı ve e-posta yakalayıcı
tek komutla ayağa kalkar. Portların hepsi 14xxx aralığındadır.

```bash
cp docker/.env.example docker/.env
node scripts/generate-keys.mjs --write
docker compose -f docker/docker-compose.yml up -d
```

Ardından http://localhost:14000 adresini açın ve `ogrenci@test.com` / `Test1234!` ile girin.
Giden e-postalar (doğrulama, şifre sıfırlama) http://localhost:14004 adresinde birikir.

Ayrıntılar, VM kurulumu ve sorun giderme: **[docker/README.md](docker/README.md)**

### Docker olmadan (yerel geliştirme)

```bash
git clone <repo> && cd zihin
npm i -g pnpm@9.15.4          # pnpm yoksa
pnpm setup                    # bağımlılıklar + Supabase + migration + seed
pnpm dev                      # http://localhost:3000
```

`pnpm setup` şunları yapar: araçları doğrular → `.env.local` üretir → `pnpm install` →
`supabase start` → çıkan anahtarları `.env.local`'e yazar → `supabase db reset` (migration + seed).

### Gereksinimler

| Araç           | Sürüm                 | Not                           |
| -------------- | --------------------- | ----------------------------- |
| Node.js        | ≥ 20.11 (22 önerilir) |                               |
| pnpm           | 9.15.4                | `npm i -g pnpm@9.15.4`        |
| Docker Desktop | güncel                | `supabase start` için zorunlu |
| Supabase CLI   | güncel                | `npm i -g supabase`           |

Docker kuramıyorsanız bulut bir Supabase projesi açıp `.env.local` içindeki
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY`
değerlerini elle girin, ardından `supabase db push` ve `pnpm seed` çalıştırın.

### Test hesapları (seed sonrası)

| Rol      | E-posta             | Şifre       |
| -------- | ------------------- | ----------- |
| Öğrenci  | `ogrenci@test.com`  | `Test1234!` |
| Veli     | `veli@test.com`     | `Test1234!` |
| Öğretmen | `ogretmen@test.com` | `Test1234!` |
| Editör   | `editor@test.com`   | `Test1234!` |
| Yönetici | `admin@test.com`    | `Test1234!` |

Öğrenci hesabında 2 haftalık gerçekçi aktivite geçmişi vardır; paneller boş gelmez.

### Yerel servisler

| Servis                    | Adres                                                     |
| ------------------------- | --------------------------------------------------------- |
| Uygulama                  | http://localhost:3000                                     |
| Supabase API              | http://127.0.0.1:54321                                    |
| Supabase Studio           | http://127.0.0.1:54323                                    |
| E-posta kutusu (Inbucket) | http://127.0.0.1:54324                                    |
| Postgres                  | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

---

## Mimari

```
                    ┌──────────────────────────────────────────┐
   Tarayıcı  ─────► │  apps/web — Next.js 15 (App Router)      │
                    │                                          │
                    │  RSC sayfaları     Server Actions        │
                    │  TanStack Query    Route Handlers        │
                    │      │                    │              │
                    └──────┼────────────────────┼──────────────┘
                           │                    │
                  ┌────────▼────────┐  ┌────────▼─────────┐
                  │ packages/core   │  │ packages/db      │
                  │ saf iş mantığı  │  │ migration + seed │
                  │ · mastery       │  │ · RLS politikası │
                  │ · studyPlan     │  │ · tip üretimi    │
                  │ · sm2           │  └────────┬─────────┘
                  │ · scoring       │           │
                  │ · gamification  │           │
                  └─────────────────┘           │
                                       ┌────────▼─────────┐
                                       │    Supabase      │
                                       │ Postgres + RLS   │
                                       │ Auth · Storage   │
                                       │ Edge Functions   │
                                       │ pg_cron          │
                                       └────────┬─────────┘
                                                │
                   ┌────────────────────────────┼────────────────────┐
                   │                            │                    │
            ┌──────▼──────┐            ┌────────▼──────┐    ┌────────▼──────┐
            │ Resend      │            │ iyzico        │    │ Video sağlayıcı│
            │ e-posta     │            │ (sandbox)     │    │ Supabase/Bunny │
            └─────────────┘            └───────────────┘    └───────────────┘
```

**Katman kuralı:** iş kuralları `packages/core` içinde saf TypeScript olarak yaşar — framework,
veritabanı ve ağ bağımsız, dolayısıyla doğrudan test edilebilir. `apps/web` yalnızca veriyi
toplar, core'a verir, sonucu yazar ve gösterir.

**Yetki kuralı:** her yetki kontrolü iki yerde yapılır — veritabanında RLS, uygulamada
`requireRole()` / `assertRole()`. Birinin atlanması diğerini devre dışı bırakmaz.

### Klasör yapısı

```
apps/web/
  app/
    (auth)/        login · register · verify · forgot-password · onboarding
    (student)/     dashboard · program · dersler · video · test · sonuc · panel
                   kartlar · deneme · soru-sor · rozetler · ayarlar
    (parent)/      veli
    (teacher)/     ogretmen
    (admin)/       admin/*
    api/           webhooks (iyzico) · cron tetikleyicileri
  components/      özellik bazlı bileşenler
  lib/             supabase istemcileri · auth · action zarfı · env · i18n
  i18n/tr.json     kullanıcıya görünen tüm metinler

packages/
  core/            mastery · studyPlan · spacedRepetition · scoring · gamification (+ testler)
  db/              supabase/migrations · seed · üretilen tipler
  ui/              paylaşılan shadcn/ui bileşenleri + tasarım belirteçleri

supabase/
  migrations/      sıralı SQL şema dosyaları
  functions/       edge functions
  config.toml      yerel yığın yapılandırması
```

---

## Ortam değişkenleri

Tümü `.env.example` içinde açıklamalıdır. Özet:

| Değişken                        | Zorunlu | Açıklama                                              |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`          | –       | Kullanıcıya görünen marka adı. Varsayılan `Zihin`.    |
| `NEXT_PUBLIC_APP_URL`           | ✔       | Tam adres; e-posta bağlantıları ve OAuth dönüşü için. |
| `NEXT_PUBLIC_BRAND_HUE`         | –       | Ana renk tonu (0–360). Tema buradan türetilir.        |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✔       | Supabase API adresi.                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔       | Tarayıcıya gider; koruma RLS'tedir.                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✔       | **Yalnızca sunucu.** RLS'i bypass eder.               |
| `SUPABASE_DB_URL`               | –       | Migration/seed için doğrudan Postgres bağlantısı.     |
| `RESEND_API_KEY`                | –       | Boşsa e-postalar konsola yazılır.                     |
| `EMAIL_FROM`                    | –       | Gönderen adresi.                                      |
| `IYZICO_*`                      | –       | Boşsa ödeme sahte sağlayıcı ile çalışır.              |
| `VIDEO_PROVIDER`                | –       | `supabase` \| `bunny`.                                |
| `BUNNY_*`                       | –       | `VIDEO_PROVIDER=bunny` ise gerekli.                   |
| `CRON_SECRET`                   | ✔       | `/api/cron/*` uçlarını korur.                         |
| `SENTRY_DSN`                    | –       | Hata izleme.                                          |

> Gizli anahtarlar koda gömülmez ve `.env.local` sürüm kontrolüne girmez.

---

## Komutlar

| Komut                 | Ne yapar                       |
| --------------------- | ------------------------------ |
| `pnpm setup`          | Sıfırdan tam kurulum           |
| `pnpm dev`            | Geliştirme sunucusu            |
| `pnpm build`          | Üretim derlemesi               |
| `pnpm lint`           | ESLint                         |
| `pnpm typecheck`      | TypeScript                     |
| `pnpm test`           | Vitest (core + web birim)      |
| `pnpm test:e2e`       | Playwright                     |
| `pnpm format`         | Prettier                       |
| `pnpm db:reset`       | Şemayı sıfırla + seed          |
| `pnpm db:types`       | Şemadan `Database` tipini üret |
| `pnpm seed`           | Yalnızca seed                  |
| `pnpm export:content` | İçerik dışa aktarımı           |

### Docker'sız veritabanı doğrulama

Şema, RLS ve seed; gömülü bir PostgreSQL 17 örneğine karşı Docker olmadan doğrulanabilir.
Her komut kendi geçici veritabanını kurar, migration'ları uygular ve sonunda temizler.

| Komut                                    | Ne doğrular                                                  |
| ---------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter @zihin/db verify`         | 13 migration uygulanıyor; her tabloda RLS ve ≥1 politika var |
| `pnpm --filter @zihin/db verify:inspect` | Yukarıdakine ek olarak tablo/indeks/fonksiyon/trigger dökümü |
| `pnpm --filter @zihin/db smoke`          | Şema davranışı: kayıt tetikleyicisi, limitler, cascade'ler   |
| `pnpm --filter @zihin/db test:rls`       | Rol matrisi: kim neyi okuyabilir/yazabilir (25 iddia)        |
| `pnpm --filter @zihin/db test:seed`      | Seed'i uçtan uca çalıştırır ve sonucu denetler               |
| `pnpm --filter @zihin/db check:content`  | Seed içeriğinin şartname kurallarına uygunluğu               |

> **Sınırlar.** Bu koşum `SQL_ASCII` kodlama ve `C` sıralama düzeni kullanır (Türkçe Windows
> yerel ayarı `initdb`'nin UTF-8 ile başlamasına izin vermiyor), `pg_cron` içermez ve
> Auth/Storage şemalarını yalnızca taklit eder. Üretimde Supabase UTF-8'dir. Uygulamanın
> kendisini çalıştırmak (GoTrue + PostgREST) hâlâ `supabase start` ve Docker gerektirir.

---

## Geliştirme durumu

Faz bazlı ilerleme ve madde madde kapsam için **[CHECKLIST.md](CHECKLIST.md)** dosyasına bakın.
Koda dokunmadan önce **[CONVENTIONS.md](CONVENTIONS.md)** okunur: dil, Server Action sözleşmesi,
yetki, şema, stil ve test kuralları oradadır.

| Faz | Kapsam                              | Durum |
| --- | ----------------------------------- | ----- |
| 0   | İskelet, auth boilerplate, CI       | ✅    |
| 1   | Şema + RLS + seed + `packages/core` | ⏳    |
| 2   | Kimlik, onboarding, katalog         | ⏳    |
| 3   | Video, checkpoint, test motoru      | ⏳    |
| 4   | Yetkinlik, program, kartlar         | ⏳    |
| 5   | Deneme, soru sor, veli              | ⏳    |
| 6   | Oyunlaştırma, abonelik, bildirim    | ⏳    |
| 7   | Admin & içerik paneli               | ⏳    |
| 8   | E2E, performans, final              | ⏳    |

## Lisans

Özel. Tüm içerik ve kod bu projeye aittir.
