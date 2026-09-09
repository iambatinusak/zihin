import 'server-only'

import type { Tables } from '@zihin/db/types'
import { AppError } from '@/lib/errors'
import { toAmount } from '@/lib/billing/money'
import type { DataClient } from './client'

/**
 * Ticaret okumaları (spec §M14): paketler, abonelikler, ödemeler.
 *
 * `packages` tablosunda `anon` için SELECT politikası YOKTUR
 * (0011_rls_policies.sql). Fiyat sayfası giriş yapmamış ziyaretçiye de
 * açık olduğu için paket listesi service-role istemcisiyle okunur; gösterilen
 * alanlar zaten herkese açık pazarlama verisidir.
 */

type Client = DataClient

export type PackageRow = Tables<'packages'>
export type SubscriptionRow = Tables<'subscriptions'>

/** Paketin arayüzde kullanılan biçimi; `features` çözümlenmiş hâlde. */
export type BillingPackage = {
  id: string
  examId: string | null
  name: string
  description: string | null
  durationDays: number
  priceTry: number
  features: PackageFeatures
  orderIndex: number
}

export type PackageFeatures = {
  dailyQuestionLimit: number | null
  mockExamAccess: boolean
  coaching: boolean
}

const DEFAULT_FEATURES: PackageFeatures = {
  dailyQuestionLimit: null,
  mockExamAccess: false,
  coaching: false,
}

/**
 * `packages.features` jsonb'sini tipli hâle getirir.
 * Bilinmeyen ya da bozuk bir değer özelliği KAPALI sayar; abartılı bir vaat
 * göstermektense eksik göstermek yeğdir.
 */
export function parseFeatures(value: unknown): PackageFeatures {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_FEATURES

  const raw = value as Record<string, unknown>
  const limit = raw.daily_question_limit

  return {
    dailyQuestionLimit: typeof limit === 'number' && Number.isFinite(limit) ? limit : null,
    mockExamAccess: raw.mock_exam_access === true,
    coaching: raw.coaching === true,
  }
}

function toBillingPackage(row: PackageRow): BillingPackage {
  return {
    id: row.id,
    examId: row.exam_id,
    name: row.name,
    description: row.description,
    durationDays: row.duration_days,
    priceTry: toAmount(row.price_try),
    features: parseFeatures(row.features),
    orderIndex: row.order_index,
  }
}

/** Satıştaki paketler, görünüm sırasıyla. */
export async function getActivePackages(client: Client): Promise<BillingPackage[]> {
  const { data, error } = await client
    .from('packages')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Paketler yüklenemedi.')
  return (data ?? []).map(toBillingPackage)
}

/**
 * Tek bir satıştaki paket.
 *
 * FİYATIN TEK KAYNAĞI BURASIDIR. Checkout action'ı tutarı bu satırdan okur;
 * istemciden gelen hiçbir sayı ödeme tutarına dönüşmez.
 */
export async function getPurchasablePackage(
  client: Client,
  packageId: string,
): Promise<BillingPackage> {
  const { data, error } = await client
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Paket bilgisi okunamadı.')
  if (!data) throw new AppError('not_found', 'Seçtiğiniz paket bulunamadı.')
  return toBillingPackage(data)
}

/** Yönetim ekranı için: pasif paketler de listelenir. */
export async function getAllPackages(client: Client): Promise<BillingPackage[]> {
  const { data, error } = await client
    .from('packages')
    .select('*')
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Paketler yüklenemedi.')
  return (data ?? []).map(toBillingPackage)
}

/** Kullanıcının yürürlükteki aboneliği; yoksa null. */
export async function getActiveSubscription(
  client: Client,
  userId: string,
): Promise<SubscriptionRow | null> {
  const nowIso = new Date().toISOString()

  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .order('ends_at', { ascending: false })
    .limit(1)

  if (error) return null
  return data?.[0] ?? null
}

/** Ödeme kaydını sağlayıcı referansıyla bulur (webhook eşleştirmesi). */
export async function getPaymentByProviderRef(
  client: Client,
  provider: 'iyzico' | 'manual' | 'mock',
  providerRef: string,
): Promise<Tables<'payments'> | null> {
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('provider', provider)
    .eq('provider_ref', providerRef)
    .maybeSingle()

  if (error) throw new Error(`payments okunamadı: ${error.message}`)
  return data ?? null
}

/** Kullanıcının ödeme geçmişi (yeni → eski). */
export async function getPaymentHistory(
  client: Client,
  userId: string,
  limit = 20,
): Promise<Tables<'payments'>[]> {
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new AppError('internal', 'Ödeme geçmişi okunamadı.')
  return data ?? []
}

/**
 * Yönetim ekranının kullanıcı araması. Service-role istemcisi bekler.
 *
 * E-posta `auth.users` tablosunda, `profiles` içinde değil; bu yüzden Admin
 * API üzerinden değil, `profiles` üzerinden arama yapılamaz. Çözüm: yönetici
 * tam e-posta yazar, arama Admin API ile yapılır (bkz. abonelikler/actions.ts).
 * Burada yalnızca kimliği bilinen kullanıcının profili okunur.
 */
export async function getProfileSummary(
  client: Client,
  userId: string,
): Promise<{ id: string; fullName: string | null; role: string } | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id, fullName: data.full_name, role: data.role }
}
