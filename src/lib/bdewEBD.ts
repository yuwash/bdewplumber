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
 * Robuste Textextraktion: Behandelt Zahlen, Strings und verschachtelte w:t
 */
function extractTextFromParsedObject(obj: any): string {
  if (!obj) return "";
  if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
  
  let text = "";
  if (Array.isArray(obj)) {
    return obj.map(item => extractTextFromParsedObject(item)).join("");
  }

  if (obj['w:t'] !== undefined) {
    const wt = obj['w:t'];
    if (Array.isArray(wt)) {
      text += wt.map(t => (typeof t === 'object' ? t['#text'] || '' : String(t))).join("");
    } else {
      text += (typeof wt === 'object' ? wt['#text'] || '' : String(wt));
    }
  } 
  
  // Rekursion für Kinder, Attribute ignorieren
  Object.keys(obj).forEach(key => {
    if (key !== 'w:t' && !key.startsWith('@_')) {
      text += extractTextFromParsedObject(obj[key]);
    }
  });

  return text;
}

export type CheckStep = {
  stepNr: string;
  description: string;
};

/**
 * Extrahiert Prüfschritte aus der Tabelle eines EbdTitle.
 */
export function extractCheckSteps(xml: string, ebd: EbdTitle): CheckStep[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // Wichtig: Diese Elemente immer als Array behandeln
    arrayMode: (tagName) => ['w:tr', 'w:tc', 'w:r', 'w:t'].includes(tagName)
  });

  const checkSteps: CheckStep[] = [];

  // 1. Tabelle im XML finden via paraId
  const idMarker = `w14:paraId="${ebd.paraId}"`;
  const idPos = xml.indexOf(idMarker);
  if (idPos === -1) return [];

  const tableStart = xml.lastIndexOf('<w:tbl', idPos);
  const tableEnd = xml.indexOf('</w:tbl>', idPos);
  if (tableStart === -1 || tableEnd === -1) return [];

  const tableXml = xml.substring(tableStart, tableEnd + 8);

  try {
    const parsed = parser.parse(tableXml);
    // Flexible Pfadsuche für die Zeilen
    const rows = parsed['w:tbl']?.[0]?.['w:tr'] || parsed['w:tbl']?.['w:tr'] || parsed['w:tr'] || [];

    // 2. Ab der dritten Zeile (Index 2) iterieren
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const cells = row['w:tc'] || [];

      if (cells.length >= 2) {
        const nrText = extractTextFromParsedObject(cells[0]).trim();
        const descText = extractTextFromParsedObject(cells[1]).trim();

        // Nur hinzufügen, wenn entweder eine Nummer oder eine Beschreibung existiert
        if (nrText || descText) {
          checkSteps.push({
            stepNr: nrText,
            description: descText
          });
        }
      }
    }
  } catch (e) {
    console.error(`Fehler beim Extrahieren der Schritte für ${ebd.title}:`, e);
  }

  return checkSteps;
}

