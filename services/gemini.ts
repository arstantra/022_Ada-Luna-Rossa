// services/gemini.ts
// @ts-nocheck
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration, GenerateContentParameters, Content, FunctionCallingConfigMode } from "@google/genai";
import type { Message, Attachment, Mode, Student, GroupDefinition, AdaAnalysis, Evaluation, QualitativeAnalysisData, Conversation, WeekRouteInfo } from '../types';
import { MODES } from '../constants';
import TurndownService from 'turndown';

export const ADA_API_KEY_STORAGE = 'ada_gemini_api_key';

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

// HELPER FUNCTION TO GENERATE DYNAMIC MAP
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
        model: 'gemini-2.5-pro',
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
    masterContext: any,
    currentModeId: Mode['id'],
    useGoogleSearch: boolean,
    conversations: Conversation[],
    availableWeeks: WeekRouteInfo[],
    planningContext?: string,
    students?: Student[]
): Promise<AsyncGenerator<GenerateContentResponse>> => {
    
    const teacherContext = masterContext.teacherProfile && masterContext.teacherProfile.trim() 
        ? `\n\nStai collaborando con il docente descritto nel seguente profilo:\n${masterContext.teacherProfile}`
        : '';
    const systemInstruction = `${masterContext.systemInstruction}${teacherContext}\n\n${getModePrompt(currentModeId)}`;

    const studentContext = students ? `Contesto studentesse in classe: ${students.map(s => s.name).join(', ')}.` : '';

    const dynamicStrategicMap = renderStrategicDashboardToMarkdown(conversations, availableWeeks);
    
    const fullContext = [masterContext.constitution, dynamicStrategicMap, masterContext.rulesContext, masterContext.crewContext, planningContext, studentContext].filter(Boolean).join('\n\n');

    const attachmentPart = attachment 
        ? { inlineData: { mimeType: attachment.type, data: attachment.data.split(',')[1] } }
        : null;

    const userParts = [{ text: content }];
    if (attachmentPart) {
        userParts.push(attachmentPart as any);
    }
    
    const contents: Content[] = [
        ...buildHistory(history),
        {
            role: 'user',
            parts: userParts,
        }
    ];

    const config: GenerateContentParameters['config'] = {
        systemInstruction: {
            role: 'system',
            parts: [{ text: `${systemInstruction}\n\n# CONTESTO GLOBALE:\n${fullContext}` }]
        },
        thinkingConfig: { thinkingBudget: 32768 }
    };
    
    if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    return getAI().models.generateContentStream({
        model: 'gemini-2.5-pro',
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
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [groupSuggestionSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'create_student_groups' && (call.args as any).groups) {
        return { groups: (call.args as any).groups as GroupDefinition[] };
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
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [lessonAnalysisSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'analyze_lesson_notes' && call.args) {
        return call.args as any;
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
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [evaluationAnalysisSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'analyze_evaluation_text' && call.args) {
        return call.args as Partial<Evaluation>;
    }
    throw new Error("L'AI non è riuscita a strutturare la valutazione. Prova a riformattare il testo.");
};


// --- MOTORE DI INFERENZA QUALITATIVA PER IL CRUSCOTTO ---

const qualitativeAnalysisSchema: FunctionDeclaration = {
    name: "analyze_qualitative_classroom_data",
    description: "Analizza note qualitative sulle lezioni per estrarre insight sull'energia della classe, la crescita degli studenti e la comprensione dei concetti.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            classEnergy: {
                type: Type.ARRAY,
                description: "Energia qualitativa della classe per ogni settimana menzionata nelle note.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        weekNumber: { type: Type.NUMBER, description: "Il numero della settimana a cui si riferisce la nota." },
                        energyLevel: { type: Type.STRING, enum: ['Bassa Frequenza', 'Ritmo di Crociera', 'Scintilla Creativa'], description: "Il livello di energia inferito per quella settimana." }
                    },
                    required: ["weekNumber", "energyLevel"]
                }
            },
            studentGrowth: {
                type: Type.ARRAY,
                description: "Analisi della crescita individuale per ogni studentessa menzionata, basata su 4 criteri.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        studentName: { type: Type.STRING, description: "Il nome completo della studentessa." },
                        criteria: {
                            type: Type.OBJECT,
                            description: "Valutazione qualitativa per ogni criterio.",
                            properties: {
                                QualitàElaborati: { type: Type.STRING, enum: ['Da Potenziare', 'Stabile', 'Punto di Forza'], description: "Livello di qualità dei lavori prodotti." },
                                Partecipazione: { type: Type.STRING, enum: ['Da Potenziare', 'Stabile', 'Punto di Forza'], description: "Livello di partecipazione attiva." },
                                Collaborazione: { type: Type.STRING, enum: ['Da Potenziare', 'Stabile', 'Punto di Forza'], description: "Capacità di collaborare con i pari." },
                                ResilienzaCreativa: { type: Type.STRING, enum: ['Da Potenziare', 'Stabile', 'Punto di Forza'], description: "Capacità di superare ostacoli creativi." },
                            },
                             required: ["QualitàElaborati", "Partecipazione", "Collaborazione", "ResilienzaCreativa"]
                        }
                    },
                    required: ["studentName", "criteria"]
                }
            },
            conceptMastery: {
                type: Type.ARRAY,
                description: "Comprensione dei concetti chiave (pilastri) menzionati nelle note.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        concept: { type: Type.STRING, description: "Il nome del concetto o pilastro." },
                        mastery: { type: Type.STRING, enum: ['Compreso', 'In Difficoltà'], description: "Il livello di comprensione del concetto da parte della classe." },
                        pillarType: { type: Type.STRING, enum: ['Sintonizzazione', 'Operativo', 'Attività Chiave', 'Sconosciuto'], description: "Il tipo di pilastro a cui appartiene il concetto." }
                    },
                    required: ["concept", "mastery", "pillarType"]
                }
            }
        },
        required: ["classEnergy", "studentGrowth", "conceptMastery"]
    }
};

export const inferQualitativeMetrics = async (corpus: string, studentNames: string[], allPillars: {name: string, type: 'Sintonizzazione' | 'Operativo' | 'Attività Chiave'}[]): Promise<QualitativeAnalysisData> => {
    const pillarsList = allPillars.map(p => `- ${p.name} (Tipo: ${p.type})`).join('\n');
    const prompt = `Sei un'AI esperta in pedagogia. Analizza il seguente corpus di note di lezione. Estrai insight qualitativi secondo lo schema fornito.

**CONTESTO:**
- **Lista Studentesse:** ${studentNames.join(', ')}
- **Lista Concetti/Pilastri Esistenti:**
${pillarsList}

**NOTE DA ANALIZZARE (ogni nota include il numero della settimana, es. "Nota Settimana 3: ..."):**
---
${corpus}
---

**ISTRUZIONI DETTAGLIATE:**
1.  **Class Energy:** Per ogni settimana menzionata, assegna un livello di energia: 'Bassa Frequenza' (note negative, stanchezza), 'Ritmo di Crociera' (note neutre, lavoro standard), 'Scintilla Creativa' (entusiasmo, idee brillanti).
2.  **Student Growth:** Per ogni studentessa menzionata, valuta i 4 criteri. Se una nota dice "Viola ha collaborato bene", assegna 'Punto di Forza' a 'Collaborazione' per Viola. Se non ci sono informazioni per un criterio, assegna 'Stabile'.
3.  **Concept Mastery:** Se una nota menziona una difficoltà con un concetto (es. "difficoltà su 'Ciclo di Vita'"), assegna 'In Difficoltà'. Se la nota è positiva, assegna 'Compreso'. Usa la lista di pilastri fornita per classificare il 'pillarType'. Se un concetto non è nella lista, classificalo come 'Sconosciuto'.

Estrai i dati in modo rigoroso e strutturato.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [qualitativeAnalysisSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'analyze_qualitative_classroom_data' && call.args) {
        const args = call.args as any;
        return {
            classEnergy: args.classEnergy || [],
            studentGrowth: args.studentGrowth || [],
            conceptMastery: args.conceptMastery || [],
        };
    }
    throw new Error("L'AI non ha fornito un'analisi qualitativa strutturata valida.");
};


export const generateClassroomTrendAnalysis = async (qualitativeData: string, qualitativeNotes: string): Promise<string> => {
    const prompt = `Sei un'analista didattico. Ti fornirò dati qualitativi sull'andamento della classe (derivati da inferenze) e le note qualitative generali del docente. Il tuo compito è incrociare queste informazioni per generare una sintesi strategica.\n\n**DATI QUALITATIVI E TREND INFERITI:**\n${qualitativeData}\n\n**NOTE QUALITATIVE DEL DOCENTE:**\n${qualitativeNotes}\n\n**TUA ANALISI:**\nBasandoti su tutto questo, fornisci una sintesi che includa:\n1. Un'analisi del trend generale dell'energia della classe.\n2. Identificazione di cluster di studentesse (es. profili di crescita simili).\n3. Suggerimenti strategici concreti per le prossime lezioni basati sulla mappa dei concetti.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
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
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            temperature: 0.5,
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    return response.text.trim();
};

export const generateThemeFromBlocks = async (weekContext: string): Promise<{ theme: string; reasoning: string; }> => {
    const themeSchema: FunctionDeclaration = {
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
    
    const prompt = `Sei un'esperta di design didattico. Basandoti sul riassunto delle attività pianificate per la settimana, genera un tema settimanale creativo e di forte impatto.

**Attività Pianificate:**
${weekContext}

Usa la funzione 'suggest_week_theme' per la tua risposta.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [themeSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'suggest_week_theme' && call.args) {
        const { theme, reasoning } = call.args as any;
        return { theme: theme || '', reasoning: reasoning || '' };
    }
    throw new Error("L'AI non ha fornito un tema in un formato valido.");
};

const objectiveSuggestionsSchema: FunctionDeclaration = {
    name: "generate_objective_suggestions",
    description: "Genera tre varianti di un obiettivo didattico per un blocco di lezione.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            concise: { type: Type.STRING, description: "Un obiettivo breve, diretto e d'impatto." },
            balanced: { type: Type.STRING, description: "Un obiettivo standard, chiaro e misurabile." },
            creative: { type: Type.STRING, description: "Una formulazione più evocativa e non convenzionale per stimolare la curiosità." }
        },
        required: ["concise", "balanced", "creative"]
    }
};

export const generateObjectiveSuggestions = async (prompt: string, moduleContext: string, theme: string): Promise<{ concise: string; balanced: string; creative: string; }> => {
    const fullPrompt = `Sei un esperto di design didattico. Il tuo compito è distillare il contesto fornito per creare tre varianti di un obiettivo didattico per un blocco di lezione.

**Contesto da Analizzare:**
- **Tema della Settimana:** "${theme}"
- **Estratto dalla Costituzione (Contesto del Modulo):** """${moduleContext}"""
- **Idea/Prompt del Docente:** """${prompt}"""

Basandoti su una sintesi di **entrambi** i testi ("Estratto dalla Costituzione" e "Idea/Prompt"), genera tre varianti di un obiettivo didattico:
1.  **Sintetico:** Breve, diretto e d'impatto.
2.  **Bilanciato:** Chiaro, misurabile e standard.
3.  **Creativo:** Evocativo, non convenzionale, stimola la curiosità.

Usa la funzione 'generate_objective_suggestions' per fornire le tre varianti. Assicurati che ogni variante sia una diretta conseguenza dei contenuti forniti.`;
    
    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
            tools: [{ functionDeclarations: [objectiveSuggestionsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_objective_suggestions' && call.args) {
        const { concise, balanced, creative } = call.args as any;
        return { concise: concise || '', balanced: balanced || '', creative: creative || '' };
    }
    throw new Error("L'AI non ha fornito gli obiettivi nel formato richiesto.");
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
export const generateStrategicSuggestions = async (prompt: string, moduleContext: string, pillarContext: string | null): Promise<{ theme: string; objectives: string[]; reasoning: string; }> => {
    const fullPrompt = `Sei un esperto di design didattico. Basandoti sul contesto fornito, genera suggerimenti strategici per una settimana di lezioni.

**Contesto:**
- **Modulo di Riferimento:** ${moduleContext}
${pillarContext ? `- **Pilastro di Focus:** ${pillarContext}\n` : ''}
- **Idea/Prompt del Docente:** "${prompt}"

Usa la funzione 'generate_strategic_suggestions' per la tua risposta. Fornisci un tema, 2-3 obiettivi e una motivazione.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
            tools: [{ functionDeclarations: [strategicSuggestionsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_strategic_suggestions' && call.args) {
        const { theme, objectives, reasoning } = call.args as any;
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
            lessonMaterials: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Una lista di materiali necessari per la lezione (es. 'Proiettore', 'Post-it', 'PC con software X')." }
        },
        required: ["lessonTitle", "lessonSyllabus", "lessonMaterials"]
    }
};
export const generateBlockDetails = async (objective: string, theme: string): Promise<{ lessonTitle: string; lessonSyllabus: string; lessonMaterials: string; }> => {
    const prompt = `Sei un esperto di design didattico. Basandoti sul contesto fornito, genera i dettagli per un blocco di lezione di 2 ore.

**Contesto:**
- **Tema della Settimana:** "${theme}"
- **Obiettivo del Blocco:** "${objective}"

Usa la funzione 'generate_block_details' per la tua risposta. Il syllabus e i materiali dovrebbero essere liste di punti. Il titolo può usare markdown per la formattazione.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{ functionDeclarations: [blockDetailsSchema] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });

    const call = response.functionCalls?.[0];
    if (call?.name === 'generate_block_details' && call.args) {
        const { lessonTitle, lessonSyllabus, lessonMaterials } = call.args as any;
        return {
            lessonTitle: lessonTitle || '',
            lessonSyllabus: (lessonSyllabus || []).map((s: string) => `- ${s}`).join('\n'),
            lessonMaterials: (lessonMaterials || []).map((m: string) => `- ${m}`).join('\n'),
        };
    }
    throw new Error("L'AI non ha fornito i dettagli del blocco in un formato valido.");
};