#!/usr/bin/env node
/**
 * `pnpm --filter @zihin/db test:seed` — seed betiğini uçtan uca dener.
 *
 * Docker gerektirmeden gömülü bir Postgres ayağa kaldırır, migration'ları
 * uygular ve `seed/index.ts` dosyasını GERÇEKTEN çalıştırır. Ardından
 * sonucun tutarlı olduğunu doğrular: konu sayısı, soru sayısı, testlerin
 * kurulması, test hesaplarının giriş yapabilecek durumda olması, demo
 * aktivitesinin panelleri dolduracak kadar veri üretmesi.
 *
 * Bu, seed'in "çalışıyor gibi görünüp" sessizce yarım kalmasını engeller.
 */
import { spawnSync } from 'node:child_process'
import { startPostgres, applyShim, applyMigrations, DB_PACKAGE_ROOT } from './lib/harness.mjs'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
}

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) {
    passed++
    console.log(`  ${c.green}✓${c.reset} ${label}`)
  } else {
    failed++
    console.log(`  ${c.red}✗ ${label}${c.reset}${detail ? `  ${c.dim}${detail}${c.reset}` : ''}`)
  }
}

const PORT = 55436
const harness = await startPostgres({ port: PORT })

try {
  await applyShim(harness.client)
  const applied = await applyMigrations(harness.client, { stopOnError: true })
  const bad = applied.find((r) => !r.ok)
  if (bad) {
    console.error(`Migration basarisiz: ${bad.file}\n${bad.error.message}`)
    process.exit(1)
  }
  console.log(`${c.green}✓${c.reset} ${applied.length} migration uygulandi`)

  // Seed'i gercek bir alt surec olarak calistir — uretimdekiyle ayni yol.
  console.log(`${c.dim}seed/index.ts calistiriliyor...${c.reset}\n`)
  const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`
  // Windows'ta npx bir .cmd sarmalayicisidir; shell olmadan spawn edilince
  // cikis kodu null doner. shell:true her iki platformda da calisir.
  const result = spawnSync('npx tsx seed/index.ts ' + JSON.stringify(`--url=${url}`), {
    cwd: DB_PACKAGE_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true,
    env: { ...process.env },
  })

  if (result.stdout) console.log(result.stdout)
  if (result.status !== 0) {
    console.error(`${c.red}Seed cikis kodu ${result.status}${c.reset}`)
    if (result.stderr) console.error(result.stderr)
    process.exit(1)
  }

  const { client } = harness
  const count = async (sql, params = []) => Number((await client.query(sql, params)).rows[0].n)

  console.log(`${c.bold}Seed sonrasi dogrulama${c.reset}`)

  check('4 sinav yuklendi', (await count('select count(*) n from public.exams')) === 4)
  check('33 ders yuklendi', (await count('select count(*) n from public.subjects')) === 33)

  const topics = await count('select count(*) n from public.topics')
  check('1000+ konu yuklendi', topics > 1000, `${topics} konu`)

  const questions = await count('select count(*) n from public.questions')
  check('sorular yuklendi', questions > 0, `${questions} soru`)

  const withAnswers = await count(
    "select count(*) n from public.questions where correct_option is null or correct_option = ''",
  )
  check('her sorunun dogru sikki var', withAnswers === 0, `${withAnswers} eksik`)

  const orphanCorrect = await count(`
    select count(*) n from public.questions q
     where not exists (
       select 1 from jsonb_array_elements(q.options) o
        where o->>'key' = q.correct_option)`)
  check('dogru sik gercekten siklar arasinda', orphanCorrect === 0, `${orphanCorrect} tutarsiz`)

  const searchVectors = await count(
    'select count(*) n from public.questions where search_vector is null',
  )
  check('arama vektoru trigger ile dolduruldu', searchVectors === 0, `${searchVectors} bos`)

  check('rozetler yuklendi', (await count('select count(*) n from public.badges')) === 7)
  check('paketler yuklendi', (await count('select count(*) n from public.packages')) === 4)

  const videos = await count('select count(*) n from public.videos')
  const checkpoints = await count('select count(*) n from public.video_checkpoints')
  check('videolar yuklendi', videos > 0, `${videos} video`)
  check('video ici sorular baglandi', checkpoints > 0, `${checkpoints} checkpoint`)

  const cpOutOfRange = await count(`
    select count(*) n from public.video_checkpoints cp
     join public.videos v on v.id = cp.video_id
    where cp.timestamp_seconds >= v.duration_seconds or cp.timestamp_seconds <= 0`)
  check('checkpoint zamanlari video suresi icinde', cpOutOfRange === 0, `${cpOutOfRange} hatali`)

  const topicTests = await count("select count(*) n from public.tests where type='topic_test'")
  const unitTests = await count("select count(*) n from public.tests where type='unit_test'")
  const mocks = await count("select count(*) n from public.tests where type='mock_exam'")
  check('konu testleri kuruldu', topicTests > 0, `${topicTests} test`)
  check('unite testleri kuruldu', unitTests > 0, `${unitTests} test`)
  check('deneme sinavlari kuruldu', mocks >= 1, `${mocks} deneme`)

  const emptyTests = await count(`
    select count(*) n from public.tests t
     where not exists (select 1 from public.test_questions tq where tq.test_id = t.id)`)
  check('bos test yok', emptyTests === 0, `${emptyTests} bos test`)

  // Test hesaplari
  const users = await count("select count(*) n from auth.users where email like '%@test.com'")
  check('5 test hesabi olusturuldu', users === 5, `${users} hesap`)

  const hashed = await count(`
    select count(*) n from auth.users
     where email = 'ogrenci@test.com'
       and encrypted_password = extensions.crypt('Test1234!', encrypted_password)`)
  check('ogrenci sifresi dogru ozetlendi (giris yapabilir)', hashed === 1)

  const confirmed = await count(
    "select count(*) n from auth.users where email like '%@test.com' and email_confirmed_at is null",
  )
  check('tum test hesaplari dogrulanmis', confirmed === 0, `${confirmed} dogrulanmamis`)

  const profiles = await count(`
    select count(*) n from public.profiles p
     join auth.users u on u.id = p.id
    where u.email like '%@test.com' and p.onboarding_completed`)
  check('profiller onboarding tamamlanmis olarak isaretli', profiles === 5, `${profiles}/5`)

  const invite = await count(`
    select count(*) n from public.profiles p
     join auth.users u on u.id = p.id
    where u.email like '%@test.com' and (p.invite_code is null or length(p.invite_code) <> 8)`)
  check('her profilde 8 haneli davet kodu var', invite === 0, `${invite} eksik`)

  check('veli ogrenciye bagli', (await count('select count(*) n from public.parent_links')) === 1)
  check(
    'ogretmen ogrenciye atanmis',
    (await count('select count(*) n from public.teacher_assignments')) === 1,
  )
  check(
    'ogrencinin aktif aboneligi var',
    (await count("select count(*) n from public.subscriptions where status='active'")) === 1,
  )

  // Demo aktivite
  const attempts = await count('select count(*) n from public.attempts')
  check('demo cozum gecmisi uretildi', attempts > 100, `${attempts} cozum`)

  const mastery = await count('select count(*) n from public.topic_mastery')
  check('yetkinlik haritasi dolduruldu', mastery > 10, `${mastery} konu`)

  const statuses = (
    await client.query(
      'select status, count(*)::int n from public.topic_mastery group by status order by status',
    )
  ).rows
  const distinctStatuses = statuses.length
  check(
    'yetkinlik dagilimi cesitli (zayif/orta/guclu birlikte)',
    distinctStatuses >= 2,
    statuses.map((s) => `${s.status}:${s.n}`).join(' '),
  )

  const autoCards = await count('select count(*) n from public.flashcards where auto_generated')
  check('yanlislardan otomatik kart uretildi', autoCards > 0, `${autoCards} kart`)

  const dueCards = await count(
    'select count(*) n from public.card_reviews where next_review_at <= now()',
  )
  check('bugun tekrar edilecek kart var', dueCards > 0, `${dueCards} kart`)

  const activity = await count('select count(*) n from public.daily_activity')
  check('gunluk aktivite kaydi var', activity > 3, `${activity} gun`)

  const xp = Number(
    (
      await client.query(
        "select xp from public.profiles p join auth.users u on u.id=p.id where u.email='ogrenci@test.com'",
      )
    ).rows[0]?.xp ?? 0,
  )
  check('ogrencinin XP si hesaplandi', xp > 0, `${xp} XP`)

  console.log(
    `\n${c.bold}Sonuc:${c.reset} ${c.green}${passed} gecti${c.reset}` +
      (failed > 0 ? `, ${c.red}${failed} kaldi${c.reset}` : ''),
  )
} catch (error) {
  console.error(`${c.red}Kosum hatasi:${c.reset}`, error.message, '\n', error.stack)
  failed++
} finally {
  await harness.stop()
}

process.exit(failed > 0 ? 1 : 0)
