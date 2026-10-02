import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { passwordHash } from '../src/policy.mjs'
const prompt = createInterface({ input: stdin, output: stdout })
try {
  const value = await prompt.question('请输入共逛服务连接口令（输入会在终端显示，请勿使用平台密码）：')
  if (value.length < 12) throw new Error('口令至少需要12个字符')
  console.log(passwordHash(value))
} finally { prompt.close() }
