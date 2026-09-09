/**
 * Veli panelinin sayı biçimlendirmesi — saf, sözlükten bağımsız.
 * Metnin kendisi i18n'den gelir; buradaki iş yalnızca parçaları çıkarmak.
 */

/** Dakikayı saat + dakikaya böler. Negatif ve geçersiz değer 0 sayılır. */
export function splitHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.floor(totalMinutes) : 0
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}
