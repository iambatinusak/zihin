# Uçtan uca testler (Playwright)

Bu klasör, şartnamenin §12'de saydığı **üç kullanıcı yolculuğunu** baştan sona
gerçek tarayıcıda koşar. Kasıtlı olarak az sayıda test var: gerçekten çalışan üç
yolculuk, çürümeye terk edilmiş yirmi testten değerlidir.

## Önce ne doğru olmalı

Testler `next dev` başlatmaz; **çalışan bir docker yığınına** karşı koşar.

```bash
docker compose -f docker/docker-compose.yml up -d
```

| Servis           | Adres                  |
| ---------------- | ---------------------- |
| Next.js uygulama | http://localhost:14000 |
| Supabase API     | http://localhost:14001 |
| PostgreSQL       | localhost:14002        |
| Supabase Studio  | http://localhost:14003 |
| Mailpit (posta)  | http://localhost:14004 |

Migration ve seed tek seferlik `migrate` servisiyle otomatik uygulanır. Yığın
ayakta değilse `e2e/global-setup.ts` daha ilk testten önce Türkçe bir hatayla
durur; onlarca zaman aşımı beklemeniz gerekmez.

Varsayılan adresler değiştiyse:

```bash
E2E_BASE_URL=http://localhost:14000 E2E_MAILPIT_URL=http://localhost:14004 pnpm --filter @zihin/web test:e2e
```

## Çalıştırma

```bash
pnpm --filter @zihin/web test:e2e            # tümü
pnpm --filter @zihin/web test:e2e:ui         # Playwright arayüzü (adım adım)
pnpm --filter @zihin/web test:e2e:report     # son koşumun HTML raporu
pnpm --filter @zihin/web test:e2e:typecheck  # yalnızca tip denetimi (yığın gerekmez)

npx playwright test --list                   # koşmadan hangi testler var
npx playwright test e2e/02-video-test-yetkinlik-kart.spec.ts --headed --debug
```

> Tarayıcı ikilileri kurulu değilse bir kez `npx playwright install chromium`.

## Yolculuklar

### 1 · `01-kayit-onboarding-seviye-tespit.spec.ts`

Kayıt → e-posta doğrulama → 6 adımlı sihirbaz → seviye tespit → öncelikli konular.

- Her koşumda **benzersiz** (zaman damgalı) bir e-posta ile kayıt olur; tohum
  hesaplarına dokunmaz ve "bu adres zaten kayıtlı" hatasına düşmez.
- KVKK onay kutusu işaretlenir, `/verify` sayfasına düşülür.
- Doğrulama postası **Mailpit API'sinden** okunur (`helpers/mail.ts`,
  yoklamalı ve zaman aşımlı) ve içindeki bağlantı gerçekten izlenir.
- **§M1 kabul ölçütü:** sihirbaz 2. adımdan sonra yenilenir ve 1. adıma
  dönmediği, kaydedilmiş adımdan devam ettiği doğrulanır.
- Sonunda `/dashboard` üzerinde "Öncelikli konular" kutusunun boş durumda
  olmadığı görülür.

### 2 · `02-video-test-yetkinlik-kart.spec.ts`

Video → checkpoint → konu testi → sonuç → yetkinlik → kart tekrarı.

Yolculuk **iki teste** bölünmüştür ve sebebi tek: tohumdaki
`videos.storage_path` gerçek bir dosyayı değil, ileride yüklenecek dosyanın
deterministik yolunu gösterir. Depoya video yüklenmemiş bir kurulumda oynatıcı
hiç veri alamaz, checkpoint ise yalnızca **gerçek oynatma** sırasında
(`timeupdate`) tetiklenir.

- **Video testi:** oynatıcının kurulduğunu doğrular, kaynağın oynatılabilir
  olup olmadığını `canplay`/`error` ile sorar ve oynatılamıyorsa
  `test.skip(...)` ile **açıkça** atlar. Oynatılabiliyorsa checkpoint'in hemen
  öncesine konumlanır, videonun duraklatıldığını, sorunun açıldığını ve cevabın
  sunucuda değerlendirildiğini doğrular.
- **Test testi:** konu testinin bütün soruları cevaplanır, sonuç ekranında
  "Soru çözümleri", doğru cevap ve açıklama görülür, `/panel` ısı haritasında
  konunun yetkinlik bandı ölçülmüş olur ve yanlışlardan üretilen kartlar
  `/kartlar` üzerinde tekrar sırasında ilerletilir.

Gezinme **kimlik varsaymaz**: `/dersler` → ders → konu şeklinde, içeriği olan
tek dal (`helpers/seed-facts.ts`) üzerinden ilerlenir.

### 3 · `03-editor-import-deneme-veli.spec.ts`

Editör toplu içe aktarır → deneme kurar → öğrenci çözer → net/yüzdelik → veli görür.

- CSV **testin kendi fikstürüdür**, koşuma özgü benzersiz soru kökleriyle
  bellekte üretilir ve `/admin/sorular/ice-aktar` ekranından yüklenir. Önce kuru
  çalışma (satır sayısı ve hata raporu), sonra "yayına al" anahtarıyla aktarım.
- `/admin/denemeler` üzerinden ders başına soru sayısı verilerek deneme kurulur
  ve yayımlanır.
- Öğrenci denemeyi çözer; sonuçta ders bazlı tablo okunur ve **net formülü**
  ekrandaki doğru/yanlış sayılarından yeniden hesaplanarak doğrulanır
  (LGS: üç yanlış bir doğruyu götürür).
- **Yüzdelik dilim bilerek "Yeterli veri yok" beklenir.** Dilim en az 20
  katılımcıyla açılır; tek katılımcıyla sıralama göstermemek doğru davranıştır
  ve testin doğruladığı şey tam olarak bu kapıdır.
- Veli panelinde denemenin göründüğü, ama sonuç ekranına geçiş bağlantısı
  **olmadığı** doğrulanır (§M12: veli içeriği göremez).

## Klasör düzeni

```
e2e/
  helpers/seed-facts.ts  tohuma dair TÜM varsayımlar (hesaplar, içerikli dal)
  helpers/auth.ts        gerçek giriş formu + oturum durumu yeniden kullanımı
  helpers/mail.ts        Mailpit yoklaması ve doğrulama bağlantısı
  global-setup.ts        yığın ayakta mı? (erken ve anlaşılır hata)
  tsconfig.json          e2e dosyalarının tip denetimi
```

`helpers/seed-facts.ts` bilinçli olarak tek kaynaktır: tohum değişirse üç spec
değil bir dosya kırılır.

Oturumlar `e2e/.auth/*.json` altında saklanır (git'e girmez) ve her testte
yeniden giriş yapılmasını önler; dosya bayatsa ya da oturum düşmüşse yardımcı
sessizce yeniden giriş yapar.

## Sözleşmeler

- **Seçiciler**: önce erişilebilir rol + görünen Türkçe metin
  (`getByRole('button', { name: 'Testi bitir' })`). `data-testid` yalnızca
  erişilebilir bir seçicinin gerçekten belirsiz kaldığı yerde eklenir — şu an
  hiçbir yerde gerekmedi, yani bu suite uygulamaya tek satır bile eklemiyor.
- **Bağımsızlık**: her test kendi verisini üretir ya da yalnızca tohum
  verisine dayanır; sıra varsaymaz ve ikinci koşumu bozacak artık bırakmaz.
- **Tek işçi**: `workers: 1`. İki spec aynı tohum öğrencisini kullanır; paralel
  koşumda "yarım kalan oturuma devam et" kuralı testleri birbirine karıştırır.

## Bir hata çıktığında

1. `pnpm --filter @zihin/web test:e2e:report` — HTML raporu; başarısız adım,
   ekran görüntüsü ve (yeniden denemede) iz kaydı burada.
2. `npx playwright test <dosya> --headed --debug` — adım adım izleyin.
3. `npx playwright show-trace test-results/.../trace.zip` — zaman çizgisi,
   ağ istekleri ve DOM anlık görüntüleri.
4. Uygulama tarafına bakın: `docker compose -f docker/docker-compose.yml logs -f web`
5. Posta gelmiyorsa Mailpit arayüzü: http://localhost:14004
6. Metin bulunamıyorsa önce `i18n/tr/*.json` dosyalarına bakın: kullanıcıya
   görünen bir metin değiştiyse seçici de değişmelidir.
