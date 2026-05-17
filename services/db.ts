// services/db.ts
import { openDB, IDBPDatabase } from 'idb';
import type { Conversation, Label, Student, Notebook, ToolkitShortcut, ToolkitCategory } from '../types';

const DB_NAME = 'AdaGeminiDB';
const DB_VERSION = 3;

// Store names
const CONVERSATIONS_STORE = 'conversations';
const LABELS_STORE = 'labels';
const STUDENTS_STORE = 'students';
const NOTEBOOKS_STORE = 'notebooks';
const SETTINGS_STORE = 'settings';
const TOOLKIT_SHORTCUTS_STORE = 'toolkit_shortcuts';
const TOOLKIT_CATEGORIES_STORE = 'toolkit_categories';


export const ALL_STORES = [
    CONVERSATIONS_STORE,
    LABELS_STORE,
    STUDENTS_STORE,
    NOTEBOOKS_STORE,
    SETTINGS_STORE,
    TOOLKIT_SHORTCUTS_STORE,
    TOOLKIT_CATEGORIES_STORE,
];

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
                db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(LABELS_STORE)) {
                db.createObjectStore(LABELS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STUDENTS_STORE)) {
                db.createObjectStore(STUDENTS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(NOTEBOOKS_STORE)) {
                db.createObjectStore(NOTEBOOKS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE);
            }
            if (!db.objectStoreNames.contains(TOOLKIT_SHORTCUTS_STORE)) {
                db.createObjectStore(TOOLKIT_SHORTCUTS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(TOOLKIT_CATEGORIES_STORE)) {
                db.createObjectStore(TOOLKIT_CATEGORIES_STORE, { keyPath: 'id' });
            }
        },
    });

    return dbPromise;
};

// --- Generic Functions ---
const getStore = async <T>(storeName: string): Promise<T[]> => {
    const db = await initDB();
    return db.getAll(storeName);
};

const saveItem = async <T>(storeName: string, item: T): Promise<void> => {
    const db = await initDB();
    await db.put(storeName, item);
};

const deleteItem = async (storeName: string, id: string): Promise<void> => {
    const db = await initDB();
    await db.delete(storeName, id);
};

const bulkSave = async <T>(storeName: string, items: T[]): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
};

const bulkDelete = async (storeName: string, ids: string[]): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
};

export interface BackupData {
    conversations: Conversation[];
    labels: Label[];
    students: Student[];
    notebooks: Notebook[];
    toolkit_shortcuts: ToolkitShortcut[];
    toolkit_categories: ToolkitCategory[];
    settings: { key: string, value: any }[];
}

export const getAllSettings = async (): Promise<{ key: string, value: any }[]> => {
    const db = await initDB();
    const keys = await db.getAllKeys(SETTINGS_STORE);
    const values = await db.getAll(SETTINGS_STORE);
    return keys.map((key, index) => ({ key: key as string, value: values[index] }));
};

export const restoreFromBackup = async (data: BackupData): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(ALL_STORES, 'readwrite');
    
    try {
        // 1. Clear all existing data
        await Promise.all(ALL_STORES.map(storeName => tx.objectStore(storeName).clear()));

        // 2. Bulk insert new data
        const putPromises: Promise<any>[] = [];

        data.conversations.forEach(item => putPromises.push(tx.objectStore(CONVERSATIONS_STORE).put(item)));
        data.labels.forEach(item => putPromises.push(tx.objectStore(LABELS_STORE).put(item)));
        data.students.forEach(item => putPromises.push(tx.objectStore(STUDENTS_STORE).put(item)));
        data.notebooks.forEach(item => putPromises.push(tx.objectStore(NOTEBOOKS_STORE).put(item)));
        data.toolkit_shortcuts.forEach(item => putPromises.push(tx.objectStore(TOOLKIT_SHORTCUTS_STORE).put(item)));
        if (data.toolkit_categories) {
            data.toolkit_categories.forEach(item => putPromises.push(tx.objectStore(TOOLKIT_CATEGORIES_STORE).put(item)));
        }
        data.settings.forEach(item => putPromises.push(tx.objectStore(SETTINGS_STORE).put(item.value, item.key)));
        
        await Promise.all(putPromises);

        await tx.done;
    } catch (error) {
        console.error("Restore failed, transaction aborted.", error);
        tx.abort();
        throw error; // re-throw to be caught by the caller
    }
};


// --- Conversations ---
export const getAllConversations = () => getStore<Conversation>(CONVERSATIONS_STORE);
export const saveConversation = (convo: Conversation) => saveItem(CONVERSATIONS_STORE, convo);
export const deleteConversation = (id: string) => deleteItem(CONVERSATIONS_STORE, id);
export const bulkSaveConversations = (convos: Conversation[]) => bulkSave(CONVERSATIONS_STORE, convos);

// --- Labels ---
export const getAllLabels = () => getStore<Label>(LABELS_STORE);
export const saveLabel = (label: Label) => saveItem(LABELS_STORE, label);
export const deleteLabel = (id: string) => deleteItem(LABELS_STORE, id);
export const bulkSaveLabels = (labels: Label[]) => bulkSave(LABELS_STORE, labels);

// --- Students ---
export const getAllStudents = () => getStore<Student>(STUDENTS_STORE);
export const saveStudent = (student: Student) => saveItem(STUDENTS_STORE, student);
export const bulkSaveStudents = (students: Student[]) => bulkSave(STUDENTS_STORE, students);
export const bulkDeleteStudents = (ids: string[]) => bulkDelete(STUDENTS_STORE, ids);

// --- Notebooks ---
export const getAllNotebooks = () => getStore<Notebook>(NOTEBOOKS_STORE);
export const saveNotebook = (notebook: Notebook) => saveItem(NOTEBOOKS_STORE, notebook);
export const deleteNotebook = (id: string) => deleteItem(NOTEBOOKS_STORE, id);
export const bulkSaveNotebooks = (notebooks: Notebook[]) => bulkSave(NOTEBOOKS_STORE, notebooks);

// --- Toolkit Shortcuts ---
export const getAllShortcuts = () => getStore<ToolkitShortcut>(TOOLKIT_SHORTCUTS_STORE);
export const saveShortcut = (shortcut: ToolkitShortcut) => saveItem(TOOLKIT_SHORTCUTS_STORE, shortcut);
export const deleteShortcut = (id: string) => deleteItem(TOOLKIT_SHORTCUTS_STORE, id);
export const bulkSaveShortcuts = (shortcuts: ToolkitShortcut[]) => bulkSave(TOOLKIT_SHORTCUTS_STORE, shortcuts);

// --- Toolkit Categories ---
export const getAllCategories = () => getStore<ToolkitCategory>(TOOLKIT_CATEGORIES_STORE);
export const saveCategory = (category: ToolkitCategory) => saveItem(TOOLKIT_CATEGORIES_STORE, category);
export const deleteCategory = (id: string) => deleteItem(TOOLKIT_CATEGORIES_STORE, id);
export const bulkSaveCategories = (categories: ToolkitCategory[]) => bulkSave(TOOLKIT_CATEGORIES_STORE, categories);


// --- Settings (Key-Value) ---
export const getSetting = async (key: string): Promise<string | undefined> => {
    const db = await initDB();
    return db.get(SETTINGS_STORE, key);
};

export const saveSetting = async (key: string, value: string): Promise<void> => {
    const db = await initDB();
    await db.put(SETTINGS_STORE, value, key);
};