

/**
 * Sottoinsieme del contesto docente passato a gemini.ts.
 * Contiene solo i campi dati letti dal servizio AI (no handler, no isLoading).
 */
export interface MasterContextData {
    systemInstruction: string;
    progettazione: string;
    crewContext: string;
    rulesContext: string;
    teacherProfile: string;
    ptofExtract?: string;
}

export interface Label {
    id: string;
    name: string;
    color: string;
}

/**
 * Una settimana nel calendario de La Rotta.
 * mondayDate: ISO string della data del lunedì (es. "2025-09-15").
 * activeBlocks: array 1-indexed dei blocchi presenti (es. [1,2,3] oppure [1,3] se BL2 è assente).
 */
export interface WeekEntry {
    weekNumber: number;
    mondayDate: string;
    activeBlocks: number[];
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface Attachment {
    name: string;
    type: string; // Mime type
    data: string; // Base64 data URL
}

export interface Evaluation {
    date: string;
    value: string; // e.g., "Ottimo", "Sotto soglia", "7/10"
    notes: string;
    // New optional fields for logbook
    weekNumber?: number;
    blockIndex?: number;
    module?: string;
    pillar?: string;
}

export interface Student {
    id: string;
    /** Nome completo — usato ovunque per retro-compatibilità. Derivato da firstName+lastName se disponibili. */
    name: string;
    /** Nome (inserimento strutturato da modale Equipaggio) */
    firstName?: string;
    /** Cognome (inserimento strutturato da modale Equipaggio) */
    lastName?: string;
    notes?: string;
    evaluations: Evaluation[];
    adaSummary?: {
        content: string;
        date: string; // ISO string
    };
    // Campi inclusione — inseriti nel modale Equipaggio
    hasBES?: boolean;
    hasDSA?: boolean;
    hasPEI?: boolean;
    besNotes?: string;
    dsaNotes?: string;
    peiNotes?: string;
    certificationNotes?: string;
}

export interface WeekRouteInfo {
    weekNumber: number;
    dates: string;
    totalBlocks: number;
    notes?: string;
}

// --- TIPI AGGIORNATI PER LA PIANIFICAZIONE DETTAGLIATA ---

export type BlockStatus = 'normale' | 'saltato' | 'da definire' | 'annullato';

/** Modalità pedagogica di conduzione della lezione — il "come" (vocabolario stabile, 5 voci) */
export type LessonType =
  | 'frontale_teorica'
  | 'frontale_operativa'
  | 'laboratorio'
  | 'verifica'
  | 'discussione';

/** Tipo di unità di contenuto del corso — il "cosa" (dichiarato nel Progetto Didattico) */
export type CourseContentType = 'modulo' | 'uda' | 'educazione_civica' | 'fsl';

/** Approccio pedagogico — il "metodo" (ortogonale a tipologia e cosa) */
export type TeachingMethodology =
  | 'tradizionale'
  | 'flipped_classroom'
  | 'project_based'
  | 'problem_based'
  | 'cooperative_learning'
  | 'peer_teaching'
  | 'debate'
  | 'design_thinking'
  | 'gamification'
  | 'studio_di_caso'
  | 'inquiry_based'
  | 'role_playing'
  | 'jigsaw';

/** Unità di contenuto parsata dal Progetto Didattico */
export interface CourseContentUnit {
  id: string;             // formato: `${type}-${order}`, es. "modulo-1", "uda-1"
  type: CourseContentType;
  title: string;          // testo dopo il prefisso, es. "Fondamenti del Design"
  order: number;          // posizione 1-based per tipo
  role?: string;          // da "Ruolo:" nel Progetto Didattico
  significance?: string;  // da "Significato:" nel Progetto Didattico
}

/** Ciclo di vita di una lezione: pianificata → in corso → archiviata */
export type LessonState = 'progettata' | 'in_corso' | 'archiviata';

export interface ModuleSection {
  id: string;
  title: string;
  lessonType: LessonType;
  estimatedBlocks: number;
}

/** Usa CourseModule (non Module) per evitare conflitti col tipo nativo Module di TS/JS */
export interface CourseModule {
  id: string;
  order: number;                // 1-based
  title: string;
  sections: ModuleSection[];
  estimatedBlocks: number;
  pillar?: string;
}


// ── Attività legacy (sistema basato su conversazioni — da migrare al sistema DB) ──

export type ActivityType =
  | 'ricerca'
  | 'audiovisivo'
  | 'produzione_scritta'
  | 'progetto'
  | 'altro';

export type ConvActivityStatus =
  | 'in_corso'
  | 'in_scadenza'
  | 'consegnata'
  | 'scaduta';

export type ActivityContext =
  | 'solo_in_classe'
  | 'classe_e_casa'
  | 'solo_a_casa';

export interface ConvActivity {
  id: string;
  title: string;
  type: ActivityType;
  context?: ActivityContext;
  launchBlockId: string;
  launchWeekNumber: number;
  launchBlockIndex: number;
  dueInBlocks: number;
  moduleId?: string;
  description?: string;
  status: ConvActivityStatus;
  deliveredAt?: string;
}

export interface Pillar {
    name: string;
}

export interface ModuleDetails {
    name: string;
    role: string;
    significance: string;
    sintonizzazione: Pillar[];
    operativi: Pillar[];
    attivitaChiave: string[];
}

/** Periodo di Formazione Scuola-Lavoro definito a livello di corso */
export interface FslPeriod {
    id: string;
    label?: string;      // es. "PCTO Anno 3" — opzionale
    startWeek: number;   // settimana di inizio (inclusa)
    endWeek: number;     // settimana di fine (inclusa)
}

export interface ParsedProgettazione {
    modules: ModuleDetails[];           // mantenuto per retrocompatibilità
    moduleMap: Map<string, ModuleDetails>;
    contentUnits: CourseContentUnit[];  // lista flat di tutte le unità (moduli, UDA, EC, FSL)
    parsedMethodologies: TeachingMethodology[]; // metodologie trovate nel testo (ordinate per rilevanza)
}

export interface GroupDefinition {
    name: string;
    studentIds: string[];
    justification?: string;
    notes?: string;
    isComplete?: boolean;
    completionDate?: string; // ISO String
    addedStudentIds?: string[];
}

export interface BlockAllocation {
    type: 'group' | 'individual';
    // A flexible structure for now, can be typed more strictly later
    data: {
        groups?: GroupDefinition[];
        individualAssignments?: { studentId: string; objective: string }[];
    }
}

export interface ContentBlock {
    id: string;
    content: string;
}

export interface MasterLibraryEntry {
    blockId: string;
    conversationId: string;
    weekNumber: number;
    blockDay: string;
    moduleRef?: string;      // block.module
    type: 'lesson_content' | 'activity_content';
    title: string;           // block.blockTitle || block.objective || 'Blocco senza titolo'
    contentBlocks: ContentBlock[];
    createdAt?: string;
}

// --- CONSEGNE INTELLIGENTI ---
// @deprecated — sistema LessonAssignment sostituito dalla Scrivania Fonti + Abbinamento in LessonPreparationTab

export type LessonAssignmentChannel = 'classroom' | 'stampa' | 'qr_code' | 'padlet' | 'drive_link' | 'verbale';

export const LESSON_ASSIGNMENT_CHANNEL_LABELS: Record<LessonAssignmentChannel, string> = {
    classroom: 'Google Classroom',
    stampa: 'Fotocopia / Stampa',
    qr_code: 'QR Code',
    padlet: 'Padlet',
    drive_link: 'Link Drive',
    verbale: 'Consegna verbale',
};

export interface LessonAssignment {
    id: string;
    groupId: string;
    groupLabel: string;
    isIndividual: boolean;
    materialIds: string[];
    rationale: string;
    distributionChannel?: LessonAssignmentChannel;
}

// --- TIPI IN AULA ---

export interface LessonMaterial {
    id: string;
    title: string;
    url: string;
    type: 'slide' | 'video' | 'pdf' | 'paper' | 'ricerca' | 'stampa' | 'altro';
    notes?: string;
    targetAudience: 'classe' | 'gruppo' | 'studente';
    targetId?: string;
    addedAt: string;
    outputTool?: 'canva' | 'powerpoint' | 'ada_diretta' | 'gemini_immagini' | 'firefly' | 'altro';
    productionBrief?: string;
}

export interface LessonEvaluation {
    id: string;
    studentId: string;
    value: string;
    type: 'orale' | 'scritto' | 'pratico' | 'formativo' | 'altro';
    notes?: string;
    date: string;
}

export interface LessonNoteAnalysis {
    engagementLevel: 'basso' | 'medio' | 'alto';
    studentSignals: Array<{
        studentId: string;
        signal: string;
        type: 'positivo' | 'attenzione';
    }>;
    groupNotes: Array<{ groupId?: string; note: string }>;
    classNotes: string[];
    rawNotes: string;
    analyzedAt: string;
}

export interface AdaAnalysis {
    performance: string;
    highlightedStudents: string[];
    difficulties: string[];
    suggestion: string;
}

export type BlockSourceType = 'url' | 'note' | 'pdf';

export interface BlockSource {
    id: string;                     // generato con crypto.randomUUID()
    type: BlockSourceType;
    title: string;                  // nome editabile dall'insegnante
    addedAt: number;                // timestamp ms (Date.now())
    origin: 'manual' | 'promoted'; // 'promoted' = promossa dalla Webliografia automatica
    // type === 'url'
    url?: string;
    // type === 'note'
    content?: string;
    // type === 'pdf'
    fileName?: string;
    fileSize?: number;
    geminiFileId?: string;          // ID restituito da Gemini File API
    geminiFileExpiry?: number;      // timestamp ms scadenza (48h da upload)
    dbFileKey?: string;             // chiave nello store IndexedDB 'blockFiles'
}

// ── PREPARAZIONE LEZIONE — Scrivania Fonti ────────────────────────────────────
export type PrepSourceType = 'master_current' | 'master_other' | 'link' | 'youtube' | 'note';

export interface PreparationSource {
    id: string;
    type: PrepSourceType;
    label: string;
    isActive: boolean;
    addedAt: string; // ISO
    // type === 'master_other'
    blockRef?: string; // `${convoId}-${blockIndex}`
    // type === 'link' | 'youtube'
    url?: string;
    // type === 'note'
    content?: string;
}

export interface BlockDetails {
    id: string;
    day: string;
    status: BlockStatus;
    reason?: string; // For 'saltato' status
    module?: string;
    objective?: string;      // Obiettivo didattico istituzionale (il "perché" formale)
    lessonSubject?: string;  // Argomento specifico della lezione (il "cosa" concreto, es. "Vetrate gotiche")
    blockTitle?: string;     // Titolo accattivante per gli studenti (generato da Ada, radicato in lessonSubject)
    contentBlocks?: ContentBlock[];
    messages?: Message[]; // Each block has its own chat history
    allocations?: BlockAllocation; // For group/individual work
    presentStudentIds?: string[];
    lateStudentIds?: string[];
    isReviewed?: boolean; // For tracking consuntivo
    artifacts?: string[]; // For tracking generated outputs in "In Aula" view
    lessonNotes?: string; // Qualitative notes about the lesson
    adaAnalysis?: AdaAnalysis; // Structured analysis generated by Ada
    usefulLinks?: { id: string; url: string; title: string; }[];
    materialsCloudLink?: string;
    linkedNotebookIds?: string[];
    // Campi per la pianificazione dettagliata nel cruscotto
    lessonTitle?: string;
    lessonSyllabus?: string;
    lessonPlanMaterials?: string;
    isLocked?: boolean;
    // Campi strutturati per Tab In Aula
    lessonMaterials?: LessonMaterial[];
    lessonEvaluations?: LessonEvaluation[];
    lessonNoteAnalysis?: LessonNoteAnalysis;
    lessonGroups?: GroupDefinition[];
    projectDeadline?: string; // ISO String for group project deadlines
    classroomUrl?: string;   // Link diretto all'attività/compito su Google Classroom
    lessonState?: LessonState; // Ciclo di vita: progettata → in_corso → archiviata
    fonti?: BlockSource[];
    tipologia?: LessonType;
    metodologia?: TeachingMethodology; // approccio pedagogico — ortogonale a tipologia e cosa
    isFslPeriod?: boolean;  // flag periodo FSL: badge visuale, ortogonale allo stato
    hasExternalExpert?: boolean;   // lezione/lab condotto da esperto esterno
    externalExpertName?: string;   // nome/ruolo dell'esperto (es. "Arch. Rossi — studi Oma")
    isFuoriAula?: boolean;         // blocco svolto fuori dall'aula (uscita, laboratorio esterno, ecc.)
    luogo?: string;                // descrizione libera del luogo (es. "Museo del Design, Milano")
    moduleId?: string;    // riferimento a CourseModule.id
    sectionId?: string;   // riferimento a ModuleSection.id
    lessonAssignments?: LessonAssignment[];
    preparationSources?: PreparationSource[]; // Scrivania Fonti — sorgenti per Preparazione Lezione
    // Il campo module?: string rimane per retrocompatibilità DB
}

export type WeekPlanStatus = 'in progettazione' | 'progettazione completata' | 'in corso' | 'completata';

export interface WeekPlan {
    weekNumber: number;
    dates: string;
    totalBlocks: number;
    notes?: string;
    theme: string;
    status: WeekPlanStatus;
    blocks: BlockDetails[];
    students: Omit<Student, 'notes' | 'evaluations' | 'adaSummary'>[]; // Use a simpler student stub for weekly plans
    activeBlockIndex: number;
    finalReport?: {
        achievedObjectives: string;
        nextWeekFollowup: string;
    };
    completionStatus?: 'pending' | 'current' | 'completed'; // Manual override to mark week as "done" in dashboard
}

// Fix: Moved LessonWithGroups here to be shared across components.
export interface LessonWithGroups {
    convoId: string;
    weekNumber: number;
    weekTheme: string;
    blockIndex: number;
    blockDay: string;
    blockObjective?: string;
    groups: GroupDefinition[];
    sortableDate: Date;
    weekDates: string;
    projectDeadline?: string;
}

// --- Planning Action Payloads for Type Safety ---
export type UpdateBlockDayPayload = { action: 'update_block_day', blockIndex: number, day: string, updateDefault?: boolean };
export type UpdateObjectivePayload = { action: 'update_objective', blockIndex: number, newObjective: string };
export type InitializeNormalBlockPayload = { action: 'initialize_normal_block', day: string, objective: string, module: string };
export type ArchiveSimpleStatePayload = { action: 'archive_simple_state', day: string, status: 'saltato', reason: string };
export type ValidateAndArchivePayload = { action: 'validate_and_archive', messageId: string };
export type RecordGroupsPayload = { action: 'record_groups', groups: GroupDefinition[] };
// --- Content Block Management Payloads ---
export type AddValidatedContentAsNewBlockPayload = { action: 'add_validated_content_as_new_block', messageId: string };
export type ReplaceEntireMasterContentPayload = { action: 'replace_entire_master_content', messageId: string };
export type DeleteContentBlockPayload = { action: 'delete_content_block', contentBlockId: string };
export type UpdateContentBlockPayload = { action: 'update_content_block', contentBlockId: string, newContent: string };
export type ConsolidateAndUpdateContentPayload = { action: 'consolidate_and_update_content', newContent: string };


export type PlanningActionPayload =
  | InitializeNormalBlockPayload
  | ArchiveSimpleStatePayload
  | ValidateAndArchivePayload
  | RecordGroupsPayload
  | AddValidatedContentAsNewBlockPayload
  | ReplaceEntireMasterContentPayload
  | DeleteContentBlockPayload
  | UpdateContentBlockPayload
  | ConsolidateAndUpdateContentPayload
  | UpdateBlockDayPayload
  | UpdateObjectivePayload;


export interface Action {
    label: string;
    payload: PlanningActionPayload;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: GroundingSource[];
  attachment?: Attachment;
  generatedImages?: string[]; // Array of base64 data URLs
  actions?: Action[];
  actionUsed?: boolean | string; // true (legacy) o la label dell'azione usata es. 'Trasferito' | 'Aggiunto' | 'Sostituito'
}

export interface DetachedLesson {
  id: string;
  sourceBlockId: string;
  sourceWeekNumber: number;
  sourceDay: string;
  objective?: string;
  lessonTitle?: string;
  lessonSyllabus?: string;
  messages?: Message[];
  contentBlocks?: ContentBlock[];
  detachedAt: string;
  distribuita?: boolean;
  archiviata?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
weekPlan?: WeekPlan;
  studentId?: string; // Link to a student's main record
  evaluationState?: 'AWAITING_VALUE' | 'AWAITING_NOTES' | 'AWAITING_REVIEW_NOTES'; // For guided evaluation input
  tempEvaluation?: Partial<Evaluation>;
  pendingContent?: DetachedLesson[];
  modules?: CourseModule[];   // estratti dal Profilo del Corso, confermati dal docente
  activities?: Activity[];    // attività del corso (sistema DB + conversazioni)
}

export interface Mode {
  id: 'balanced' | 'formal' | 'creative' | 'analytical' | 'playful' | 'concise';
  label: string;
  stylePrompt: string;
  colorClasses: {
    badge: string;
    text: string;
    hoverBg: string;
  };
  introMessage: string;
}

export interface Notebook {
  id: string;
  title: string;
  url: string;
  notes: string;
  dateAdded: string; // ISO string
  lastAccessed: string | null; // ISO string or null
}

export interface ToolkitCategory {
  id: string;
  name: string;
  order: number;
}

export interface ToolkitShortcut {
  id: string;
  name: string;
  url: string;
  notes: string;
  categoryId: string;
  order: number;
}

// ── Attività ─────────────────────────────────────────────────────────────────

// @deprecated — sistema Activity sostituito dalla Distribuzione + Abbinamento in LessonPreparationTab
export type ActivityFormaLavoro = 'individuale' | 'coppia' | 'gruppo' | 'classe';
export type ActivityContesto = 'in_aula' | 'misto' | 'autonoma';
export type ActivityDeliverable = 'elaborato' | 'presentazione' | 'prototipo' | 'performance' | 'altro';
export type ActivityStatus = 'progettata' | 'lanciata' | 'in_corso' | 'consegnata' | 'scaduta' | 'annullata';

export interface ActivityRubricCriteria {
  id: string;
  label: string;
  description?: string;
}

export interface ActivityGroupAssignment {
  groupId: string;
  customInstructions?: string;
}

export interface ActivityStudentOverride {
  studentId: string;
  customInstructions?: string;
  supportLevel?: 'standard' | 'semplificato' | 'avanzato';
}

export interface ActivitySubmissionRecord {
  refId: string;
  refType: 'student' | 'group';
  submittedAt?: string;
  outcome?: string;
  classroomLink?: string;
}

export interface ActivityObservation {
  id: string;
  timestamp: string;
  text: string;
  refId?: string;
  refType?: 'student' | 'group' | 'activity';
  blockId?: string;
  adaInsights?: {
    sentiment?: 'positivo' | 'neutro' | 'critico';
    tags?: string[];
    alerts?: string[];
  };
}

export interface Activity {
  id: string;
  blockId: string;
  weekNumber: number;

  // MASTER ACTIVITY (progettazione)
  title: string;
  description?: string;
  objectiveLink?: string;
  formaLavoro?: ActivityFormaLavoro;   // opzionale — definito in preparazione lezione
  contesto?: ActivityContesto;
  deliverable?: ActivityDeliverable;   // opzionale — definito in preparazione lezione
  durationInBlocks?: number;           // durata in blocchi (impostata alla creazione)
  // Tracciamento lancio (retrocompatibilità con sistema conversazioni)
  launchBlockId?: string;
  launchWeekNumber?: number;
  launchBlockIndex?: number;
  rubric?: ActivityRubricCriteria[];
  sourceBlockIds?: string[];

  // BRIEFING LABORATORIO (Opzione A — chat parallela + master attività)
  messages?: Message[];                // canale chat parallelo nel Laboratorio
  masterContent?: ContentBlock[];      // contenuto master dell'attività

  // DECLINAZIONE (preparazione)
  groupAssignments?: ActivityGroupAssignment[];
  studentOverrides?: ActivityStudentOverride[];
  deadline?: string;
  classroomAssignmentUrl?: string;
  supportMaterials?: string[];
  briefingContent?: string;

  // LIFECYCLE
  status: ActivityStatus;
  launchedAt?: string;
  submissionRecords?: ActivitySubmissionRecord[];

  // OSSERVAZIONI
  observations?: ActivityObservation[];

  createdAt: string;
  updatedAt: string;
}
