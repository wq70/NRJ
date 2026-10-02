import { decrypt, encrypt, CommerceError } from './policy.mjs'

export class Repository {
  constructor(pool, key) { this.pool = pool; this.key = key }
  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS nrj_commerce_records (
      owner text NOT NULL, kind text NOT NULL, id text NOT NULL,
      payload text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(owner,kind,id));
      CREATE TABLE IF NOT EXISTS nrj_commerce_operations (
      owner text NOT NULL, id text NOT NULL, session_id text NOT NULL,
      status text NOT NULL, result text, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(owner,id));`)
  }
  async get(owner, kind, id) {
    const result = await this.pool.query('SELECT payload FROM nrj_commerce_records WHERE owner=$1 AND kind=$2 AND id=$3', [owner, kind, id])
    return result.rows[0] ? decrypt(result.rows[0].payload, this.key) : null
  }
  async list(owner, kind, all = false) {
    const result = await this.pool.query(`SELECT payload FROM nrj_commerce_records WHERE owner=$1 AND kind=$2 ORDER BY updated_at DESC${all ? '' : ' LIMIT 200'}`, [owner, kind])
    return result.rows.map(row => decrypt(row.payload, this.key))
  }
  async put(owner, kind, id, value) {
    await this.pool.query('INSERT INTO nrj_commerce_records(owner,kind,id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(owner,kind,id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()', [owner, kind, id, encrypt(value, this.key)])
    return value
  }
  async remove(owner, kind, id) { await this.pool.query('DELETE FROM nrj_commerce_records WHERE owner=$1 AND kind=$2 AND id=$3', [owner, kind, id]) }
  async operation(owner, id, sessionId, run) {
    if (!/^[\w-]{16,100}$/.test(id || '')) throw new CommerceError('缺少有效的操作标识')
    const inserted = await this.pool.query('INSERT INTO nrj_commerce_operations(owner,id,session_id,status) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [owner, id, sessionId, 'pending'])
    if (!inserted.rowCount) {
      const existing = (await this.pool.query('SELECT * FROM nrj_commerce_operations WHERE owner=$1 AND id=$2', [owner, id])).rows[0]
      if (existing.session_id !== sessionId) throw new CommerceError('操作标识不能跨会话使用', 409)
      if (existing.status !== 'completed') throw new CommerceError('该操作的结果尚未确认，请查看平台页面，不要重复提交', 409, 'result_unknown')
      return decrypt(existing.result, this.key)
    }
    try {
      const result = await run()
      await this.pool.query('UPDATE nrj_commerce_operations SET status=$3,result=$4 WHERE owner=$1 AND id=$2', [owner, id, 'completed', encrypt(result, this.key)])
      return result
    } catch (error) {
      // A lost response can follow a successful platform mutation. Never replay an unresolved operation.
      await this.pool.query('UPDATE nrj_commerce_operations SET status=$3 WHERE owner=$1 AND id=$2', [owner, id, 'unknown']).catch(() => {})
      throw error
    }
  }
}
