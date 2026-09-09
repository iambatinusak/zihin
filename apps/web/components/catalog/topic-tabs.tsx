import Link from 'next/link'
import { Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zihin/ui/tabs'
import { buttonVariants } from '@zihin/ui/button'
import { Markdown } from '@/components/common/markdown'
import type { TopicDetail } from '@/lib/data'
import { section } from '@/lib/i18n'
import { fill } from '@/lib/i18n'
import type { CatalogStrings } from './strings'
import { ContentEmpty } from './content-empty'
import { VideoList } from './video-list'
import { TestList } from './test-list'

type TopicTabsProps = {
  detail: TopicDetail
  hasSubscription: boolean
}

/**
 * Konu sayfasının dört sekmesi. Radix sekmeleri istemcide çalışır, içerik
 * sunucuda üretilir — hafıza notunun Markdown'ı istemciye taşınmaz.
 */
export function TopicTabs({ detail, hasSubscription }: TopicTabsProps) {
  const s = section<CatalogStrings>('catalog')

  return (
    <Tabs defaultValue="videos" className="gap-4">
      <TabsList className="w-full overflow-x-auto sm:w-fit">
        <TabsTrigger value="videos">{s.tabs.videos}</TabsTrigger>
        <TabsTrigger value="memory-note">{s.tabs.memoryNote}</TabsTrigger>
        <TabsTrigger value="tests">{s.tabs.tests}</TabsTrigger>
        <TabsTrigger value="flashcards">{s.tabs.flashcards}</TabsTrigger>
      </TabsList>

      <TabsContent value="videos">
        <VideoList videos={detail.videos} hasSubscription={hasSubscription} />
      </TabsContent>

      <TabsContent value="memory-note">
        {detail.topic.memory_note && detail.topic.memory_note.trim().length > 0 ? (
          <article className="border-border rounded-lg border p-4">
            <Markdown content={detail.topic.memory_note} />
          </article>
        ) : (
          <ContentEmpty description={s.emptyMemoryNote} />
        )}
      </TabsContent>

      <TabsContent value="tests">
        <TestList tests={detail.tests} topicId={detail.topic.id} />
      </TabsContent>

      <TabsContent value="flashcards">
        {detail.flashcardCount > 0 ? (
          <div className="border-border flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground flex items-center gap-2 text-sm">
              <Layers aria-hidden="true" className="text-primary size-5" />
              {fill(s.flashcardCount, { count: detail.flashcardCount })}
            </p>
            <Link
              href={`/kartlar?konu=${detail.topic.slug}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {s.openCards}
            </Link>
          </div>
        ) : (
          <ContentEmpty description={s.emptyFlashcards} />
        )}
      </TabsContent>
    </Tabs>
  )
}
