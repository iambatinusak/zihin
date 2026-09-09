'use client'

import { IMAGE_QUALITY, MAX_IMAGE_EDGE, resizeDimensions } from './image'

/**
 * Fotoğrafı YÜKLEMEDEN ÖNCE tarayıcıda küçültür (spec §M11).
 *
 * Sebep pratik: öğrenci telefonuyla çekiyor, dosya 6-8 MB gelebiliyor ve mobil
 * bağlantıda yüklenmesi dakikalar sürüyor. En uzun kenarı 1600 px'e indirip
 * JPEG olarak yeniden kodlamak dosyayı tipik olarak on kat küçültüyor,
 * okunabilirliği ise bozmuyor.
 *
 * BU BİR DENETİM DEĞİLDİR: tarayıcı istediğini gönderebilir, tür ve boyut
 * sunucuda yeniden doğrulanır (bkz. app/(student)/soru-sor/actions.ts).
 * Küçültme başarısız olursa (canvas yok, bozuk dosya) özgün dosya döner;
 * boyut denetimini yine sunucu yapar.
 */
export async function resizeImageFile(
  file: File,
  maxEdge: number = MAX_IMAGE_EDGE,
): Promise<{ file: File; resized: boolean }> {
  try {
    const bitmap = await loadBitmap(file)
    // Ölçüler ÖNCE okunur: `close()` çağrıldıktan sonra ImageBitmap'in
    // genişliği/yüksekliği 0'a düşer.
    const source = { width: bitmap.width, height: bitmap.height }
    const target = resizeDimensions(source, maxEdge)
    if (target.width === 0 || target.height === 0) {
      closeBitmap(bitmap)
      return { file, resized: false }
    }

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height

    const context = canvas.getContext('2d')
    if (!context) {
      closeBitmap(bitmap)
      return { file, resized: false }
    }

    context.drawImage(bitmap, 0, 0, target.width, target.height)
    closeBitmap(bitmap)

    const blob = await toBlob(canvas)
    if (!blob) return { file, resized: false }

    // Küçültme dosyayı büyüttüyse (küçük PNG → JPEG) özgün dosyada kalınır.
    if (blob.size >= file.size && target.width === source.width) {
      return { file, resized: false }
    }

    return {
      file: new File([blob], 'soru.jpg', { type: 'image/jpeg', lastModified: Date.now() }),
      resized: true,
    }
  } catch {
    return { file, resized: false }
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('görsel okunamadı'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', IMAGE_QUALITY)
  })
}
