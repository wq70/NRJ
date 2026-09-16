import assert from 'node:assert/strict'
import { createDeliveryQrPayload, decodeDeliveryQrPayload, deliveryKindLabel, formatDeliverySize, validateDeliveryFiles } from '../src/services/deliveryService'
import type { DeliveryItem } from '../src/types/delivery'

const item: DeliveryItem = {
  id: 'delivery_test', schemaVersion: 1, title: '跨设备便签', note: '给另一台设备', text: '明天下午三点见', url: 'https://example.com/path', kind: 'link', direction: 'saved', source: 'local', files: [], createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 60_000
}

const payload = createDeliveryQrPayload(item)
assert.match(payload, /^nrjdelivery:/)
assert.deepEqual(decodeDeliveryQrPayload(payload), { v: 1, title: item.title, note: item.note, text: item.text, url: item.url, expiresAt: item.expiresAt })
assert.throws(() => createDeliveryQrPayload({ ...item, files: [{ id: 'f', name: 'a.txt', mimeType: 'text/plain', size: 1, lastModified: 1 }] }), /含文件/)
assert.throws(() => decodeDeliveryQrPayload('nrjdelivery:not-valid'), /损坏/)
assert.throws(() => validateDeliveryFiles([new File([new Uint8Array(80 * 1024 * 1024 + 1)], 'too-large.bin')]), /80MB/)
assert.equal(deliveryKindLabel('worldbook'), '世界书')
assert.equal(formatDeliverySize(1536), '1.5 KB')

console.log('delivery tests passed')
