// utils.ts
import type { Attachment, WeekRouteInfo, WeekPlan, BlockDetails, Message, Conversation, Student } from './types';
import TurndownService from 'turndown';
import { marked } from 'marked';

/**
 * Converts a File object to a base64 encoded Attachment object.
 */
export const fileToAttachment = (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
                resolve({
                    name: file.name,
                    type: file.type,
                    data: event.target.result,
                });
            } else {
                reject(new Error("Failed to read file as data URL."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

/**
 * Parses a string of student names into an array.
 * Handles names separated by newlines, commas, or semicolons.
 */
export const parseCrewContextToNames = (context: string): string[] => {
    if (!context) return [];

    // Replace newlines and semicolons with commas to standardize the separator
    const commaSeparated = context.replace(/[\n;]/g, ',');

    // Split by comma, then trim and filter out any empty entries
    return commaSeparated
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
};


/**
 * Parses the route context string into an array of WeekRouteInfo objects.
 */
export const parseRouteContext = (context: string): WeekRouteInfo[] => {
    const lines = context.split('\n').filter(line => line.trim().startsWith('Settimana'));
    return lines.map(line => {
        const weekMatch = line.match(/Settimana (\d+)/);
        const dateMatch = line.match(/: (.*?)\s\(/);
        const blockMatch = line.match(/(\d+) blocchi/);
        const notesMatch = line.match(/-\s*(.*)/);

        return {
            weekNumber: weekMatch ? parseInt(weekMatch[1], 10) : 0,
            dates: dateMatch ? dateMatch[1].trim() : 'N/D',
            totalBlocks: blockMatch ? parseInt(blockMatch[1], 10) : 0,
            notes: notesMatch ? notesMatch[1].trim() : undefined,
        };
    }).filter(w => w.weekNumber > 0 && w.totalBlocks > 0);
};

/**
 * Parses the teacher's name from the profile string.
 */
export const parseTeacherName = (profile: string): string | null => {
    if (!profile) return null;
    const match = profile.match(/Nome:\s*(.*)/);
    const name = match ? match[1].trim() : null;
    return name && name.length > 0 ? name : null;
};

const italianMonths: { [key: string]: number } = {
    'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5,
    'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11
};
const italianDaysOfWeek = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export const getSchoolYear = (teacherProfile: string, dateForMonth: Date): number => {
    // First, check for a simple "Anno: YYYY" format. This takes precedence.
    const simpleYearMatch = teacherProfile.match(/Anno:\s*(\d{4})/i);
    if (simpleYearMatch && simpleYearMatch[1]) {
        return parseInt(simpleYearMatch[1], 10);
    }

    // Then, check for "Anno Scolastico: YYYY/YYYY"
    const schoolYearMatch = teacherProfile.match(/Anno Scolastico:\s*(\d{4})\/(\d{4})/);
    if (schoolYearMatch && schoolYearMatch[1] && schoolYearMatch[2]) {
        const startYear = parseInt(schoolYearMatch[1], 10);
        const endYear = parseInt(schoolYearMatch[2], 10);
        const month = dateForMonth.getMonth(); // 0-11

        // School year typically starts in September (month 8)
        if (month >= 8) { // September to December
            return startYear;
        } else { // January to August
            return endYear;
        }
    }
    
    // As a fallback, use the current year.
    return new Date().getFullYear();
};

export const getExactDateForBlock = (weekDates: string, dayOfWeek: string, teacherProfile: string): Date | null => {
    try {
        const datePartsMatch = weekDates.match(/(\d+)(?:-\d+)?\s+(\w+)/i);
        if (!datePartsMatch) return null;

        const startDayOfMonth = parseInt(datePartsMatch[1], 10);
        const monthStr = datePartsMatch[2].toLowerCase();
        const monthIndex = italianMonths[monthStr.substring(0, 3)];

        if (isNaN(startDayOfMonth) || monthIndex === undefined) return null;

        const tempDateForYear = new Date();
        tempDateForYear.setMonth(monthIndex);
        const year = getSchoolYear(teacherProfile, tempDateForYear);

        // Use UTC to create the date object to avoid timezone-related issues.
        const weekStartDate = new Date(Date.UTC(year, monthIndex, startDayOfMonth, 12, 0, 0));

        const targetDayItalianIndex = italianDaysOfWeek.indexOf(dayOfWeek.toLowerCase());
        if (targetDayItalianIndex === -1) return null;

        // Find the Monday of the week that contains the weekStartDate.
        // This provides a stable anchor for the week.
        const dayOfWeekOfStartDate = weekStartDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        
        // Calculate the offset to get back to the previous Monday.
        // If it's Sunday (0), go back 6 days. If it's Monday (1), go back 0 days. If Tuesday (2), go back 1 day.
        const offsetToMonday = (dayOfWeekOfStartDate + 6) % 7;
        
        const mondayOfWeek = new Date(weekStartDate);
        mondayOfWeek.setUTCDate(weekStartDate.getUTCDate() - offsetToMonday);

        // Now, add the days for the target day from that Monday.
        // The Italian index works perfectly here since Lunedì is 0.
        const finalDate = new Date(mondayOfWeek);
        finalDate.setUTCDate(mondayOfWeek.getUTCDate() + targetDayItalianIndex);

        return finalDate;
    } catch (e) {
        console.error("Error calculating exact date:", e);
        return null;
    }
};


/**
 * Generates a prompt and filename for exporting lesson content to various formats.
 */
export const generateExportContent = (plan: WeekPlan, block: BlockDetails, blockIndex: number, format: string): { prompt: string; filename: string } => {
    const turndownService = new TurndownService();
    const markdownContent = (block.contentBlocks || []).map(cb => turndownService.turndown(cb.content)).join('\n\n---\n\n');

    let prompt = `Sei un esperto di didattica e comunicazione. Formatta il seguente contenuto di una lezione per il formato richiesto.\n\n`;
    prompt += `**CONTESTO LEZIONE:**\n`;
    prompt += `- Settimana ${plan.weekNumber}: ${plan.theme}\n`;
    prompt += `- Blocco ${blockIndex + 1} (${block.day}): ${block.objective || 'N/D'}\n`;
    prompt += `- Modulo: ${block.module || 'N/D'}\n\n`;
    prompt += `**CONTENUTO GREZZO (MARKDOWN):**\n\n${markdownContent}\n\n`;

    let filename = `esportazione_${plan.weekNumber}_blocco_${blockIndex + 1}`;
    
    switch (format) {
        case 'powerpoint':
            prompt += `**FORMATO RICHIESTO: Slide PowerPoint**\nCrea una struttura per slide (Titolo, Contenuti puntati) sintetica, chiara e visivamente accattivante. Usa un linguaggio diretto. Non usare la sintassi di markdown per le slide, ma un formato testuale chiaro. Esempio:\n\nSLIDE 1: Titolo\n- Punto 1\n- Punto 2`;
            filename += '.txt';
            break;
        case 'classroom':
            prompt += `**FORMATO RICHIESTO: Post Google Classroom**\nScrivi un post per Google Classroom che introduca questa lezione. Deve essere coinvolgente, chiaro e includere un riassunto dei punti chiave e eventuali compiti per gli studenti. Inizia con un titolo accattivante.`;
            filename += '.txt';
            break;
        case 'worksheet':
            prompt += `**FORMATO RICHIESTO: Scheda Operativa**\nTrasforma il contenuto in una scheda operativa per gli studenti, con esercizi, domande e spazi per le risposte. Deve essere pratica e stimolare la riflessione.`;
            filename += '.txt';
            break;
        case 'notebooklm':
            prompt += `**FORMATO RICHIESTO: Note per NotebookLM**\nPrepara questo contenuto per essere importato in Google NotebookLM. Strutturalo con titoli chiari (usando #, ##) e liste puntate. Mantieni il formato Markdown. L'obiettivo è creare una fonte di conoscenza ben organizzata.`;
            filename += '.md';
            break;
        case 'text':
        default:
            prompt += `**FORMATO RICHIESTO: Testo Semplice**\nRiformula il contenuto in un testo pulito e ben leggibile, senza formattazione complessa.`;
            filename += '.txt';
            break;
    }

    return { prompt, filename };
};

export type BlockPlanningStatus = 'da_definire' | 'da_progettare' | 'in_progettazione' | 'in_revisione' | 'concluso' | 'saltato' | 'fsl' | 'annullato' | 'sconosciuto';

export const getBlockPlanningStatus = (block: BlockDetails | undefined): BlockPlanningStatus => {
    if (!block) return 'sconosciuto';

    switch (block.status) {
        case 'da definire':
            if (block.objective || block.module) {
                return 'da_progettare';
            }
            return 'da_definire';

        case 'saltato': return 'saltato';
        case 'formazione scuola-lavoro': return 'fsl';
        case 'annullato': return 'annullato';

        case 'normale':
            const hasMasterContent = block.contentBlocks && block.contentBlocks.length > 0;
            const messages = block.messages || [];

            if (!hasMasterContent) {
                return 'in_progettazione';
            }

            // HAS MASTER CONTENT. Now check if it's concluded or in revision.
            // A block is "In Revisione" if the last meaningful action was a user sending a message.
            // It's "Concluso" if the last action was validating an assistant's response.
            
            // Find the index of the last validated assistant message.
            let lastValidationIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'assistant' && messages[i].actionUsed) {
                    lastValidationIndex = i;
                    break;
                }
            }
            
            // Find the index of the last user message.
            let lastUserMessageIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    lastUserMessageIndex = i;
                    break;
                }
            }

            if (lastUserMessageIndex > lastValidationIndex) {
                return 'in_revisione';
            }

            return 'concluso';

        default:
            return 'sconosciuto';
    }
};

export const generateCourseBookHtml = (
    adaPresentation: string,
    foundingDocs: { constitution: string; route: string; crew: string; rules: string; },
    conversations: Conversation[],
    students: Student[]
): string => {
    
    const escapeHtml = (unsafe: string | undefined): string => {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    const styles = `
      body { font-family: 'Lora', serif; line-height: 1.7; color: #1f2937; background-color: #f9fafb; max-width: 21cm; margin: 0 auto; }
      .book-container { padding: 2.54cm; }
      h1, h2, h3, h4 { font-family: 'Inter', sans-serif; color: #111827; line-height: 1.3; margin-top: 1.8em; margin-bottom: 0.8em; }
      h1 { font-size: 2.8em; text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2.5rem; }
      h2 { font-size: 2em; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5rem; }
      h3 { font-size: 1.5em; }
      h4 { font-size: 1.2em; font-style: italic; color: #4b5563; }
      p { margin-bottom: 1em; }
      pre { background-color: #f3f4f6; padding: 1em; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
      .page-break { page-break-before: always; }
      .toc { list-style-type: none; padding-left: 0; }
      .toc li { margin-bottom: 0.5em; }
      .toc a { text-decoration: none; color: #2563eb; }
      .chapter-content h1, .chapter-content h2, .chapter-content h3 { font-family: 'Lora', serif !important; }
      blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; margin-left: 0; font-style: italic; color: #4b5563; }
      @media print {
        body { background-color: white; }
        .book-container { padding: 1.5cm; }
      }
    `;

    const coverPage = `<h1>Libro del Corso</h1><h2 style="text-align:center; border:none;">Progetto Ada Gemini</h2><p style="text-align:center; color: #6b7280;">Esportato il: ${new Date().toLocaleString('it-IT')}</p>`;
    
    const adaPresentationHtml = `<div class="page-break"><h2>Presentazione di Ada</h2><div>${marked.parse(adaPresentation)}</div></div>`;
    
    const foundingDocsHtml = `
      <div class="page-break">
        <h2>Documenti Fondanti</h2>
        <h3>La Costituzione</h3>
        <pre>${escapeHtml(foundingDocs.constitution)}</pre>
        <h3>La Rotta</h3>
        <pre>${escapeHtml(foundingDocs.route)}</pre>
        <h3>L'Equipaggio</h3>
        <pre>${escapeHtml(foundingDocs.crew)}</pre>
        <h3>Le Regole</h3>
        <pre>${escapeHtml(foundingDocs.rules)}</pre>
      </div>
    `;

    const weekPlans = conversations
        .filter(c => c.weekPlan)
        .map(c => c.weekPlan!)
        .sort((a, b) => a.weekNumber - b.weekNumber);

    const tableOfContents = `
        <div class="page-break">
            <h2>Indice</h2>
            <ul class="toc">
                ${weekPlans.map(plan => `
                    <li><a href="#settimana-${plan.weekNumber}"><strong>Settimana ${plan.weekNumber}:</strong> ${escapeHtml(plan.theme)}</a></li>
                `).join('')}
            </ul>
        </div>
    `;
    
    const chaptersHtml = weekPlans.map(plan => `
        <div class="page-break" id="settimana-${plan.weekNumber}">
            <h2>Settimana ${plan.weekNumber}: ${escapeHtml(plan.theme)}</h2>
            <div class="chapter-content">
                ${plan.blocks
                    .filter(block => block.contentBlocks && block.contentBlocks.length > 0)
                    .map((block, index) => `
                        <div>
                            ${block.contentBlocks!.map(cb => cb.content).join('<hr>')}
                        </div>
                    `).join('')}
            </div>
        </div>
    `).join('');

    const appendixHtml = `
        <div class="page-break">
            <h2>Appendice: Sintesi Studentesse</h2>
            ${students
                .filter(s => s.adaSummary && s.adaSummary.content)
                .map(s => `
                    <div>
                        <h3>${escapeHtml(s.name)}</h3>
                        <div>${marked.parse(s.adaSummary!.content)}</div>
                    </div>
                `).join('<hr style="border:0; border-top: 1px dashed #ccc; margin: 2em 0;">')}
        </div>
    `;

    return `
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Libro del Corso - Ada Gemini</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
            <style>${styles}</style>
        </head>
        <body>
            <div class="book-container">
                ${coverPage}
                ${adaPresentationHtml}
                ${foundingDocsHtml}
                ${tableOfContents}
                ${chaptersHtml}
                ${appendixHtml}
            </div>
        </body>
        </html>
    `;
};
