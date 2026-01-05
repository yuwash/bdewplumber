import * as fflate from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export async function handleWordFile(file: File): Promise<{ ebdTitles: EbdTitle[], checkSteps: Record<string, CheckStep[]> } | string> {
  try {
    const buffer = await file.arrayBuffer();
    const decompressed = fflate.unzipSync(new Uint8Array(buffer));
    const documentXml = decompressed['word/document.xml'];
    if (documentXml) {
      const xmlContent = new TextDecoder().decode(documentXml);
      const ebdTitles = extractEbdTitlesWithParser(xmlContent);
      const allCheckSteps: Record<string, CheckStep[]> = {};
      
      for (const ebdTitle of ebdTitles) {
        allCheckSteps[ebdTitle.paraId] = extractCheckSteps(xmlContent, ebdTitle);
      }

      return { ebdTitles, checkSteps: allCheckSteps };
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

export type CheckResult = {
  description: string;
  code: string;
};

export type CheckStep = {
  stepNr: string;
  description: string;
  results: CheckResult[];
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
  let currentCheckStep: CheckStep | null = null;

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

      // Ensure we have at least 4 cells to process for stepNr, description, result description, and result code
      if (cells.length >= 4) {
        const stepNrText = extractTextFromParsedObject(cells[0]).trim();
        const stepDescriptionText = extractTextFromParsedObject(cells[1]).trim();
        const resultDescriptionText = extractTextFromParsedObject(cells[2]).trim(); // Third column for Prüfergebnis description
        const resultCodeText = extractTextFromParsedObject(cells[3]).trim(); // Fourth column for Code

        // If a new step number is found, finalize the previous one and start a new one
        if (stepNrText) {
          if (currentCheckStep) {
            checkSteps.push(currentCheckStep);
          }
          currentCheckStep = {
            stepNr: stepNrText,
            description: stepDescriptionText,
            results: []
          };
          // If there's a result description and code in the same row as a new step number, add it
          if (resultDescriptionText || resultCodeText) {
            currentCheckStep.results.push({
              description: resultDescriptionText,
              code: resultCodeText
            });
          }
        } else if (currentCheckStep) {
          // If no new step number, but we are within an existing step
          // Check if the current row contains a check result (description and/or code)
          if (resultDescriptionText || resultCodeText) {
            currentCheckStep.results.push({
              description: resultDescriptionText,
              code: resultCodeText
            });
          } else if (stepDescriptionText) {
            // If the third and fourth columns are empty but the second column has text,
            // it might be a continuation of the step description.
            // This is a less common case, but we can append it if needed.
            // For now, we prioritize results in columns 3 and 4.
            // If you need to handle this, you might append to currentCheckStep.description
            // or create a new result with an empty code.
          }
        }
      } else if (cells.length === 3 && currentCheckStep) {
        // Handle cases where there might be only 3 cells, and the third cell
        // contains the code, and the description might be implied or in the previous row.
        // This is a heuristic and might need adjustment based on actual document structure.
        const resultCodeText = extractTextFromParsedObject(cells[2]).trim();
        if (resultCodeText) {
          // If the last result has no code, assign it here. Otherwise, create a new one.
          if (currentCheckStep.results.length > 0 && !currentCheckStep.results[currentCheckStep.results.length - 1].code) {
            currentCheckStep.results[currentCheckStep.results.length - 1].code = resultCodeText;
          } else {
            currentCheckStep.results.push({
              description: '', // Assuming no explicit description in this case
              code: resultCodeText
            });
          }
        }
      }
    }

    // Add the last check step if it exists
    if (currentCheckStep) {
      checkSteps.push(currentCheckStep);
    }

  } catch (e) {
    console.error(`Fehler beim Extrahieren der Schritte für ${ebd.title}:`, e);
  }

  return checkSteps;
}
