import { Button } from '@zihin/ui/button'
import { Label } from '@zihin/ui/label'
import { helpStrings } from './strings'

/**
 * Kuyruğun ders süzgeci.
 *
 * Bilerek düz bir GET formu (kartlardaki konu süzgeciyle aynı yaklaşım):
 * sunucu bileşeni olarak kalır, JavaScript olmadan da çalışır ve seçim
 * adres çubuğunda görünür — `/ogretmen/sorular?ders=<id>` paylaşılabilir.
 */
export function SubjectFilter({
  subjects,
  selectedId,
  action,
}: {
  subjects: Array<{ id: string; name: string }>
  selectedId: string | null
  action: string
}) {
  const s = helpStrings()

  if (subjects.length === 0) return null

  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-sm">
        <Label htmlFor="kuyruk-ders">{s.teacherFilterLabel}</Label>
        <select
          id="kuyruk-ders"
          name="ders"
          defaultValue={selectedId ?? ''}
          className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <option value="">{s.teacherFilterAll}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        {s.teacherFilterApply}
      </Button>
    </form>
  )
}
