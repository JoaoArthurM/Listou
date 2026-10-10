// Fotos dos cartões de lista. A referência visual vive de fotografia de comida
// em tons escuros; aqui o equivalente são hortifrúti e feira. Cada lista fica
// sempre com a mesma foto, escolhida pelo id.
//
// Origem e licença das imagens: src/assets/fotos/CREDITOS.md

import feira from '@/assets/fotos/feira-cenouras.webp'
import gondola from '@/assets/fotos/gondola-hortifruti.webp'
import legumesEscuro from '@/assets/fotos/legumes-fundo-escuro.webp'
import legumesMadeira from '@/assets/fotos/legumes-na-madeira.webp'
import tabua from '@/assets/fotos/tabua-de-corte.webp'

const FOTOS = [legumesEscuro, tabua, legumesMadeira, feira, gondola]

/** Foto usada onde não existe lista (demonstração do login). */
export const FOTO_PADRAO = legumesEscuro

export function fotoDaLista(id: string): string {
  let soma = 0
  for (const letra of id) soma = (soma * 31 + letra.charCodeAt(0)) >>> 0
  return FOTOS[soma % FOTOS.length] ?? FOTO_PADRAO
}
