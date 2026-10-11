// Fotos dos cartões de lista: corredores, geladeiras e prateleiras de mercado,
// em enquadramentos limpos e tons escuros o bastante para o nome da lista em
// branco por cima. Cada lista fica sempre com a mesma foto, escolhida pelo id;
// quanto mais fotos, mais variam entre as listas.
//
// Origem e licença das imagens: src/assets/fotos/CREDITOS.md

import carrinhoAzul from '@/assets/fotos/carrinho-azul.webp'
import corredorIluminado from '@/assets/fotos/corredor-iluminado.webp'
import geladeiraLaticinios from '@/assets/fotos/geladeira-laticinios.webp'
import geladeiraReflexo from '@/assets/fotos/geladeira-reflexo.webp'
import geladeirasLaticinios from '@/assets/fotos/geladeiras-laticinios.webp'
import gondola from '@/assets/fotos/gondola-hortifruti.webp'
import legumesEscuro from '@/assets/fotos/legumes-fundo-escuro.webp'
import lojaTetoOndulado from '@/assets/fotos/loja-teto-ondulado.webp'
import prateleiraFrutas from '@/assets/fotos/prateleira-frutas.webp'
import prateleiraFrutasMadeira from '@/assets/fotos/prateleira-frutas-madeira.webp'

const FOTOS = [
  lojaTetoOndulado,
  corredorIluminado,
  geladeirasLaticinios,
  legumesEscuro,
  prateleiraFrutas,
  geladeiraReflexo,
  carrinhoAzul,
  prateleiraFrutasMadeira,
  gondola,
  geladeiraLaticinios,
]

/** Foto usada onde não existe lista (demonstração do login). */
export const FOTO_PADRAO = legumesEscuro

export function fotoDaLista(id: string): string {
  let soma = 0
  for (const letra of id) soma = (soma * 31 + letra.charCodeAt(0)) >>> 0
  return FOTOS[soma % FOTOS.length] ?? FOTO_PADRAO
}
