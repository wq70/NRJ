/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { DeliveryItem } from '../types/delivery'
import { createDelivery } from './deliveryService'

const DB_NAME = 'nrt-delivery-share-target'
const STORE_NAME = 'incoming'

type PendingShare = { id: string; title?: string; text?: string; url?: string; files?: Blob[]; fileNames?: string[]; fileTypes?: string[]; createdAt: number }

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const readAll = async () => {
  const db = await openDb()
  try {
    return await new Promise<PendingShare[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

const remove = async (id: string) => {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally { db.close() }
}

export const consumePendingSystemShares = async (): Promise<{ imported: DeliveryItem[]; failed: number }> => {
  if (typeof indexedDB === 'undefined') return { imported: [], failed: 0 }
  const records = await readAll().catch(() => [])
  const imported: DeliveryItem[] = []
  let failed = 0
  for (const record of records.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const files = (record.files || []).map((blob, index) => new File([blob], record.fileNames?.[index] || `分享文件-${index + 1}`, { type: record.fileTypes?.[index] || blob.type }))
      const item = await createDelivery({ title: record.title, text: record.text, url: record.url, files, direction: 'received', source: 'system-share' })
      imported.push(item)
      await remove(record.id)
    } catch {
      failed += 1
      /* 保留尚未成功处理的系统分享，便于下次重试。 */
    }
  }
  return { imported, failed }
}

export const hasPendingSystemShares = async () => (await readAll().catch(() => [])).length > 0
