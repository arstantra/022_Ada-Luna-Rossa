// services/gemini.ts
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration, GenerateContentParameters, Content, FunctionCallingConfigMode, Part } from "@google/genai";
import type { Message, Attachment, Mode, Student, GroupDefinition, AdaAnalysis, Evaluation, Conversation, WeekRouteInfo, MasterContextData, BlockSource, CourseModule, ModuleSection, LessonType } from '../types';
import { getBlockFile } from './db';
import { MODES } from '../constants';
import TurndownService from 'turndown';

export const ADA_API_KEY_STORAGE = 'ada_gemini_api_key';

// SDK tipizza FunctionCall.args come opaco; doppio cast è il pattern TS approvato per questo boundary.
function extractArgs<T>(args: Record<string, unknown> | undefined): T {
    return args as unknown as T;
}

const getAI = () => {
    const key = localStorage.getItem(ADA_API_KEY_STORAGE) || '';
    return new GoogleGenAI({ apiKey: key });
};

const turndownService = new TurndownService();

const getModePrompt = (modeId: Mode['id']): string => {
    return MODES.find(m => m.id === modeId)?.stylePrompt || '';
};

const buildHistory = (messages: Message[]): Content[] => {
    return messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content !== '...')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turndownService.turndown(m.content || '') }],
        }));
};

const buildFontiContext = async (
    fonti: BlockSource[]
): Promise<{ textSection: string; fileParts: Part[] }> => {
    if (!fonti || fonti.length === 0) {
        return { textSection: '', fileParts: [] };
    }

    let textSection = '';
    const fileParts: Part[] = [];

    // 1. URL ----------------------------------------------------------------
    const urlFonti = fonti.filter(f => f.type === 'url');
    if (urlFonti.length > 0) {
        textSection += '--- Fonti di riferimento per questo blocco ---\n';
        urlFonti.forEach(f => {
            textSection += `[${f.title}] → ${f.url}\n`;
        });
        textSection += '---\n';
    }

    // 2. Note ---------------------------------------------------------------
    const noteFonti = fonti.filter(f => f.type === 'note');
    noteFonti.forEach(f => {
        textSection += `--- Nota: ${f.title} ---\n${f.content || ''}\n---\n`;
    });

    // 3. PDF ----------------------------------------------------------------
    const pdfFonti = fonti.filter(f => f.type === 'pdf');
    for (const fonte of pdfFonti) {
        try {
            const now = Date.now();
            if (fonte.geminiFileId && fonte.geminiFileExpiry && fonte.geminiFileExpiry > now) {
                // File ancora valido su Gemini — riutilizza l'URI
                fileParts.push({
                    fileData: {
                        mimeType: 'application/pdf',
                        fileUri: fonte.geminiFileId,
                    },
                });
            } else {
                // File scaduto o mai caricato — recupera il blob da IndexedDB e ri-carica
                if (!fonte.dbFileKey) continue;
                const blob = await getBlockFile(fonte.dbFileKey);
                if (!blob) continue; // DB resettato: skip silenzioso

                const ai = getAI();
                const uploadResult = await ai.files.upload({
                    file: blob,
                    config: { mimeType: 'application/pdf', displayName: fonte.title },
                });

                // Aggiornamento in memoria (il caller persisterà via updateConversation)
                fonte.geminiFileId = uploadResult.uri;
                fonte.geminiFileExpiry = Date.now() + 48 * 60 * 60 * 1000; // 48h

                fileParts.push({
                    fileData: {
                        mimeType: 'application/pdf',
                        fileUri: uploadResult.uri,
                    },
                });
            }
        } catch (err) {
            // Un PDF che non si carica non blocca l'invio del messaggio
            console.error(`[buildFontiContext] Errore elaborazione PDF "${fonte.title}":`, err);
        }
    }

    return { textSection, fileParts };
};

const renderStrategicDashboardToMarkdown = (conversations: Conversation[], weeks: WeekRouteInfo[]): string => {
    const convoMap = new Map<number, Conversation>();
    conversations.forEach(convo => {
        if (convo.weekPlan) {
            convoMap.set(convo.weekPlan.weekNumber, convo);
        }
    });

    let markdown = "# Quadro Sinottico Strategico (Stato Attuale)\n\n";
    if (weeks.length === 0) {
        markdown += "Nessuna settimana definita nella Rotta.\n";
        return markdown;
    }

    weeks.forEach(week => {
        const plan = convoMap.get(week.weekNumber)?.weekPlan;

        markdown += `## Settimana ${week.weekNumber}: ${plan?.theme || 'Tema da definire'}\n`;
        markdown += `*Date: ${week.dates}*\n\n`;

        if (plan && plan.blocks.some(b => b.objective || b.lessonTitle)) {
            plan.blocks.forEach((block, index) => {
                markdown += `### Blocco ${index + 1} (${block.day})\n`;
                markdown += `- **Obiettivo:** ${block.objective || 'Non definito'}\n`;
                if(block.lessonTitle) markdown += `- **Titolo Lezione:** ${block.lessonTitle}\n`;
            });
            markdown += `\n`;
            if(plan.notes) markdown += `**Note sulla Settimana:** ${plan.notes}\n`;

        } else {
            markdown += "*Dettagli di pianificazione non ancora inseriti.*\n";
        }
        markdown += "\n---\n\n";
    });

    return markdown;
};

export const generateTitle = async (prompt: string): Promise<string> => {
    const fullPrompt = `Genera un titolo breve (massimo 5 parole) per una conversazione che inizia con questo prompt: "${prompt}". Rispondi solo con il titolo, senza virgolette o altre frasi.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });
    return response.text.trim().replace(/^["']|["']$/g, '');
};

export const distillText = async (textToDistill: string): Promise<string> => {
    const prompt = `Sei un esperto di sintesi e chiarezza. Distilla il seguente testo, migliorandone la struttura, la leggibilità e l'impatto, mantenendo il significato originale. Rimuovi ogni ridondanza e rendilo più conciso e potente. Restituisci solo il testo distillato, senza commenti o introduzioni.\n\nTESTO DA DISTILLARE:\n\n${textToDistill}`;
    
    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            temperature: 0.3,
            // Optimized thinking budget for a focused task
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });
    return response.text.trim();
};

export const streamChatResponse = async (
    history: Message[],
    content: string,
    attachment: Attachment | undefined,
    masterContext: MasterContextData,
    currentModeId: Mode['id'],
    useGoogleSearch: boolean,
    conversations: Conversation[],
    availableWeeks: WeekRouteInfo[],
    planningContext?: string,
    students?: Student[],
    fonti?: BlockSource[]   // Fonti del blocco (Laboratorio only) — undefined → nessun effetto
): Promise<AsyncGenerator<GenerateContentResponse>> => {
    
    const teacherContext = masterContext.teacherProfile && masterContext.teacherProfile.trim()
        ? `\n\nStai collaborando con il docente descritto nel seguente profilo:\n${masterContext.teacherProfile}`
        : '';
    const systemInstruction = `${masterContext.systemInstruction}${teacherContext}\n\n${getModePrompt(currentModeId)}`;

    const studentContext = students ? `Contesto studentesse in classe: ${students.map(s => s.name).join(', ')}.` : '';

    const dynamicStrategicMap = renderStrategicDashboardToMarkdown(conversations, availableWeeks);

    const ptofSection = masterContext.ptofExtract?.trim()
        ? `# CONTESTO ISTITUZIONALE (PTOF):\n${masterContext.ptofExtract.trim()}`
        : '';

    const fullContext = [masterContext.progettazione, dynamicStrategicMap, masterContext.rulesContext, masterContext.crewContext, ptofSection, planningContext, studentContext].filter(Boolean).join('\n\n');

    const { textSection: fontiText, fileParts: fontiFileParts } =
        await buildFontiContext(fonti ?? []);

    const attachmentPart = attachment
        ? { inlineData: { mimeType: attachment.type, data: attachment.data.split(',')[1] } }
        : null;

    // PDF preposti al testo: ordine consigliato dall'API Gemini (media prima del testo che vi si riferisce).
    const userParts: Part[] = [...fontiFileParts, { text: content }];
    if (attachmentPart) {
        userParts.push(attachmentPart);
    }

    const contents: Content[] = [
        ...buildHistory(history),
        {
            role: 'user',
            parts: userParts,
        }
    ];

    // textSection fonti in coda al system prompt: resta vicino al task del blocco, lontano dal contesto globale.
    const systemText = `${systemInstruction}\n\n# CONTESTO GLOBALE:\n${fullContext}${fontiText ? `\n\n${fontiText}` : ''}`;

    const config: GenerateContentParameters['config'] = {
        systemInstruction: {
            role: 'system',
            parts: [{ text: systemText }]
        },
        thinkingConfig: { thinkingBudget: 8192 }
    };
    
    if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    return getAI().models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config
    });
};

export const generateImages = async (prompt: string, aspectRatio: string, numberOfImages: number, adaStyle: boolean): Promise<string[]> => {
    const finalPrompt = adaStyle 
        ? `${prompt}. Stile: palette di colori neutri, luce morbida e diffusa, estetica minimalista e pulita, fotografia cinematografica.` 
        : prompt;

    const response = await getAI().models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: finalPrompt,
        config: {
            numberOfImages,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio as "1:1" | "4:3" | "3:4" | "16:9" | "9:16",
        }
    });

    return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
};

const groupSuggestionSchema: FunctionDeclaration = {
    name: "create_student_groups",
    description: "Crea gruppi di lavoro bilanciati per gli studenti basandosi su un obiettivo didattico.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            groups: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Un nome creativo per il gruppo." },
                        studentIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista degli ID degli studenti nel gruppo." },
                        justification: { type: Type.STRING, description: "Una breve motivazione per la composizione di questo gruppo." }
                    },
                    required: ["name", "studentIds", "justification"]
                }
            }
        },
        required: ["groups"]
    }
};

export const generateGroupSuggestions = async (students: Student[], objective: string, maxGroupSize: number): Promise<{ groups: GroupDefinition[] }> => {
    const studentList = students.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
    const prompt = `Obiettivo: ${objective}\nLista Studentesse:\n${studentList}\n\nCrea gruppi di lavoro bilanciati. Considera possibili dinamiche di gruppo e crea combinazioni eterogenee o omogenee a seconda dell'obiettivo, fornendo una motivazione per ogni gruppo. Ogni gruppo deve avere un massimo di ${maxGroupSize} studentesse. Se il numero totale di studentesse non è divisibile equamente, crea gruppi di dimensioni il più possibile simili, rispettando questo limite massimo (ad esempio, alcuni gruppi potrebbero avere una studentessa in più o in meno).`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [groupSuggestionSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'create_student_groups') {
        const args = extractArgs<{ groups?: GroupDefinition[] }>(call.args);
        if (args.groups) return { groups: args.groups };
    }
    throw new Error("La risposta dell'AI non conteneva una struttura di gruppi valida.");
};

export const generateGroupSuggestionWithCriteria = async (
    students: Student[],
    criteria: string[],
    groupSize: number
): Promise<GroupDefinition[]> => {
    const criteriaMap: Record<string, string> = {
        'Livello competenza': 'bilancia i livelli di competenza (mescola studenti forti e deboli)',
        'Stile apprendimento': 'considera gli stili di apprendimento diversi (es. visivo, pratico, teorico) indicati nelle note',
        'Dinamiche relazionali': 'considera le dinamiche relazionali segnalate nelle note del docente per evitare conflitti e favorire collaborazione',
        'Mix casuale': 'crea composizioni casuali senza criteri specifici',
    };
    const criteriaDesc = criteria.map(c => criteriaMap[c] ?? c).join('; ');
    const studentList = students
        .map(s => {
            const notes = [s.notes, s.besNotes, s.dsaNotes].filter(Boolean).join(' — ');
            return `- ${s.name} (ID: ${s.id})${notes ? `: ${notes}` : ''}`;
        })
        .join('\n');
    const prompt = `Sei un assistente per un insegnante. Crea gruppi di lavoro per la classe, ${groupSize} studenti per gruppo.
Criteri di bilanciamento: ${criteriaDesc}.
Usa ESATTAMENTE gli ID forniti nella lista. Ogni studente deve comparire in un solo gruppo.

Lista studenti:
${studentList}

Crea gruppi di circa ${groupSize} persone (alcuni possono avere ±1 se il totale non è divisibile). Fornisci un nome creativo per ogni gruppo e una motivazione breve sulla composizione.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [groupSuggestionSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'create_student_groups') {
        const args = extractArgs<{ groups?: GroupDefinition[] }>(call.args);
        if (args.groups) return args.groups;
    }
    throw new Error("La risposta dell'AI non conteneva una struttura di gruppi valida.");
};


const lessonAnalysisSchema: FunctionDeclaration = {
    name: "analyze_lesson_notes",
    description: "Analizza le note di una lezione per estrarre insight sulla performance della classe.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            performance: { type: Type.STRING, description: "Una valutazione qualitativa generale della performance della classe (es. 'Ottima', 'Discreta con aree di miglioramento')." },
            highlightedStudents: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Nomi delle studentesse che si sono distinte in positivo." },
            difficulties: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Aree di difficoltà o concetti non compresi dalla maggior parte della classe." },
            suggestion: { type: Type.STRING, description: "Un suggerimento strategico per la prossima lezione basato sull'analisi." }
        },
        required: ["performance", "highlightedStudents", "difficulties", "suggestion"]
    }
};

export const generateLessonAnalysis = async (notes: string, studentNames: string[]): Promise<AdaAnalysis> => {
    const prompt = `Analizza le seguenti note di lezione. I nomi delle studentesse sono: ${studentNames.join(', ')}.\n\nNOTE:\n${notes}`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [lessonAnalysisSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'analyze_lesson_notes' && call.args) {
        return extractArgs<AdaAnalysis>(call.args);
    }
    throw new Error("L'AI non ha fornito un'analisi strutturata valida.");
};

const evaluationAnalysisSchema: FunctionDeclaration = {
    name: "analyze_evaluation_text",
    description: "Analizza un testo di valutazione (es. un commento da Google Classroom) e lo struttura in un oggetto.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            value: { type: Type.STRING, description: "Il valore quantitativo o qualitativo della valutazione (es. '8/10', 'Ottimo', 'Ben Fatto')." },
            notes: { type: Type.STRING, description: "Un riassunto delle note qualitative, punti di forza e aree di miglioramento." },
            weekNumber: { type: Type.INTEGER, description: "Il numero della settimana, se menzionato o inferibile." },
            module: { type: Type.STRING, description: "Il nome del modulo di riferimento, se menzionato o inferibile." },
            pillar: { type: Type.STRING, description: "Il nome del pilastro o concetto chiave, se menzionato o inferibile." }
        },
        required: ["value", "notes"]
    }
};

export const analyzeEvaluationText = async (evaluationText: string, studentName: string): Promise<Partial<Evaluation>> => {
    const prompt = `Sei un'assistente pedagogico. Analizza il seguente testo di valutazione per la studentessa "${studentName}" ed estrai le informazioni strutturate usando lo schema fornito. Se non riesci a inferire un campo opzionale, omettilo. Il campo 'notes' deve contenere un riassunto qualitativo della valutazione.\n\nTESTO DA ANALIZZARE:\n"${evaluationText}"`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [evaluationAnalysisSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'analyze_evaluation_text' && call.args) {
        return extractArgs<Partial<Evaluation>>(call.args);
    }
    throw new Error("L'AI non è riuscita a strutturare la valutazione. Prova a riformattare il testo.");
};




export const generateClassroomTrendAnalysis = async (qualitativeData: string, qualitativeNotes: string): Promise<string> => {
    const prompt = `Sei un'analista didattico. Ti fornirò dati qualitativi sull'andamento della classe (derivati da inferenze) e le note qualitative generali del docente. Il tuo compito è incrociare queste informazioni per generare una sintesi strategica.\n\n**DATI QUALITATIVI E TREND INFERITI:**\n${qualitativeData}\n\n**NOTE QUALITATIVE DEL DOCENTE:**\n${qualitativeNotes}\n\n**TUA ANALISI:**\nBasandoti su tutto questo, fornisci una sintesi che includa:\n1. Un'analisi del trend generale dell'energia della classe.\n2. Identificazione di cluster di studentesse (es. profili di crescita simili).\n3. Suggerimenti strategici concreti per le prossime lezioni basati sulla mappa dei concetti.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });
    return response.text.trim();
};

export const generateStudentSummary = async (studentName: string, notes: string, evaluations: Evaluation[]): Promise<string> => {
    const formattedEvaluations = evaluations
        .map(e => `- Settimana ${e.weekNumber}, Blocco ${e.blockIndex}: [${e.value}] ${e.notes}`)
        .join('\n');

    const prompt = `Sei Ada, un'AI esperta in pedagogia. Analizza i dati raccolti per la studentessa "${studentName}" e crea una sintesi pedagogica.

**NOTE QUALITATIVE DEL DOCENTE:**
${notes || "Nessuna nota qualitativa fornita."}

**DIARIO DI BORDO (Attività e Presenze):**
${formattedEvaluations || "Nessun dato nel diario di bordo."}

**TUA ANALISI:**
Basandoti su tutto questo, fornisci una sintesi che includa:
1.  **Punti di Forza:** Identifica le aree in cui la studentessa eccelle o mostra un forte interesse.
2.  **Aree di Miglioramento:** Evidenzia i concetti o le abilità su cui la studentessa potrebbe concentrarsi.
3.  **Stile di Apprendimento (Inferito):** Basandoti sulle note, prova a ipotizzare lo stile di apprendimento preferito dalla studentessa (es. pratico, visivo, collaborativo).
4.  **Prossimi Passi Suggeriti:** Fornisci uno o due suggerimenti pratici per il docente per supportare la crescita della studentessa.

Usa un tono costruttivo e professionale. Formatta la risposta in Markdown.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            temperature: 0.5,
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });
    return response.text.trim();
};

const weekThemeSchema: FunctionDeclaration = {
    name: "suggest_week_theme",
    description: "Suggerisce un tema settimanale creativo basato su un riassunto dei blocchi di lezione pianificati.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            theme: { type: Type.STRING, description: "Un tema settimanale conciso, creativo e di forte impatto." },
            reasoning: { type: Type.STRING, description: "Una breve motivazione (1-2 frasi) che spiega la logica pedagogica dietro il tema proposto." }
        },
        required: ["theme", "reasoning"]
    }
};

export const generateThemeFromBlocks = async (weekContext: string): Promise<{ theme: string; reasoning: string; }> => {
    const prompt = `Sei un'esperta di design didattico. Basandoti sul riassunto delle attività pianificate per la settimana, genera un tema settimanale creativo e di forte impatto.

**Attività Pianificate:**
${weekContext}

Usa la funzione 'suggest_week_theme' per la tua risposta.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [weekThemeSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'suggest_week_theme' && call.args) {
        const { theme, reasoning } = extractArgs<{ theme?: string; reasoning?: string }>(call.args);
        return { theme: theme || '', reasoning: reasoning || '' };
    }
    throw new Error("L'AI non ha fornito un tema in un formato valido.");
};

const objectiveSuggestionsSchema: FunctionDeclaration = {
    name: "generate_objective_suggestions",
    description: "Genera tre varianti di un obiettivo didattico istituzionale per un blocco di lezione.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            concise: { type: Type.STRING, description: "Un obiettivo sintetico: una frase formale e d'impatto, in stile 'Lo studente sarà in grado di...'." },
            balanced: { type: Type.STRING, description: "Un obiettivo bilanciato: chiaro, misurabile, che integra contenuto e metodologia." },
            creative: { type: Type.STRING, description: "Un obiettivo più articolato che collega il contenuto a competenze trasversali o al contesto reale degli studenti." }
        },
        required: ["concise", "balanced", "creative"]
    }
};

/**
 * Genera tre varianti di obiettivo didattico istituzionale (il "perché" formale del blocco).
 * Usa: unità didattica selezionata + estratto dal Progetto Didattico + tipologia lezione + profilo docente/patto formativo + tema settimana.
 */
export const generateObjectiveSuggestions = async (
    moduleTitle: string,
    moduleContext: string,
    tipologia: string,
    teacherProfile: string,
    theme: string
): Promise<{ concise: string; balanced: string; creative: string; }> => {
    const fullPrompt = `Sei un esperto di design didattico e programmazione curricolare. Il tuo compito è formulare tre varianti di un obiettivo didattico istituzionale per un blocco di lezione.

L'obiettivo deve essere in linguaggio formale, adatto alla documentazione scolastica (registro di classe, programmazione, consiglio di classe). NON deve essere un titolo creativo per gli studenti — quello viene dopo, separatamente.

**Contesto del blocco:**
- **Unità didattica:** ${moduleTitle}
- **Estratto dal Progetto Didattico:** """${moduleContext || 'non disponibile'}"""
- **Modalità pedagogica (come):** ${tipologia || 'non specificata'}
- **Tema della settimana:** "${theme || 'non definito'}"
- **Profilo del corso / Patto Formativo:** """${teacherProfile ? teacherProfile.slice(0, 800) : 'non disponibile'}"""

Genera tre varianti di obiettivo didattico:
1. **Sintetico:** Una frase concisa e formale. Inizia con "Lo studente sarà in grado di..." o formulazione equivalente.
2. **Bilanciato:** Obiettivo standard, chiaro, misurabile, che integra contenuto e metodologia della lezione.
3. **Articolato:** Obiettivo più ricco che collega il contenuto disciplinare a competenze trasversali o al contesto autentico degli studenti, richiamando il patto formativo.

Usa la funzione 'generate_objective_suggestions' per fornire le tre varianti.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
            tools: [{ functionDeclarations: [objectiveSuggestionsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            temperature: 0.6,
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_objective_suggestions' && call.args) {
        const { concise, balanced, creative } = extractArgs<{ concise?: string; balanced?: string; creative?: string }>(call.args);
        return { concise: concise || '', balanced: balanced || '', creative: creative || '' };
    }
    throw new Error("L'AI non ha fornito gli obiettivi nel formato richiesto.");
};

const blockTitleSuggestionsSchema: FunctionDeclaration = {
    name: "generate_block_title_suggestions",
    description: "Genera tre titoli accattivanti per un blocco di lezione, da comunicare agli studenti.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            direct: { type: Type.STRING, description: "Titolo diretto: chiaro, immediato, dice esattamente di cosa si tratta ma in modo vivace." },
            narrative: { type: Type.STRING, description: "Titolo narrativo: racconta una storia, usa una metafora o un'immagine concreta che cattura l'essenza della lezione." },
            evocative: { type: Type.STRING, description: "Titolo evocativo: apre una domanda o crea suspense, stimola la curiosità senza rivelare tutto." }
        },
        required: ["direct", "narrative", "evocative"]
    }
};

/**
 * Genera tre titoli accattivanti per il blocco da mostrare agli studenti (il "nome" della lezione).
 * Usa: obiettivo istituzionale già definito + unità didattica + tipologia + tema settimana.
 * I titoli devono essere coinvolgenti, mai scolastici, mai burocratici.
 */
export const generateBlockTitleSuggestions = async (
    objective: string,
    moduleTitle: string,
    tipologia: string,
    theme: string
): Promise<{ direct: string; narrative: string; evocative: string }> => {
    const fullPrompt = `Sei un esperto di comunicazione didattica e storytelling educativo. Il tuo compito è trasformare un obiettivo pedagogico formale in tre titoli accattivanti per una lezione, da comunicare agli studenti (scritto alla lavagna, nel registro, nel piano di lavoro settimanale condiviso).

I titoli devono essere coinvolgenti, curiosi, mai burocratici. Devono fare venire voglia di saperne di più. Pensa a come un buon documentario o un libro avvincente intitola i propri capitoli.

**Contesto:**
- **Obiettivo didattico del blocco:** "${objective}"
- **Unità didattica (cosa):** ${moduleTitle || 'non specificata'}
- **Modalità pedagogica (come):** ${tipologia || 'non specificata'}
- **Tema della settimana:** "${theme || 'non definito'}"

Genera tre varianti di titolo:
1. **Diretto:** Chiaro e vivace. Dice esattamente cosa si fa, ma con energia. Massimo 8 parole.
2. **Narrativo:** Usa una metafora, un'immagine o un verbo d'azione che racconta la lezione come un'esperienza. Può avere un sottotitolo breve (separato da "—").
3. **Evocativo:** Apre una domanda, crea attesa, non rivela tutto. Può essere una domanda retorica o una frase che lascia sospesa la curiosità.

Usa la funzione 'generate_block_title_suggestions' per fornire le tre varianti.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
            tools: [{ functionDeclarations: [blockTitleSuggestionsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            temperature: 0.85,
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_block_title_suggestions' && call.args) {
        const { direct, narrative, evocative } = extractArgs<{ direct?: string; narrative?: string; evocative?: string }>(call.args);
        return { direct: direct || '', narrative: narrative || '', evocative: evocative || '' };
    }
    throw new Error("L'AI non ha fornito i titoli nel formato richiesto.");
};


const strategicSuggestionsSchema: FunctionDeclaration = {
    name: "generate_strategic_suggestions",
    description: "Genera suggerimenti strategici per la pianificazione di una settimana di lezioni, inclusi un tema, obiettivi e una motivazione.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            theme: { type: Type.STRING, description: "Un tema settimanale creativo e di forte impatto basato sul prompt e sul contesto." },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Una lista di 2-3 obiettivi didattici per i blocchi di lezione, coerenti con il tema." },
            reasoning: { type: Type.STRING, description: "Una breve motivazione (1-2 frasi) che spiega la logica pedagogica dietro il tema e gli obiettivi proposti." }
        },
        required: ["theme", "objectives", "reasoning"]
    }
};
export const generateStrategicSuggestions = async (prompt: string, moduleContext: string): Promise<{ theme: string; objectives: string[]; reasoning: string; }> => {
    const fullPrompt = `Sei un esperto di design didattico. Basandoti sul contesto fornito, genera suggerimenti strategici per una settimana di lezioni.

**Contesto:**
- **Modulo di Riferimento:** ${moduleContext}
- **Idea/Prompt del Docente:** "${prompt}"

Usa la funzione 'generate_strategic_suggestions' per la tua risposta. Fornisci un tema, 2-3 obiettivi e una motivazione.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
            tools: [{ functionDeclarations: [strategicSuggestionsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_strategic_suggestions' && call.args) {
        const { theme, objectives, reasoning } = extractArgs<{ theme?: string; objectives?: string[]; reasoning?: string }>(call.args);
        return { theme: theme || '', objectives: objectives || [], reasoning: reasoning || '' };
    }
    throw new Error("L'AI non ha fornito suggerimenti strategici in un formato valido.");
};

const blockDetailsSchema: FunctionDeclaration = {
    name: "generate_block_details",
    description: "Genera i dettagli per un blocco di lezione, inclusi un titolo, un syllabus e una lista di materiali.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lessonTitle: { type: Type.STRING, description: "Un titolo creativo e accattivante per la lezione, formattato in Markdown (es. **Titolo**\\n*Sottotitolo*)." },
            lessonSyllabus: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Una lista di 3-5 punti chiave che verranno trattati durante la lezione (syllabus)." },
            lessonPlanMaterials: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Una lista di materiali necessari per la lezione (es. 'Proiettore', 'Post-it', 'PC con software X')." }
        },
        required: ["lessonTitle", "lessonSyllabus", "lessonPlanMaterials"]
    }
};
export type DocumentContentType = 'progetto_didattico' | 'regole' | 'personalita';

export const generateDocumentContent = async (
    docType: DocumentContentType,
    teacherProfile: string
): Promise<string> => {
    const prompts: Record<DocumentContentType, string> = {
        progetto_didattico: `Sei un esperto di progettazione didattica. Basandoti sul profilo del corso fornito, genera un Progetto Didattico completo e professionale per questa disciplina.

Il Progetto Didattico deve usare OBBLIGATORIAMENTE i seguenti prefissi riconosciuti dal sistema per le unità di contenuto:

  MODULO N: Titolo        → un modulo didattico principale (con numero 0-based)
  UDA N: Titolo           → un'Unità di Apprendimento / compito autentico
  EDUCAZIONE CIVICA: Titolo  → un percorso di educazione civica (numero opzionale)
  FSL: Titolo             → attività di Formazione Scuola-Lavoro strutturata (numero opzionale)

Usa SOLO i prefissi pertinenti al profilo del corso. Non inventare prefissi diversi.

I prefissi sono case-sensitive e devono essere esattamente come mostrati sopra (tutto maiuscolo, con due punti). Il sistema li legge direttamente per popolare le tendine di pianificazione di Ada — usarli correttamente consente all'AI di proporre le unità nelle interfacce di pianificazione.

Per ogni sezione MODULO includi (facoltativi ma molto utili):
  Ruolo: descrizione sintetica del ruolo nel percorso
  Significato: perché questo modulo è significativo per gli studenti
  ⦁ Concetti Chiave: concetto 1; concetto 2; concetto 3
  ⦁ Competenze Operative: competenza 1; competenza 2; competenza 3
  ⦁ Attività Chiave: attività 1; attività 2; attività 3

Per UDA, EDUCAZIONE CIVICA e FSL includi almeno:
  Ruolo: descrizione sintetica
  Significato: motivazione pedagogica

Esempio di struttura corretta:
---
MODULO 0: Orientamento
Ruolo: Accoglienza e presentazione del percorso formativo.
Significato: ...

MODULO 1: Fondamenti
Ruolo: ...
...

UDA 1: Nome del compito autentico
Ruolo: ...
Significato: ...

EDUCAZIONE CIVICA: Cittadinanza Digitale
Ruolo: ...
---

Scrivi solo le sezioni pertinenti al profilo del corso. Usa il formato sopra, senza intestazioni Markdown aggiuntive attorno ai prefissi — i prefissi sono già i titoli di sezione.

PROFILO DEL CORSO:
${teacherProfile}`,

        regole: `Sei un esperto di gestione della classe e valutazione formativa. Basandoti sul profilo del corso fornito, genera un Patto Formativo per questa disciplina.

Il Patto Formativo deve includere:
- L'ambiente di apprendimento (regole del laboratorio, comportamenti attesi)
- Il sistema di valutazione (criteri, tipologie di verifica, peso delle componenti)
- Le modalità di feedback e revisione del lavoro
- I diritti e doveri degli studenti
- Le modalità di recupero e approfondimento

Scrivi in modo coinvolgente e positivo, come un vero patto condiviso con la classe. Usa Markdown con titoli (##), sottotitoli (###) e liste puntate.

PROFILO DEL CORSO:
${teacherProfile}`,

        personalita: `Sei un esperto di AI applicata alla didattica. Basandoti sul profilo del corso fornito, genera le istruzioni di sistema per Ada — l'assistente AI dell'insegnante.

Le istruzioni devono definire:
- Il tono e lo stile comunicativo di Ada (es. entusiasta, rigorosa, ironica, incoraggiante)
- Le priorità pedagogiche di Ada in questo contesto specifico
- Come Ada affianca il docente nella pianificazione, nell'analisi e nel feedback
- Le peculiarità del corso che Ada deve tenere sempre presente
- Il "carattere" di Ada: cosa la rende unica e adatta a questo docente

Scrivi le istruzioni in seconda persona rivolgendoti ad Ada (es. "Sei Ada, ..."). Usa Markdown con titoli e liste. Il risultato deve essere direttamente incollabile come system prompt.

PROFILO DEL CORSO:
${teacherProfile}`,
    };

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompts[docType] }] }],
        config: {
            temperature: 0.65,
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });
    return response.text.trim();
};

const VALID_LESSON_TYPES = new Set<string>([
    'frontale_teorica', 'frontale_operativa', 'laboratorio',
    'verifica', 'discussione',
]);

export const extractModulesFromProfile = async (teacherProfile: string): Promise<CourseModule[]> => {
    if (!teacherProfile?.trim()) return [];

    const prompt = `Analizza il seguente Profilo del Corso ed estrai i moduli didattici strutturati.

Restituisci SOLO un array JSON valido, senza markdown né testo aggiuntivo, con questa struttura:
[
  {
    "title": "Nome del modulo",
    "estimatedBlocks": <numero intero>,
    "pillar": "<asse tematico opzionale, ometti se non presente>",
    "sections": [
      {
        "title": "Nome della sezione o argomento",
        "lessonType": "<uno tra: frontale_teorica | frontale_operativa | laboratorio | verifica | discussione | uda | fsl>",
        "estimatedBlocks": <numero intero>
      }
    ]
  }
]

Regole:
- Ogni modulo deve avere almeno una sezione
- estimatedBlocks deve essere >= 1
- lessonType deve essere uno dei valori elencati esattamente come scritto
- Se il profilo non contiene moduli chiari, estrai le aree tematiche principali

PROFILO DEL CORSO:
${teacherProfile}`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                temperature: 0.2,
            }
        });

        const raw = JSON.parse(response.text.trim());
        if (!Array.isArray(raw)) return [];

        return raw.map((m: Record<string, unknown>, i: number): CourseModule => ({
            id: crypto.randomUUID(),
            order: i + 1,
            title: String(m.title || `Modulo ${i + 1}`),
            estimatedBlocks: Math.max(1, Number(m.estimatedBlocks) || 1),
            pillar: m.pillar ? String(m.pillar) : undefined,
            sections: Array.isArray(m.sections)
                ? (m.sections as Record<string, unknown>[]).map((s): ModuleSection => ({
                    id: crypto.randomUUID(),
                    title: String(s.title || 'Sezione senza titolo'),
                    lessonType: VALID_LESSON_TYPES.has(String(s.lessonType))
                        ? (s.lessonType as LessonType)
                        : 'frontale_teorica',
                    estimatedBlocks: Math.max(1, Number(s.estimatedBlocks) || 1),
                }))
                : [],
        }));
    } catch {
        return [];
    }
};


export const generateLessonNoteAnalysis = async (
    notes: string,
    students: { id: string; name: string }[]
): Promise<{ engagementLevel: 'basso' | 'medio' | 'alto'; studentSignals: Array<{ studentId: string; signal: string; type: 'positivo' | 'attenzione' }>; groupNotes: Array<{ note: string }>; classNotes: string[] }> => {
    const studentList = students.length > 0
        ? students.map(s => `- ${s.name} (id: ${s.id})`).join('\n')
        : '(nessuna lista studenti fornita)';

    const prompt = `Sei Ada, assistente AI per un insegnante. Analizza queste note di lezione e restituisci un'analisi strutturata in JSON puro (senza markdown).

NOTE DEL DOCENTE:
${notes}

STUDENTI (usa gli ID nei campi studentId):
${studentList}

Rispondi SOLO con un oggetto JSON con questa struttura:
{
  "engagementLevel": "basso" | "medio" | "alto",
  "studentSignals": [{ "studentId": "<id esatto>", "signal": "<10-15 parole>", "type": "positivo" | "attenzione" }],
  "groupNotes": [{ "note": "<osservazione breve sul gruppo>" }],
  "classNotes": ["<osservazione generale 1>", "<osservazione 2>"]
}

Regole:
- Includi in studentSignals SOLO studenti esplicitamente menzionati nelle note, usando l'ID corretto dalla lista
- Se nessuno studente è menzionato, usa studentSignals=[]
- classNotes: max 3 osservazioni generali sulla classe
- Sii conciso e fattuale`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }
    });

    try {
        const cleaned = response.text
            .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            engagementLevel: (['basso', 'medio', 'alto'] as const).includes(parsed.engagementLevel)
                ? parsed.engagementLevel : 'medio',
            studentSignals: Array.isArray(parsed.studentSignals) ? parsed.studentSignals : [],
            groupNotes: Array.isArray(parsed.groupNotes) ? parsed.groupNotes : [],
            classNotes: Array.isArray(parsed.classNotes) ? parsed.classNotes : [],
        };
    } catch {
        throw new Error("L'AI non ha restituito un'analisi strutturata valida.");
    }
};

export const generateToolSuggestion = async (question: string, masterContentSnippet?: string): Promise<string> => {
    const contextPart = masterContentSnippet?.trim()
        ? `\n\n**Contesto del blocco di lezione:**\n${masterContentSnippet.slice(0, 800)}`
        : '';
    const prompt = `Sei Ada, assistente AI specializzata nella didattica. Un insegnante ti chiede consiglio su strumenti e materiali per la sua lezione.${contextPart}

**Domanda:** ${question}

Rispondi in 2-4 frasi. Suggerisci strumenti digitali concreti (Canva, Padlet, Mentimeter, Gamma, Kahoot, Google Slides, YouTube, ecc.) adatti al contesto didattico. Usa Markdown.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text.trim();
};

export const generateBlockDetails = async (objective: string, theme: string): Promise<{ lessonTitle: string; lessonSyllabus: string; lessonPlanMaterials: string; }> => {
    const prompt = `Sei un esperto di design didattico. Basandoti sul contesto fornito, genera i dettagli per un blocco di lezione di 2 ore.

**Contesto:**
- **Tema della Settimana:** "${theme}"
- **Obiettivo del Blocco:** "${objective}"

Usa la funzione 'generate_block_details' per la tua risposta. Il syllabus e i materiali dovrebbero essere liste di punti. Il titolo può usare markdown per la formattazione.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [blockDetailsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_block_details' && call.args) {
        const { lessonTitle, lessonSyllabus, lessonPlanMaterials } = extractArgs<{ lessonTitle?: string; lessonSyllabus?: string[]; lessonPlanMaterials?: string[] }>(call.args);
        return {
            lessonTitle: lessonTitle || '',
            lessonSyllabus: (lessonSyllabus || []).map((s: string) => `- ${s}`).join('\n'),
            lessonPlanMaterials: (lessonPlanMaterials || []).map((m: string) => `- ${m}`).join('\n'),
        };
    }
    throw new Error("L'AI non ha fornito i dettagli del blocco in un formato valido.");
};
