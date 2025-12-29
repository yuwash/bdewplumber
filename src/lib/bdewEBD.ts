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
  id: string;
  title: string;
  basedOn?: string;
  role?: string;
};

export function extractEbdTitlesWithParser(xml: string): EbdTitle[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    arrayMode: true,
    trimNodeName: false
  });
  
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    console.error('XML Parse Error:', e);
    return [];
  }

  const ebdMatches: EbdTitle[] = [];
  let lastEbdId: string | null = null;

  function extractAllTexts(obj: any): {text: string, isPara: boolean}[] {
    const results: {text: string, isPara: boolean}[] = [];
    
    function traverse(current: any, inPara: boolean = false) {  // *** FIX: Parameter default
      if (Array.isArray(current)) {
        current.forEach(item => traverse(item, inPara));
        return;
      }
      
      if (!current || typeof current !== 'object') return;
      
      // *** FIX: inPara-Tracking vereinfacht ***
      let currentInPara = inPara;
      
      // Paragraph-Start
      if (current['w:p']) {
        currentInPara = true;
        traverse(current['w:p'], currentInPara);
        return;
      }
      
      // Text-Extraktion
      if (current['w:t']) {
        let text = '';
        const wt = current['w:t'];
        
        if (typeof wt === 'string') {
          text = wt;
        } else if (wt && typeof wt === 'object' && wt['#text']) {
          text = String(wt['#text']);
        } else if (Array.isArray(wt)) {
          text = wt.map(t => String(t?.['#text'] || t || '')).join(' ').trim();
        }
        
        if (text) {
          results.push({ text: text.trim(), isPara: currentInPara });
        }
        return;
      }
      
      // Rekursion in Kinder (r, tc, tr, tbl)
      Object.values(current).forEach(val => {
        traverse(val, currentInPara);
      });
    }
    
    traverse(doc);
    return results;
  }

  const allTexts = extractAllTexts(doc);

  // Sequenzielle Verarbeitung wie Regex-Version
  let currentPara = '';
  allTexts.forEach(({text, isPara}) => {
    if (isPara) {
      const paraText = (currentPara + ' ' + text).trim().replace(/\s+/g, ' ');
      currentPara = '';

      // EBD-Titel
      const ebdMatch = paraText.match(/^E_(\d{4})_(.+)/i);
      if (ebdMatch) {
        const id = `E_${ebdMatch[1].padStart(4, '0')}`;
        if (ebdMatches.some(e => e.id === id)) return;
        
        let title = ebdMatch[2].slice(0, 120);
        if (title.length < 10 || !title.match(/prüf|prf|storn|best|markt|abgleichen/i)) return;

        const basedOnMatch = paraText.match(/Basiert auf Strom EBD[,:]\s*E_(\d{4})_/i);
        const basedOn = basedOnMatch ? `E_${basedOnMatch[1].padStart(4, '0')}` : undefined;

        ebdMatches.push({ id, title, basedOn });
        lastEbdId = id;
        return;
      }

      // Rolle
      if (lastEbdId && paraText) {
        const roleMatch = paraText.match(/Pr[üu]fende\s+Rolle[,:]\s*(NB|LF|MSB|BIKO|BTR)/i);
        if (roleMatch) {
          const ebd = ebdMatches.find(e => e.id === lastEbdId);
          if (ebd) {
            ebd.role = roleMatch[1].toUpperCase();
            lastEbdId = null;
          }
        }
      }
    } else {
      currentPara += ' ' + text;
    }
  });

  return ebdMatches.sort((a, b) => a.id.localeCompare(b.id));
}
