# Zihin — Kod Kuralları

Bu depoya dokunan herkesin (insan ya da yapay zekâ) önce okuduğu belge budur. Kurulum
[README.md](README.md), kapsam [CHECKLIST.md](CHECKLIST.md); burada yalnızca **karar kuralları** var.
Bir kuralı bozmanız gerekiyorsa önce bu dosyayı değiştirin.

## 1. Dil

| Ne                                           | Dil                                                |
| -------------------------------------------- | -------------------------------------------------- |
| Değişken, fonksiyon, tablo, kolon, dosya adı | İngilizce                                          |
| Kullanıcının gördüğü her metin               | Türkçe, **eksiksiz aksanla** (ş, ğ, ı, İ, ö, ç, ü) |
| Yorum                                        | Türkçe — ve yalnızca **neden**i açıklıyorsa        |

Arayüz metinleri `apps/web/i18n/tr.json` içinde yaşar, koda gömülmez; `t('auth.login')` ile okunur.
Seed içeriği (soru, hafıza notu, rozet açıklaması) kendi Türkçesini taşır, sözlüğe girmez.

```ts
// apps/web/lib/errors.ts
export const ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  unauthenticated: 'Bu işlem için giriş yapmalısınız.',
  rate_limited: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
  // ...
}
```

Tek istisna: `supabase/migrations/*.sql` ve `packages/core/src/*.ts` içindeki **yorumlar** aksansız
ASCII yazılmıştır (doğrulama koşumu SQL_ASCII kodlamasıyla çalışır, bkz. §7); dokunduğunuz dosyanın
mevcut yazımına uyun. Bu yalnızca yorumlar içindir — **kullanıcıya giden metin asla aksansız
yazılmaz.**

## 2. Server Action sözleşmesi

**Her mutasyon bir Server Action'dır ve her action girdisini doğrular.** Route handler yalnızca
dışarıdan gelen çağrılar içindir (`/api/webhooks/*`, `/api/cron/*`). Zincir üç halkadır: **Zod
şeması → `action()` → `ActionResult` zarfı.**

```ts
// apps/web/lib/action.ts
export function action<TSchema extends z.ZodTypeAny, TOutput>(
  schema: TSchema,
  handler: Handler<z.infer<TSchema>, TOutput>,
)
// Kullanım:
//   export const saveProgress = action(SaveProgressSchema, async (input) => { ... })

// apps/web/lib/errors.ts — dönen zarf her zaman aynı biçimdedir
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }
```

- Girdisi olmayan action için `actionNoInput()`; `action(z.void(), ...)` yazmayın.
- Beklenen hatayı `throw new AppError('forbidden', '...')` ile fırlatın, sarmalayıcı zarfa çevirir.
- Beklenmeyen hata istemciye sızmaz: loglanır, `internal` koduyla döner.
- Hata kodu `ACTION_ERROR_CODES` listesinden gelir; yeni kod, `ERROR_MESSAGES` içine Türkçe
  karşılığını yazmayı da gerektirir.
- `redirect()` / `notFound()` sinyalleri yakalanmaz (`isNextControlFlowError`) — bunu bozmayın.

## 3. Yetki iki kez denetlenir

Yetki hem **veritabanında RLS** ile hem **uygulamada** denetlenir. İkisi birbirinin yedeği değil,
ikisi de zorunlu: RLS satırı korur, uygulama katmanı kullanıcıya doğru cevabı verir. Birini atlamak
diğerini geçersiz kılmaz, sadece açık bırakır.

| Yardımcı                    | Nerede            | Başarısızlıkta                        |
| --------------------------- | ----------------- | ------------------------------------- |
| `requireUser()`             | Sayfa (RSC)       | `/login?next=...` yönlendirmesi       |
| `requireRole(roles)`        | Sayfa (RSC)       | Rolün kendi ana sayfasına yönlendirir |
| `requireOnboardedStudent()` | Öğrenci sayfaları | `/onboarding` yönlendirmesi           |
| `assertRole(roles)`         | **Server Action** | `AppError` fırlatır                   |

```ts
// apps/web/lib/auth.ts — action'lar için: yönlendirmez, fırlatır
if (!user) throw new AppError('unauthenticated', 'Bu işlem için giriş yapmalısınız.')
if (!allowed.includes(user.role)) {
  throw new AppError('forbidden', 'Bu işlem için yetkiniz yok.')
}
```

Ayrımın sebebi: action içinde `redirect()` yarım kalmış bir mutasyon ve anlamsız bir gezinme
bırakır; sayfada hata fırlatmak ise kullanıcıyı hata ekranına düşürür. `middleware.ts` yalnızca
oturum tazeler ve `PUBLIC_PATHS` dışını girişe yollar — **rol denetimi yapmaz**, ona güvenmeyin.
Roller tek yerde: `apps/web/lib/roles.ts` (`student · parent · teacher · editor · admin`, kullanıcı
başına tek rol).

## 4. Service-role istemcisi

`createSupabaseAdminClient()` yalnızca sunucuda çalışır ve **RLS'i devre dışı bırakır**. Meşru üç
kullanımı vardır: (1) kullanıcı bağlamı olmayan işler — cron, webhook; (2) doğru cevabın istemciye
sızmaması gereken sunucu tarafı doğrulamalar; (3) yönetim işlemleri — kullanıcı anonimleştirme, elle
abonelik tanımlama.

```ts
// apps/web/lib/supabase/admin.ts
import 'server-only' // Client Component'ten import edilemez; bu koruma kaldırılmaz.
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY tanımlı değil. ...')
}
```

Değişmez kural: **doğrudan kullanıcı girdisiyle parametrelenmez.** Sorgunun `user_id`, `id` ve rol
filtreleri her zaman sunucuda doğrulanmış oturumdan (`getCurrentUser()` / `assertRole()`) gelir,
isteğin gövdesinden değil. Normal akış `createSupabaseServerClient()` (RSC/action, RLS geçerli) ya da
`getBrowserClient()` (tarayıcı, anon key).

## 5. Ne nerede yaşar

```
apps/web/app/        rota grupları: (auth) (student) (parent) (teacher) (admin) · api/
apps/web/components/ özellik bazlı: components/video/, components/test/ — tip bazlı değil
apps/web/lib/        supabase istemcileri · auth · action zarfı · env · i18n · roles
packages/core/       saf iş mantığı: mastery · studyPlan · spacedRepetition · scoring · gamification
packages/db/         migration · seed · üretilen tipler · doğrulama betikleri
packages/ui/         paylaşılan shadcn/ui bileşenleri + tasarım belirteçleri
supabase/migrations/ sıralı SQL şema dosyaları
```

**"Bu core'a mı ait?" testi:** _Aynı girdiye her zaman aynı çıktıyı veriyor; ne isteğe, ne
veritabanına, ne de sistem saatine ihtiyacı var mı?_ Evet ise core'a aittir. `packages/core/src/index.ts`
bunu şöyle yazar: "Buradaki hicbir dosya Next.js, React, Supabase ya da ag katmanini tanimaz. Girdi
alir, hesaplar, cikti doner." Dolayısıyla core'da `Date.now()` da yoktur; zamana bağlı fonksiyonlar
referans tarihi **parametre olarak** alır. Core tipleri veritabanı satırlarının kopyası değil, her
fonksiyonun ihtiyaç duyduğu en az bilgidir (`AttemptLike`, `TopicLike`) — şema değişikliği core'u
kırmaz. `apps/web` veriyi toplar, core'a verir, sonucu yazar ve gösterir. Bileşen importu alt
yoldan: `import { Button } from '@zihin/ui/button'`.

## 6. Veritabanı kuralları

- **Zaman:** her yerde `timestamptz`, varsayılan `now()`. Yerel tarih gerektiğinde
  `public.tr_today()` — "bugün"ün sistemdeki tek tanımı (UTC+3, yaz saati yok).
- **Enum yok:** `text` + `check`. Yeni değer eklemek tek satırlık kısıt değişikliğidir; enum tür
  değişikliği gerektirirdi.
- **Yumuşak silme yalnızca içerik tablolarında** (`exams`…`topics`, `videos`, `questions`, `tests`,
  `flashcards`, `badges`, `packages`): `deleted_at timestamptz`. Aktivite ve olay tabloları
  (`attempts`, `job_runs`, `xp_events`) yumuşak silinmez.
- **`updated_at`** kolonu olan her tabloda `before update` trigger'ı vardır; zaman damgası istemciye
  bırakılmaz.
- **Her fonksiyon `set search_path` ile yazılır**, gövdede her şey tam nitelikli çağrılır. Tercih
  `set search_path = ''`; kaçınılmazsa dar liste (`pg_catalog, public`).
- Anlamı adından okunmayan her tablo/kolon için `comment on`. Adlandırma öngörülebilir:
  `idx_<tablo>_<kolonlar>`, `<tablo>_<kolon>_check`.

```sql
-- supabase/migrations/0001_foundation.sql
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
```

**RLS:** her tabloda `enable row level security` ve en az bir politika bulunur (§7 ikisini de
denetler). Politikalarda `auth.uid()` **daima alt sorgu olarak** yazılır —
`using ((select auth.uid()) = user_id)`. Sebep: `(select auth.uid())` bir kez hesaplanıp `InitPlan`
olarak önbelleğe alınır; çıplak `auth.uid()` her satır için yeniden çalışır ve büyük tablolarda
taramayı belirgin şekilde yavaşlatır. Politika dosyaları (`0010`, `0011`) henüz yazılmadı;
`0001`–`0009` yalnızca tabloları kurar ve başlıklarında bunu belirtir.

## 7. Şema doğrulama (Docker gerekmez)

```bash
pnpm --filter @zihin/db verify           # migration'ları uygula + özetle
pnpm --filter @zihin/db verify:inspect   # tablo/RLS/indeks/fonksiyon dökümü
node packages/db/scripts/verify-schema.mjs --continue   # ilk hatada durma
pnpm db:types                            # packages/db/src/types.ts'i yeniden üret
```

Koşum gömülü bir PostgreSQL 17 başlatır, `packages/db/scripts/supabase-shim.sql` ile Supabase'in
şema/rol/fonksiyon yüzeyini taklit eder, `supabase/migrations` altındaki dosyaları sırayla ve **her
biri tek işlemde** uygular; hatada dosya + satır + Postgres mesajı verir, kısmi şema kalmaz. Ardından
iki denetim yapar: RLS açılmamış tablo ve **politikasız tablo** (RLS açık, kural yok = hiçbir satır
okunamaz) varsa çıkış kodu 1 olur. Bilinçli sınırlar (`packages/db/scripts/lib/harness.mjs`):

- Kodlama **SQL_ASCII**, sıralama düzeni **C** — Windows'ta Türkçe yerel ayar initdb'yi UTF8 ile
  başlatmıyor. Türkçe metin bayt bazında sorunsuz gider gelir, ancak `lower()`/`upper()` ve sıralama
  Türkçe'ye özgü davranmaz. Üretimde kodlama UTF8'dir.
- **`pg_cron` yok** — zamanlanmış işler ayrı, tolere edilen bir migration'da tutulur.
- Auth ve Storage yalnızca taklit; gerçek Supabase servisleri çalışmaz.

Tam yığın gerektiğinde (Docker ile) `pnpm db:reset` ve `supabase db lint`; CI'ın `sql` işi bunu yapar.

## 8. Stil ve erişilebilirlik

**Sabit renk yazılmaz.** Renkler `packages/ui/src/styles.css` içindeki HSL belirteçlerinden gelir ve
Tailwind sınıfı olarak kullanılır (`bg-primary`, `text-muted-foreground`, `border-border`). Ana renk
`--brand-hue` üzerinden türetilir; değerini `NEXT_PUBLIC_BRAND_HUE` verir, `app/layout.tsx` kök öğeye
işler. **Koyu tema** `.dark` sınıfıyla çalışır (`darkMode: ['class']`, `next-themes`
`attribute="class"`); yeni belirteci hem `:root` hem `.dark` bloğuna yazın, biri eksikse tema yarım
kalır.

| Bant              | Belirteç            | Anlamı                             |
| ----------------- | ------------------- | ---------------------------------- |
| `mastery-unknown` | `--mastery-unknown` | `n < 3` — ölçmeye yetecek veri yok |
| `mastery-weak`    | `--mastery-weak`    | puan `< 50` — öncelikli çalışma    |
| `mastery-medium`  | `--mastery-medium`  | `50 ≤ puan < 75` — pekiştirme      |
| `mastery-strong`  | `--mastery-strong`  | `puan ≥ 75` — koruma / tekrar      |

```ts
// packages/core/src/mastery.ts
export function classifyMastery(mastery: number, n: number): MasteryStatus {
  if (n < MIN_ATTEMPTS_FOR_STATUS) return 'unknown'
  if (mastery < 50) return 'weak'
  if (mastery < 75) return 'medium'
  return 'strong'
}
```

Etiketler `i18n/tr.json` → `mastery.*` (Ölçülmedi · Zayıf · Orta · Güçlü). Renk tek başına anlam
taşımaz; her zaman metin ya da sayıyla birlikte gösterilir.

**Erişilebilirlik tabanı** (pazarlık konusu değil): kontrast WCAG AA (normal metin 4.5:1, büyük metin
3:1) · her input'un `<Label htmlFor>` bağı var, yer tutucu etiket yerine geçmez · odak halkası
görünür kalır (`:focus-visible` kuralı `styles.css` içindedir, bileşende `outline-none` ile
ezilmez) · test ve video ekranları tamamen klavyeyle kullanılabilir (şık seçme, soru ızgarasında
gezinme, oynatıcı kısayolları) · `prefers-reduced-motion` açıkken animasyonlar kısılır.

## 9. Test beklentileri

| Katman          | Araç                     | Beklenti                                                             |
| --------------- | ------------------------ | -------------------------------------------------------------------- |
| `packages/core` | Vitest                   | Satır/fonksiyon/ifade **%90**, dal **%80** — eşikler koşumda zorunlu |
| Veritabanı      | RLS iddia betiği         | Her politika için bir "erişebilir" + bir "erişemez" iddiası          |
| `apps/web`      | Vitest + Testing Library | Yardımcılar ve karmaşık bileşenler                                   |
| Uçtan uca       | Playwright               | Üç kritik yolculuk                                                   |

Core eşikleri `packages/core/vitest.config.ts` içindedir ve düşürülmez; sınır durumları (boş girdi,
geçersiz tarih, aralık dışı zorluk) da test edilir. RLS iddiaları
`packages/db/scripts/lib/harness.mjs` içindeki `asUser()` / `asAnon()` üzerine yazılır; ikisi de
işlemi geri alır, testler birbirini kirletmez. Playwright'ın üç yolculuğu (CHECKLIST Faz 8):

1. Kayıt → onboarding → seviye tespit → öncelikli konular.
2. Video → checkpoint → test → sonuç → yetkinlik güncellemesi → kart tekrarı.
3. İçerik import → deneme oluştur → çöz → net/yüzdelik → veli panelinde görünürlük.

## 10. Göndermeden önce

Sıra, CI'ın `verify` işiyle birebir aynıdır; yerelde geçmeyen uzakta da geçmez.

```bash
pnpm format:check    # Prettier (pre-commit zaten yazıyor)
pnpm lint            # ESLint
pnpm typecheck       # TypeScript (strict, noUncheckedIndexedAccess)
pnpm test            # Vitest, core eşikleri dâhil
pnpm build           # Üretim derlemesi
```

Migration'a dokunduysanız ek olarak `pnpm --filter @zihin/db verify` (CI'ın `sql` işi ayrıca
`supabase db lint --level warning` çalıştırır).

- [ ] Yeni mutasyon bir Server Action ve Zod şeması var mı?
- [ ] Yetki hem RLS'te hem `requireRole` / `assertRole` ile denetleniyor mu?
- [ ] Yeni tabloda RLS açık ve en az bir politika var mı?
- [ ] Kullanıcıya görünen metinler `i18n/tr.json` içinde ve aksanları doğru mu?
- [ ] Sabit renk, sabit metin, gizli anahtar kalmadı mı?
- [ ] Yeni core fonksiyonunun testi ve sınır durumları var mı?
- [ ] `CHECKLIST.md` işaretlendi mi?

## Bilinen sapmalar (düzeltilecek, örnek alınmayacak)

- `packages/core/src/studyPlan.ts` içindeki `WARNING_*` sabitleri ve blok başlıkları kullanıcıya
  gidiyor ama aksansız yazılmış. Yeni metinleri doğru yazımla ekleyin.
- `apps/web/lib/auth.ts` yorumunda geçen `withAction` sarmalayıcısının gerçek adı `action`.
