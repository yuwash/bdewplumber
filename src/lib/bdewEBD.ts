import * as fflate from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export async function handleWordFile(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const decompressed = fflate.unzipSync(new Uint8Array(buffer));
    const documentXml = decompressed['word/document.xml'];
    if (documentXml) {
      const xmlContent = new TextDecoder().decode(documentXml);
      const ebdTitles = extractEbdTitlesWithParser(xmlContent);
      return JSON.stringify(ebdTitles, null, 2);
    } else {
      return 'File does not contain word/document.xml';
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export type EbdTitle = {
  title: string;
  role: string;
  paraId: string;
};

export function extractEbdTitlesWithParser(xml: string): EbdTitle[] {
  const results: EbdTitle[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    arrayMode: true
  });

  // Haupt-Anker: Die Rolle in der Tabelle
  const roleRegex = /<w:t>Prüfende Rolle:?\s*(NB|LF|MSB|BIKO|BTR)<\/w:t>/gi;
  const styleMarker = 'w:val="berschrift3"'; // "Ü" weggelassen für Robustheit
  
  let match;
  while ((match = roleRegex.exec(xml)) !== null) {
    const roleText = match[1];
    const rolePos = match.index;

    // 1. Tabellenbeginn vor der Rolle finden
    const tableStart = xml.lastIndexOf('<w:tbl', rolePos);
    if (tableStart === -1) continue;

    // 2. Suche rückwärts nach der nächsten Überschrift 3
    const headingStylePos = xml.lastIndexOf(styleMarker, tableStart);
    if (headingStylePos === -1) {
        console.warn(`Keine Überschrift 3 vor Rolle "${roleText}" bei Position ${rolePos} gefunden.`);
        continue;
    }

    // 3. Den umschließenden Absatz <w:p>...</w:p> der Überschrift finden
    // Suche nach "<w:p " oder "<w:p>" um Verwechslungen mit "<w:pStyle" zu vermeiden
    let paraStart = xml.lastIndexOf('<w:p ', headingStylePos);
    if (paraStart === -1) {
        paraStart = xml.lastIndexOf('<w:p>', headingStylePos);
    }
    const paraEnd = xml.indexOf('</w:p>', headingStylePos);

    if (paraStart === -1 || paraEnd === -1) continue;

    const paraXml = xml.substring(paraStart, paraEnd + 6);
    
    let title = "Titel nicht lesbar";
    try {
      const parsedPara = parser.parse(paraXml);
      title = extractTextFromParsedObject(parsedPara).replace(/\s+/g, ' ').trim();
    } catch (e) {
      console.warn("Parser-Fehler bei Überschrift-Absatz nahe Position", paraXml);
    }

    // 4. Die paraId der Tabellenzeile extrahieren (Bereich der Rolle)
    // Wir nehmen die paraId direkt aus dem XML-Segment der Rollen-Zelle
    const searchAreaParaId = xml.substring(tableStart, rolePos + 100); 
    const paraIdMatch = [...searchAreaParaId.matchAll(/w14:paraId="([^"]+)"/g)].pop();
    const paraId = paraIdMatch ? paraIdMatch[1] : 'n/a';

    results.push({
      title,
      role: roleText.toUpperCase(),
      paraId
    });
  }
  return results;
}

/**
 * Extrahiert NUR Texte aus w:t Elementen und ignoriert Attribute sowie Metadaten.
 */
function extractTextFromParsedObject(obj: any): string {
  if (!obj || typeof obj !== 'object') return "";

  let text = "";

  // Falls es ein Array ist (kommt bei w:r oder w:t oft vor), rekursiv durchlaufen
  if (Array.isArray(obj)) {
    return obj.map(item => extractTextFromParsedObject(item)).join("");
  }

  // GEZIELTE SUCHE:
  // 1. Wenn wir direkt ein w:t finden
  if (obj['w:t']) {
    const wt = obj['w:t'];
    // w:t kann ein String, ein Array von Strings oder ein Objekt mit #text sein
    if (typeof wt === 'string') {
      text += wt;
    } else if (Array.isArray(wt)) {
      text += wt.map(t => (typeof t === 'string' ? t : t['#text'] || '')).join("");
    } else if (wt && wt['#text']) {
      text += wt['#text'];
    }
  } 
  
  // 2. Weitersuchen in Unterelementen, aber Attribute (@_) ignorieren
  Object.keys(obj).forEach(key => {
    if (key !== 'w:t' && !key.startsWith('@_')) {
      text += extractTextFromParsedObject(obj[key]);
    }
  });

  return text;
}
