import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('lib/index.js использует z.natural() и не содержит несовместимых методов Zod (.int(), .nonnegative())', () => {
  const code = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(code, /maxStepTokens:\s*z\s*\.\s*natural\(\)/, 'maxStepTokens должен объявляться через z.natural()')
  assert.doesNotMatch(code, /\.int\(\)/, 'в схеме schemastery не должно быть вызова .int()')
  assert.doesNotMatch(code, /\.nonnegative\(\)/, 'в схеме schemastery не должно быть вызова .nonnegative()')
})
