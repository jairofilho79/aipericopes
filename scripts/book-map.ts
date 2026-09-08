/** English KJV book name → nome e abreviatura em português */
export const BOOK_MAP: Record<string, { name: string; abbrev: string }> = {
  Genesis: { name: 'Gênesis', abbrev: 'Gn' },
  Exodus: { name: 'Êxodo', abbrev: 'Êx' },
  Leviticus: { name: 'Levítico', abbrev: 'Lv' },
  Numbers: { name: 'Números', abbrev: 'Nm' },
  Deuteronomy: { name: 'Deuteronômio', abbrev: 'Dt' },
  Joshua: { name: 'Josué', abbrev: 'Js' },
  Judges: { name: 'Juízes', abbrev: 'Jz' },
  Ruth: { name: 'Rute', abbrev: 'Rt' },
  '1 Samuel': { name: '1 Samuel', abbrev: '1Sm' },
  '2 Samuel': { name: '2 Samuel', abbrev: '2Sm' },
  '1 Kings': { name: '1 Reis', abbrev: '1Rs' },
  '2 Kings': { name: '2 Reis', abbrev: '2Rs' },
  '1 Chronicles': { name: '1 Crônicas', abbrev: '1Cr' },
  '2 Chronicles': { name: '2 Crônicas', abbrev: '2Cr' },
  Ezra: { name: 'Esdras', abbrev: 'Ed' },
  Nehemiah: { name: 'Neemias', abbrev: 'Ne' },
  Esther: { name: 'Ester', abbrev: 'Et' },
  Job: { name: 'Jó', abbrev: 'Jó' },
  Psalms: { name: 'Salmos', abbrev: 'Sl' },
  Psalm: { name: 'Salmos', abbrev: 'Sl' },
  Proverbs: { name: 'Provérbios', abbrev: 'Pv' },
  Ecclesiastes: { name: 'Eclesiastes', abbrev: 'Ec' },
  'Song of Solomon': { name: 'Cantares', abbrev: 'Ct' },
  'Song of Songs': { name: 'Cantares', abbrev: 'Ct' },
  Isaiah: { name: 'Isaías', abbrev: 'Is' },
  Jeremiah: { name: 'Jeremias', abbrev: 'Jr' },
  Lamentations: { name: 'Lamentações', abbrev: 'Lm' },
  Ezekiel: { name: 'Ezequiel', abbrev: 'Ez' },
  Daniel: { name: 'Daniel', abbrev: 'Dn' },
  Hosea: { name: 'Oséias', abbrev: 'Os' },
  Joel: { name: 'Joel', abbrev: 'Jl' },
  Amos: { name: 'Amós', abbrev: 'Am' },
  Obadiah: { name: 'Obadias', abbrev: 'Ob' },
  Jonah: { name: 'Jonas', abbrev: 'Jn' },
  Micah: { name: 'Miquéias', abbrev: 'Mq' },
  Nahum: { name: 'Naum', abbrev: 'Na' },
  Habakkuk: { name: 'Habacuque', abbrev: 'Hc' },
  Zephaniah: { name: 'Sofonias', abbrev: 'Sf' },
  Haggai: { name: 'Ageu', abbrev: 'Ag' },
  Zechariah: { name: 'Zacarias', abbrev: 'Zc' },
  Malachi: { name: 'Malaquias', abbrev: 'Ml' },
  Matthew: { name: 'Mateus', abbrev: 'Mt' },
  Mark: { name: 'Marcos', abbrev: 'Mc' },
  Luke: { name: 'Lucas', abbrev: 'Lc' },
  John: { name: 'João', abbrev: 'Jo' },
  Acts: { name: 'Atos', abbrev: 'At' },
  Romans: { name: 'Romanos', abbrev: 'Rm' },
  '1 Corinthians': { name: '1 Coríntios', abbrev: '1Co' },
  '2 Corinthians': { name: '2 Coríntios', abbrev: '2Co' },
  Galatians: { name: 'Gálatas', abbrev: 'Gl' },
  Ephesians: { name: 'Efésios', abbrev: 'Ef' },
  Philippians: { name: 'Filipenses', abbrev: 'Fp' },
  Colossians: { name: 'Colossenses', abbrev: 'Cl' },
  '1 Thessalonians': { name: '1 Tessalonicenses', abbrev: '1Ts' },
  '2 Thessalonians': { name: '2 Tessalonicenses', abbrev: '2Ts' },
  '1 Timothy': { name: '1 Timóteo', abbrev: '1Tm' },
  '2 Timothy': { name: '2 Timóteo', abbrev: '2Tm' },
  Titus: { name: 'Tito', abbrev: 'Tt' },
  Philemon: { name: 'Filemom', abbrev: 'Fm' },
  Hebrews: { name: 'Hebreus', abbrev: 'Hb' },
  James: { name: 'Tiago', abbrev: 'Tg' },
  '1 Peter': { name: '1 Pedro', abbrev: '1Pe' },
  '2 Peter': { name: '2 Pedro', abbrev: '2Pe' },
  '1 John': { name: '1 João', abbrev: '1Jo' },
  '2 John': { name: '2 João', abbrev: '2Jo' },
  '3 John': { name: '3 João', abbrev: '3Jo' },
  Jude: { name: 'Judas', abbrev: 'Jd' },
  Revelation: { name: 'Apocalipse', abbrev: 'Ap' },
}

export type ParsedRef = {
  livroEn: string
  capitulo: number
  versiculo: number
}

/** Parse "Genesis 1:1" / "1 Samuel 2:3" / "Song of Solomon 1:1" */
export function parseReference(ref: string): ParsedRef {
  const m = ref.trim().match(/^(.+?)\s+(\d+):(\d+)$/)
  if (!m) throw new Error(`Referência inválida: ${ref}`)
  return {
    livroEn: m[1],
    capitulo: Number(m[2]),
    versiculo: Number(m[3]),
  }
}
