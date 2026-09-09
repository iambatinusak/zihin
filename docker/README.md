# Zihin — Docker ile kurulum

Tüm yığın (uygulama + Supabase + veritabanı + e-posta) tek komutla ayağa kalkar.
Portların hepsi **14xxx** aralığındadır, makinedeki başka servislerle çakışmaz.

## Kurulum

```bash
git clone <repo> && cd zihin

cp docker/.env.example docker/.env
node scripts/generate-keys.mjs --write     # sırları üretir ve docker/.env'e yazar

docker compose -f docker/docker-compose.yml up -d
```

İlk çalıştırma imajları indirir ve uygulamayı derler; makineye göre **5–15 dakika** sürer.
Sonraki çalıştırmalar saniyeler içindedir.

İlerlemeyi izlemek için:

```bash
docker compose -f docker/docker-compose.yml logs -f migrate web
```

`migrate` servisi "Seed tamamlandı" yazıp çıktığında sistem hazırdır.

## Adresler

| Adres                  | Ne                                                                       |
| ---------------------- | ------------------------------------------------------------------------ |
| http://localhost:14000 | **Zihin uygulaması**                                                     |
| http://localhost:14001 | Supabase API (uygulamanın konuştuğu adres)                               |
| `localhost:14002`      | PostgreSQL — `psql postgres://postgres:<şifre>@localhost:14002/postgres` |
| http://localhost:14003 | Supabase Studio — tabloları görsel yönetim                               |
| http://localhost:14004 | **Mailpit** — giden tüm e-postalar burada birikir                        |

Doğrulama e-postası, şifre sıfırlama ve bildirim postalarının hepsi Mailpit'e düşer;
dışarıya hiçbir şey gitmez. Kayıt akışını denerken doğrulama bağlantısını oradan alın.

## Test hesapları

Seed açıkken (`SEED_DATABASE=true`) beş hesap hazır gelir. Şifre: **`Test1234!`**

| Rol      | E-posta             |
| -------- | ------------------- |
| Öğrenci  | `ogrenci@test.com`  |
| Veli     | `veli@test.com`     |
| Öğretmen | `ogretmen@test.com` |
| Editör   | `editor@test.com`   |
| Yönetici | `admin@test.com`    |

Öğrenci hesabında iki haftalık gerçekçi aktivite geçmişi vardır; paneller boş gelmez.

## VM'de çalıştırma

`localhost` yalnızca makinenin kendisinden çözülür. VM'e dışarıdan bağlanacaksanız
`docker/.env` içindeki iki satırı VM'nin adresiyle değiştirin:

```bash
PUBLIC_API_URL=http://192.168.1.50:14001
PUBLIC_APP_URL=http://192.168.1.50:14000
```

Sonra **uygulamayı yeniden derleyin**:

```bash
docker compose -f docker/docker-compose.yml up -d --build web
```

Yeniden derleme şart: Next.js `NEXT_PUBLIC_*` değerlerini derleme sırasında paketin içine
gömer, çalışma anında okumaz. Yalnızca `restart` ederseniz tarayıcı hâlâ `localhost:14001`
adresine bağlanmaya çalışır ve giriş çalışmaz.

Güvenlik duvarı açıksa 14000 ve 14001 portlarına izin verin. 14002 (veritabanı) ve 14003
(Studio) portlarını dışarı açmanız gerekmez — gerekmiyorsa `docker-compose.yml` içindeki
`ports` satırlarını kaldırıp yalnızca konteyner ağında bırakın.

## Sık karşılaşılanlar

**`migrate` servisi hata verip çıkıyor.**
Migration'lar `auth.users` tablosunu bekler; onu GoTrue kurar. `migrate` zaten bekliyor ama
GoTrue hiç ayağa kalkmadıysa süre dolar. `docker compose logs auth` bakın; genellikle
`JWT_SECRET` boştur — `node scripts/generate-keys.mjs --write` çalıştırmayı atlamışsınızdır.

**Giriş yapınca "Failed to fetch" / ağ hatası.**
Tarayıcının `PUBLIC_API_URL` adresine erişemediği anlamına gelir. VM'deyseniz yukarıdaki
adımı uygulayın. `curl http://<adres>:14001/health` ile ağ geçidini doğrulayın.

**Bir imaj çekilemiyor (404 / manifest unknown).**
Sürüm etiketi eskimiş olabilir. `docker/.env` içindeki `IMAGE_*` değişkenlerinden ilgili
olanı güncelleyin; hepsi oradan yönetilir.

**Şemayı sıfırlamak istiyorum.**

```bash
docker compose -f docker/docker-compose.yml down -v   # -v: veritabanı ve dosyalar da silinir
docker compose -f docker/docker-compose.yml up -d
```

**Migration'ların durumunu görmek.**

```bash
docker compose -f docker/docker-compose.yml run --rm migrate \
  node packages/db/scripts/migrate.mjs --status
```

## Üretime almadan önce

Bu yığın geliştirme ve demo içindir. Gerçek kullanıcıya açmadan önce:

- `SEED_DATABASE=false` — test hesapları bilinen şifrelerle gelir.
- `NODE_ENV=production` — seed test hesaplarını zaten atlar, ama açıkça ayarlayın.
- `docker/.env` dosyasını yeniden üretin; geliştirme sırasındaki anahtarları taşımayın.
- 14002 ve 14003 portlarını dışarı kapatın.
- Ağ geçidinin önüne TLS koyun (nginx/Caddy ile reverse proxy) — bu yığın düz HTTP konuşur
  ve oturum çerezleri şifresiz gider.
- `RESEND_API_KEY` doldurun; Mailpit e-postaları hiçbir yere göndermez.
- iyzico anahtarlarını gerçek değerlerle doldurun; boşken sahte sağlayıcı devreye girer.

## Yığındaki servisler

| Servis                 | İş                                                                    | Dışarı açık   |
| ---------------------- | --------------------------------------------------------------------- | ------------- |
| `db`                   | PostgreSQL (`supabase/postgres` — rolleri ve uzantıları kurulu gelir) | 14002         |
| `auth`                 | GoTrue — kayıt, giriş, e-posta doğrulama                              | hayır         |
| `rest`                 | PostgREST — veri API'si, RLS'i uygular                                | hayır         |
| `storage` + `imgproxy` | Dosya depolama ve görsel dönüştürme                                   | hayır         |
| `api`                  | nginx — `/auth` `/rest` `/storage` öneklerini yönlendirir             | 14001         |
| `migrate`              | Şema + seed, tek seferlik; bitince çıkar                              | —             |
| `web`                  | Zihin uygulaması (Next.js standalone)                                 | 14000         |
| `mail`                 | Mailpit — giden postaları yakalar                                     | 14004 / 14005 |
| `meta` + `studio`      | Supabase Studio                                                       | 14003         |

Bağımlılık sırası bilinçlidir: `db` → `auth` → `migrate` → `web`. Sıra bozulursa
`0002_identity.sql` içindeki `auth.users` yabancı anahtarı hedefini bulamaz.
