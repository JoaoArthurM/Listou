import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const shared = path.resolve(aqui, '../../supabase/functions/_shared')

// O servidor calcula com uma cópia destes arquivos. Se alguém editar um lado
// só, cliente e Edge Function passariam a discordar do total.
describe('cópia das funções puras nas Edge Functions', () => {
  it.each(['dinheiro.ts', 'precos.ts', 'leitura.ts', 'nomes.ts'])('%s é idêntico em src/lib e supabase/functions/_shared', (arquivo) => {
    const fonte = readFileSync(path.join(aqui, arquivo), 'utf8')
    const copia = readFileSync(path.join(shared, arquivo), 'utf8')
    expect(copia, 'rode "npm run sync:shared"').toBe(fonte)
  })
})
