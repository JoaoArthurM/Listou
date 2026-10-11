// Seções do mercado. A lista de compras é agrupada por elas, na ordem em que
// costumam aparecer no caminho da loja. A seção sai do nome do item, por uma
// tabela de palavras: é imediato, funciona sem conexão e não gasta IA. Quando a
// tabela erra ou não conhece o produto, a pessoa escolhe a seção no item e a
// escolha fica gravada (coluna itens.secao).

export const SECOES = [
  'hortifruti',
  'padaria',
  'acougue',
  'frios',
  'mercearia',
  'bebidas',
  'congelados',
  'limpeza',
  'higiene',
  'pet',
  'outros',
] as const

export type Secao = (typeof SECOES)[number]

export const NOME_DA_SECAO: Record<Secao, string> = {
  hortifruti: 'Hortifrúti',
  padaria: 'Padaria',
  acougue: 'Açougue e peixaria',
  frios: 'Frios e laticínios',
  mercearia: 'Mercearia',
  bebidas: 'Bebidas',
  congelados: 'Congelados',
  limpeza: 'Limpeza',
  higiene: 'Higiene e beleza',
  pet: 'Pet',
  outros: 'Outros',
}

// Termos já sem acento e no singular. Um termo de várias palavras ganha de um
// de uma só ("molho de tomate" é mercearia, não hortifrúti).
const TERMOS: Record<Exclude<Secao, 'outros'>, string> = {
  hortifruti:
    'abacate|abacaxi|abobora|abobrinha|acelga|agriao|aipim|alface|alho|alho poro|ameixa|banana|batata|batata doce|berinjela|beterraba|brocolis|caju|caqui|cebola|cebolinha|cenoura|cheiro verde|chuchu|coco|coentro|couve|couve flor|espinafre|fruta|gengibre|goiaba|hortela|inhame|jilo|kiwi|laranja|legume|limao|maca|macaxeira|mamao|mandioca|mandioquinha|manga|manjericao|maracuja|maxixe|melancia|melao|morango|pepino|pera|pessego|pimentao|quiabo|rabanete|repolho|rucula|salsa|salsinha|tangerina|mexerica|tomate|uva|vagem|verdura|acerola|amora|atemoia|batata baroa|batata inglesa|bergamota|caja|carambola|cereja|champignon|cogumelo|couve manteiga|damasco|erva cidreira|erva doce|figo|framboesa|fruta do conde|graviola|jabuticaba|jaca|lichia|lima|mirtilo|nabo|nectarina|pitaya|pinhao|pimenta biquinho|pimenta dedo de moca|ponkan|shiitake|shimeji|tamarindo|tomate cereja|tomate italiano|salsao|aspargo|alcachofra|taioba|limao siciliano|limao taiti|ora pro nobis',
  padaria: 'baguete|bisnaguinha|bolo|broa|croissant|pao|pao de forma|pao frances|pao integral|pao sirio|rosca|sonho|torrada|bisnaga|bolo de pote|ciabatta|coxinha|cuca|donut|empada|enroladinho|esfiha|mini pao|panetone|pao australiano|pao careca|pao de batata|pao de centeio|pao de hamburguer|pao de hot dog|pao de leite|pao de mel|pao de sal|pao doce|pao arabe|pao sovado|pastel|pita|rabanada|rosquinha|salgado|tortilha|wrap|pao naan',
  acougue:
    'acem|alcatra|bacon|bife|bisteca|camarao|carne|carne moida|contra file|costela|coxa|coxao mole|cupim|file|file de peixe|file de frango|fraldinha|frango|figado|lagarto|linguica|lombo|maminha|merluza|moela|musculo|patinho|peito de frango|peixe|pernil|picanha|salmao|sardinha fresca|sobrecoxa|tilapia|toucinho|asa|asa de frango|bacalhau|bucho|cacao|calabresa|carne de porco|carne de sol|carne seca|charque|copa lombo|coracao|cordeiro|costela de porco|costelinha|dobradinha|entrecot|file mignon|filezinho|frango inteiro|isca|jaba|kafta|lingua|lula|mexilhao|mocoto|ossobuco|osso buco|ostra|paleta|panceta|pe de porco|picadinho|polvo|ponta de agulha|rabada|rabo|sassami|surubim|tambaqui|tambacu|pintado|pacu|atum fresco|peito bovino|t bone|ancho|noix',
  frios:
    'coalhada|cream cheese|creme de ricota|iogurte|leite|leite fermentado|manteiga|margarina|massa fresca|mortadela|mussarela|mucarela|nata|peito de peru|petit suisse|presunto|queijo|requeijao|ricota|salame|salsicha|apresuntado|blanquet|brie|camembert|catupiry|chantilly|ghee|gorgonzola|gouda|iogurte grego|kefir|lombo canadense|nhoque|ravioli|tortellini|capeletti|massa de pastel|massa de lasanha|parmesao|pate|pepperoni|peperoni|provolone|queijo coalho|queijo minas|tofu|yakult|danoninho|chamyto|activia',
  mercearia:
    'acucar|adocante|amendoim|amido|arroz|atum|aveia|azeite|azeitona|bala|batata palha|biscoito|bolacha|cafe|caldo de galinha|caldo de carne|canela|catchup|ketchup|cereal|cha|chocolate|chocolate em po|achocolatado|colorau|cominho|creme de leite|doce de leite|ervilha|extrato de tomate|farinha|farinha de trigo|farinha de mandioca|farofa|feijao|fermento|fuba|gelatina|geleia|granola|grao de bico|lasanha seca|leite condensado|leite de coco|leite em po|lentilha|macarrao|maionese|massa|massa de tomate|mel|milho|mistura para bolo|milho de pipoca|milho verde|molho|molho de tomate|mostarda|oleo|oleo de soja|oregano|ovo|palmito|pimenta|pipoca|polvilho|sal|salgadinho|sardinha|tapioca|tempero|trigo|vinagre|acafrao|alecrim|alho em po|amendoa|ameixa seca|amido de milho|avela|bananada|barra de cereal|bicarbonato|bombom|cacau|cacau em po|calda|calda de chocolate|capsula de cafe|cafe soluvel|cafe em capsula|cappuccino|caramelo|castanha|castanha de caju|castanha do para|cereal matinal|chia|chiclete|chimichurri|chips|cha mate|cha de camomila|chocolate granulado|chocolate meio amargo|coco ralado|composto lacteo|confeito|corn flake|cravo|cream cracker|creme de avela|cuscuz|curry|damasco seco|doce de abobora|doritos|drops|erva mate|ervilha em conserva|espaguete|essencia de baunilha|farinha de aveia|farinha de arroz|farinha de milho|farinha de rosca|farinha lactea|filtro de cafe|flocao|fusilli|gergelim|goiabada|gordura vegetal|gotas de chocolate|granulado|jujuba|leite ninho|linhaca|louro|macarrao instantaneo|maizena|marshmallow|melado|miojo|mix de castanhas|molho shoyu|molho ingles|molho de pimenta|molho pronto|molho barbecue|molho branco|noz|noz moscada|nozes|nutella|ovo de codorna|ovo de pascoa|pacoca|paprica|pasta de amendoim|penne|pe de moleque|picles|pimenta do reino|pimenta calabresa|pipoca de microondas|pistache|pudim em po|quinoa|rapadura|sal grosso|sal rosa|sazon|shoyu|stevia|sucrilhos|tabasco|talharim|tamara|tempero pronto|tomate seco|tomilho|uva passa|vinagre balsamico|wafer|batata chips|biscoito recheado|conserva|ervas finas|lemon pepper|mucilon|papinha|formula infantil',
  bebidas:
    'agua|agua de coco|agua mineral|agua tonica|cachaca|cerveja|energetico|espumante|guarana|isotonico|refrigerante|coca|coca cola|pepsi|fanta|sprite|skol|brahma|heineken|suco|suco de laranja|suco de uva|vinho|vodka|whisky|agua com gas|agua sem gas|aperol|budweiser|campari|cerveja long neck|chope|chopp|cidra|sidra|champagne|prosecco|conhaque|del valle|gatorade|powerade|h2oh|kombucha|licor|maguary|mate leao|monster|nectar|pinga|red bull|sake|schweppes|smirnoff|stella artois|suco em po|suco de caixinha|suco de limao|suco integral|tang|tequila|toddynho|vermouth|vinho tinto|vinho branco|vinho rose|itaipava|amstel|eisenbahn|devassa|leite de aveia|leite de amendoa|leite de soja|bebida vegetal|cha gelado|cha pronto|coca zero|guarana antartica|sukita|kuat|antarctica|jack daniels|absolut',
  congelados:
    'acai|batata frita|batata congelada|empanado|empanado de frango|hamburguer|lasanha|nuggets|nuggets de frango|steak de frango|pao de queijo|picole|pizza|polpa|polpa de fruta|sorvete|steak|bolinho de bacalhau|brocolis congelado|croquete|fruta congelada|file empanado|frango empanado|gelo|hot pocket|kibe|quibe|legumes congelados|lasanha congelada|marmita|marmitex|massa folhada|massa congelada|mandioca congelada|milho congelado|mix de legumes|morango congelado|nhoque congelado|pao de alho|peixe empanado|camarao empanado|polpa de acai|prato pronto|refeicao congelada|sorvete de pote|ervilha congelada|espinafre congelado|batata rustica|pastel congelado|coxinha congelada|salgadinho congelado',
  limpeza:
    'agua sanitaria|alcool|alvejante|amaciante|bombril|bucha|candida|cera|desengordurante|desinfetante|detergente|esponja|flanela|guardanapo|inseticida|limpa vidro|limpador|lustra movel|luva|multiuso|omo|pano|pinho sol|pano de chao|pano de prato|papel aluminio|papel toalha|rodo|sabao|sabao em barra|sabao em po|sabao liquido|saco de lixo|saponaceo|vassoura|veja|aromatizador|balde|baygon|bloco sanitario|cera liquida|cif|cloro|desentupidor|desodorizador|detergente em po|esfregao|filme plastico|harpic|lava louca|lava roupa|limpa forno|limpa piso|limpa vidros|limpador perfumado|lixeira|lysoform|mata barata|mata mosquito|naftalina|odorizador|palha de aco|papel filme|papel manteiga|pedra sanitaria|perfex|pinho|prato descartavel|copo descartavel|talher descartavel|raid|removedor|saco de freezer|saco para lixo|saco plastico|saco zip|sabao de coco|sabao em pedra|tira manchas|tira gordura|vanish|ype|toalha de papel|sapolio',
  higiene:
    'absorvente|algodao|aparelho de barbear|barbeador|condicionador|cotonete|creme dental|creme de barbear|creme hidratante|desodorante|enxaguante|escova de dente|fio dental|fralda|hidratante|lenco umedecido|papel higienico|pasta de dente|protetor solar|sabonete|shampoo|xampu|acetona|alcool em gel|alcool gel|agua micelar|band aid|bloqueador solar|colonia|coloracao|creme de pentear|creme depilatorio|creme para maos|creme para o corpo|cera depilatoria|curativo|demaquilante|disco de algodao|dipirona|dorflex|elastico de cabelo|enxaguante bucal|escova de cabelo|esmalte|espuma de barbear|esparadrapo|fralda descartavel|gaze|gel de banho|gel de cabelo|gilette|hastes flexiveis|ibuprofeno|lamina de barbear|lenco de papel|listerine|locao|mascara capilar|mascara descartavel|mascara de cabelo|oleo corporal|paracetamol|palito de dente|pente|perfume|pomada|pos barba|remedio|repelente|sabonete em barra|sabonete liquido|sabonete intimo|soro fisiologico|talco|tampao|tintura|tinta de cabelo|vaselina|vitamina|coletor menstrual|protetor diario|analgesico|colgate|oral b|cortador de unha|alicate de unha|lixa de unha|rolo de papel higienico|mamadeira|pomada de assadura',
  pet: 'areia de gato|areia higienica|petisco|racao|sache de gato|sache de cachorro|tapete higienico|alpiste|antipulgas|areia sanitaria|bifinho|cat chow|chappi|coleira|comedouro|dog chow|granulado sanitario|osso de couro|pedigree|premier pet|purina|shampoo pet|vermifugo|whiskas|racao de passaro|brinquedo para cachorro|brinquedo para gato|arranhador',
}

// "limões" -> "limao", "pães" -> "pao", "tomates" -> "tomate", "cereais" -> "cereal".
function singular(palavra: string): string {
  if (palavra.length <= 3) return palavra
  if (palavra.endsWith('oes') || palavra.endsWith('aes')) return palavra.slice(0, -3) + 'ao'
  if (palavra.endsWith('eis') || palavra.endsWith('ais')) return palavra.slice(0, -2) + 'l'
  if (palavra.endsWith('res') || palavra.endsWith('zes')) return palavra.slice(0, -2)
  if (palavra.endsWith('s') && !palavra.endsWith('ss')) return palavra.slice(0, -1)
  return palavra
}

function palavras(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
}

// termo -> seção, com os termos mais longos primeiro.
const INDICE: Array<{ termo: string[]; secao: Secao }> = (Object.entries(TERMOS) as Array<[Secao, string]>)
  .flatMap(([secao, lista]) => lista.split('|').map((termo) => ({ termo: termo.split(' ').map(singular), secao })))
  .sort((a, b) => b.termo.length - a.termo.length)

function contem(frase: string[], termo: string[]): boolean {
  for (let i = 0; i + termo.length <= frase.length; i++) {
    if (termo.every((palavra, j) => frase[i + j] === palavra)) return true
  }
  return false
}

/** Seção pelo nome do item. O que a tabela não conhece vai para "outros". */
export function secaoPeloNome(nome: string): Secao {
  const frase = palavras(nome)
  return INDICE.find(({ termo }) => contem(frase, termo))?.secao ?? 'outros'
}

const ehSecao = (valor: string | null | undefined): valor is Secao => SECOES.includes(valor as Secao)

/** A seção escolhida à mão vale; sem escolha, decide o nome. */
export function secaoDoItem(item: { nome: string; secao?: string | null }): Secao {
  return ehSecao(item.secao) ? item.secao : secaoPeloNome(item.nome)
}

/** Agrupa na ordem das seções, pulando as vazias. */
export function agruparPorSecao<T extends { nome: string; secao?: string | null }>(itens: T[]): Array<{ secao: Secao; itens: T[] }> {
  const grupos = new Map<Secao, T[]>()
  for (const item of itens) {
    const secao = secaoDoItem(item)
    grupos.set(secao, [...(grupos.get(secao) ?? []), item])
  }
  return SECOES.filter((s) => grupos.has(s)).map((secao) => ({ secao, itens: grupos.get(secao) as T[] }))
}
