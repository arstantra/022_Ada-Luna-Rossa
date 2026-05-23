import React, { useState, useRef, useCallback } from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon, ClipboardDocumentCheckIcon,
  BookOpenIcon, ClipboardListIcon, UsersIcon,
  BriefcaseIcon, PresentationChartBarIcon, ToolboxIcon,
  ImageIcon, DocumentTextIcon, PencilIcon, SparklesIcon,
  TagIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, CalendarDaysIcon,
  ChevronDownIcon, FolderOpenIcon, WandIcon,
} from './Icons';
import ConfirmationModal from './ConfirmationModal';

// ── tipi ──────────────────────────────────────────────────────────────────────
export type ActiveView =
  | 'lobby' | 'chat' | 'planning' | 'roster' | 'notebooklm'
  | 'lezione_in_corso' | 'archivio_lezioni'
  | 'student_profile' | 'classroom_trend' | 'founding_documents'
  | 'toolkit' | 'strategic_dashboard' | 'groups_archive' | 'gantt';

interface SidebarProps {
  activeView: ActiveView;

  // Conversa con Ada
  onOpenConversaConAda: () => void;

  // Contenuti del corso
  onOpenStrategicDashboard: () => void;
  onOpenGantt: () => void;
  onOpenToolkit: () => void;
  onOpenImageGenerator: () => void;

  // In Aula
  onOpenLezioneinCorso: () => void;
  onOpenArchivioLezioni: () => void;
  onOpenNotebookLM: () => void;
  hasActiveLessons: boolean;

  // Monitoraggio
  onOpenClassroomTrend: () => void;
  onOpenGroupsArchive: () => void;
  onOpenStudentRoster: () => void;

  // Gestione del Corso
  onOpenFoundingDocuments: () => void;
  onOpenTeacherProfile: () => void;
  onOpenBlockDayDefaults: () => void;
  onOpenInstructions: () => void;
  onOpenLabelManager: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportCourseBook: () => void;
  onOpenApiSettings: () => void;
  onSaveInstructions: (context: string) => void;

  // Disciplina
  disciplina: string;
  onSaveDisciplina: (value: string) => void;

  // Misc
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

// ── Label di sezione collassabile ─────────────────────────────────────────────
// Stessa estetica di SectionLabel ma cliccabile con chevron
const CollapsibleSectionLabel: React.FC<{
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ children, isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-2 pt-5 pb-1.5 group select-none"
    aria-expanded={isOpen}
  >
    <span className="text-[10px] font-mono tracking-[0.14em] uppercase text-gray-500 group-hover:text-gray-400 transition-colors">
      {children}
    </span>
    <ChevronDownIcon
      className={`h-3 w-3 text-gray-600 group-hover:text-gray-500 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`}
    />
  </button>
);

// ── Contenuto collassabile ────────────────────────────────────────────────────
const CollapsibleContent: React.FC<{ isOpen: boolean; children: React.ReactNode }> = ({ isOpen, children }) => (
  <div className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="overflow-hidden">
      {children}
    </div>
  </div>
);

// ── Sezione collassabile con icona (per sotto-sezioni tipo "Laboratori") ──────
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ title, icon, children, isOpen, onToggle }) => (
  <div>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-800/60 hover:text-white transition-colors"
      aria-expanded={isOpen}
    >
      <div className="flex items-center gap-3">{icon}<span>{title}</span></div>
      <ChevronDownIcon className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <div className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <div className="pl-3 pt-1 pb-1 space-y-0.5">{children}</div>
      </div>
    </div>
  </div>
);

// ── Voce di navigazione ───────────────────────────────────────────────────────
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
  indent?: boolean;
  disabled?: boolean;
}> = ({ icon, label, isActive, onClick, badge, indent, disabled }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`relative w-full flex items-center gap-3 px-2 py-2 text-sm rounded-lg transition-all duration-150
      ${indent ? 'pl-4' : ''}
      ${disabled
        ? 'opacity-30 cursor-not-allowed text-gray-500'
        : isActive
          ? 'bg-gray-700/70 text-white'
          : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
      }`}
  >
    {isActive && !indent && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-purple-400/80" />
    )}
    {icon}
    <span className="flex-1 text-left">{label}</span>
    {disabled && (
      <span className="text-[8px] font-mono tracking-widest text-gray-600 uppercase border border-gray-700/80 rounded px-1 py-0.5 leading-none">
        API
      </span>
    )}
    {!disabled && badge}
  </button>
);

// ── Componente principale ─────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onOpenConversaConAda,
  onOpenStrategicDashboard, onOpenGantt, onOpenToolkit, onOpenImageGenerator,
  onOpenLezioneinCorso, onOpenArchivioLezioni, onOpenNotebookLM, hasActiveLessons,
  onOpenClassroomTrend, onOpenGroupsArchive, onOpenStudentRoster,
  onOpenFoundingDocuments, onOpenTeacherProfile, onOpenBlockDayDefaults,
  onOpenInstructions, onOpenLabelManager, onExportData, onImportData,
  onExportCourseBook, onOpenApiSettings, onSaveInstructions,
  disciplina, onSaveDisciplina,
  onShowToast,
}) => {
  const [contenutoOpen, setContenutoOpen] = useState(true);
  const [inAulaOpen, setInAulaOpen] = useState(true);
  const [monitoraggioOpen, setMonitoraggioOpen] = useState(true);
  const [gestioneOpen, setGestioneOpen] = useState(false);
  const [strumentiOpen, setStrumentiOpen] = useState(false);
  const [isDisciplinaEditing, setIsDisciplinaEditing] = useState(false);
  const [disciplinaTemp, setDisciplinaTemp] = useState(disciplina);
  const disciplinaInputRef = useRef<HTMLInputElement>(null);
  const instructionImportRef = useRef<HTMLInputElement>(null);

  // Sync disciplina when prop changes
  React.useEffect(() => { setDisciplinaTemp(disciplina); }, [disciplina]);
  React.useEffect(() => { if (isDisciplinaEditing) disciplinaInputRef.current?.focus(); }, [isDisciplinaEditing]);

  const handleDisciplinaSave = useCallback(() => {
    onSaveDisciplina(disciplinaTemp.trim());
    setIsDisciplinaEditing(false);
  }, [disciplinaTemp, onSaveDisciplina]);

  const handleDisciplinaKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleDisciplinaSave();
    else if (e.key === 'Escape') { setDisciplinaTemp(disciplina); setIsDisciplinaEditing(false); }
  }, [handleDisciplinaSave, disciplina]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onSaveInstructions(text);
      onShowToast('Contesto importato con successo!', 'success');
    };
    reader.onerror = () => onShowToast('Errore durante la lettura del file.', 'error');
    reader.readAsText(file);
    e.target.value = '';
  }, [onSaveInstructions, onShowToast]);

  return (
    <div className="flex flex-col w-72 bg-gray-900 border-r border-gray-600/55 flex-shrink-0 shadow-[4px_0_32px_rgba(0,0,0,0.75)]">
      <input
        type="file"
        ref={instructionImportRef}
        onChange={handleFileImport}
        accept=".txt,.md"
        className="hidden"
      />

      {/* ── Conversa con Ada ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 border-b border-gray-600/40 bg-gray-900/80 shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
        <button
          onClick={onOpenConversaConAda}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
            ${activeView === 'chat'
              ? 'bg-gradient-to-r from-purple-900/60 to-purple-900/25 text-white border border-purple-600/40 shadow-sm shadow-purple-900/30'
              : 'text-gray-300 hover:bg-gray-800/70 hover:text-white border border-gray-700/40 hover:border-gray-600/50'
            }`}
        >
          <ChatBubbleOvalLeftEllipsisIcon className={`h-5 w-5 flex-shrink-0 transition-colors ${activeView === 'chat' ? 'text-purple-400' : 'text-gray-400'}`} />
          <span className="leading-tight">Conversa con Ada</span>
        </button>
      </div>

      {/* ── Navigazione ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">

        {/* CONTENUTI DEL CORSO */}
        <CollapsibleSectionLabel isOpen={contenutoOpen} onToggle={() => setContenutoOpen(o => !o)}>
          Contenuti del Corso
        </CollapsibleSectionLabel>
        <CollapsibleContent isOpen={contenutoOpen}>
          <div className="space-y-0.5">
            <NavItem
              icon={<ClipboardDocumentCheckIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Progettazione del Corso"
              isActive={activeView === 'strategic_dashboard'}
              onClick={onOpenStrategicDashboard}
            />
            <NavItem
              icon={<CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Gantt del Corso"
              isActive={activeView === 'gantt'}
              onClick={onOpenGantt}
            />
            <CollapsibleSection
              title="Laboratori e Strumenti"
              icon={<ToolboxIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              isOpen={strumentiOpen}
              onToggle={() => setStrumentiOpen(o => !o)}
            >
              <NavItem
                icon={<WandIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                label="Toolkit"
                isActive={activeView === 'toolkit'}
                onClick={onOpenToolkit}
                indent
              />
              <NavItem
                icon={<ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                label="Atelier Visivo"
                isActive={false}
                onClick={onOpenImageGenerator}
                indent
                disabled
              />
            </CollapsibleSection>
          </div>
        </CollapsibleContent>

        {/* IN AULA */}
        <CollapsibleSectionLabel isOpen={inAulaOpen} onToggle={() => setInAulaOpen(o => !o)}>
          In Aula
        </CollapsibleSectionLabel>
        <CollapsibleContent isOpen={inAulaOpen}>
          <div className="space-y-0.5">
            <NavItem
              icon={<BriefcaseIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Lezione in Corso"
              isActive={activeView === 'lezione_in_corso'}
              onClick={onOpenLezioneinCorso}
              badge={
                hasActiveLessons
                  ? <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  : undefined
              }
            />
            <NavItem
              icon={<FolderOpenIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Archivio Lezioni"
              isActive={activeView === 'archivio_lezioni'}
              onClick={onOpenArchivioLezioni}
            />
            <NavItem
              icon={<BookOpenIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="I Miei Notebook"
              isActive={activeView === 'notebooklm'}
              onClick={onOpenNotebookLM}
            />
          </div>
        </CollapsibleContent>

        {/* MONITORAGGIO */}
        <CollapsibleSectionLabel isOpen={monitoraggioOpen} onToggle={() => setMonitoraggioOpen(o => !o)}>
          Monitoraggio
        </CollapsibleSectionLabel>
        <CollapsibleContent isOpen={monitoraggioOpen}>
          <div className="space-y-0.5">
            <NavItem
              icon={<PresentationChartBarIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Andamento Aula"
              isActive={activeView === 'classroom_trend'}
              onClick={onOpenClassroomTrend}
            />
            <NavItem
              icon={<UsersIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Gruppi"
              isActive={activeView === 'groups_archive'}
              onClick={onOpenGroupsArchive}
            />
            <NavItem
              icon={<ClipboardListIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              label="Studentesse"
              isActive={activeView === 'roster' || activeView === 'student_profile'}
              onClick={onOpenStudentRoster}
            />
          </div>
        </CollapsibleContent>

        {/* GESTIONE DEL CORSO */}
        <CollapsibleSectionLabel isOpen={gestioneOpen} onToggle={() => setGestioneOpen(o => !o)}>
          Gestione del Corso
        </CollapsibleSectionLabel>
        <CollapsibleContent isOpen={gestioneOpen}>
          <div className="space-y-0.5 pb-1">
            {/* Campo Disciplina */}
            <div className="mx-1 mb-2 mt-1 px-2 py-2 rounded-lg bg-gray-800/60 border border-gray-700/40">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1.5">Disciplina / Corso</p>
              {isDisciplinaEditing ? (
                <input
                  ref={disciplinaInputRef}
                  type="text"
                  value={disciplinaTemp}
                  onChange={e => setDisciplinaTemp(e.target.value)}
                  onBlur={handleDisciplinaSave}
                  onKeyDown={handleDisciplinaKeyDown}
                  placeholder="es. Matematica, Design, Storia…"
                  className="w-full bg-gray-900 border border-purple-500/40 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500/60"
                />
              ) : (
                <button
                  onClick={() => setIsDisciplinaEditing(true)}
                  className="w-full text-left px-2 py-1 rounded-md text-sm hover:bg-gray-700/50 group flex items-center justify-between transition-colors"
                >
                  <span className={disciplina ? 'text-purple-300 font-medium' : 'text-gray-600 italic'}>
                    {disciplina || 'Clicca per impostare…'}
                  </span>
                  <PencilIcon className="h-3 w-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            <NavItem icon={<DocumentTextIcon className="h-4 w-4 flex-shrink-0" />} label="Documenti Fondanti" isActive={activeView === 'founding_documents'} onClick={onOpenFoundingDocuments} indent />
            <NavItem icon={<PencilIcon className="h-4 w-4 flex-shrink-0" />} label="Profilo Docente" isActive={false} onClick={onOpenTeacherProfile} indent />
            <NavItem icon={<CalendarDaysIcon className="h-4 w-4 flex-shrink-0" />} label="Giorni Predefiniti" isActive={false} onClick={onOpenBlockDayDefaults} indent />

            <div className="group flex items-center justify-between rounded-lg hover:bg-gray-800/60 transition-colors">
              <button onClick={onOpenInstructions} className="flex-grow flex items-center gap-3 pl-4 pr-2 py-2 text-sm text-gray-400 hover:text-gray-200">
                <SparklesIcon className="h-4 w-4 flex-shrink-0" />
                <span>Personalità di Ada</span>
              </button>
              <button onClick={() => instructionImportRef.current?.click()} className="p-2 mr-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-700/50 transition-opacity text-gray-500" title="Importa da file">
                <ArrowUpTrayIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <NavItem icon={<TagIcon className="h-4 w-4 flex-shrink-0" />} label="Gestisci Etichette" isActive={false} onClick={onOpenLabelManager} indent />
            <NavItem icon={<ArrowDownTrayIcon className="h-4 w-4 flex-shrink-0" />} label="Esporta Backup" isActive={false} onClick={onExportData} indent />
            <NavItem icon={<ArrowUpTrayIcon className="h-4 w-4 flex-shrink-0" />} label="Importa Backup" isActive={false} onClick={onImportData} indent />
            <NavItem icon={<BookOpenIcon className="h-4 w-4 flex-shrink-0" />} label="Esporta Libro del Corso" isActive={false} onClick={onExportCourseBook} indent />
            <NavItem icon={<SparklesIcon className="h-4 w-4 flex-shrink-0 text-gray-600" />} label="Chiave API Gemini" isActive={false} onClick={onOpenApiSettings} indent />
          </div>
        </CollapsibleContent>

      </nav>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800/30">
        <p className="text-[10px] text-center text-gray-700 font-mono">
          Ada · NuovaDidattica.eu
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
