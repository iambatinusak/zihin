/**
 * Yerleşik `<select>`in ortak sınıfı.
 *
 * Radix Select yerine yerleşik öğe kullanılır: yönetim ekranlarındaki listeler
 * (birkaç yüz konu) uzun ve klavye/tarayıcı araması burada bedava gelir.
 *
 * Kendi dosyasında durur ve `'use client'` TAŞIMAZ: hem sunucu bileşeni olan
 * filtre formu hem istemci formu aynı sabiti okur. Bir istemci modülünden
 * dışa aktarılsaydı sunucu tarafında istemci referansına dönüşürdü.
 */
export const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60'
