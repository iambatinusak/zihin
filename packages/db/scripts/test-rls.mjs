#!/usr/bin/env node
/**
 * `pnpm --filter @zihin/db test:rls` — RLS politikalarinin DAVRANISINI dogrular.
 *
 * `verify-schema.mjs` politikalarin VAR OLDUGUNU kontrol eder; bu betik
 * politikalarin DOGRU SEYI YAPTIGINI kontrol eder. Sartnamedeki rol matrisinin
 * her satiri burada calistirilabilir bir iddiaya karsilik gelir.
 *
 * Yontem: gomulu Postgres uzerinde `set local role authenticated` +
 * `request.jwt.claims` ayarlanir; `auth.uid()` boylece Supabase'deki gibi
 * cozulur. Fixture verisi superuser olarak (RLS atlanarak) yazilir, iddialar
 * ise her zaman ilgili rolun gozunden calistirilir.
 */
import { startPostgres, applyShim, applyMigrations, asUser, asAnon } from './lib/harness.mjs'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
}

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ${c.green}✓${c.reset} ${label}`)
  } else {
    failed++
    console.log(
      `  ${c.red}✗ ${label}${c.reset}${detail ? `\n      ${c.dim}${detail}${c.reset}` : ''}`,
    )
  }
}

function group(title) {
  console.log(`\n${c.bold}${title}${c.reset}`)
}

/** Bir sorgunun hata firlatmasini bekler; hata mesajini doner. */
async function expectError(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error.message
  }
}

const harness = await startPostgres({ port: 55435 })
const { client } = harness

try {
  await applyShim(client)
  const applied = await applyMigrations(client, { stopOnError: true })
  const bad = applied.find((r) => !r.ok)
  if (bad) {
    console.error(`Migration basarisiz: ${bad.file}\n${bad.error.message}`)
    process.exit(1)
  }

  // ---------------------------------------------------------------------
  // Fixture — superuser olarak yazilir, RLS atlanir.
  // ---------------------------------------------------------------------
  const ids = {}
  const mkUser = async (key, email, role) => {
    const { rows } = await client.query(
      // jsonb_build_object polimorfiktir; Postgres parametre tipini
      // cikaramadigi icin acikca ::text veriyoruz.
      `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
       values ($1, now(), jsonb_build_object('full_name', $2::text, 'role', $3::text))
       returning id`,
      [email, key, role],
    )
    ids[key] = rows[0].id
    // handle_new_user tetikleyicisi profili olusturur; rolu kesinlestir.
    await client.query(`update public.profiles set role = $2 where id = $1`, [ids[key], role])
    return ids[key]
  }

  await mkUser('studentA', 'a@test.local', 'student')
  await mkUser('studentB', 'b@test.local', 'student')
  await mkUser('parent', 'p@test.local', 'parent')
  await mkUser('teacher', 't@test.local', 'teacher')
  await mkUser('editor', 'e@test.local', 'editor')
  await mkUser('admin', 'ad@test.local', 'admin')

  await client.query(`insert into public.parent_links (parent_id, student_id) values ($1, $2)`, [
    ids.parent,
    ids.studentA,
  ])
  await client.query(
    `insert into public.teacher_assignments (teacher_id, student_id) values ($1, $2)`,
    [ids.teacher, ids.studentA],
  )

  const { rows: examRows } = await client.query(
    `insert into public.exams (code, name, wrong_penalty_divisor, is_active)
     values ('TEST', 'Test Sinavi', 4, true) returning id`,
  )
  ids.exam = examRows[0].id
  const { rows: subjRows } = await client.query(
    `insert into public.subjects (exam_id, name, slug) values ($1, 'Matematik', 'matematik')
     returning id`,
    [ids.exam],
  )
  ids.subject = subjRows[0].id
  const { rows: unitRows } = await client.query(
    `insert into public.units (subject_id, name, slug) values ($1, 'Temel', 'temel') returning id`,
    [ids.subject],
  )
  ids.unit = unitRows[0].id
  const { rows: topicRows } = await client.query(
    `insert into public.topics (unit_id, title, slug) values ($1, 'Sayilar', 'sayilar') returning id`,
    [ids.unit],
  )
  ids.topic = topicRows[0].id

  const mkQuestion = async (published) => {
    const { rows } = await client.query(
      `insert into public.questions
         (topic_id, stem, options, correct_option, explanation, is_published)
       values ($1, $2,
         '[{"key":"A","text":"1"},{"key":"B","text":"2"}]'::jsonb,
         'A', 'Cunku bir.', $3)
       returning id`,
      [ids.topic, published ? 'Yayindaki soru' : 'Taslak soru', published],
    )
    return rows[0].id
  }
  ids.question = await mkQuestion(true)
  ids.draftQuestion = await mkQuestion(false)

  for (const who of ['studentA', 'studentB']) {
    await client.query(
      `insert into public.attempts (user_id, question_id, topic_id, source, is_correct)
       values ($1, $2, $3, 'topic_test', true)`,
      [ids[who], ids.question, ids.topic],
    )
    await client.query(
      `insert into public.topic_mastery (user_id, topic_id, mastery, status, attempts_count)
       values ($1, $2, 60, 'medium', 1)`,
      [ids[who], ids.topic],
    )
  }

  const { rows: helpRows } = await client.query(
    `insert into public.help_requests (student_id, body) values ($1, 'Yardim eder misiniz?')
     returning id`,
    [ids.studentA],
  )
  ids.helpRequest = helpRows[0].id

  const asA = (fn) => asUser(client, { userId: ids.studentA }, fn)
  const asParent = (fn) => asUser(client, { userId: ids.parent }, fn)
  const asTeacher = (fn) => asUser(client, { userId: ids.teacher }, fn)
  const asEditor = (fn) => asUser(client, { userId: ids.editor }, fn)
  const asAdmin = (fn) => asUser(client, { userId: ids.admin }, fn)
  const asVisitor = (fn) => asAnon(client, fn)

  // ---------------------------------------------------------------------
  group('Ogrenci kendi verisi')

  await asA(async (db) => {
    const { rows } = await db.query(`select id from public.attempts`)
    check('Ogrenci A kendi denemelerini okur', rows.length === 1, `${rows.length} satir`)
  })

  await asA(async (db) => {
    const { rows } = await db.query(`select id from public.attempts where user_id = $1`, [
      ids.studentB,
    ])
    check(
      'Ogrenci A, ogrenci B nin denemelerini GOREMEZ',
      rows.length === 0,
      `${rows.length} satir sizdi`,
    )
  })

  await asA(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.attempts (user_id, question_id, topic_id, source, is_correct)
         values ($1, $2, $3, 'topic_test', true)`,
        [ids.studentB, ids.question, ids.topic],
      ),
    )
    check('Ogrenci A, B adina deneme YAZAMAZ', msg !== null, 'hata bekleniyordu')
  })

  // ---------------------------------------------------------------------
  group('Veli erisimi')

  await asParent(async (db) => {
    const { rows } = await db.query(`select id from public.attempts where user_id = $1`, [
      ids.studentA,
    ])
    check('Bagli veli, ogrencisinin denemelerini okur', rows.length === 1, `${rows.length} satir`)
  })

  await asParent(async (db) => {
    const { rows } = await db.query(`select user_id from public.topic_mastery where user_id = $1`, [
      ids.studentA,
    ])
    check('Bagli veli, ogrencisinin yetkinligini okur', rows.length === 1)
  })

  await asParent(async (db) => {
    const { rows } = await db.query(`select id from public.attempts where user_id = $1`, [
      ids.studentB,
    ])
    check('Veli, bagli OLMADIGI ogrenciyi goremez', rows.length === 0, `${rows.length} satir sizdi`)
  })

  await asParent(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.attempts (user_id, question_id, topic_id, source, is_correct)
         values ($1, $2, $3, 'topic_test', true)`,
        [ids.studentA, ids.question, ids.topic],
      ),
    )
    check('Veli deneme YAZAMAZ (icerik cozemez)', msg !== null)
  })

  await asParent(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.video_progress (user_id, video_id, last_position_seconds)
         values ($1, gen_random_uuid(), 10)`,
        [ids.studentA],
      ),
    )
    check('Veli video ilerlemesi YAZAMAZ (icerik izleyemez)', msg !== null)
  })

  // ---------------------------------------------------------------------
  group('Ogretmen erisimi')

  await asTeacher(async (db) => {
    const { rows } = await db.query(`select user_id from public.topic_mastery where user_id = $1`, [
      ids.studentA,
    ])
    check('Atanmis ogretmen, ogrencisinin yetkinligini okur', rows.length === 1)
  })

  await asTeacher(async (db) => {
    const { rows } = await db.query(`select user_id from public.topic_mastery where user_id = $1`, [
      ids.studentB,
    ])
    check('Ogretmen, atanmadigi ogrenciyi goremez', rows.length === 0)
  })

  // ---------------------------------------------------------------------
  group('Dogru cevap sizintisi (sartnamenin en kritik kurali)')

  await asA(async (db) => {
    const msg = await expectError(() => db.query(`select correct_option from public.questions`))
    check('Ogrenci questions.correct_option OKUYAMAZ', msg !== null, msg ?? 'sizdi!')
  })

  await asA(async (db) => {
    const msg = await expectError(() => db.query(`select explanation from public.questions`))
    check('Ogrenci questions.explanation OKUYAMAZ', msg !== null, msg ?? 'sizdi!')
  })

  await asA(async (db) => {
    const { rows } = await db.query(`select id, stem from public.questions_public`)
    check('Ogrenci questions_public gorunumunden soruyu okuyabilir', rows.length >= 1)
  })

  await asA(async (db) => {
    const { rows } = await db.query(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='questions_public'
          and column_name in ('correct_option','explanation')`,
    )
    check('questions_public gorunumu cevap kolonlarini ICERMEZ', rows.length === 0)
  })

  // ---------------------------------------------------------------------
  group('Yayinlanmamis icerik')

  await asA(async (db) => {
    const { rows } = await db.query(`select id from public.questions_public`)
    check(
      'Ogrenci yalnizca yayindaki soruyu gorur',
      rows.length === 1,
      `${rows.length} soru gorundu (taslak sizmis olabilir)`,
    )
  })

  await asEditor(async (db) => {
    const { rows } = await db.query(`select id from public.questions`)
    check('Editor taslak dahil tum sorulari gorur', rows.length === 2, `${rows.length} soru`)
  })

  // ---------------------------------------------------------------------
  group('Icerik yazma yetkisi')

  await asEditor(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.questions (topic_id, stem, options, correct_option)
         values ($1, 'Editor sorusu',
           '[{"key":"A","text":"1"},{"key":"B","text":"2"}]'::jsonb, 'A')`,
        [ids.topic],
      ),
    )
    check('Editor soru ekleyebilir', msg === null, msg ?? '')
  })

  await asA(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.questions (topic_id, stem, options, correct_option)
         values ($1, 'Ogrenci sorusu',
           '[{"key":"A","text":"1"},{"key":"B","text":"2"}]'::jsonb, 'A')`,
        [ids.topic],
      ),
    )
    check('Ogrenci soru EKLEYEMEZ', msg !== null)
  })

  // ---------------------------------------------------------------------
  group('Kendi profilini yukseltme girisimi')

  await asA(async (db) => {
    const msg = await expectError(() =>
      db.query(
        `insert into public.xp_events (user_id, amount, reason)
      values ($1, 9999, 'video_completed')`,
        [ids.studentA],
      ),
    )
    check('Ogrenci kendine XP olayi YAZAMAZ', msg !== null)
  })

  await asA(async (db) => {
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.studentA])
    const { rows } = await db.query(`select role from public.profiles where id = $1`, [
      ids.studentA,
    ])
    check(
      'Ogrenci kendi rolunu admin YAPAMAZ (trigger geri alir)',
      rows[0]?.role === 'student',
      `rol: ${rows[0]?.role}`,
    )
  })

  await asA(async (db) => {
    await db.query(`update public.profiles set xp = 999999 where id = $1`, [ids.studentA])
    const { rows } = await db.query(`select xp from public.profiles where id = $1`, [ids.studentA])
    check('Ogrenci kendi XP sini elle ARTIRAMAZ', Number(rows[0]?.xp) === 0, `xp: ${rows[0]?.xp}`)
  })

  // ---------------------------------------------------------------------
  /*
   * YONETICININ YAZMASI GERCEKTEN INIYOR MU?
   *
   * `protect_profile_fields` korunan kolonlari SESSIZCE eski degerine dondurur
   * — hata firlatmaz. Yani yanlis kurgulanmis bir yonetim akisi "kaydedildi"
   * der ve hicbir sey degismez. Yukarida bu trigger'in ogrenciyi durdurdugu
   * dogrulaniyor; asagida trigger'in YONETICIYI DURDURMADIGI dogrulanir.
   * Ikisinden yalnizca biri test edilirse panel sessizce ise yaramaz hale
   * gelir ve kimse fark etmez.
   *
   * Uygulama tarafi ayni yolu kullanir: admin/kullanicilar/actions.ts rol ve
   * aski yazmasini OTURUM ISTEMCISIYLE yapar (service-role ile degil).
   */
  group('Yonetici yazmasi (trigger muafiyeti)')

  await asAdmin(async (db) => {
    await db.query(`update public.profiles set role = 'editor' where id = $1`, [ids.studentB])
    const { rows } = await db.query(`select role from public.profiles where id = $1`, [
      ids.studentB,
    ])
    check(
      'Admin BASKA kullanicinin rolunu degistirebilir (trigger geri ALMAZ)',
      rows[0]?.role === 'editor',
      `rol: ${rows[0]?.role}`,
    )
  })

  await asAdmin(async (db) => {
    await db.query(`update public.profiles set suspended_at = now() where id = $1`, [ids.studentB])
    const { rows } = await db.query(`select suspended_at from public.profiles where id = $1`, [
      ids.studentB,
    ])
    check('Admin baska kullaniciyi askiya alabilir', rows[0]?.suspended_at !== null)
  })

  await asAdmin(async (db) => {
    await db.query(`update public.profiles set suspended_at = null where id = $1`, [ids.studentB])
    await db.query(`update public.profiles set role = 'student' where id = $1`, [ids.studentB])
    const { rows } = await db.query(
      `select role, suspended_at from public.profiles where id = $1`,
      [ids.studentB],
    )
    check(
      'Admin askiyi kaldirip rolu geri alabilir',
      rows[0]?.role === 'student' && rows[0]?.suspended_at === null,
    )
  })

  /*
   * Editor yonetim duzenini adminle PAYLASIR. Menude dugmeyi gizlemek bir
   * kontrol degildir; asil kapi burasi: `profiles_update_self_or_admin`
   * editore baskasinin satirini vermez, trigger de rolu geri alir.
   */
  // Sonuc SUPERUSER olarak okunur: editor baskasinin profilini zaten
  // OKUYAMAZ (`profiles_select_self_or_guardian`), yani kendi gozunden bakmak
  // "satir yok" der ve testi yanlis sebeple gecirirdi.
  await asEditor(async (db) => {
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.studentB])
  })
  {
    const { rows } = await client.query(`select role from public.profiles where id = $1`, [
      ids.studentB,
    ])
    check(
      'Editor BASKA kullanicinin rolunu DEGISTIREMEZ',
      rows[0]?.role === 'student',
      `rol: ${rows[0]?.role}`,
    )
  }

  await asEditor(async (db) => {
    await db.query(`update public.profiles set suspended_at = now() where id = $1`, [ids.studentA])
  })
  {
    const { rows } = await client.query(`select suspended_at from public.profiles where id = $1`, [
      ids.studentA,
    ])
    check(
      'Editor baska kullaniciyi ASKIYA ALAMAZ',
      rows[0]?.suspended_at === null,
      `suspended_at: ${rows[0]?.suspended_at}`,
    )
  }

  await asEditor(async (db) => {
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.editor])
    const { rows } = await db.query(`select role from public.profiles where id = $1`, [ids.editor])
    check(
      'Editor KENDINI admin YAPAMAZ (trigger geri alir)',
      rows[0]?.role === 'editor',
      `rol: ${rows[0]?.role}`,
    )
  })

  // ---------------------------------------------------------------------
  /*
   * Mufredat siralamasi `upsert` (INSERT ... ON CONFLICT UPDATE) ile TEK
   * yazmada gonderiliyor; bu, INSERT politikasindan da gecmek demek. Sadece
   * UPDATE'i test etmek bu yolu acikta birakirdi.
   */
  group('Mufredat siralamasi (editor upsert)')

  await asEditor(async (db) => {
    const { rows: before } = await db.query(`select * from public.topics where id = $1`, [
      ids.topic,
    ])
    const row = before[0]
    const msg = await expectError(() =>
      db.query(
        `insert into public.topics (id, unit_id, title, slug, order_index)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set order_index = excluded.order_index`,
        [row.id, row.unit_id, row.title, row.slug, 7],
      ),
    )
    const { rows: after } = await db.query(`select order_index from public.topics where id = $1`, [
      ids.topic,
    ])
    check(
      'Editor konu sirasini upsert ile yazabilir',
      msg === null && Number(after[0]?.order_index) === 7,
      msg ?? `order_index: ${after[0]?.order_index}`,
    )
  })

  // ---------------------------------------------------------------------
  group('Anonim erisim')

  await asVisitor(async (db) => {
    const { rows } = await db.query(`select id from public.profiles`)
    check('Anonim kullanici profil OKUYAMAZ', rows.length === 0, `${rows.length} satir sizdi`)
  })

  await asVisitor(async (db) => {
    const { rows } = await db.query(`select id from public.attempts`)
    check('Anonim kullanici deneme OKUYAMAZ', rows.length === 0, `${rows.length} satir sizdi`)
  })

  // ---------------------------------------------------------------------
  group('Veritabani is kurallari')

  const { rows: p2 } = await client.query(
    `insert into auth.users (email, email_confirmed_at) values ('p2@test.local', now())
     returning id`,
  )
  await client.query(`update public.profiles set role='parent' where id=$1`, [p2[0].id])
  await client.query(`insert into public.parent_links (parent_id, student_id) values ($1,$2)`, [
    p2[0].id,
    ids.studentA,
  ])

  const { rows: p3 } = await client.query(
    `insert into auth.users (email, email_confirmed_at) values ('p3@test.local', now())
     returning id`,
  )
  await client.query(`update public.profiles set role='parent' where id=$1`, [p3[0].id])
  const thirdParent = await expectError(() =>
    client.query(`insert into public.parent_links (parent_id, student_id) values ($1,$2)`, [
      p3[0].id,
      ids.studentA,
    ]),
  )
  check(
    'Ucuncu veli baglantisi REDDEDILIR (en fazla 2 veli)',
    thirdParent !== null && /en fazla 2 veli/i.test(thirdParent),
    thirdParent ?? 'hata bekleniyordu',
  )

  for (let i = 0; i < 5; i++) {
    await client.query(
      `insert into public.help_messages (request_id, sender_id, body) values ($1,$2,$3)`,
      [ids.helpRequest, ids.studentA, `mesaj ${i + 1}`],
    )
  }
  const sixth = await expectError(() =>
    client.query(
      `insert into public.help_messages (request_id, sender_id, body) values ($1,$2,'altinci')`,
      [ids.helpRequest, ids.studentA],
    ),
  )
  check(
    'Altinci yardim mesaji REDDEDILIR (en fazla 5 mesaj)',
    sixth !== null && /en fazla 5 mesaj/i.test(sixth),
    sixth ?? 'hata bekleniyordu',
  )

  // ---------------------------------------------------------------------
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
