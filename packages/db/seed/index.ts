#!/usr/bin/env tsx
/**
 * `pnpm seed` — veritabanını gerçekçi başlangıç verisiyle doldurur.
 *
 * Doğrudan Postgres'e bağlanır (Supabase JS istemcisi değil), çünkü:
 *  - `auth.users` satırlarını ve şifre özetlerini yazması gerekiyor,
 *  - RLS'i atlaması gerekiyor,
 *  - aynı kod hem `supabase start` yığınına hem de Docker'sız gömülü
 *    doğrulama koşumuna karşı çalışabilsin diye.
 *
 * Bağlantı: `SUPABASE_DB_URL` ortam değişkeni, ya da `--url` argümanı.
 *
 * Yeniden çalıştırılabilir: her adım `on conflict` ile upsert eder, demo
 * aktivite geçmişi ise önce temizlenip yeniden üretilir. Tohumlu rastgelelik
 * sayesinde her koşumda aynı veri oluşur.
 */
import { Client } from 'pg'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { tytExam } from './curriculum/tyt'
import { aytExam } from './curriculum/ayt'
import { lgsExam } from './curriculum/lgs'
import { kpssExam } from './curriculum/kpss'
import { badges, packages, testUsers, TEST_PASSWORD, DEMO_ACTIVITY } from './static'
import { createRng } from './lib/rng'
import type { SeedExam, SeedSubjectContent, SeedTopic } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(HERE, 'content')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

const log = {
  step: (m: string) => console.log(`\n${c.blue}${c.bold}▸${c.reset} ${c.bold}${m}${c.reset}`),
  ok: (m: string) => console.log(`  ${c.green}✓${c.reset} ${m}`),
  warn: (m: string) => console.log(`  ${c.yellow}!${c.reset} ${m}`),
  dim: (m: string) => console.log(`  ${c.dim}${m}${c.reset}`),
}

// ---------------------------------------------------------------------------

function resolveConnectionString(): string {
  const fromArg = process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length)
  const url = fromArg || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (!url) {
    console.error(
      `${c.red}Bağlantı adresi yok.${c.reset}\n` +
        `  .env.local içindeki SUPABASE_DB_URL değerini doldurun ya da --url=... verin.\n` +
        `  Yerel Supabase varsayılanı:\n` +
        `    postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
    )
    process.exit(1)
  }
  return url
}

const EXAMS: SeedExam[] = [lgsExam, tytExam, aytExam, kpssExam]

/** İçerik dosyalarını `examCode/subjectSlug/unitSlug/topicSlug` ile eşlenebilir hâle getirir. */
type ContentIndex = Map<string, SeedSubjectContent['units'][number]['topics'][number]>

async function loadContent(): Promise<ContentIndex> {
  const index: ContentIndex = new Map()
  if (!existsSync(CONTENT_DIR)) return index

  for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.ts'))) {
    const mod = (await import(pathToFileURL(join(CONTENT_DIR, file)).href)) as {
      content?: SeedSubjectContent
    }
    const content = mod.content
    if (!content) continue
    for (const unit of content.units) {
      for (const topic of unit.topics) {
        index.set(`${content.examCode}/${content.subjectSlug}/${unit.slug}/${topic.slug}`, topic)
      }
    }
  }
  return index
}

// ---------------------------------------------------------------------------

async function main() {
  const client = new Client({ connectionString: resolveConnectionString() })
  await client.connect()
  await client.query("set client_encoding to 'UTF8'")

  const rng = createRng(DEMO_ACTIVITY.seed)
  const contentIndex = await loadContent()

  try {
    await client.query('begin')

    // ─── Müfredat ─────────────────────────────────────────────────────────
    log.step('Müfredat ağacı')

    const topicIdBySlugPath = new Map<string, string>()
    const topicMeta = new Map<string, { examCode: string; subjectId: string; topic: SeedTopic }>()
    const subjectIdBySlug = new Map<string, string>()
    const unitIdBySlug = new Map<string, string>()
    const examIdByCode = new Map<string, string>()

    let subjectTotal = 0
    let unitTotal = 0
    let topicTotal = 0

    for (const exam of EXAMS) {
      const { rows } = await client.query(
        `insert into public.exams
           (code, name, description, wrong_penalty_divisor, default_exam_date,
            total_questions, duration_minutes, order_index, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,true)
         on conflict (code) do update set
           name = excluded.name,
           description = excluded.description,
           wrong_penalty_divisor = excluded.wrong_penalty_divisor,
           default_exam_date = excluded.default_exam_date,
           total_questions = excluded.total_questions,
           duration_minutes = excluded.duration_minutes,
           order_index = excluded.order_index
         returning id`,
        [
          exam.code,
          exam.name,
          exam.description,
          exam.wrongPenaltyDivisor,
          exam.defaultExamDate,
          exam.totalQuestions,
          exam.durationMinutes,
          exam.orderIndex,
        ],
      )
      const examId = rows[0].id as string
      examIdByCode.set(exam.code, examId)

      for (const subject of exam.subjects) {
        const { rows: sr } = await client.query(
          `insert into public.subjects (exam_id, name, slug, order_index, color, question_count)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (exam_id, slug) do update set
             name = excluded.name, order_index = excluded.order_index,
             color = excluded.color, question_count = excluded.question_count
           returning id`,
          [
            examId,
            subject.name,
            subject.slug,
            subject.orderIndex,
            subject.color,
            subject.questionCount,
          ],
        )
        const subjectId = sr[0].id as string
        subjectIdBySlug.set(`${exam.code}/${subject.slug}`, subjectId)
        subjectTotal++

        for (const unit of subject.units) {
          const { rows: ur } = await client.query(
            `insert into public.units (subject_id, name, slug, order_index)
             values ($1,$2,$3,$4)
             on conflict (subject_id, slug) do update set
               name = excluded.name, order_index = excluded.order_index
             returning id`,
            [subjectId, unit.name, unit.slug, unit.orderIndex],
          )
          const unitId = ur[0].id as string
          unitIdBySlug.set(`${exam.code}/${subject.slug}/${unit.slug}`, unitId)
          unitTotal++

          for (const topic of unit.topics) {
            const key = `${exam.code}/${subject.slug}/${unit.slug}/${topic.slug}`
            const deep = contentIndex.get(key)

            const { rows: tr } = await client.query(
              `insert into public.topics
                 (unit_id, title, slug, order_index, estimated_minutes, difficulty,
                  exam_weight, memory_note)
               values ($1,$2,$3,$4,$5,$6,$7,$8)
               on conflict (unit_id, slug) do update set
                 title = excluded.title, order_index = excluded.order_index,
                 estimated_minutes = excluded.estimated_minutes,
                 difficulty = excluded.difficulty, exam_weight = excluded.exam_weight,
                 memory_note = coalesce(excluded.memory_note, public.topics.memory_note)
               returning id`,
              [
                unitId,
                topic.title,
                topic.slug,
                topic.orderIndex,
                topic.estimatedMinutes,
                topic.difficulty,
                topic.examWeight,
                deep?.memoryNote ?? null,
              ],
            )
            const topicId = tr[0].id as string
            topicIdBySlugPath.set(key, topicId)
            topicMeta.set(topicId, { examCode: exam.code, subjectId, topic })
            topicTotal++
          }
        }
      }
      log.ok(
        `${exam.code}: ${exam.subjects.length} ders, ` +
          `${exam.subjects.reduce((n, s) => n + s.units.length, 0)} ünite`,
      )
    }
    log.dim(`toplam ${subjectTotal} ders · ${unitTotal} ünite · ${topicTotal} konu`)

    // ─── İçerik (kazanım, video, soru, kart) ──────────────────────────────
    log.step('Ders içeriği')

    let outcomeTotal = 0
    let videoTotal = 0
    let questionTotal = 0
    let cardTotal = 0
    let checkpointTotal = 0

    /** Konu bazında soru id listesi — testler ve denemeler bundan kurulur. */
    const questionIdsByTopic = new Map<string, string[]>()

    for (const [key, deep] of contentIndex) {
      const topicId = topicIdBySlugPath.get(key)
      if (!topicId) {
        log.warn(`içerik dosyasındaki konu müfredatta yok, atlandı: ${key}`)
        continue
      }

      // Kazanımlar
      const outcomeIdByCode = new Map<string, string>()
      for (const outcome of deep.outcomes) {
        const { rows } = await client.query(
          `insert into public.outcomes (topic_id, code, description, order_index)
           values ($1,$2,$3,$4)
           on conflict (topic_id, code) do update set
             description = excluded.description, order_index = excluded.order_index
           returning id`,
          [topicId, outcome.code, outcome.description, outcome.orderIndex],
        )
        outcomeIdByCode.set(outcome.code, rows[0].id as string)
        outcomeTotal++
      }

      // Sorular — sıra korunur, checkpoint'ler indeksle bağlanır.
      const questionIds: string[] = []
      for (const q of deep.questions) {
        const { rows } = await client.query(
          `insert into public.questions
             (topic_id, outcome_id, type, stem, options, correct_option, explanation,
              difficulty, expected_seconds, tags, source, is_published)
           values ($1,$2,'multiple_choice',$3,$4::jsonb,$5,$6,$7,$8,$9,$10,true)
           returning id`,
          [
            topicId,
            q.outcomeCode ? (outcomeIdByCode.get(q.outcomeCode) ?? null) : null,
            q.stem,
            JSON.stringify(q.options),
            q.correctOption,
            q.explanation,
            q.difficulty,
            q.expectedSeconds,
            q.tags,
            q.source,
          ],
        )
        questionIds.push(rows[0].id as string)
        questionTotal++
      }
      questionIdsByTopic.set(topicId, questionIds)

      // Videolar + checkpoint soruları
      for (const v of deep.videos) {
        const { rows } = await client.query(
          `insert into public.videos
             (topic_id, title, type, provider, storage_path, duration_seconds,
              order_index, is_free_preview, is_published)
           values ($1,$2,$3,'supabase',$4,$5,$6,$7,true)
           returning id`,
          [
            topicId,
            v.title,
            v.type,
            // Gerçek video dosyaları depoya ayrıca yüklenir; yol şimdiden
            // deterministik olsun ki yükleme betiği eşleştirebilsin.
            `${key.replace(/\//g, '/')}/${v.type}-${v.orderIndex}.mp4`,
            v.durationSeconds,
            v.orderIndex,
            v.isFreePreview,
          ],
        )
        const videoId = rows[0].id as string
        videoTotal++

        for (const [i, cp] of v.checkpoints.entries()) {
          const questionId = questionIds[cp.questionIndex]
          if (!questionId) continue
          await client.query(
            `insert into public.video_checkpoints
               (video_id, question_id, timestamp_seconds, order_index)
             values ($1,$2,$3,$4)
             on conflict (video_id, timestamp_seconds) do nothing`,
            [videoId, questionId, cp.timestampSeconds, i],
          )
          checkpointTotal++
        }
      }

      // Hafıza kartları (editör kartı — herkese açık)
      for (const card of deep.flashcards) {
        await client.query(
          `insert into public.flashcards (topic_id, front, back, auto_generated, is_published)
           values ($1,$2,$3,false,true)`,
          [topicId, card.front, card.back],
        )
        cardTotal++
      }
    }

    log.ok(`${questionTotal} soru · ${cardTotal} kart · ${videoTotal} video`)
    log.dim(`${outcomeTotal} kazanım · ${checkpointTotal} video içi soru`)
    if (contentIndex.size < topicTotal) {
      log.warn(
        `${topicTotal - contentIndex.size} konu ağaçta var ama henüz içeriği yok ` +
          `(arayüzde "içerik hazırlanıyor" olarak görünür).`,
      )
    }

    // ─── Testler ───────────────────────────────────────────────────────────
    log.step('Testler')

    let topicTestCount = 0
    for (const [topicId, questionIds] of questionIdsByTopic) {
      if (questionIds.length < 10) continue
      const meta = topicMeta.get(topicId)
      if (!meta) continue

      const { rows } = await client.query(
        `insert into public.tests
           (type, title, exam_id, subject_id, topic_id, duration_seconds, is_published)
         values ('topic_test', $1, $2, $3, $4, $5, true)
         returning id`,
        [
          `${meta.topic.title} — Konu Testi`,
          examIdByCode.get(meta.examCode),
          meta.subjectId,
          topicId,
          // 10 soru × ortalama 90 sn; süre isteğe bağlı ama bir üst sınır iyi gelir.
          10 * 90,
        ],
      )
      const testId = rows[0].id as string
      for (const [i, qid] of questionIds.slice(0, 10).entries()) {
        await client.query(
          `insert into public.test_questions (test_id, question_id, order_index)
           values ($1,$2,$3) on conflict do nothing`,
          [testId, qid, i],
        )
      }
      topicTestCount++
    }
    log.ok(`${topicTestCount} konu testi`)

    // Ünite testleri — ünitedeki konulardan karışık 20 soru.
    let unitTestCount = 0
    for (const [unitKey, unitId] of unitIdBySlug) {
      const [examCode, subjectSlug, unitSlug] = unitKey.split('/')
      const pool: string[] = []
      for (const [topicKey, topicId] of topicIdBySlugPath) {
        if (!topicKey.startsWith(`${examCode}/${subjectSlug}/${unitSlug}/`)) continue
        pool.push(...(questionIdsByTopic.get(topicId) ?? []))
      }
      if (pool.length < 20) continue

      const subjectId = subjectIdBySlug.get(`${examCode}/${subjectSlug}`)
      const { rows } = await client.query(
        `insert into public.tests
           (type, title, exam_id, subject_id, unit_id, duration_seconds, is_published)
         values ('unit_test', $1, $2, $3, $4, $5, true)
         returning id`,
        [`${unitSlug} — Ünite Testi`, examIdByCode.get(examCode!), subjectId, unitId, 20 * 90],
      )
      const testId = rows[0].id as string
      for (const [i, qid] of rng.shuffle(pool).slice(0, 20).entries()) {
        await client.query(
          `insert into public.test_questions (test_id, question_id, order_index)
           values ($1,$2,$3) on conflict do nothing`,
          [testId, qid, i],
        )
      }
      unitTestCount++
    }
    log.ok(`${unitTestCount} ünite testi`)

    // Ünite testi başlığını okunur yap (slug yerine gerçek ad).
    await client.query(`
      update public.tests t
         set title = u.name || ' — Ünite Testi'
        from public.units u
       where t.unit_id = u.id and t.type = 'unit_test'
    `)

    // ─── Deneme sınavları ─────────────────────────────────────────────────
    log.step('Deneme sınavları')

    let mockCount = 0
    for (const exam of [tytExam, lgsExam]) {
      const examId = examIdByCode.get(exam.code)
      if (!examId) continue

      // Her dersten, sınavdaki soru sayısı oranında soru topla.
      const sections: Array<{ subjectName: string; questionIds: string[] }> = []
      for (const subject of exam.subjects) {
        const pool: string[] = []
        for (const [topicKey, topicId] of topicIdBySlugPath) {
          if (!topicKey.startsWith(`${exam.code}/${subject.slug}/`)) continue
          pool.push(...(questionIdsByTopic.get(topicId) ?? []))
        }
        if (pool.length === 0) continue
        // Havuz yetmiyorsa olan kadarını al — deneme yine de kurulabilsin.
        const take = Math.min(subject.questionCount, pool.length)
        sections.push({ subjectName: subject.name, questionIds: rng.shuffle(pool).slice(0, take) })
      }

      const total = sections.reduce((n, s) => n + s.questionIds.length, 0)
      if (total === 0) {
        log.warn(`${exam.code} denemesi kurulamadı — havuzda soru yok.`)
        continue
      }

      const { rows } = await client.query(
        `insert into public.tests
           (type, title, exam_id, duration_seconds, is_published, publish_at, config)
         values ('mock_exam', $1, $2, $3, true, now(), $4::jsonb)
         returning id`,
        [
          `${exam.code} Deneme Sınavı — 1`,
          examId,
          exam.durationMinutes * 60,
          JSON.stringify({
            sections: sections.map((s) => ({
              subject: s.subjectName,
              count: s.questionIds.length,
            })),
            targetQuestions: exam.totalQuestions,
          }),
        ],
      )
      const testId = rows[0].id as string

      let order = 0
      for (const section of sections) {
        for (const qid of section.questionIds) {
          await client.query(
            `insert into public.test_questions (test_id, question_id, order_index, section)
             values ($1,$2,$3,$4) on conflict do nothing`,
            [testId, qid, order++, section.subjectName],
          )
        }
      }
      mockCount++
      log.ok(
        `${exam.code} Deneme 1 — ${total}/${exam.totalQuestions} soru, ${exam.durationMinutes} dk` +
          (total < exam.totalQuestions ? ` ${c.dim}(havuz yetersiz)${c.reset}` : ''),
      )
    }
    if (mockCount === 0) log.warn('Deneme sınavı üretilemedi.')

    // ─── Rozetler ve paketler ─────────────────────────────────────────────
    log.step('Rozetler ve paketler')

    for (const badge of badges) {
      await client.query(
        `insert into public.badges (code, name, description, icon, rule, order_index)
         values ($1,$2,$3,$4,$5::jsonb,$6)
         on conflict (code) do update set
           name = excluded.name, description = excluded.description,
           icon = excluded.icon, rule = excluded.rule, order_index = excluded.order_index`,
        [
          badge.code,
          badge.name,
          badge.description,
          badge.icon,
          JSON.stringify(badge.rule),
          badge.orderIndex,
        ],
      )
    }
    log.ok(`${badges.length} rozet`)

    for (const pkg of packages) {
      const examId = examIdByCode.get(pkg.examCode)
      await client.query(
        `insert into public.packages
           (exam_id, name, description, duration_days, price_try, features, order_index, is_active)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,true)
         on conflict do nothing`,
        [
          examId,
          pkg.name,
          pkg.description,
          pkg.durationDays,
          pkg.priceTry,
          JSON.stringify(pkg.features),
          pkg.orderIndex,
        ],
      )
    }
    log.ok(`${packages.length} paket`)

    // ─── Test kullanıcıları ───────────────────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
      log.step('Test hesapları')
      log.warn('NODE_ENV=production — test hesapları oluşturulmadı.')
      await client.query('commit')
      return
    }

    log.step('Test hesapları')

    /*
     * Demo öğrencisi, İÇERİĞİ EN ÇOK OLAN sınava atanır.
     *
     * `static.ts` bir tercih belirtir (TYT), ancak içerik üretimi kademeli
     * ilerlediği için o sınavın henüz sorusu olmayabilir. Sabit bir sınava
     * bağlı kalmak, panelleri boş bir demo hesabı üretirdi — seed "başarılı"
     * görünüp ürün boş açılırdı. Bu yüzden seçim veriye bakarak yapılır.
     */
    const contentTopicsPerExam = new Map<string, number>()
    for (const key of contentIndex.keys()) {
      const examCode = key.split('/')[0]!
      contentTopicsPerExam.set(examCode, (contentTopicsPerExam.get(examCode) ?? 0) + 1)
    }
    const preferredExam = testUsers.find((u) => u.role === 'student')?.examCode ?? 'TYT'
    const demoExamCode =
      (contentTopicsPerExam.get(preferredExam) ?? 0) > 0
        ? preferredExam
        : ([...contentTopicsPerExam.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? preferredExam)

    if (demoExamCode !== preferredExam) {
      log.warn(
        `${preferredExam} sınavında henüz içerik yok; demo öğrencisi ${demoExamCode} sınavına ` +
          `atandı (${contentTopicsPerExam.get(demoExamCode)} konu içerikli).`,
      )
    }

    const userIdByEmail = new Map<string, string>()
    for (const user of testUsers) {
      const code = user.role === 'student' && user.examCode ? demoExamCode : user.examCode
      const examId = code ? examIdByCode.get(code) : null
      const exam = code ? EXAMS.find((e) => e.code === code) : undefined

      const { rows } = await client.query(
        `insert into auth.users
           (email, encrypted_password, email_confirmed_at, aud, role, raw_user_meta_data)
         values ($1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
                 'authenticated', 'authenticated',
                 jsonb_build_object('full_name', $3::text, 'role', $4::text))
         on conflict (email) do update set
           encrypted_password = excluded.encrypted_password,
           email_confirmed_at = now()
         returning id`,
        [user.email, user.password, user.fullName, user.role],
      )
      const userId = rows[0].id as string
      userIdByEmail.set(user.email, userId)

      // handle_new_user profili kurar; kalan alanları burada tamamlıyoruz.
      await client.query(
        `update public.profiles set
           role = $2, full_name = $3, display_name = $4, grade = $5,
           exam_id = $6, target_exam_date = $7, daily_minutes = coalesce($8, daily_minutes),
           onboarding_completed = true, onboarding_step = 6, kvkk_consent_at = now()
         where id = $1`,
        [
          userId,
          user.role,
          user.fullName,
          user.displayName,
          user.grade ?? null,
          examId ?? null,
          exam?.defaultExamDate ?? null,
          user.dailyMinutes ?? null,
        ],
      )
    }
    log.ok(`${testUsers.length} hesap (şifre: ${TEST_PASSWORD})`)

    const studentId = userIdByEmail.get('ogrenci@test.com')!
    const parentId = userIdByEmail.get('veli@test.com')!
    const teacherId = userIdByEmail.get('ogretmen@test.com')!

    await client.query(
      `insert into public.parent_links (parent_id, student_id) values ($1,$2)
       on conflict do nothing`,
      [parentId, studentId],
    )
    await client.query(
      `insert into public.teacher_assignments (teacher_id, student_id) values ($1,$2)
       on conflict do nothing`,
      [teacherId, studentId],
    )
    log.ok('veli ve öğretmen öğrenciye bağlandı')

    // Öğrenciye aktif abonelik ver — kilitli ekranlar demo'yu bozmasın.
    const { rows: pkgRows } = await client.query(
      `select p.id, p.duration_days from public.packages p
        join public.exams e on e.id = p.exam_id
       where e.code = $1
       union all
       select p.id, p.duration_days from public.packages p limit 1`,
      [demoExamCode],
    )
    if (pkgRows[0]) {
      await client.query(
        `insert into public.subscriptions
           (user_id, package_id, starts_at, ends_at, status, source)
         values ($1,$2, now(), now() + ($3 || ' days')::interval, 'active', 'manual')
         on conflict do nothing`,
        [studentId, pkgRows[0].id, pkgRows[0].duration_days],
      )
      log.ok('öğrenciye aktif abonelik tanımlandı')
    }

    // ─── Demo aktivite geçmişi ────────────────────────────────────────────
    log.step('Demo aktivite geçmişi (2 hafta)')

    // Yeniden çalıştırılabilirlik: önceki demo verisini temizle.
    for (const table of [
      'attempts',
      'topic_mastery',
      'daily_activity',
      'xp_events',
      'card_reviews',
      'video_progress',
    ]) {
      await client.query(`delete from public.${table} where user_id = $1`, [studentId])
    }

    // Demo öğrencisinin sınavına ait, içeriği OLAN konuları al.
    const { rows: demoTopics } = await client.query(
      `select t.id, t.difficulty
         from public.topics t
         join public.units u on u.id = t.unit_id
         join public.subjects s on s.id = u.subject_id
         join public.exams e on e.id = s.exam_id
        where e.code = $1
          and exists (select 1 from public.questions q where q.topic_id = t.id)
        order by t.id`,
      [demoExamCode],
    )

    if (demoTopics.length === 0) {
      log.warn(
        `${demoExamCode} konularında soru yok — aktivite geçmişi üretilemedi. ` +
          'Önce `pnpm --filter @zihin/db check:content` ile içerik üretin.',
      )
    } else {
      const profile = DEMO_ACTIVITY.masteryProfile
      const buckets = rng.shuffle(demoTopics as Array<{ id: string; difficulty: number }>)
      const nStrong = Math.floor(buckets.length * profile.strong)
      const nMedium = Math.floor(buckets.length * profile.medium)
      const nWeak = Math.floor(buckets.length * profile.weak)

      /** Konuya göre hedef doğruluk oranı — gerçekçi bir öğrenci profili. */
      const targetAccuracy = new Map<string, number>()
      buckets.forEach((t, i) => {
        if (i < nStrong) targetAccuracy.set(t.id, 0.85)
        else if (i < nStrong + nMedium) targetAccuracy.set(t.id, 0.6)
        else if (i < nStrong + nMedium + nWeak) targetAccuracy.set(t.id, 0.3)
        // kalanı hiç çalışılmamış — attempt üretilmez
      })

      const studiedTopicIds = [...targetAccuracy.keys()]
      const today = new Date()
      let attemptCount = 0
      let dayCount = 0

      for (let dayOffset = DEMO_ACTIVITY.days - 1; dayOffset >= 0; dayOffset--) {
        if (!rng.chance(DEMO_ACTIVITY.activeDayRatio)) continue
        dayCount++

        const date = new Date(today)
        date.setUTCDate(date.getUTCDate() - dayOffset)
        const dateIso = date.toISOString().slice(0, 10)

        const [minQ, maxQ] = DEMO_ACTIVITY.questionsPerDay
        const questionsToday = rng.int(minQ, maxQ)
        let answeredToday = 0
        let correctToday = 0

        for (let i = 0; i < questionsToday; i++) {
          const topicId = rng.pick(studiedTopicIds)
          if (!topicId) continue
          const pool = questionIdsByTopic.get(topicId)
          if (!pool || pool.length === 0) continue
          const questionId = rng.pick(pool)
          if (!questionId) continue

          const accuracy = targetAccuracy.get(topicId) ?? 0.5
          const isCorrect = rng.chance(accuracy)
          // Gün içinde saat dağılımı: akşam çalışan bir öğrenci.
          const answeredAt = new Date(date)
          answeredAt.setUTCHours(rng.int(15, 21), rng.int(0, 59), rng.int(0, 59), 0)

          await client.query(
            `insert into public.attempts
               (user_id, question_id, topic_id, source, selected_option, is_correct,
                time_spent_ms, answered_at)
             values ($1,$2,$3,'topic_test',$4,$5,$6,$7)`,
            [
              studentId,
              questionId,
              topicId,
              isCorrect ? 'A' : 'B',
              isCorrect,
              rng.int(20_000, 180_000),
              answeredAt.toISOString(),
            ],
          )
          attemptCount++
          answeredToday++
          if (isCorrect) correctToday++
        }

        if (answeredToday > 0) {
          await client.query(
            `insert into public.daily_activity
               (user_id, date, study_seconds, questions_answered, xp_earned)
             values ($1,$2,$3,$4,$5)
             on conflict (user_id, date) do update set
               study_seconds = excluded.study_seconds,
               questions_answered = excluded.questions_answered,
               xp_earned = excluded.xp_earned`,
            [
              studentId,
              dateIso,
              answeredToday * rng.int(60, 120),
              answeredToday,
              10 + correctToday * 2,
            ],
          )
        }
      }

      log.ok(`${attemptCount} çözüm, ${dayCount} aktif gün`)

      // Yetkinlik tablosunu attempts'ten türet. Gerçek hesap uygulamada
      // packages/core ile yapılır; burada panelin dolu gelmesi için
      // basit bir yaklaşım yeterli.
      await client.query(
        `insert into public.topic_mastery
           (user_id, topic_id, mastery, status, attempts_count, last_calculated_at)
         select a.user_id,
                a.topic_id,
                greatest(0, least(100, round(100.0 * avg(case when a.is_correct then 1 else 0 end))))::int,
                case
                  when count(*) < 3 then 'unknown'
                  when avg(case when a.is_correct then 1 else 0 end) < 0.5 then 'weak'
                  when avg(case when a.is_correct then 1 else 0 end) < 0.75 then 'medium'
                  else 'strong'
                end,
                count(*),
                now()
           from public.attempts a
          where a.user_id = $1
          group by a.user_id, a.topic_id
         on conflict (user_id, topic_id) do update set
           mastery = excluded.mastery, status = excluded.status,
           attempts_count = excluded.attempts_count, last_calculated_at = now()`,
        [studentId],
      )

      // Yanlış yapılan sorulardan otomatik hafıza kartı — ürünün temel döngüsü.
      const { rows: autoCards } = await client.query(
        `insert into public.flashcards
           (topic_id, front, back, auto_generated, source_question_id, created_by, is_published)
         select distinct on (q.id)
                q.topic_id,
                q.stem,
                'Doğru cevap: ' || q.correct_option || E'\\n\\n' || coalesce(q.explanation, ''),
                true, q.id, $1, true
           from public.attempts a
           join public.questions q on q.id = a.question_id
          where a.user_id = $1 and a.is_correct = false
         on conflict do nothing
         returning id`,
        [studentId],
      )

      if (autoCards.length > 0) {
        await client.query(
          `insert into public.card_reviews
             (user_id, flashcard_id, next_review_at)
           select $1, f.id, now() - (random() * interval '2 days')
             from public.flashcards f
            where f.created_by = $1 and f.auto_generated
           on conflict do nothing`,
          [studentId],
        )
      }
      log.ok(`${autoCards.length} otomatik hafıza kartı (yanlışlardan)`)

      // XP ve seri — profil satırını tutarlı hâle getir.
      await client.query(
        `update public.profiles p
            set xp = coalesce(agg.xp, 0),
                current_streak = coalesce(agg.streak, 0),
                longest_streak = greatest(p.longest_streak, coalesce(agg.streak, 0)),
                last_study_date = agg.last_day
           from (
             select sum(xp_earned)::int as xp,
                    count(*)::int as streak,
                    max(date) as last_day
               from public.daily_activity where user_id = $1
           ) agg
          where p.id = $1`,
        [studentId],
      )
    }

    await client.query('commit')

    // ─── Özet ─────────────────────────────────────────────────────────────
    console.log(`\n${c.green}${c.bold}Seed tamamlandı.${c.reset}`)
    console.log(
      `  ${topicTotal} konu · ${questionTotal} soru · ${cardTotal} kart · ${videoTotal} video`,
    )
    console.log(
      `  ${topicTestCount} konu testi · ${unitTestCount} ünite testi · ${mockCount} deneme`,
    )
    console.log(`\n  ${c.dim}Giriş: ogrenci@test.com / ${TEST_PASSWORD}${c.reset}`)
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.error(`\n${c.red}${c.bold}Seed başarısız — hiçbir değişiklik yazılmadı.${c.reset}`)
    console.error((error as Error).message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

await main()
