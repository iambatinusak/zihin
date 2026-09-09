#!/usr/bin/env node
/**
 * `pnpm --filter @zihin/db smoke` — semanin yalnizca UYGULANDIGINI degil,
 * gercekten CALISTIGINI kanitlar.
 *
 * verify-schema.mjs migration'larin hatasiz uygulandigini gosterir; bu betik
 * bir adim oteye gecip semayi kullanir: kayit akisini tetikler, mufredat
 * zincirini bastan sona kurar ve is kurali trigger'larinin gercekten
 * hata firlattigini dogrular. Bir trigger sessizce devre disi kalirsa
 * verify bunu goremez, buradaki test goruyor.
 *
 * Kullanim:
 *   node scripts/smoke-schema.mjs
 *   node scripts/smoke-schema.mjs --verbose   # her adimin ayrintisini yaz
 */
import { startPostgres, applyShim, applyMigrations } from './lib/harness.mjs'

const args = new Set(process.argv.slice(2))
const verbose = args.has('--verbose')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
}

let passed = 0
const failures = []

/** Tek bir kontrolu calistirir; hata testi durdurmaz, rapora eklenir. */
async function check(label, fn) {
  try {
    const note = await fn()
    passed += 1
    console.log(`${c.green}✓${c.reset} ${label}${note ? ` ${c.dim}${note}${c.reset}` : ''}`)
  } catch (error) {
    failures.push({ label, error })
    console.log(`${c.red}✗ ${label}${c.reset}`)
    console.log(`  ${c.red}${error.message}${c.reset}`)
    if (verbose && error.stack)
      console.log(`  ${c.dim}${error.stack.split('\n').slice(1, 3).join('\n  ')}${c.reset}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * Verilen sorgunun hata firlatmasini bekler.
 * Otomatik islem (autocommit) modunda calisiriz: basarisiz bir ifade yalnizca
 * kendini geri alir, sonraki testleri kirletmez.
 */
async function expectError(client, sql, params, messageFragment) {
  let raised = null
  try {
    await client.query(sql, params)
  } catch (error) {
    raised = error
  }
  assert(raised !== null, 'Hata bekleniyordu, sorgu basariyla tamamlandi.')
  assert(
    raised.message.includes(messageFragment),
    `Hata mesaji "${messageFragment}" icermiyor. Gelen: ${raised.message}`,
  )
  return raised.message
}

/** auth.users'a kullanici ekler; profil trigger'i profili kendisi olusturur. */
async function createUser(client, { email, role = 'student', fullName = null }) {
  const { rows } = await client.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('role', $2::text, 'full_name', $3::text))
     returning id`,
    [email, role, fullName],
  )
  return rows[0].id
}

console.log(`${c.dim}Gomulu PostgreSQL baslatiliyor...${c.reset}`)
// verify-schema.mjs ile ayni anda calisabilsin diye farkli port.
const harness = await startPostgres({ port: 55434 })
const db = harness.client
let exitCode = 0

try {
  await applyShim(db)
  const results = await applyMigrations(db, { stopOnError: true })
  const broken = results.filter((r) => !r.ok)
  if (broken.length > 0) {
    console.log(`${c.red}✗ Migration'lar uygulanamadi; duman testi calistirilamiyor.${c.reset}`)
    for (const b of broken) {
      console.log(`  ${c.red}${b.file}${c.reset}: ${b.error.message}`)
      if (b.error.line)
        console.log(`  ${c.dim}satir ${b.error.line.line}: ${b.error.line.text}${c.reset}`)
    }
    process.exit(1)
  }
  console.log(
    `${c.green}✓${c.reset} ${results.length} migration uygulandi ${c.dim}(duman testi basliyor)${c.reset}\n`,
  )

  // -------------------------------------------------------------------------
  console.log(`${c.bold}1. Kayit akisi — profil trigger'i${c.reset}`)
  // -------------------------------------------------------------------------
  let studentId
  await check('auth.users insert edilince public.profiles satiri olusuyor', async () => {
    studentId = await createUser(db, {
      email: 'ogrenci@zihin.test',
      role: 'student',
      fullName: 'Elif Yilmaz',
    })
    const { rows } = await db.query('select * from public.profiles where id = $1', [studentId])
    assert(rows.length === 1, `profiles satiri olusmadi (${rows.length} satir).`)
    assert(
      rows[0].full_name === 'Elif Yilmaz',
      `full_name meta veriden gelmedi: ${rows[0].full_name}`,
    )
    assert(rows[0].role === 'student', `role beklenen student degil: ${rows[0].role}`)
    return `id=${studentId.slice(0, 8)}`
  })

  await check('profil 8 haneli, karisabilir harf icermeyen bir invite_code aliyor', async () => {
    const { rows } = await db.query('select invite_code from public.profiles where id = $1', [
      studentId,
    ])
    const code = rows[0].invite_code
    assert(code !== null, 'invite_code null geldi; generate_invite_code() cagrilmamis.')
    // 0/O ve 1/I/L bilerek alfabede yok (telefonda sozlu paylasilabilsin diye).
    assert(
      /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code),
      `invite_code beklenen bicimde degil: ${code}`,
    )
    return code
  })

  await check('invite_code kullanicilar arasinda benzersiz', async () => {
    const others = []
    for (let i = 0; i < 5; i += 1) {
      others.push(await createUser(db, { email: `toplu${i}@zihin.test` }))
    }
    const { rows } = await db.query(
      'select count(distinct invite_code) as uniq, count(*) as total from public.profiles',
    )
    assert(rows[0].uniq === rows[0].total, `kod cakismasi var: ${rows[0].uniq}/${rows[0].total}`)
    return `${rows[0].total} profil, ${rows[0].uniq} farkli kod`
  })

  await check("meta veriden yetkili rol istenirse student'a dusuyor", async () => {
    // Kayit istegi istemciden gelir; buradan admin olunamamali.
    const sneakyId = await createUser(db, { email: 'sizinti@zihin.test', role: 'admin' })
    const { rows } = await db.query('select role from public.profiles where id = $1', [sneakyId])
    assert(rows[0].role === 'student', `yetki yukseltme engellenmedi: ${rows[0].role}`)
    return "istenen 'admin' -> verilen 'student'"
  })

  // -------------------------------------------------------------------------
  console.log(`\n${c.bold}2. Mufredat + icerik zinciri${c.reset}`)
  // -------------------------------------------------------------------------
  const ids = {}
  await check('exam -> subject -> unit -> topic zinciri kuruluyor', async () => {
    const exam = await db.query(
      `insert into public.exams (code, name, wrong_penalty_divisor)
       values ('LGS', 'Liselere Gecis Sinavi', 3) returning id`,
    )
    ids.exam = exam.rows[0].id

    const subject = await db.query(
      `insert into public.subjects (exam_id, name, slug, question_count)
       values ($1, 'Matematik', 'matematik', 20) returning id`,
      [ids.exam],
    )
    ids.subject = subject.rows[0].id

    const unit = await db.query(
      `insert into public.units (subject_id, name, slug)
       values ($1, 'Sayilar ve Islemler', 'sayilar-ve-islemler') returning id`,
      [ids.subject],
    )
    ids.unit = unit.rows[0].id

    const topic = await db.query(
      `insert into public.topics (unit_id, title, slug, estimated_minutes, difficulty, exam_weight)
       values ($1, 'Carpanlar ve Katlar', 'carpanlar-ve-katlar', 45, 3, 0.80) returning id`,
      [ids.unit],
    )
    ids.topic = topic.rows[0].id
    return 'LGS / Matematik / Sayilar ve Islemler / Carpanlar ve Katlar'
  })

  await check('question ekleniyor ve search_vector trigger ile doluyor', async () => {
    const question = await db.query(
      `insert into public.questions (topic_id, stem, options, correct_option, difficulty, is_published)
       values (
         $1,
         'Asagidakilerden hangisi 24 sayisinin carpanidir?',
         '[{"key":"A","text":"5"},{"key":"B","text":"6"},{"key":"C","text":"7"},{"key":"D","text":"9"}]'::jsonb,
         'B', 2, true
       )
       returning id, search_vector`,
      [ids.topic],
    )
    ids.question = question.rows[0].id
    assert(question.rows[0].search_vector, 'search_vector bos; trigger calismamis.')

    const { rows } = await db.query(
      `select 1 from public.questions
        where id = $1 and search_vector @@ plainto_tsquery('simple', 'carpanidir')`,
      [ids.question],
    )
    assert(rows.length === 1, 'search_vector uretildi ama arama eslesmedi.')
    return 'gin(search_vector) uzerinden eslesti'
  })

  await check('yanlis correct_option validate_question_options ile reddediliyor', async () => {
    // Bir check constraint jsonb dizisinin icine bakamaz; kural trigger'da.
    return await expectError(
      db,
      `insert into public.questions (topic_id, stem, options, correct_option)
       values ($1, 'Bozuk soru', '[{"key":"A","text":"1"},{"key":"B","text":"2"}]'::jsonb, 'Z')`,
      [ids.topic],
      'siklar arasinda bulunamadi',
    )
  })

  await check('attempt (soru cozumu) kaydediliyor', async () => {
    const attempt = await db.query(
      `insert into public.attempts (user_id, question_id, topic_id, source, selected_option, is_correct, time_spent_ms)
       values ($1, $2, $3, 'quick_practice', 'B', true, 8400)
       returning id, answered_at`,
      [studentId, ids.question, ids.topic],
    )
    assert(attempt.rows[0].id, 'attempt eklenemedi.')

    // Zorunlu indeksin (user_id, topic_id, answered_at desc) tasidigi
    // erisim deseni: kullanicinin bir konudaki son cozumleri.
    const { rows } = await db.query(
      `select id, is_correct from public.attempts
        where user_id = $1 and topic_id = $2
        order by answered_at desc
        limit 20`,
      [studentId, ids.topic],
    )
    assert(rows.length === 1, `beklenen 1 cozum, gelen ${rows.length}`)
    assert(rows[0].is_correct === true, 'is_correct yazilmadi.')
    return 'user_id + topic_id + answered_at desc ile okundu'
  })

  await check("updated_at trigger'i icerik guncellemesinde zaman damgasini tazeliyor", async () => {
    const before = await db.query('select updated_at from public.topics where id = $1', [ids.topic])
    await db.query(
      `update public.topics set title = 'Carpanlar ve Katlar (guncel)' where id = $1`,
      [ids.topic],
    )
    const after = await db.query('select updated_at from public.topics where id = $1', [ids.topic])
    assert(
      after.rows[0].updated_at > before.rows[0].updated_at,
      "updated_at degismedi; set_updated_at trigger'i baglanmamis.",
    )
    return 'topics.updated_at ilerledi'
  })

  await check('salt-ekleme tablolarinda updated_at kolonu yok', async () => {
    const { rows } = await db.query(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
                            and a.attnum > 0 and not a.attisdropped
        where n.nspname = 'public'
          and c.relname in ('attempts','xp_events','mastery_history','video_notes',
                            'help_messages','notifications','payments')`,
    )
    assert(
      rows.length === 0,
      `updated_at tasiyan salt-ekleme tablolari: ${rows.map((r) => r.relname).join(', ')}`,
    )
    return '7 tablo temiz'
  })

  // -------------------------------------------------------------------------
  console.log(`\n${c.bold}3. Is kurali trigger'lari${c.reset}`)
  // -------------------------------------------------------------------------
  await check("bir ogrenciye 2 veli baglanabiliyor, 3.'su reddediliyor", async () => {
    const p1 = await createUser(db, { email: 'veli1@zihin.test', role: 'parent' })
    const p2 = await createUser(db, { email: 'veli2@zihin.test', role: 'parent' })
    const p3 = await createUser(db, { email: 'veli3@zihin.test', role: 'parent' })

    await db.query('insert into public.parent_links (parent_id, student_id) values ($1, $2)', [
      p1,
      studentId,
    ])
    await db.query('insert into public.parent_links (parent_id, student_id) values ($1, $2)', [
      p2,
      studentId,
    ])

    const message = await expectError(
      db,
      'insert into public.parent_links (parent_id, student_id) values ($1, $2)',
      [p3, studentId],
      'en fazla 2 veli',
    )

    const { rows } = await db.query(
      `select count(*)::int as n from public.parent_links
        where student_id = $1 and status = 'active'`,
      [studentId],
    )
    assert(rows[0].n === 2, `sinir asildi: ${rows[0].n} aktif baglanti.`)
    return message
  })

  await check('iptal edilmis baglantiyi tekrar aktiflestirmek de sinira takiliyor', async () => {
    // Trigger yalnizca INSERT'te calissaydi bu yol siniri sessizce asardi.
    const revoked = await createUser(db, { email: 'veli4@zihin.test', role: 'parent' })
    await db.query(
      `insert into public.parent_links (parent_id, student_id, status)
       values ($1, $2, 'revoked')`,
      [revoked, studentId],
    )
    return await expectError(
      db,
      `update public.parent_links set status = 'active'
        where parent_id = $1 and student_id = $2`,
      [revoked, studentId],
      'en fazla 2 veli',
    )
  })

  await check("bir yardim talebine 5 mesaj girebiliyor, 6.'si reddediliyor", async () => {
    const request = await db.query(
      `insert into public.help_requests (student_id, topic_id, body)
       values ($1, $2, 'Bu soruyu cozemedim, yardim eder misiniz?')
       returning id`,
      [studentId, ids.topic],
    )
    const requestId = request.rows[0].id

    for (let i = 1; i <= 5; i += 1) {
      await db.query(
        'insert into public.help_messages (request_id, sender_id, body) values ($1, $2, $3)',
        [requestId, studentId, `Mesaj ${i}`],
      )
    }

    const message = await expectError(
      db,
      'insert into public.help_messages (request_id, sender_id, body) values ($1, $2, $3)',
      [requestId, studentId, 'Mesaj 6'],
      'en fazla 5 mesaj',
    )

    const { rows } = await db.query(
      'select count(*)::int as n from public.help_messages where request_id = $1',
      [requestId],
    )
    assert(rows[0].n === 5, `sinir asildi: ${rows[0].n} mesaj.`)
    return message
  })

  // -------------------------------------------------------------------------
  console.log(`\n${c.bold}4. Butunluk ve temizlik${c.reset}`)
  // -------------------------------------------------------------------------
  await check('public.tr_today() Turkiye gununu donduruyor', async () => {
    const { rows } = await db.query(
      `select public.tr_today() as today,
              public.tr_today() = ((now() at time zone 'UTC') + interval '3 hours')::date as matches`,
    )
    assert(rows[0].matches === true, 'tr_today() UTC+3 gunu ile ortusmuyor.')
    return String(rows[0].today).slice(0, 10)
  })

  await check('auth.users silinince profil ve tum aktivitesi cascade ile gidiyor', async () => {
    const doomed = await createUser(db, { email: 'silinecek@zihin.test' })
    await db.query(
      `insert into public.attempts (user_id, question_id, topic_id, source)
       values ($1, $2, $3, 'quick_practice')`,
      [doomed, ids.question, ids.topic],
    )
    await db.query('delete from auth.users where id = $1', [doomed])

    const profile = await db.query('select 1 from public.profiles where id = $1', [doomed])
    const attempts = await db.query('select 1 from public.attempts where user_id = $1', [doomed])
    assert(profile.rows.length === 0, 'profil silinmedi.')
    assert(attempts.rows.length === 0, 'cozum kayitlari silinmedi.')
    return 'auth.users -> profiles -> attempts'
  })

  await check("sinav silinince profiles.exam_id null'lanip profil korunuyor", async () => {
    const tempExam = await db.query(
      `insert into public.exams (code, name) values ('GECICI', 'Gecici Sinav') returning id`,
    )
    await db.query('update public.profiles set exam_id = $1 where id = $2', [
      tempExam.rows[0].id,
      studentId,
    ])
    await db.query('delete from public.exams where id = $1', [tempExam.rows[0].id])

    const { rows } = await db.query('select exam_id from public.profiles where id = $1', [
      studentId,
    ])
    assert(rows.length === 1, 'profil sinavla birlikte silindi (on delete set null bekleniyordu).')
    assert(rows[0].exam_id === null, `exam_id null'lanmadi: ${rows[0].exam_id}`)
    return 'profiles_exam_id_fkey = set null'
  })
} catch (error) {
  exitCode = 1
  console.error(`\n${c.red}Kosum hatasi:${c.reset}`, error.message)
  if (verbose) console.error(error.stack)
} finally {
  await harness.stop()
}

console.log('')
if (failures.length > 0) {
  exitCode = 1
  console.log(
    `${c.red}${c.bold}${failures.length} kontrol basarisiz${c.reset} ${c.dim}(${passed} basarili)${c.reset}`,
  )
  for (const f of failures) console.log(`  ${c.red}✗${c.reset} ${f.label}`)
} else if (exitCode === 0) {
  console.log(`${c.green}${c.bold}${passed} kontrolun tamami gecti — sema calisiyor.${c.reset}`)
}

process.exit(exitCode)
