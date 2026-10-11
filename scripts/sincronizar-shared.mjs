// Copia as funções puras de dinheiro, preço, leitura e nomes para as Edge Functions.
// O Deno do Supabase só empacota o que está dentro de supabase/functions/,
// então o servidor trabalha com uma cópia; src/lib é a fonte da verdade e
// src/lib/shared.test.ts falha se as duas versões divergirem.
//
// Uso: npm run sync:shared

import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origem = path.join(raiz, 'src', 'lib')
const destino = path.join(raiz, 'supabase', 'functions', '_shared')

mkdirSync(destino, { recursive: true })
for (const arquivo of ['dinheiro.ts', 'precos.ts', 'leitura.ts', 'nomes.ts']) {
  copyFileSync(path.join(origem, arquivo), path.join(destino, arquivo))
  console.log(`src/lib/${arquivo} -> supabase/functions/_shared/${arquivo}`)
}
