/**
 * Veri katmanı. Supabase'ten yapılan her okuma buradan geçer.
 *
 * Her fonksiyonun ilk parametresi Supabase istemcisidir; böylece testler
 * gerçek bağlantı yerine sahte bir istemci geçirebilir (uygulama Docker
 * olmadan yerelde koşamıyor, bu katman o dikişin yeri).
 */

export type { DataClient } from './client'

export {
  getActiveExams,
  getExamTree,
  getSubjects,
  getUnits,
  getTopicBySlug,
  getTopicsForUnit,
  getSubjectBySlug,
  getUnitBySlug,
  getSubjectOverviews,
  getUnitsWithTopicItems,
  getTopicDetail,
  hasActiveSubscription,
  type Exam,
  type ExamTree,
  type Subject,
  type SubjectOverview,
  type SubjectWithUnits,
  type Test,
  type Topic,
  type TopicDetail,
  type TopicListItem,
  type TopicMastery,
  type Unit,
  type UnitWithTopics,
  type UnitWithTopicItems,
  type Video,
} from './catalog'

export { getProfile, getLinkedStudents, type LinkedStudent, type Profile } from './profile'

export { getUnreadCount } from './notifications'

export {
  getMasteryMap,
  getPriorityTopics,
  getMasteryTimeline,
  getSubjectAverages,
  NEUTRAL_MASTERY,
  type MasteryMap,
  type MasterySubjectGroup,
  type MasteryTopicEntry,
  type MasteryUnitGroup,
  type SubjectAverage,
} from './mastery'

export {
  getActivePlan,
  getLatestActivePlan,
  getPlanBlocks,
  getWeekPlan,
  getBlocksForDate,
  getOwnedBlock,
  getMaxOrderIndex,
  type BlockTopic,
  type OwnedBlock,
  type PlanStats,
  type StudyBlockItem,
  type StudyPlanRow,
  type WeekPlan,
} from './plan'

export {
  getPlacementCandidates,
  createPlacementTest,
  findResumablePlacementSession,
  getPlacementStatus,
  type PlacementCandidates,
  type PlacementStatus,
} from './placement'

export {
  getWeeklyActivity,
  getLastMockResult,
  resolveTopicHrefs,
  type DailyActivityPoint,
  type LastMockResult,
} from './dashboard'
