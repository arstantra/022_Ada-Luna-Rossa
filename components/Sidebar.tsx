import React, { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import type { Conversation, Label, WeekPlanStatus, BlockDetails, Mode, Message } from '../types';
import { SparklesIcon, TrashIcon, BookOpenIcon, SearchIcon, ImageIcon, TagIcon, DotsVerticalIcon, XIcon, PresentationChartBarIcon, ClipboardListIcon, CalendarIcon, UsersIcon, FolderIcon, ChevronDownIcon, ChatBubbleOvalLeftEllipsisIcon, ArrowUpTrayIcon, BriefcaseIcon, ArrowDownTrayIcon, DocumentTextIcon, PencilIcon, ToolboxIcon, ClipboardDocumentCheckIcon, CalendarDaysIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';
import { LABEL_COLORS } from '../constants';
import ModeSelector from './ModeSelector';
import { getBlockPlanningStatus } from '../utils';

// Helper function for block status
const getStatusInfo = (block: BlockDetails | undefined): { color: string, label: string } => {
    const status = getBlockPlanningStatus(block);

    switch (status) {
        case 'da_definire': return { color: 'bg-red-500', label: 'Da Definire' };
        
        case 'da_progettare':
        case 'in_progettazione':
        case 'in_revisione':
            return { color: 'bg-amber-500', label: 'In Progettazione' };
        
        case 'concluso': return { color: 'bg-green-500', label: 'Concluso' };

        case 'saltato': return { color: 'bg-gray-600', label: 'Saltato' };
        case 'fsl': return { color: 'bg-sky-500', label: 'Scuola-Lavoro' };
        case 'annullato': return { color: 'bg-gray-600', label: 'Annullato' };
        
        case 'sconosciuto':
        default:
            return { color: 'bg-gray-600', label: 'Sconosciuto' };
    }
};


const BlockStatusIndicator: React.FC<{ blocks: BlockDetails[] }> = memo(({ blocks }) => {
    return (
        <div className="flex items-center gap-1.5 flex-shrink-0">
            {Array.from({ length: 3 }).map((_, index) => {
                const block = blocks[index];
                const { color, label } = getStatusInfo(block);
                return (
                    <div
                        key={index}
                        className={`w-2 h-2 rounded-full ${color}`}
                        title={`Blocco ${index + 1}: ${label}`}
                    />
                );
            })}
        </div>
    );
});

// Fix: Defined ActiveView type based on its usage in MainApp.tsx
type ActiveView = 'lobby' | 'chat' | 'planning' | 'roster' | 'notebooklm' | 'in_aula' | 'student_profile' | 'classroom_trend' | 'founding_documents' | 'toolkit' | 'strategic_dashboard' | 'groups_archive';

// Fix: Defined Section type based on collapsible section identifiers
type Section = 'progettazione' | 'archivio' | 'registri' | 'gestione';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeView: ActiveView;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onReorderConversations: (draggedId: string, targetId: string) => void;
  onOpenInstructions: () => void;
  onOpenImageGenerator: () => void;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
  currentModeId: Mode['id'];
  onModeChange: (modeId: Mode['id']) => void;
  labels: Label[];
  onOpenLabelManager: () => void;
  onOpenAssignLabels: (conversation: Conversation) => void;
  onOpenStudentRoster: () => void;
  onOpenNotebookLM: () => void;
  onOpenInAula: () => void;
  onOpenClassroomTrend: () => void;
  onOpenGroupsArchive: () => void;
  onOpenFoundingDocuments: () => void;
  onOpenTeacherProfile: () => void;
  onOpenToolkit: () => void;
  onOpenStrategicDashboard: () => void;
  onOpenBlockDayDefaults: () => void;
  onSaveInstructions: (context: string) => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportCourseBook: () => void;
  onOpenApiSettings: () => void;
}

const ConversationTab: React.FC<{
  conversation: Conversation;
  isActive: boolean;
  allLabels: Label[];
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onInitiateDelete: (conversation: Conversation) => void;
  onOpenAssignLabels: (conversation: Conversation) => void;
  onFilterByLabel: (label: Label) => void;
}> = memo(({ conversation, isActive, allLabels, onSelect, onRename, onInitiateDelete, onOpenAssignLabels, onFilterByLabel }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(conversation.title);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isPlanningConvo = !!conversation.weekPlan;
  const displayTitle = isPlanningConvo
    ? `Settimana ${conversation.weekPlan.weekNumber} (${conversation.weekPlan.dates})`
    : conversation.title;

  const conversationLabels = useMemo(() => 
    (conversation.labelIds ?? [])
      .map(id => allLabels.find(l => l.id === id))
      .filter((l): l is Label => !!l),
    [conversation.labelIds, allLabels]
  );
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);
  
  useEffect(() => {
    if (!isEditing) setTempTitle(conversation.title);
  }, [conversation.title, isEditing]);


  const handleStartEditing = () => {
    setIsEditing(true);
    setIsMenuOpen(false);
  };

  const handleSaveRename = () => {
    if (tempTitle.trim() && tempTitle.trim() !== conversation.title) onRename(conversation.id, tempTitle.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveRename();
    else if (e.key === 'Escape') setIsEditing(false);
  };
  
  return (
    <div className={`group relative rounded-md transition-colors ${isActive ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
        <div className="flex items-center justify-between w-full pl-3 pr-2 py-2">
            {isEditing && !isPlanningConvo ? (
                 <input
                    ref={inputRef} type="text" value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)} onBlur={handleSaveRename} onKeyDown={handleKeyDown}
                    className="flex-grow w-full text-sm font-medium bg-gray-600 text-white border-none focus:ring-2 focus:ring-blue-500 outline-none rounded"
                />
            ) : (
              <div onClick={() => onSelect(conversation.id)} className="flex items-center gap-3 flex-grow cursor-pointer overflow-hidden">
                <div className="flex-grow overflow-hidden">
                    <div className="flex items-center justify-between pr-1">
                        <p className="text-sm font-medium truncate text-white">{displayTitle}</p>
                        {isPlanningConvo && <BlockStatusIndicator blocks={conversation.weekPlan.blocks} />}
                    </div>
                    {!isPlanningConvo && conversationLabels.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                        {conversationLabels.slice(0, 3).map(label => {
                            const color = LABEL_COLORS.find(c => c.key === label.color) || LABEL_COLORS[0];
                            return <button key={label.id} onClick={(e) => { e.stopPropagation(); onFilterByLabel(label);}} className={`px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text} ${color.ring} hover:opacity-80 transition-opacity`}>{label.name}</button>
                        })}
                        {conversationLabels.length > 3 && <span className="text-xs text-gray-400 font-medium">+ {conversationLabels.length - 3}</span>}
                        </div>
                    )}
                </div>
              </div>
            )}
            {!isEditing && (
              <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={(e) => { e.stopPropagation(); onInitiateDelete(conversation); }} className="p-1 rounded-md text-gray-400 hover:bg-red-500/20 hover:text-red-400" aria-label="Elimina"><TrashIcon className="h-4 w-4" /></button>
                 <div className="relative" ref={menuRef}>
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(o => !o); }} className="p-1 rounded-md text-gray-400 hover:bg-gray-600 hover:text-white" aria-label="Altre opzioni"><DotsVerticalIcon className="h-4 w-4" /></button>
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700/50 rounded-lg shadow-2xl z-20 p-1.5 animate-fade-in-down">
                        {!isPlanningConvo && (
                           <>
                            <button onClick={handleStartEditing} className="w-full text-left p-2 rounded-md text-sm text-gray-200 hover:bg-gray-700">Rinomina</button>
                            <button onClick={() => { onOpenAssignLabels(conversation); setIsMenuOpen(false); }} className="w-full text-left p-2 rounded-md text-sm text-gray-200 hover:bg-gray-700">Assegna Etichette</button>
                           </>
                        )}
                      </div>
                    )}
                 </div>
              </div>
            )}
        </div>
    </div>
  );
});

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = memo(({ title, icon, children, isOpen, onToggle }) => {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-200 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="pl-4 pt-2 pb-1 space-y-1">
              {children}
          </div>
        </div>
      </div>
    </div>
  );
});


const Sidebar: React.FC<SidebarProps> = ({
  conversations, activeConversationId, activeView, onNewConversation, onSelectConversation,
  onRenameConversation, onDeleteConversation, onReorderConversations, onOpenInstructions,
  onOpenImageGenerator, onOpenInAula, onOpenClassroomTrend, onOpenGroupsArchive,
  onShowToast, labels, onOpenLabelManager, onOpenAssignLabels, onOpenStudentRoster,
  onOpenNotebookLM, onOpenFoundingDocuments, onOpenTeacherProfile, onOpenStrategicDashboard,
  onSaveInstructions, onOpenToolkit, onExportData, onImportData, onOpenBlockDayDefaults,
  onExportCourseBook, onOpenApiSettings,
  currentModeId, onModeChange
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [activeLabelFilter, setActiveLabelFilter] = useState<Label | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>('progettazione');
  
  const instructionImportRef = useRef<HTMLInputElement>(null);

  const toggleSection = useCallback((section: Section) => {
    setOpenSection(prev => (prev === section ? null : section));
  }, []);

  const handleInitiateDelete = useCallback((convo: Conversation) => setDeletingConversation(convo), []);
  
  const handleConfirmDelete = useCallback(() => {
    if (deletingConversation) onDeleteConversation(deletingConversation.id);
    setDeletingConversation(null);
  }, [deletingConversation, onDeleteConversation]);
  
  const handleFileImport = useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    saveFunction: (content: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        saveFunction(text);
        onShowToast('Contesto importato con successo!', 'success');
    };
    reader.onerror = () => onShowToast('Errore durante la lettura del file.', 'error');
    reader.readAsText(file);
    event.target.value = ''; // Reset input to allow re-uploading the same file
  }, [onShowToast]);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedItemId(id);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== targetId) onReorderConversations(draggedId, targetId);
    setDraggedItemId(null);
  }, [onReorderConversations]);
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveLabelFilter(query.startsWith('#') ? labels.find(l => l.name.toLowerCase() === query.substring(1).toLowerCase()) || null : null);
  }, [labels]);
  
  const handleFilterByLabel = useCallback((label: Label) => {
    setActiveLabelFilter(label);
    setSearchQuery(`#${label.name}`);
    setIsSearchVisible(true);
  }, []);

  const clearFilter = useCallback(() => {
    setActiveLabelFilter(null);
    setSearchQuery('');
  }, []);

  const filteredConversations = useMemo(() => {
    if (activeLabelFilter) return conversations.filter(convo => convo.labelIds?.includes(activeLabelFilter.id));
    const query = searchQuery.toLowerCase();
    return query ? conversations.filter(convo => convo.title.toLowerCase().includes(query)) : conversations;
  }, [conversations, searchQuery, activeLabelFilter]);

  return (
    <>
      <div className="flex flex-col w-80 bg-gray-800 border-r border-gray-700/50">
          {/* Hidden file inputs for quick import */}
          <input type="file" ref={instructionImportRef} onChange={(e) => handleFileImport(e, onSaveInstructions)} accept=".txt,.md" className="hidden" />

        <div className="flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-6 w-6 text-purple-400" />
                    <span className="text-lg font-bold text-white">Ada</span>
                </div>
                <div className="flex items-center gap-2">
                    <ModeSelector currentModeId={currentModeId} onModeChange={onModeChange} />
                    <button onClick={() => setIsSearchVisible(v => !v)} className="p-2 text-gray-400 rounded-full hover:bg-gray-700 transition-colors" aria-label="Cerca conversazione">
                        <SearchIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            
            {/* New Conversation Button and Search */}
            <div className="p-4 space-y-4 border-b border-gray-700/50">
                {isSearchVisible && (
                    <div className="relative animate-fade-in-down">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><SearchIcon className="h-4 w-4 text-gray-400" /></span>
                        <input 
                            type="search" 
                            placeholder="Cerca o filtra con #" 
                            value={searchQuery} 
                            onChange={handleSearchChange} 
                            className="w-full block pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                            autoFocus
                        />
                         <button onClick={() => { setIsSearchVisible(false); clearFilter(); }} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white">
                            <XIcon className="h-4 w-4"/>
                        </button>
                    </div>
                )}
                {activeLabelFilter && (
                    <div className="flex items-center justify-between bg-gray-800/50 rounded-md px-2 py-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Filtro:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(LABEL_COLORS.find(c => c.key === activeLabelFilter.color) || LABEL_COLORS[0]).bg} ${(LABEL_COLORS.find(c => c.key === activeLabelFilter.color) || LABEL_COLORS[0]).text}`}>{activeLabelFilter.name}</span>
                        </div>
                        <button onClick={clearFilter} className="p-0.5 rounded-full text-gray-500 hover:bg-gray-700 hover:text-white"><XIcon className="h-3 w-3"/></button>
                    </div>
                )}
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1 py-4">
          {filteredConversations.map((convo) => (
            <div key={convo.id} draggable onDragStart={(e) => handleDragStart(e, convo.id)} onDragEnd={() => setDraggedItemId(null)} onDrop={(e) => handleDrop(e, convo.id)} onDragOver={(e) => e.preventDefault()} className={`rounded-md transition-opacity cursor-grab active:cursor-grabbing ${draggedItemId === convo.id ? 'opacity-30' : ''}`}>
                <ConversationTab conversation={convo} isActive={activeConversationId === convo.id} allLabels={labels} onSelect={onSelectConversation} onRename={onRenameConversation} onInitiateDelete={handleInitiateDelete} onOpenAssignLabels={onOpenAssignLabels} onFilterByLabel={handleFilterByLabel} />
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700/50 flex-shrink-0 space-y-2">
            <button onClick={onNewConversation} className={`w-full flex items-center gap-3 px-3 py-2.5 text-base font-semibold rounded-lg transition-colors ${activeView === 'chat' && !activeConversationId?.includes('week') ? 'bg-gray-700 text-white' : 'text-gray-200 hover:bg-gray-700/70 hover:text-white'}`}><ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-pink-400" />Conversa con Ada</button>
            <button onClick={onOpenStrategicDashboard} className={`w-full flex items-center gap-3 px-3 py-2.5 text-base font-semibold rounded-lg transition-colors ${activeView === 'strategic_dashboard' ? 'bg-gray-700 text-white' : 'text-gray-200 hover:bg-gray-700/70 hover:text-white'}`}><ClipboardDocumentCheckIcon className="h-6 w-6 text-yellow-400" />Visione d'Insieme</button>
            <div className="pt-2 space-y-1">
                 <CollapsibleSection
                  title="Laboratori e Strumenti"
                  icon={<CalendarIcon className="h-5 w-5 text-blue-400" />}
                  isOpen={openSection === 'progettazione'}
                  onToggle={() => toggleSection('progettazione')}
                >
                    <button onClick={onOpenToolkit} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'toolkit' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><ToolboxIcon className="h-5 w-5" />Toolkit</button>
                    <button onClick={onOpenImageGenerator} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><ImageIcon className="h-5 w-5" />Atelier Visivo</button>
                </CollapsibleSection>
                
                <CollapsibleSection
                  title="Archivio Lezioni"
                  icon={<BookOpenIcon className="h-5 w-5 text-amber-400" />}
                  isOpen={openSection === 'archivio'}
                  onToggle={() => toggleSection('archivio')}
                >
                    <button onClick={onOpenInAula} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'in_aula' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><BriefcaseIcon className="h-5 w-5" />In Aula</button>
                    <button onClick={onOpenNotebookLM} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'notebooklm' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><BookOpenIcon className="h-5 w-5" />I Miei Notebook</button>
                </CollapsibleSection>
                
                <CollapsibleSection
                  title="Registri e Valutazioni"
                  icon={<ClipboardListIcon className="h-5 w-5 text-teal-400" />}
                  isOpen={openSection === 'registri'}
                  onToggle={() => toggleSection('registri')}
                >
                    <button onClick={onOpenClassroomTrend} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'classroom_trend' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><PresentationChartBarIcon className="h-5 w-5" />Andamento Aula</button>
                    <button onClick={onOpenGroupsArchive} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'groups_archive' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><UsersIcon className="h-5 w-5" />Gruppi</button>
                    <button onClick={onOpenStudentRoster} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'roster' || activeView === 'student_profile' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><UsersIcon className="h-5 w-5" />Studentesse</button>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Gestione del Corso"
                  icon={<UsersIcon className="h-5 w-5 text-gray-400" />}
                  isOpen={openSection === 'gestione'}
                  onToggle={() => toggleSection('gestione')}
                >
                    <button onClick={onOpenFoundingDocuments} className={`w-full flex items-center gap-3 px-2 py-2 text-sm font-normal rounded-md transition-colors ${activeView === 'founding_documents' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'}`}><DocumentTextIcon className="h-5 w-5" />Documenti Fondanti</button>
                    <button onClick={onOpenTeacherProfile} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><PencilIcon className="h-5 w-5" />Profilo Docente</button>
                    <button onClick={onOpenBlockDayDefaults} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><CalendarDaysIcon className="h-5 w-5" />Imposta Giorni Predefiniti</button>
                    <div className="group w-full flex items-center justify-between text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors">
                        <button onClick={onOpenInstructions} className="flex-grow flex items-center gap-3 px-2 py-2 text-left"><SparklesIcon className="h-5 w-5" />Personalità di Ada</button>
                        <button onClick={() => instructionImportRef.current?.click()} className="p-2 mr-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-600/50 transition-opacity" title="Importa da file"><ArrowUpTrayIcon className="h-4 w-4" /></button>
                    </div>
                    <button onClick={onOpenLabelManager} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><TagIcon className="h-5 w-5" />Gestisci Etichette</button>
                    <button onClick={onExportData} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><ArrowDownTrayIcon className="h-5 w-5" />Esporta Backup</button>
                    <button onClick={onImportData} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><ArrowUpTrayIcon className="h-5 w-5" />Importa Backup</button>
                    <button onClick={onExportCourseBook} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-300 rounded-md hover:bg-gray-700/70 hover:text-white transition-colors"><BookOpenIcon className="h-5 w-5" />Esporta Libro del Corso</button>
                    <button onClick={onOpenApiSettings} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-normal text-gray-500 rounded-md hover:bg-gray-700/70 hover:text-gray-300 transition-colors"><SparklesIcon className="h-5 w-5" />Chiave API Gemini</button>
                </CollapsibleSection>
            </div>
            <div className="text-xs text-center text-gray-500 pt-4">Ada Gemini - Laboratorio di Design</div>
        </div>
      </div>
      <ConfirmationModal isOpen={!!deletingConversation} onClose={() => setDeletingConversation(null)} onConfirm={handleConfirmDelete} title="Conferma Eliminazione">
        {`Vuoi davvero eliminare la conversazione "${deletingConversation?.title}"? L'azione non può essere annullata.`}
      </ConfirmationModal>
    </>
  );
};

export default memo(Sidebar);