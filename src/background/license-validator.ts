/**
 * License Validation Module
 *
 * Responsibilities:
 * - Verify Pro/Free tier status
 * - Check Free tier monthly limits (500 images)
 * - Cache verification results (24 hours)
 * - Automatic re-verification with Alarms API
 * - Graceful fallback on network errors
 *
 * @module background/license-validator
 */

import type { UserConfig } from '@/shared/types'

/**
 * License verification cache structure
 */
interface LicenseCache {
  tier: 'free' | 'pro'
  expiresAt: number // Unix timestamp
  verifiedAt: number // Unix timestamp
  email?: string
}

/**
 * API verification response
 */
interface VerifyApiResponse {
  tier: 'pro'
  expiresAt: number
  email: string
}

/**
 * API error response
 */
interface VerifyApiError {
  error: 'INVALID_KEY' | 'EXPIRED' | 'REVOKED'
}

/**
 * API endpoint configuration
 */
const API_CONFIG = {
  endpoint: 'https://api.diffsnap.io/v1/verify',
  timeout: 5000, // 5秒
} as const

/**
 * Cache validity period (24 hours in milliseconds)
 */
const CACHE_VALIDITY_MS = 24 * 60 * 60 * 1000

/**
 * Grace period after expiration (72 hours in milliseconds)
 */
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000

/**
 * Alarm name for automatic re-verification
 */
const LICENSE_CHECK_ALARM = 'license-check'

/**
 * License verification alarm interval (24 hours = 1440 minutes)
 */
const LICENSE_CHECK_INTERVAL_MINUTES = 1440

/**
 * Get cached license verification result
 *
 * @returns Cached result if valid, null otherwise
 */
const getCachedVerification = async (): Promise<LicenseCache | null> => {
  const result = await chrome.storage.local.get(['lastVerification'])
  const cache = result.lastVerification as LicenseCache | undefined

  if (!cache) {
    return null
  }

  const now = Date.now()

  // Check cache validity (within 24 hours AND not expired)
  if (now - cache.verifiedAt < CACHE_VALIDITY_MS && now < cache.expiresAt) {
    return cache
  }

  return null
}

/**
 * Update license verification cache
 *
 * @param cache - Cache data to store
 */
const updateCache = async (cache: LicenseCache): Promise<void> => {
  await chrome.storage.local.set({ lastVerification: cache })
}

/**
 * Verify license key with API endpoint
 *
 * @param licenseKey - License key to verify
 * @returns Verification response or null on error
 */
const verifyWithApi = async (licenseKey: string): Promise<VerifyApiResponse | null> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

  try {
    const response = await fetch(API_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: licenseKey }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = (await response.json()) as VerifyApiError
      console.warn('[license-validator] API returned error:', errorData.error)
      return null
    }

    const data = (await response.json()) as VerifyApiResponse
    return data
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[license-validator] API request timeout')
    } else {
      console.warn('[license-validator] API request failed:', error)
    }

    return null
  }
}

/**
 * Get license key from storage
 *
 * @returns License key or null if not found
 */
const getLicenseKey = async (): Promise<string | null> => {
  const result = await chrome.storage.sync.get(['config'])
  const config = result.config as UserConfig | undefined

  return config?.licenseKey ?? null
}

/**
 * Check user tier (Pro or Free)
 *
 * Algorithm:
 * 1. Check cache (24-hour validity)
 * 2. Get license key from storage
 * 3. If no key → Free tier
 * 4. If key exists → Verify with API
 * 5. On API success → Update cache, check grace period
 * 6. On API error → Fallback to cache if valid
 * 7. Default → Free tier
 *
 * @returns User tier ('pro' or 'free')
 *
 * @example
 * ```ts
 * const tier = await checkTier()
 * if (tier === 'pro') {
 *   // Enable Pro features
 * }
 * ```
 */
export const checkTier = async (): Promise<'free' | 'pro'> => {
  const now = Date.now()

  // 1. Check cache
  const cache = await getCachedVerification()
  if (cache) {
    if (import.meta.env.DEV) {
      console.log('[license-validator] Using cached tier:', cache.tier)
    }
    return cache.tier
  }

  // 2. Get license key
  const licenseKey = await getLicenseKey()

  // 3. No license key → Free tier
  if (!licenseKey) {
    const freeCache: LicenseCache = {
      tier: 'free',
      expiresAt: now + CACHE_VALIDITY_MS,
      verifiedAt: now,
    }
    await updateCache(freeCache)
    return 'free'
  }

  // 4. Verify with API
  const apiResult = await verifyWithApi(licenseKey)

  // 5. API success
  if (apiResult) {
    const { tier, expiresAt, email } = apiResult

    // Update cache
    const newCache: LicenseCache = {
      tier,
      expiresAt,
      verifiedAt: now,
      email,
    }
    await updateCache(newCache)

    // Check grace period
    const graceEndTime = expiresAt + GRACE_PERIOD_MS
    if (now > graceEndTime) {
      // Grace period expired → Free tier
      console.warn('[license-validator] License expired beyond grace period')
      return 'free'
    }

    // Within grace period or not expired
    return tier
  }

  // 6. API error → Fallback to cache if exists and not expired
  const result = await chrome.storage.local.get(['lastVerification'])
  const fallbackCache = result.lastVerification as LicenseCache | undefined

  if (fallbackCache && now < fallbackCache.expiresAt) {
    console.log('[license-validator] Using fallback cache due to API error')
    return fallbackCache.tier
  }

  // 7. Default → Free tier
  console.warn('[license-validator] No valid cache, defaulting to Free tier')
  return 'free'
}

/**
 * Check Free tier monthly limit
 *
 * Free tier: 500 images per month
 *
 * Algorithm:
 * 1. Get monthly count and reset date from storage
 * 2. If past reset date → Reset counter
 * 3. Calculate new count = current + imageCount
 * 4. If new count > 500 → Return false (limit exceeded)
 * 5. Otherwise → Update count and return true
 *
 * @param imageCount - Number of images to check
 * @returns true if within limit, false if exceeded
 *
 * @example
 * ```ts
 * const canProceed = await checkFreeLimit(50)
 * if (!canProceed) {
 *   // Show upgrade prompt
 * }
 * ```
 */
export const checkFreeLimit = async (imageCount: number): Promise<boolean> => {
  const now = Date.now()

  // Get current config
  const result = await chrome.storage.sync.get(['config'])
  let config = result.config as UserConfig | undefined

  // Initialize config if not exists
  if (!config) {
    config = {
      tier: 'free',
      namingTemplate: '{date}-{domain}-{w}x{h}-{index}',
      domainProfiles: [],
      monthlyCount: 0,
      monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000, // 30日後
    }
    await chrome.storage.sync.set({ config })
  }

  // Check if reset is needed
  if (now > (config.monthlyResetAt ?? 0)) {
    // Reset counter
    const newResetAt = now + 30 * 24 * 60 * 60 * 1000 // 30日後
    config.monthlyCount = 0
    config.monthlyResetAt = newResetAt

    await chrome.storage.sync.set({ config })

    if (import.meta.env.DEV) {
      console.log('[license-validator] Monthly counter reset')
    }
  }

  // Calculate new count
  const newCount = (config.monthlyCount ?? 0) + imageCount

  // Check limit
  const FREE_LIMIT = 500
  if (newCount > FREE_LIMIT) {
    console.warn(`[license-validator] Free limit exceeded: ${newCount}/${FREE_LIMIT}`)
    return false
  }

  // Update count
  config.monthlyCount = newCount
  await chrome.storage.sync.set({ config })

  if (import.meta.env.DEV) {
    console.log(`[license-validator] Free usage: ${newCount}/${FREE_LIMIT}`)
  }

  return true
}

/**
 * Initialize automatic license re-verification
 *
 * Creates an alarm that checks license status every 24 hours
 * and notifies user if license expires
 */
export const initLicenseChecker = async (): Promise<void> => {
  // Create alarm for periodic check (24 hours = 1440 minutes)
  await chrome.alarms.create(LICENSE_CHECK_ALARM, {
    periodInMinutes: LICENSE_CHECK_INTERVAL_MINUTES,
  })

  if (import.meta.env.DEV) {
    console.log('[license-validator] License checker alarm created')
  }
}

/**
 * Handle license check alarm
 *
 * Called by chrome.alarms.onAlarm listener
 * Verifies license and notifies user if expired
 *
 * @param alarm - Alarm object from chrome.alarms
 */
export const handleLicenseCheckAlarm = async (alarm: chrome.alarms.Alarm): Promise<void> => {
  if (alarm.name !== LICENSE_CHECK_ALARM) {
    return
  }

  if (import.meta.env.DEV) {
    console.log('[license-validator] Running periodic license check')
  }

  // Force fresh verification (bypass cache)
  await chrome.storage.local.remove(['lastVerification'])
  const tier = await checkTier()

  // If license expired, notify user
  if (tier === 'free') {
    const licenseKey = await getLicenseKey()
    if (licenseKey) {
      // Had a license key but now Free → Expired
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'DiffSnap Pro期限切れ',
        message: 'Proライセンスの期限が切れました。引き続きご利用いただくには更新してください。',
        priority: 2,
      })

      console.warn('[license-validator] License expired, user notified')
    }
  }
}

/**
 * Get remaining Free tier images for current month
 *
 * @returns Number of images remaining in Free tier quota
 */
export const getRemainingFreeImages = async (): Promise<number> => {
  const result = await chrome.storage.sync.get(['config'])
  const config = result.config as UserConfig | undefined

  if (!config) {
    return 500 // Full quota if no config exists
  }

  const { monthlyCount = 0, monthlyResetAt = 0 } = config
  const now = Date.now()

  // If past reset date, full quota available
  if (now > monthlyResetAt) {
    return 500
  }

  return Math.max(0, 500 - monthlyCount)
}
