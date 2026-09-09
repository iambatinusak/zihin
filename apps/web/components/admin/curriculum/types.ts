import type { CurriculumExam } from '@/lib/data/admin'

/**
 * Ağacın istemci tarafındaki şekli.
 *
 * Veritabanı satırının tamamı istemciye GÖNDERİLMEZ: yalnızca ekranda görünen
 * ya da düzenleme formunun doldurduğu alanlar taşınır. `kind` ayrımı sayesinde
 * tek bir özyinelemeli bileşen dört düzeyi de basabiliyor, ama TypeScript her
 * düzeyde doğru alanları zorunlu tutuyor.
 */

export type TopicNode = {
  kind: 'topic'
  id: string
  parentId: string
  title: string
  slug: string
  estimatedMinutes: number
  difficulty: number
  examWeight: number
  memoryNote: string
}

export type UnitNode = {
  kind: 'unit'
  id: string
  parentId: string
  name: string
  slug: string
  children: TopicNode[]
}

export type SubjectNode = {
  kind: 'subject'
  id: string
  parentId: string
  name: string
  slug: string
  color: string
  questionCount: number | null
  children: UnitNode[]
}

export type ExamNode = {
  kind: 'exam'
  id: string
  parentId: null
  code: string
  name: string
  description: string
  wrongPenaltyDivisor: number
  isActive: boolean
  children: SubjectNode[]
}

export type AnyNode = ExamNode | SubjectNode | UnitNode | TopicNode
export type BranchNode = ExamNode | SubjectNode | UnitNode

/** Satırda ve iletişim kutularında gösterilen ad. */
export function nodeLabel(node: AnyNode): string {
  return node.kind === 'topic' ? node.title : node.name
}

/** Bir düğümün altına eklenebilecek düzey; konunun altı yoktur. */
export function childKind(kind: AnyNode['kind']): 'subject' | 'unit' | 'topic' | null {
  if (kind === 'exam') return 'subject'
  if (kind === 'subject') return 'unit'
  if (kind === 'unit') return 'topic'
  return null
}

export function hasChildren(node: AnyNode): node is BranchNode {
  return node.kind !== 'topic'
}

/** Sunucudaki satırları istemci ağacına çevirir. */
export function toExamNodes(tree: CurriculumExam[]): ExamNode[] {
  return tree.map((exam) => ({
    kind: 'exam',
    id: exam.id,
    parentId: null,
    code: exam.code,
    name: exam.name,
    description: exam.description ?? '',
    wrongPenaltyDivisor: exam.wrong_penalty_divisor,
    isActive: exam.is_active,
    children: exam.subjects.map((subject) => ({
      kind: 'subject',
      id: subject.id,
      parentId: exam.id,
      name: subject.name,
      slug: subject.slug,
      color: subject.color ?? '',
      questionCount: subject.question_count,
      children: subject.units.map((unit) => ({
        kind: 'unit',
        id: unit.id,
        parentId: subject.id,
        name: unit.name,
        slug: unit.slug,
        children: unit.topics.map((topic) => ({
          kind: 'topic',
          id: topic.id,
          parentId: unit.id,
          title: topic.title,
          slug: topic.slug,
          estimatedMinutes: topic.estimated_minutes,
          difficulty: topic.difficulty,
          examWeight: Number(topic.exam_weight),
          memoryNote: topic.memory_note ?? '',
        })),
      })),
    })),
  }))
}

/**
 * Bir kardeş listesinde taşıma sonucu. Saf; testi `lib/admin/reorder.ts`
 * üzerinde yapıldığı için burada yalnızca dizi kaydırma var.
 */
export function moveInArray<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) return items.slice()
  next.splice(to, 0, item)
  return next
}
