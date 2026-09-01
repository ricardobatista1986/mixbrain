function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Normalização SÓ para fins de comparação de identidade (nunca altera o
// título/artista exibido ou gravado): remove ruído puro de formatação —
// aspas curvas viradas em retas, acentuação, hífens/travessões variantes,
// espaços duplicados, maiúsculas — para que "Café del Mar" e "Cafe Del Mar"
// (mesma track, digitada diferente) sejam reconhecidas como a mesma. Isso
// NÃO remove sufixos como "(Extended Mix)" ou "(Radio Edit)": remixes e
// edits são tracks distintas de verdade e devem continuar separados. É
// puramente sobre ruído de digitação/exportação, não sobre semântica.
//
// Fonte única usada tanto pela importação CSV (dedup na criação) quanto
// pelo ranking de "melhores encaixes" (pra uma track quase-idêntica — só
// digitada diferente — não aparecer como "match" de si mesma, mesmo tendo
// um id diferente no banco).
export function normalizeForMatching(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (café -> cafe)
    .replace(/[\u2018\u2019\u02bc]/g, "'") // aspas simples curvas -> reta
    .replace(/[\u201c\u201d]/g, '"') // aspas duplas curvas -> reta
    .replace(/[\u2013\u2014]/g, "-") // en/em dash -> hífen normal
    .toLocaleLowerCase("pt-BR");
}

export function makeTrackKey(title: string, artist: string) {
  return `${normalizeForMatching(title)}::${normalizeForMatching(artist)}`;
}
