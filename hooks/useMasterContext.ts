// hooks/useMasterContext.ts
import { useState, useEffect, useCallback } from 'react';
import * as db from '../services/db';
import type { Mode, WeekEntry } from '../types';
import {
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_PROGETTAZIONE,
  DEFAULT_ROUTE_CONTEXT,
  DEFAULT_CREW_CONTEXT,
  DEFAULT_RULES_CONTEXT,
  DEFAULT_TEACHER_PROFILE,
  DEFAULT_MODE_ID,
  MODES,
  LOCAL_STORAGE_INSTRUCTION_KEY,
  LOCAL_STORAGE_PROGETTAZIONE_KEY,
  LOCAL_STORAGE_ROUTE_KEY,
  LOCAL_STORAGE_CREW_KEY,
  LOCAL_STORAGE_RULES_KEY,
  LOCAL_STORAGE_TEACHER_KEY,
  LOCAL_STORAGE_MODE_KEY,
  LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY,
  LOCAL_STORAGE_ROUTE_CALENDAR_KEY,
  LOCAL_STORAGE_DISCIPLINA_KEY,
  DEFAULT_DISCIPLINA,
  LOCAL_STORAGE_PTOF_EXTRACT_KEY,
  LOCAL_STORAGE_PTOF_NOTEBOOK_URL_KEY,
} from '../constants';

export const useMasterContext = () => {
    const [systemInstruction, setSystemInstruction] = useState('');
    const [progettazione, setProgettazione] = useState('');
    const [routeContext, setRouteContext] = useState('');
    const [crewContext, setCrewContext] = useState('');
    const [rulesContext, setRulesContext] = useState('');
    const [teacherProfile, setTeacherProfile] = useState('');
    const [disciplina, setDisciplina] = useState('');
    const [ptofExtract, setPtofExtract] = useState('');
    const [ptofNotebookUrl, setPtofNotebookUrl] = useState('');
    const [blockDayDefaults, setBlockDayDefaults] = useState<Record<string, string>>({});
    const [routeCalendar, setRouteCalendar] = useState<WeekEntry[]>([]);
    const [currentModeId, setCurrentModeId] = useState<Mode['id']>(DEFAULT_MODE_ID);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadContexts() {
            try {
                // Helper to load a setting from DB or seed it from a default value.
                const loadOrSeedSetting = async (key: string, defaultValue: string, setter: (value: string) => void) => {
                    const savedValue = await db.getSetting(key);
                    if (savedValue !== null && savedValue !== undefined) {
                        setter(savedValue);
                    } else {
                        setter(defaultValue);
                        await db.saveSetting(key, defaultValue);
                    }
                };

                await Promise.all([
                    loadOrSeedSetting(LOCAL_STORAGE_INSTRUCTION_KEY, DEFAULT_SYSTEM_INSTRUCTION, setSystemInstruction),
                    loadOrSeedSetting(LOCAL_STORAGE_PROGETTAZIONE_KEY, DEFAULT_PROGETTAZIONE, setProgettazione),
                    loadOrSeedSetting(LOCAL_STORAGE_ROUTE_KEY, DEFAULT_ROUTE_CONTEXT, setRouteContext),
                    loadOrSeedSetting(LOCAL_STORAGE_CREW_KEY, DEFAULT_CREW_CONTEXT, setCrewContext),
                    loadOrSeedSetting(LOCAL_STORAGE_RULES_KEY, DEFAULT_RULES_CONTEXT, setRulesContext),
                    loadOrSeedSetting(LOCAL_STORAGE_TEACHER_KEY, DEFAULT_TEACHER_PROFILE, setTeacherProfile),
                    loadOrSeedSetting(LOCAL_STORAGE_DISCIPLINA_KEY, DEFAULT_DISCIPLINA, setDisciplina),
                    loadOrSeedSetting(LOCAL_STORAGE_PTOF_EXTRACT_KEY, '', setPtofExtract),
                    loadOrSeedSetting(LOCAL_STORAGE_PTOF_NOTEBOOK_URL_KEY, '', setPtofNotebookUrl),
                ]);

                // Load route calendar (JSON array of WeekEntry)
                const calendarJson = await db.getSetting(LOCAL_STORAGE_ROUTE_CALENDAR_KEY);
                if (calendarJson) {
                    try { setRouteCalendar(JSON.parse(calendarJson)); }
                    catch (e) { console.error("Failed to parse route calendar, resetting.", e); setRouteCalendar([]); }
                }

                // Load block day defaults separately as it's JSON
                const defaultsJson = await db.getSetting(LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY);
                if (defaultsJson) {
                    try {
                        setBlockDayDefaults(JSON.parse(defaultsJson));
                    } catch (e) {
                        console.error("Failed to parse block day defaults, resetting.", e);
                        setBlockDayDefaults({});
                        await db.saveSetting(LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY, '{}');
                    }
                } else {
                    setBlockDayDefaults({});
                    await db.saveSetting(LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY, '{}');
                }


                // Handle mode separately as it's not a simple string
                const modeValue = await db.getSetting(LOCAL_STORAGE_MODE_KEY);
                const savedMode = modeValue as Mode['id'];
                if (savedMode && MODES.find(m => m.id === savedMode)) {
                    setCurrentModeId(savedMode);
                } else {
                    const defaultMode = DEFAULT_MODE_ID;
                    setCurrentModeId(defaultMode);
                    await db.saveSetting(LOCAL_STORAGE_MODE_KEY, defaultMode);
                }

            } catch (e) {
                console.error("Failed to load/seed master contexts from DB", e);
                // Fallback to defaults in memory if DB operations fail completely
                setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION);
                setProgettazione(DEFAULT_PROGETTAZIONE);
                setRouteContext(DEFAULT_ROUTE_CONTEXT);
                setCrewContext(DEFAULT_CREW_CONTEXT);
                setRulesContext(DEFAULT_RULES_CONTEXT);
                setTeacherProfile(DEFAULT_TEACHER_PROFILE);
                setDisciplina(DEFAULT_DISCIPLINA);
                setPtofExtract('');
                setPtofNotebookUrl('');
                setBlockDayDefaults({});
                setCurrentModeId(DEFAULT_MODE_ID);
            } finally {
                setIsLoading(false);
            }
        }
        loadContexts();
    }, []); // This logic runs only once on app startup.

    const handleSaveInstructions = useCallback(async (value: string) => {
        setSystemInstruction(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_INSTRUCTION_KEY, value);
        } catch (error) { console.error("Failed to save instructions:", error); }
    }, []);

    const handleSaveProgettazione = useCallback(async (value: string) => {
        setProgettazione(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_PROGETTAZIONE_KEY, value);
        } catch (error) { console.error("Failed to save progettazione:", error); }
    }, []);

    const handleSaveRoute = useCallback(async (value: string) => {
        setRouteContext(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_ROUTE_KEY, value);
        } catch (error) { console.error("Failed to save route:", error); }
    }, []);
    
    const handleSaveCrew = useCallback(async (value: string) => {
        setCrewContext(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_CREW_KEY, value);
        } catch (error) { console.error("Failed to save crew:", error); }
    }, []);

    const handleSaveRules = useCallback(async (value: string) => {
        setRulesContext(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_RULES_KEY, value);
        } catch (error) { console.error("Failed to save rules:", error); }
    }, []);

    const handleSaveTeacherProfile = useCallback(async (value: string) => {
        setTeacherProfile(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_TEACHER_KEY, value);
        } catch (error) { console.error("Failed to save teacher profile:", error); }
    }, []);

    const handleSaveDisciplina = useCallback(async (value: string) => {
        setDisciplina(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_DISCIPLINA_KEY, value);
        } catch (error) { console.error("Failed to save disciplina:", error); }
    }, []);

    const handleSavePtofExtract = useCallback(async (value: string) => {
        setPtofExtract(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_PTOF_EXTRACT_KEY, value);
        } catch (error) { console.error("Failed to save PTOF extract:", error); }
    }, []);

    const handleSavePtofNotebookUrl = useCallback(async (value: string) => {
        setPtofNotebookUrl(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_PTOF_NOTEBOOK_URL_KEY, value);
        } catch (error) { console.error("Failed to save PTOF notebook URL:", error); }
    }, []);

    const handleSaveBlockDayDefaults = useCallback(async (defaults: Record<string, string>) => {
        setBlockDayDefaults(defaults);
        try {
            await db.saveSetting(LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY, JSON.stringify(defaults));
        } catch (error) { console.error("Failed to save block day defaults:", error); }
    }, []);

    const handleSaveRouteCalendar = useCallback(async (calendar: WeekEntry[]) => {
        setRouteCalendar(calendar);
        try {
            await db.saveSetting(LOCAL_STORAGE_ROUTE_CALENDAR_KEY, JSON.stringify(calendar));
        } catch (error) { console.error("Failed to save route calendar:", error); }
    }, []);

    const handleSaveMode = useCallback(async (value: Mode['id']) => {
        setCurrentModeId(value);
        try {
            await db.saveSetting(LOCAL_STORAGE_MODE_KEY, value);
        } catch (error) { console.error("Failed to save mode:", error); }
    }, []);

    const isUninitialized = !isLoading && (!progettazione.trim() || !crewContext.trim() || !rulesContext.trim());

    return {
        isLoading,
        systemInstruction,
        progettazione,
        routeContext,
        crewContext,
        rulesContext,
        teacherProfile,
        disciplina,
        ptofExtract,
        ptofNotebookUrl,
        blockDayDefaults,
        routeCalendar,
        currentModeId,
        isUninitialized,
        handleSaveInstructions,
        handleSaveProgettazione,
        handleSaveRoute,
        handleSaveCrew,
        handleSaveRules,
        handleSaveTeacherProfile,
        handleSaveDisciplina,
        handleSavePtofExtract,
        handleSavePtofNotebookUrl,
        handleSaveBlockDayDefaults,
        handleSaveRouteCalendar,
        handleSaveMode,
    };
};
