/**
 * License Validator Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  checkTier,
  checkFreeLimit,
  getRemainingFreeImages,
  initLicenseChecker,
  handleLicenseCheckAlarm,
} from './license-validator'
import type { UserConfig } from '@/shared/types'

// Mock chrome APIs
const mockChromeStorage = {
  local: {
    data: {} as Record<string, unknown>,
    get: vi.fn(async (keys: string[]) => {
      const result: Record<string, unknown> = {}
      for (const key of keys) {
        if (key in mockChromeStorage.local.data) {
          result[key] = mockChromeStorage.local.data[key]
        }
      }
      return result
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(mockChromeStorage.local.data, items)
    }),
    remove: vi.fn(async (keys: string[]) => {
      for (const key of keys) {
        delete mockChromeStorage.local.data[key]
      }
    }),
  },
  sync: {
    data: {} as Record<string, unknown>,
    get: vi.fn(async (keys: string[]) => {
      const result: Record<string, unknown> = {}
      for (const key of keys) {
        if (key in mockChromeStorage.sync.data) {
          result[key] = mockChromeStorage.sync.data[key]
        }
      }
      return result
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(mockChromeStorage.sync.data, items)
    }),
  },
}

const mockChromeAlarms = {
  create: vi.fn(),
}

const mockChromeNotifications = {
  create: vi.fn(),
}

global.chrome = {
  storage: mockChromeStorage as unknown as typeof chrome.storage,
  alarms: mockChromeAlarms as unknown as typeof chrome.alarms,
  notifications: mockChromeNotifications as unknown as typeof chrome.notifications,
} as typeof chrome

// Mock fetch
global.fetch = vi.fn()

describe('license-validator', () => {
  beforeEach(() => {
    // Reset storage
    mockChromeStorage.local.data = {}
    mockChromeStorage.sync.data = {}

    // Reset mocks
    vi.clearAllMocks()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkTier', () => {
    it('should return "free" when no license key exists', async () => {
      const tier = await checkTier()
      expect(tier).toBe('free')

      // Should cache the result
      expect(mockChromeStorage.local.set).toHaveBeenCalled()
    })

    it('should return cached tier within 24 hours', async () => {
      const now = Date.now()
      mockChromeStorage.local.data.lastVerification = {
        tier: 'pro',
        expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30日後
        verifiedAt: now,
      }

      const tier = await checkTier()
      expect(tier).toBe('pro')

      // Should not call API (fetch not called)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should verify with API when license key exists and no cache', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'test-license-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock successful API response
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tier: 'pro',
          expiresAt: now + 30 * 24 * 60 * 60 * 1000,
          email: 'test@example.com',
        }),
      })

      const tier = await checkTier()
      expect(tier).toBe('pro')

      // Should call API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.diffsnap.io/v1/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'test-license-key' }),
        })
      )

      // Should cache result
      expect(mockChromeStorage.local.set).toHaveBeenCalled()
    })

    it('should return "free" when license expired beyond grace period', async () => {
      const now = Date.now()
      const expiredAt = now - 73 * 60 * 60 * 1000 // 73時間前（グレース期間72時間超過）

      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'expired-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock API response with expired license
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tier: 'pro',
          expiresAt: expiredAt,
          email: 'test@example.com',
        }),
      })

      const tier = await checkTier()
      expect(tier).toBe('free')
    })

    it('should fallback to cache on API error', async () => {
      const now = Date.now()

      // Set valid cache
      mockChromeStorage.local.data.lastVerification = {
        tier: 'pro',
        expiresAt: now + 10 * 24 * 60 * 60 * 1000, // まだ有効
        verifiedAt: now - 25 * 60 * 60 * 1000, // 25時間前（キャッシュ期限切れ）
      }

      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'test-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock API failure
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

      const tier = await checkTier()

      // Should fallback to cached tier
      expect(tier).toBe('pro')
    })

    it('should return "free" on API error with no valid cache', async () => {
      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'test-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock API failure
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

      const tier = await checkTier()
      expect(tier).toBe('free')
    })

    it('should handle API timeout', async () => {
      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'test-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock timeout
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            setTimeout(() => reject(error), 100)
          })
      )

      const tier = await checkTier()
      expect(tier).toBe('free')
    })
  })

  describe('checkFreeLimit', () => {
    it('should return true when within limit', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 100,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000, // 10日後
      }
      mockChromeStorage.sync.data.config = config

      const canProceed = await checkFreeLimit(50)
      expect(canProceed).toBe(true)

      // Should update count to 150
      const updatedConfig = mockChromeStorage.sync.data.config as UserConfig
      expect(updatedConfig.monthlyCount).toBe(150)
    })

    it('should return false when exceeding limit', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 480,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      const canProceed = await checkFreeLimit(30)
      expect(canProceed).toBe(false)

      // Should not update count
      const updatedConfig = mockChromeStorage.sync.data.config as UserConfig
      expect(updatedConfig.monthlyCount).toBe(480)
    })

    it('should reset counter when past reset date', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 500, // 上限達している
        monthlyResetAt: now - 1000, // 過去（リセット必要）
      }
      mockChromeStorage.sync.data.config = config

      const canProceed = await checkFreeLimit(50)
      expect(canProceed).toBe(true)

      // Should reset count
      const updatedConfig = mockChromeStorage.sync.data.config as UserConfig
      expect(updatedConfig.monthlyCount).toBe(50)
      expect(updatedConfig.monthlyResetAt).toBeGreaterThan(now)
    })

    it('should initialize config if not exists', async () => {
      const canProceed = await checkFreeLimit(10)
      expect(canProceed).toBe(true)

      // Should create config
      const config = mockChromeStorage.sync.data.config as UserConfig
      expect(config).toBeDefined()
      expect(config.monthlyCount).toBe(10)
    })

    it('should handle exactly 500 images', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      const canProceed = await checkFreeLimit(500)
      expect(canProceed).toBe(true)

      const updatedConfig = mockChromeStorage.sync.data.config as UserConfig
      expect(updatedConfig.monthlyCount).toBe(500)
    })

    it('should return false for 501 images', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      const canProceed = await checkFreeLimit(501)
      expect(canProceed).toBe(false)
    })
  })

  describe('getRemainingFreeImages', () => {
    it('should return remaining images', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 200,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      const remaining = await getRemainingFreeImages()
      expect(remaining).toBe(300)
    })

    it('should return 500 when config does not exist', async () => {
      const remaining = await getRemainingFreeImages()
      expect(remaining).toBe(500)
    })

    it('should return 500 when past reset date', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 400,
        monthlyResetAt: now - 1000, // 過去
      }
      mockChromeStorage.sync.data.config = config

      const remaining = await getRemainingFreeImages()
      expect(remaining).toBe(500)
    })

    it('should return 0 when limit reached', async () => {
      const now = Date.now()
      const config: UserConfig = {
        tier: 'free',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 500,
        monthlyResetAt: now + 10 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      const remaining = await getRemainingFreeImages()
      expect(remaining).toBe(0)
    })
  })

  describe('initLicenseChecker', () => {
    it('should create alarm for periodic check', async () => {
      await initLicenseChecker()

      expect(mockChromeAlarms.create).toHaveBeenCalledWith('license-check', {
        periodInMinutes: 1440, // 24時間
      })
    })
  })

  describe('handleLicenseCheckAlarm', () => {
    it('should verify license on alarm', async () => {
      const alarm = { name: 'license-check' } as chrome.alarms.Alarm

      await handleLicenseCheckAlarm(alarm)

      // Should clear cache and re-verify
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(['lastVerification'])
    })

    it('should notify user when license expires', async () => {
      const now = Date.now()

      // Set expired license
      const config: UserConfig = {
        tier: 'free',
        licenseKey: 'expired-key',
        namingTemplate: '{date}-{domain}',
        domainProfiles: [],
        monthlyCount: 0,
        monthlyResetAt: now + 30 * 24 * 60 * 60 * 1000,
      }
      mockChromeStorage.sync.data.config = config

      // Mock API returning expired
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tier: 'pro',
          expiresAt: now - 73 * 60 * 60 * 1000, // グレース期間超過
          email: 'test@example.com',
        }),
      })

      const alarm = { name: 'license-check' } as chrome.alarms.Alarm
      await handleLicenseCheckAlarm(alarm)

      // Should create notification
      expect(mockChromeNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          title: 'DiffSnap Pro期限切れ',
        })
      )
    })

    it('should ignore non-license-check alarms', async () => {
      const alarm = { name: 'other-alarm' } as chrome.alarms.Alarm
      await handleLicenseCheckAlarm(alarm)

      // Should not remove cache
      expect(mockChromeStorage.local.remove).not.toHaveBeenCalled()
    })
  })
})
