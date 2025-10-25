/**
 * IndexedDB: DiffSnapDB
 * 差分台帳管理用のデータベース
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { DiffRecord } from '../shared/types'

const DB_NAME = 'DiffSnapDB'
const DB_VERSION = 1
const STORE_NAME = 'records'

export interface DiffSnapDB {
  records: {
    key: string
    value: DiffRecord
    indexes: {
      domain: string
      lastScanAt: number
    }
  }
}

/**
 * IndexedDBを開く
 * データベースが存在しない場合は新規作成し、スキーマをセットアップする
 */
export const openDiffSnapDB = async (): Promise<IDBPDatabase<DiffSnapDB>> => {
  return openDB<DiffSnapDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ObjectStore作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })

        // インデックス作成
        store.createIndex('domain', 'domain', { unique: false })
        store.createIndex('lastScanAt', 'lastScanAt', { unique: false })
      }
    },
  })
}

/**
 * レコードを取得
 */
export const getRecord = async (recordId: string): Promise<DiffRecord | undefined> => {
  const db = await openDiffSnapDB()
  try {
    return await db.get(STORE_NAME, recordId)
  } finally {
    db.close()
  }
}

/**
 * レコードを保存
 */
export const saveRecord = async (record: DiffRecord): Promise<void> => {
  const db = await openDiffSnapDB()
  try {
    await db.put(STORE_NAME, record)
  } finally {
    db.close()
  }
}

/**
 * レコードを削除
 */
export const deleteRecord = async (recordId: string): Promise<void> => {
  const db = await openDiffSnapDB()
  try {
    await db.delete(STORE_NAME, recordId)
  } finally {
    db.close()
  }
}

/**
 * ドメインでレコードを検索
 */
export const getRecordsByDomain = async (domain: string): Promise<DiffRecord[]> => {
  const db = await openDiffSnapDB()
  try {
    return await db.getAllFromIndex(STORE_NAME, 'domain', domain)
  } finally {
    db.close()
  }
}

/**
 * 古いレコードを削除（90日以上前）
 */
export const cleanupOldRecords = async (daysOld = 90): Promise<number> => {
  const db = await openDiffSnapDB()
  try {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000

    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.store.index('lastScanAt')
    const oldRecords = await index.getAll(IDBKeyRange.upperBound(cutoffTime))

    // 並列削除でパフォーマンス向上
    await Promise.all(oldRecords.map((record) => tx.store.delete(record.id)))

    await tx.done
    return oldRecords.length
  } finally {
    db.close()
  }
}

/**
 * 全レコードを取得
 */
export const getAllRecords = async (): Promise<DiffRecord[]> => {
  const db = await openDiffSnapDB()
  try {
    return await db.getAll(STORE_NAME)
  } finally {
    db.close()
  }
}

/**
 * データベースをクリア（テスト用）
 */
export const clearDatabase = async (): Promise<void> => {
  const db = await openDiffSnapDB()
  try {
    await db.clear(STORE_NAME)
  } finally {
    db.close()
  }
}
