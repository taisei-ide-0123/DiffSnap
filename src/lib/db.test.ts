/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  openDiffSnapDB,
  saveRecord,
  getRecord,
  deleteRecord,
  getRecordsByDomain,
  cleanupOldRecords,
  getAllRecords,
  clearDatabase,
} from './db'
import type { DiffRecord, ImageSnapshot } from '../shared/types'

describe('db', () => {
  beforeEach(async () => {
    // テスト前にデータベースをクリア
    await clearDatabase()
  })

  afterEach(async () => {
    // テスト後にクリーンアップ
    await clearDatabase()
  })

  describe('openDiffSnapDB', () => {
    it('データベースを開けること', async () => {
      const db = await openDiffSnapDB()
      try {
        expect(db.name).toBe('DiffSnapDB')
        expect(db.version).toBe(1)
      } finally {
        db.close()
      }
    })

    it('recordsストアが存在すること', async () => {
      const db = await openDiffSnapDB()
      try {
        expect(db.objectStoreNames.contains('records')).toBe(true)
      } finally {
        db.close()
      }
    })

    it('domainインデックスが存在すること', async () => {
      const db = await openDiffSnapDB()
      try {
        const tx = db.transaction('records', 'readonly')
        const store = tx.objectStore('records')
        expect(store.indexNames.contains('domain')).toBe(true)
      } finally {
        db.close()
      }
    })

    it('lastScanAtインデックスが存在すること', async () => {
      const db = await openDiffSnapDB()
      try {
        const tx = db.transaction('records', 'readonly')
        const store = tx.objectStore('records')
        expect(store.indexNames.contains('lastScanAt')).toBe(true)
      } finally {
        db.close()
      }
    })
  })

  describe('saveRecord / getRecord', () => {
    it('レコードを保存して取得できること', async () => {
      const testRecord: DiffRecord = {
        id: 'https://example.com/test:abc123',
        url: 'https://example.com/test?q=1',
        origin: 'https://example.com',
        pathname: '/test',
        queryHash: 'abc123',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(testRecord)
      const retrieved = await getRecord(testRecord.id)

      expect(retrieved).toEqual(testRecord)
    })

    it('存在しないレコードはundefinedを返すこと', async () => {
      const retrieved = await getRecord('nonexistent')
      expect(retrieved).toBeUndefined()
    })

    it('画像スナップショットを含むレコードを保存できること', async () => {
      const imageSnapshot: ImageSnapshot = {
        hash: 'hash123',
        url: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        alt: 'Test image',
        context: 'Some context text',
        firstSeenAt: Date.now(),
      }

      const testRecord: DiffRecord = {
        id: 'https://example.com/test:abc123',
        url: 'https://example.com/test?q=1',
        origin: 'https://example.com',
        pathname: '/test',
        queryHash: 'abc123',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [imageSnapshot],
      }

      await saveRecord(testRecord)
      const retrieved = await getRecord(testRecord.id)

      expect(retrieved?.images).toHaveLength(1)
      expect(retrieved?.images[0]).toEqual(imageSnapshot)
    })
  })

  describe('deleteRecord', () => {
    it('レコードを削除できること', async () => {
      const testRecord: DiffRecord = {
        id: 'https://example.com/test:abc123',
        url: 'https://example.com/test?q=1',
        origin: 'https://example.com',
        pathname: '/test',
        queryHash: 'abc123',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(testRecord)
      await deleteRecord(testRecord.id)

      const retrieved = await getRecord(testRecord.id)
      expect(retrieved).toBeUndefined()
    })
  })

  describe('getRecordsByDomain', () => {
    it('ドメインでレコードを検索できること', async () => {
      const record1: DiffRecord = {
        id: 'https://example.com/page1:abc',
        url: 'https://example.com/page1',
        origin: 'https://example.com',
        pathname: '/page1',
        queryHash: 'abc',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      const record2: DiffRecord = {
        id: 'https://example.com/page2:def',
        url: 'https://example.com/page2',
        origin: 'https://example.com',
        pathname: '/page2',
        queryHash: 'def',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      const record3: DiffRecord = {
        id: 'https://other.com/page1:ghi',
        url: 'https://other.com/page1',
        origin: 'https://other.com',
        pathname: '/page1',
        queryHash: 'ghi',
        domain: 'other.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(record1)
      await saveRecord(record2)
      await saveRecord(record3)

      const exampleRecords = await getRecordsByDomain('example.com')
      expect(exampleRecords).toHaveLength(2)
      expect(exampleRecords.map((r) => r.id)).toContain(record1.id)
      expect(exampleRecords.map((r) => r.id)).toContain(record2.id)

      const otherRecords = await getRecordsByDomain('other.com')
      expect(otherRecords).toHaveLength(1)
      expect(otherRecords[0]?.id).toBe(record3.id)
    })

    it('該当するドメインがない場合は空配列を返すこと', async () => {
      const records = await getRecordsByDomain('nonexistent.com')
      expect(records).toEqual([])
    })
  })

  describe('getAllRecords', () => {
    it('全レコードを取得できること', async () => {
      const record1: DiffRecord = {
        id: 'https://example.com/page1:abc',
        url: 'https://example.com/page1',
        origin: 'https://example.com',
        pathname: '/page1',
        queryHash: 'abc',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      const record2: DiffRecord = {
        id: 'https://other.com/page1:def',
        url: 'https://other.com/page1',
        origin: 'https://other.com',
        pathname: '/page1',
        queryHash: 'def',
        domain: 'other.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(record1)
      await saveRecord(record2)

      const allRecords = await getAllRecords()
      expect(allRecords).toHaveLength(2)
      expect(allRecords.map((r) => r.id)).toContain(record1.id)
      expect(allRecords.map((r) => r.id)).toContain(record2.id)
    })

    it('レコードがない場合は空配列を返すこと', async () => {
      const records = await getAllRecords()
      expect(records).toEqual([])
    })
  })

  describe('cleanupOldRecords', () => {
    it('指定日数より古いレコードを削除できること', async () => {
      const now = Date.now()
      const oldRecord: DiffRecord = {
        id: 'https://example.com/old:abc',
        url: 'https://example.com/old',
        origin: 'https://example.com',
        pathname: '/old',
        queryHash: 'abc',
        domain: 'example.com',
        lastScanAt: now - 100 * 24 * 60 * 60 * 1000, // 100日前
        images: [],
      }

      const recentRecord: DiffRecord = {
        id: 'https://example.com/recent:def',
        url: 'https://example.com/recent',
        origin: 'https://example.com',
        pathname: '/recent',
        queryHash: 'def',
        domain: 'example.com',
        lastScanAt: now - 10 * 24 * 60 * 60 * 1000, // 10日前
        images: [],
      }

      await saveRecord(oldRecord)
      await saveRecord(recentRecord)

      const deletedCount = await cleanupOldRecords(90)
      expect(deletedCount).toBe(1)

      const remainingRecords = await getAllRecords()
      expect(remainingRecords).toHaveLength(1)
      expect(remainingRecords[0]?.id).toBe(recentRecord.id)
    })

    it('古いレコードがない場合は0を返すこと', async () => {
      const recentRecord: DiffRecord = {
        id: 'https://example.com/recent:abc',
        url: 'https://example.com/recent',
        origin: 'https://example.com',
        pathname: '/recent',
        queryHash: 'abc',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(recentRecord)

      const deletedCount = await cleanupOldRecords(90)
      expect(deletedCount).toBe(0)

      const remainingRecords = await getAllRecords()
      expect(remainingRecords).toHaveLength(1)
    })
  })

  describe('clearDatabase', () => {
    it('全レコードをクリアできること', async () => {
      const record: DiffRecord = {
        id: 'https://example.com/test:abc',
        url: 'https://example.com/test',
        origin: 'https://example.com',
        pathname: '/test',
        queryHash: 'abc',
        domain: 'example.com',
        lastScanAt: Date.now(),
        images: [],
      }

      await saveRecord(record)
      await clearDatabase()

      const records = await getAllRecords()
      expect(records).toEqual([])
    })
  })
})
