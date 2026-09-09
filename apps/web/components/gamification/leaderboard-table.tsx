import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@zihin/ui/table'
import { cn } from '@zihin/ui/lib/utils'
import { fill } from '@/lib/i18n'
import type { LeaderboardRow } from '@/lib/gamification/leaderboard'
import { gamificationStrings } from './strings'

/**
 * Haftalık sıralama tablosu (spec §M13).
 *
 * GİZLİLİK: satırda yalnızca sıra, GÖRÜNEN AD ve haftalık XP vardır — bileşene
 * kullanıcı kimliği hiç gelmez, sıralamaya katılmayanlar veri katmanında zaten
 * elenmiştir (bkz. lib/gamification/leaderboard.ts).
 *
 * Kendi satırı hem renk hem de "Sen" etiketiyle işaretlenir; renk tek başına
 * anlam taşımaz (CONVENTIONS §8).
 */
export function LeaderboardTable({ rows, limit }: { rows: LeaderboardRow[]; limit: number }) {
  const s = gamificationStrings()

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption className="text-left">
          {fill(s.leaderboardTableCaption, { limit })} {s.leaderboardPrivacy}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="w-16">
              {s.leaderboardRank}
            </TableHead>
            <TableHead scope="col">{s.leaderboardStudent}</TableHead>
            <TableHead scope="col" className="text-right">
              {s.leaderboardXp}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={`${row.rank}-${index}`}
              className={cn(row.isCurrentUser && 'bg-primary/5 font-medium')}
            >
              <TableCell className="tabular-nums">{row.rank}</TableCell>
              <TableCell>
                {row.displayName}
                {row.isCurrentUser ? (
                  <span className="text-primary ml-2 text-xs">({s.leaderboardYou})</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.xp}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
