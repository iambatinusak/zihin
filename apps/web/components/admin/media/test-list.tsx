'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { fill, t } from '@/lib/i18n/admin-media'
import { deleteTest, setTestPublished } from '@/app/(admin)/admin/testler/actions'
import type { AdminTestListItem } from '@/lib/data/admin-media'

/** Test ve deneme listeleri aynı tabloyu paylaşır; yalnızca süzgeç farklıdır. */
export function TestList({ items }: { items: AdminTestListItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function run(operation: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const result = await operation()
      if (!result.ok) {
        setError(result.error?.message ?? null)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <div className="border-border rounded-lg border" aria-busy={pending}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminMedia.testTitleField')}</TableHead>
              <TableHead>{t('adminMedia.testQuestions')}</TableHead>
              <TableHead>{t('adminMedia.testDuration')}</TableHead>
              <TableHead>{t('adminMedia.published')}</TableHead>
              <TableHead className="text-right">{t('adminMedia.edit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ test, questionCount }) => (
              <TableRow key={test.id}>
                <TableCell className="font-medium">
                  <Link className="hover:underline" href={`/admin/testler/${test.id}`}>
                    {test.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {fill(t('adminMedia.testQuestionCount'), { count: questionCount })}
                </TableCell>
                <TableCell>
                  {test.duration_seconds === null
                    ? t('adminMedia.noDuration')
                    : fill(t('adminMedia.durationMinutesLabel'), {
                        count: Math.round(test.duration_seconds / 60),
                      })}
                </TableCell>
                <TableCell>
                  <Badge variant={test.is_published ? 'default' : 'outline'}>
                    {test.is_published ? t('adminMedia.published') : t('adminMedia.draft')}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() => setTestPublished({ id: test.id, isPublished: !test.is_published }))
                    }
                  >
                    {test.is_published ? t('adminMedia.unpublish') : t('adminMedia.publish')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t('adminMedia.deleteConfirm'))) return
                      run(() => deleteTest({ id: test.id }))
                    }}
                  >
                    {t('adminMedia.delete')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
