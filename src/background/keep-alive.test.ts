import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initKeepAlive,
  handleKeepAliveAlarm,
  saveCheckpoint,
  clearCheckpoint,
  updateBadge,
  showCompleteBadge,
  showErrorBadge,
  clearBadge,
} from './keep-alive'
import type { ProcessingCheckpoint } from '../shared/types'

// chrome API モック
const mockChrome = {
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
}

// グローバルにchromeをモック
global.chrome = mockChrome as unknown as typeof chrome

describe('keep-alive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initKeepAlive', () => {
    it('should clear existing alarms and create new one', async () => {
      mockChrome.alarms.clear.mockResolvedValue(true)
      mockChrome.alarms.create.mockResolvedValue(undefined)

      await initKeepAlive()

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('keep-alive')
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('keep-alive', {
        periodInMinutes: 0.5,
      })
    })
  })

  describe('handleKeepAliveAlarm', () => {
    it('should do nothing if alarm name does not match', async () => {
      const alarm = { name: 'other-alarm' } as chrome.alarms.Alarm

      await handleKeepAliveAlarm(alarm)

      expect(mockChrome.storage.session.get).not.toHaveBeenCalled()
    })

    it('should check active processing when alarm matches', async () => {
      const alarm = { name: 'keep-alive' } as chrome.alarms.Alarm
      mockChrome.storage.session.get.mockResolvedValue({ activeProcessing: false })

      await handleKeepAliveAlarm(alarm)

      expect(mockChrome.storage.session.get).toHaveBeenCalledWith(['activeProcessing'])
    })

    it('should log when processing continues', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const alarm = { name: 'keep-alive' } as chrome.alarms.Alarm
      mockChrome.storage.session.get.mockResolvedValue({ activeProcessing: true })

      await handleKeepAliveAlarm(alarm)

      expect(consoleSpy).toHaveBeenCalledWith('Keep-alive: processing continues')
    })

    it('should clear badge when clear-badge alarm fires', async () => {
      const alarm = { name: 'clear-badge' } as chrome.alarms.Alarm
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)
      mockChrome.alarms.clear.mockResolvedValue(true)

      await handleKeepAliveAlarm(alarm)

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('clear-badge')
    })
  })

  describe('saveCheckpoint', () => {
    it('should save checkpoint to session storage', async () => {
      const checkpoint: ProcessingCheckpoint = {
        tabId: 123,
        url: 'https://example.com',
        candidates: [],
        completedIndices: [0, 1, 2],
        failedCandidates: [],
        lastCheckpointAt: Date.now(),
        phase: 'fetching',
      }

      mockChrome.storage.session.set.mockResolvedValue(undefined)

      await saveCheckpoint(checkpoint)

      expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
        checkpoint_123: checkpoint,
      })
    })
  })

  describe('clearCheckpoint', () => {
    it('should remove checkpoint from session storage', async () => {
      mockChrome.storage.session.remove.mockResolvedValue(undefined)

      await clearCheckpoint(123)

      expect(mockChrome.storage.session.remove).toHaveBeenCalledWith('checkpoint_123')
    })
  })

  describe('updateBadge', () => {
    it('should clear badge when total is 0', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)

      await updateBadge(0, 0)

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
    })

    it('should show percentage when processing', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)
      mockChrome.action.setBadgeBackgroundColor.mockResolvedValue(undefined)

      await updateBadge(50, 100)

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '50%' })
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#3B82F6',
      })
    })

    it('should show 100% when all completed', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)
      mockChrome.action.setBadgeBackgroundColor.mockResolvedValue(undefined)

      await updateBadge(100, 100)

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '100%' })
    })
  })

  describe('showCompleteBadge', () => {
    it('should show checkmark with green background and schedule clear', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)
      mockChrome.action.setBadgeBackgroundColor.mockResolvedValue(undefined)
      mockChrome.alarms.create.mockResolvedValue(undefined)

      await showCompleteBadge()

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '✓' })
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#10B981',
      })
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('clear-badge', {
        delayInMinutes: 0.05,
      })
    })
  })

  describe('showErrorBadge', () => {
    it('should show X mark with red background', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)
      mockChrome.action.setBadgeBackgroundColor.mockResolvedValue(undefined)

      await showErrorBadge()

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '✗' })
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#EF4444',
      })
    })
  })

  describe('clearBadge', () => {
    it('should clear badge text', async () => {
      mockChrome.action.setBadgeText.mockResolvedValue(undefined)

      await clearBadge()

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
    })
  })
})
