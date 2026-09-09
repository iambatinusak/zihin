import Link from 'next/link'
import {
  BrainCircuit,
  CalendarCheck,
  GraduationCap,
  LineChart,
  PlayCircle,
  Repeat2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { Badge } from '@zihin/ui/badge'
import { APP_NAME } from '@/lib/env'

const FEATURES = [
  {
    icon: PlayCircle,
    title: 'Video içinde soru',
    body: 'Konu anlatımı izlerken belirli anlarda video durur, karşına kısa bir soru gelir. Anladığını anında test edersin; izlemekle öğrenmek arasındaki farkı kapatır.',
  },
  {
    icon: LineChart,
    title: 'Konu bazlı yetkinlik skoru',
    body: 'Çözdüğün her soru bağlı olduğu konuya işlenir. Doğruluk, zorluk ve çözüm süren birlikte değerlendirilir; her konu için 0-100 arası gerçek bir skor çıkar.',
  },
  {
    icon: CalendarCheck,
    title: 'Kendiliğinden güncellenen program',
    body: 'Sınav tarihin, günlük süren ve zayıf konuların bir araya gelir; haftalık plan otomatik oluşur. Sen çalıştıkça plan da değişir.',
  },
  {
    icon: Repeat2,
    title: 'Aralıklı tekrar',
    body: 'Öğrendiğin bilgi tam unutulmaya başlarken karşına çıkar. Yanlış yaptığın her soru otomatik olarak hafıza kartına dönüşür.',
  },
  {
    icon: BrainCircuit,
    title: 'Hafıza teknikleri',
    body: 'Her konunun altında o konuya özel kısaltma, hikâyeleme ve akıl haritası notu bulunur. Ezberi değil, hatırlamayı kolaylaştırır.',
  },
  {
    icon: GraduationCap,
    title: 'Veli ve öğretmen görünümü',
    body: 'Velin haftalık özeti görür, öğretmenin sorularını yanıtlar. İlerleme kimsenin tahminine kalmaz.',
  },
]

const EXAMS = [
  { code: 'LGS', label: 'LGS', detail: '8. sınıf' },
  { code: 'TYT', label: 'TYT', detail: 'Temel Yeterlilik' },
  { code: 'AYT', label: 'AYT', detail: 'Alan Yeterlilik' },
  { code: 'KPSS', label: 'KPSS', detail: 'Lisans GK-GY' },
]

const STEPS = [
  {
    step: '1',
    title: 'Sınavını seç, seviyeni ölç',
    body: 'Kayıt olduktan sonra kısa bir seviye tespit sınavı çözersin. Hangi konuda nerede olduğun ilk günden belli olur.',
  },
  {
    step: '2',
    title: 'Programını al',
    body: 'Sınav tarihine kalan süre ve günlük çalışma süren üzerinden haftalık plan oluşur. İzle, çöz ve tekrar et blokları günlere dağılır.',
  },
  {
    step: '3',
    title: 'Çalış, sistem seni takip etsin',
    body: 'Her soru skoruna işlenir. Zayıf konuların öne çıkar, güçlü konuların tekrar bloğu olarak kalır.',
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BrainCircuit className="text-primary size-6" aria-hidden />
            <span className="text-lg">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/paketler">Paketler</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Giriş yap</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Ücretsiz başla</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="icerik" className="flex-1">
        {/* Hero */}
        <section className="from-accent/40 to-background border-b bg-gradient-to-b">
          <div className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3.5" aria-hidden />
              LGS · YKS · KPSS · DGS · ALES
            </Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
              Önce anla, sonra unutma.
            </h1>
            <p className="text-muted-foreground max-w-2xl text-balance text-lg">
              {APP_NAME}, izlediğin videoyu soruya, çözdüğün soruyu konu skoruna, konu skorunu da
              haftalık çalışma programına çevirir. Neyi ne zaman çalışacağını düşünmeyi bırakır,
              çalışmaya başlarsın.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">Hemen başla</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/paketler">Paketleri incele</Link>
              </Button>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" aria-hidden />
              Her konunun ilk iki videosu ücretsiz. Kredi kartı istemiyoruz.
            </p>
          </div>
        </section>

        {/* Sınavlar */}
        <section className="border-b py-12">
          <div className="container">
            <h2 className="sr-only">Desteklenen sınavlar</h2>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {EXAMS.map((exam) => (
                <li key={exam.code}>
                  <Card className="h-full text-center">
                    <CardContent className="flex flex-col items-center gap-1 p-6">
                      <span className="text-primary text-2xl font-bold">{exam.label}</span>
                      <span className="text-muted-foreground text-sm">{exam.detail}</span>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Özellikler */}
        <section className="border-b py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Video ve testten fazlası
              </h2>
              <p className="text-muted-foreground mt-3">
                Dört parça birbirine bağlı çalışır: izleme, ölçme, planlama ve tekrar.
              </p>
            </div>
            <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <Card className="h-full">
                    <CardHeader>
                      <feature.icon className="text-primary size-8" aria-hidden />
                      <CardTitle className="mt-2">{feature.title}</CardTitle>
                      <CardDescription className="leading-relaxed">{feature.body}</CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Nasıl çalışır */}
        <section className="bg-muted/30 border-b py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Nasıl çalışır?</h2>
            </div>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((item) => (
                <li key={item.step} className="flex flex-col gap-3">
                  <span
                    className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-lg font-bold"
                    aria-hidden
                  >
                    {item.step}
                  </span>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container">
            <Card className="border-primary/30 bg-accent/40">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <h2 className="text-2xl font-bold md:text-3xl">
                  Bugün başlarsan farkı yarın görürsün
                </h2>
                <p className="text-muted-foreground max-w-xl">
                  Seviye tespit sınavı 30 dakika sürer. Sonunda hangi konuda ne durumda olduğunu ve
                  ilk haftalık programını görürsün.
                </p>
                <Button asChild size="lg">
                  <Link href="/register">Ücretsiz hesap oluştur</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="text-muted-foreground container flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Tüm hakları saklıdır.
          </p>
          <nav className="flex gap-4">
            <Link href="/kvkk" className="hover:text-foreground">
              KVKK Aydınlatma Metni
            </Link>
            <Link href="/gizlilik" className="hover:text-foreground">
              Gizlilik
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
