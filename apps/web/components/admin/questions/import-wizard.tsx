'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import { Switch } from '@zihin/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { FormErrorSummary, SwitchRow } from '@/components/common/form-parts'
import {
  importQuestions,
  previewImport,
  type ImportCommitResult,
  type ImportPreviewResult,
} from '@/app/(admin)/admin/sorular/actions'
import { MAX_IMPORT_BYTES } from '@/app/(admin)/admin/sorular/schemas'
import { IMPORT_COLUMNS, type RowError } from '@/lib/admin/import/parse'
import { LiveRegion } from '@/components/common/live-region'
import { fill } from '@/lib/i18n/core'
import { questionStrings } from './strings'

/**
 * Toplu içe aktarma sihirbazı (spec §M15).
 *
 * ÜÇ ADIM, TEK KAYNAK: dosya seç → KURU ÇALIŞMA (hiçbir şey yazılmaz) →
 * "İçe aktar". Sunucuya her iki adımda da DOSYANIN KENDİSİ gönderilir; ayrıştırma
 * ve doğrulama iki kez aynı saf kodla yapılır. İstemcinin ayrıştırdığı satırlar
 * gönderilseydi, önizlemede görülen ile yazılan ayrışabilirdi.
 *
 * Dosya `FileReader` yerine `file.text()` ile UTF-8 olarak okunur; BOM ve
 * ayırıcı işini sunucudaki okuyucu yapar (bkz. `lib/admin/import/csv.ts`).
 */

const PREVIEW_LIMIT = 50

export function ImportWizard() {
  const s = questionStrings()
  const router = useRouter()

  const [file, setFile] = React.useState<File | null>(null)
  const [content, setContent] = React.useState<string | null>(null)
  const [publish, setPublish] = React.useState(false)
  const [preview, setPreview] = React.useState<ImportPreviewResult | null>(null)
  const [committed, setCommitted] = React.useState<ImportCommitResult | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [committing, setCommitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  function reset() {
    setFile(null)
    setContent(null)
    setPreview(null)
    setCommitted(null)
    setFormError(null)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setPreview(null)
    setCommitted(null)
    setFormError(null)

    if (!selected) {
      setFile(null)
      setContent(null)
      return
    }

    if (selected.size > MAX_IMPORT_BYTES) {
      setFile(null)
      setContent(null)
      setFormError(s.importTooLarge)
      return
    }

    setFile(selected)
    try {
      setContent(await selected.text())
    } catch {
      setContent(null)
      setFormError(s.importReadFailed)
    }
  }

  async function handleAnalyze() {
    if (!file || content === null || analyzing) return

    setAnalyzing(true)
    setFormError(null)
    const result = await previewImport({ fileName: file.name, content })
    setAnalyzing(false)

    if (!result.ok) {
      setPreview(null)
      setFormError(result.error.message)
      return
    }
    setPreview(result.data)
  }

  async function handleCommit() {
    if (!file || content === null || committing) return

    setCommitting(true)
    setFormError(null)
    const result = await importQuestions({ fileName: file.name, content, publish })
    setCommitting(false)

    if (!result.ok) {
      setFormError(result.error.message)
      return
    }

    setCommitted(result.data)
    if (result.data.failed.length === 0) {
      toast.success(fill(s.importDone, { count: result.data.inserted }))
    } else {
      toast.warning(
        fill(s.importPartial, {
          inserted: result.data.inserted,
          failed: result.data.failed.length,
        }),
      )
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <FormErrorSummary message={formError} />

      <section className="border-border bg-card space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="ice-aktar-dosya">{s.importFileLabel}</Label>
          <Input
            id="ice-aktar-dosya"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleFileChange}
            aria-describedby="ice-aktar-dosya-aciklama"
          />
          <p id="ice-aktar-dosya-aciklama" className="text-muted-foreground text-xs">
            {s.importFileHint}
          </p>
        </div>

        <div className="text-muted-foreground space-y-2 text-xs">
          <p>
            <span className="font-medium">{s.importColumns}:</span>{' '}
            <code className="font-mono">{IMPORT_COLUMNS.join(', ')}</code>
          </p>
          <Button variant="outline" size="sm" asChild>
            {/* Route Handler'dan gerçek bir HTTP indirmesi; `<a download>` bazı
                gömülü görüntüleyicilerde engellenir. */}
            <Link href="/api/admin/sorular/sablon" prefetch={false}>
              <Download aria-hidden="true" className="size-4" />
              {s.importTemplate}
            </Link>
          </Button>
        </div>

        <Button onClick={handleAnalyze} disabled={!file || content === null || analyzing}>
          {analyzing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {analyzing ? s.importAnalyzing : s.importAnalyze}
        </Button>
      </section>

      {preview && !committed ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 aria-hidden="true" className="text-primary size-4" />
              {fill(s.importSummaryValid, { count: preview.rows.length })}
            </span>
            {preview.errors.length > 0 ? (
              <span className="text-destructive flex items-center gap-1.5">
                <AlertTriangle aria-hidden="true" className="size-4" />
                {fill(s.importSummaryErrors, { count: countLines(preview.errors) })}
              </span>
            ) : null}
          </div>

          {preview.errors.length > 0 ? (
            <ErrorReport title={s.importErrorsTitle} errors={preview.errors} />
          ) : null}

          {preview.rows.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">{s.importPreviewTitle}</h2>
              <div className="border-border rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{s.importColLine}</TableHead>
                      <TableHead>{s.importColStem}</TableHead>
                      <TableHead className="w-48">{s.importColTopic}</TableHead>
                      <TableHead className="w-20">{s.importColOptions}</TableHead>
                      <TableHead className="w-20">{s.importColCorrect}</TableHead>
                      <TableHead className="w-20">{s.importColDifficulty}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, PREVIEW_LIMIT).map((row) => (
                      <TableRow key={row.line}>
                        <TableCell className="text-muted-foreground">{row.line}</TableCell>
                        <TableCell className="max-w-md truncate">{row.stem}</TableCell>
                        <TableCell>{row.topicTitle}</TableCell>
                        <TableCell>{row.optionCount}</TableCell>
                        <TableCell>{row.correctOption}</TableCell>
                        <TableCell>{row.difficulty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.rows.length > PREVIEW_LIMIT ? (
                <p className="text-muted-foreground text-xs">
                  {fill(s.importPreviewMore, {
                    shown: PREVIEW_LIMIT,
                    total: preview.rows.length,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{s.importNoValid}</p>
          )}

          <SwitchRow id="ice-aktar-yayin" label={s.importPublishLabel} hint={s.importPublishHint}>
            {(aria) => <Switch {...aria} checked={publish} onCheckedChange={setPublish} />}
          </SwitchRow>

          <Button onClick={handleCommit} disabled={preview.rows.length === 0 || committing}>
            {committing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {committing ? s.importCommitting : s.importCommit}
          </Button>
        </section>
      ) : null}

      <LiveRegion
        message={
          committed
            ? committed.failed.length === 0
              ? fill(s.importDone, { count: committed.inserted })
              : fill(s.importPartial, {
                  inserted: committed.inserted,
                  failed: committed.failed.length,
                })
            : ''
        }
      />
      {committed ? (
        <section className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="text-primary size-4" />
            {committed.failed.length === 0
              ? fill(s.importDone, { count: committed.inserted })
              : fill(s.importPartial, {
                  inserted: committed.inserted,
                  failed: committed.failed.length,
                })}
          </p>

          {committed.failed.length > 0 ? (
            <ErrorReport title={s.importFailedTitle} errors={committed.failed} />
          ) : null}
          {committed.errors.length > 0 ? (
            <ErrorReport title={s.importErrorsTitle} errors={committed.errors} />
          ) : null}

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              {s.importAgain}
            </Button>
            <Button asChild>
              <Link href="/admin/sorular">{s.backToList}</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** Satır bazlı hata raporu; spec §M15'in istediği tablo. */
function ErrorReport({ title, errors }: { title: string; errors: RowError[] }) {
  const s = questionStrings()

  return (
    <div className="space-y-2">
      <h2 className="text-destructive text-base font-semibold">{title}</h2>
      <div className="border-destructive/40 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{s.importColLine}</TableHead>
              <TableHead className="w-40">{s.importColColumn}</TableHead>
              <TableHead>{s.importColMessage}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((error, index) => (
              <TableRow key={`${error.line}-${error.column ?? ''}-${index}`}>
                <TableCell className="text-muted-foreground">{error.line}</TableCell>
                <TableCell className="font-mono text-xs">{error.column ?? '—'}</TableCell>
                <TableCell>{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Bir satırda birden çok hata olabilir; özet satır sayar, hata değil. */
function countLines(errors: readonly RowError[]): number {
  return new Set(errors.map((error) => error.line)).size
}
