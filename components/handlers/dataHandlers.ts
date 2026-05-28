import React from 'react';
import CryptoJS from 'crypto-js';
import type { Student, Evaluation } from '../../types';
import type { useMasterContext } from '../../hooks/useMasterContext';
import * as db from '../../services/db';
import * as GeminiService from '../../services/gemini';
import { generateCourseBookHtml } from '../../utils';
import type { Conversation } from '../../types';

export interface DataHandlerDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  students: Student[];
  masterContext: ReturnType<typeof useMasterContext>;
  addEvaluationToStudent: (studentId: string, evaluation: Evaluation) => void;
  fileToImport: File | null;
  dataToRestore: db.BackupData | null;
  studentForEvaluationImport: Student | null;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setModalState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDataToRestore: React.Dispatch<React.SetStateAction<db.BackupData | null>>;
  setFileToImport: React.Dispatch<React.SetStateAction<File | null>>;
  setStudentForEvaluationImport: React.Dispatch<React.SetStateAction<Student | null>>;
}

export function createDataHandlers(deps: DataHandlerDeps) {
  const {
    conversationsRef, students, masterContext, addEvaluationToStudent,
    fileToImport, dataToRestore, studentForEvaluationImport,
    showToast, setIsLoading, setModalState, setDataToRestore, setFileToImport, setStudentForEvaluationImport,
  } = deps;

  const handleExportData = async (password: string) => {
    setIsLoading(true);
    setModalState(s => ({ ...s, exportPassword: false }));
    showToast('Creazione del backup in corso...', 'info');
    try {
      const backupData = {
        version: 2,
        timestamp: new Date().toISOString(),
        data: {
          conversations: await db.getAllConversations(),
          labels: await db.getAllLabels(),
          students: await db.getAllStudents(),
          notebooks: await db.getAllNotebooks(),
          toolkit_shortcuts: await db.getAllShortcuts(),
          toolkit_categories: await db.getAllCategories(),
          settings: await db.getAllSettings(),
        },
      };

      const jsonString = JSON.stringify(backupData);
      const encryptedData = CryptoJS.AES.encrypt(jsonString, password).toString();

      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'backup_ada_laboratorio.ada_encrypted';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showToast('Backup esportato con successo!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Errore durante la creazione del backup.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelectedForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileToImport(file);
      setModalState(s => ({ ...s, importPassword: true }));
    }
    event.target.value = '';
  };

  const handleAttemptImport = (password: string) => {
    if (!fileToImport) return;
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileContent = e.target?.result as string;
      try {
        const bytes = CryptoJS.AES.decrypt(fileContent, password);
        const decryptedJson = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedJson) {
          throw new Error('Password errata o file corrotto.');
        }

        const backup = JSON.parse(decryptedJson);

        if (!backup.version || !backup.data) {
          throw new Error('File di backup non valido.');
        }

        setDataToRestore(backup.data);
        setModalState(s => ({ ...s, importPassword: false, importConfirm: true }));
      } catch (error) {
        console.error('Import failed:', error);
        showToast(error instanceof Error ? error.message : 'Password errata o file non valido.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(fileToImport);
  };

  const handleConfirmRestore = async () => {
    if (!dataToRestore) return;
    setIsLoading(true);
    setModalState(s => ({ ...s, importConfirm: false }));

    try {
      await db.restoreFromBackup(dataToRestore);
      sessionStorage.setItem('backupRestored', 'true');
      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
      showToast('Errore critico durante il ripristino dei dati.', 'error');
      setIsLoading(false);
    }
  };

  const handleOpenImportModal = (student: Student) => {
    setStudentForEvaluationImport(student);
  };

  const handleConfirmImportEvaluation = async (text: string) => {
    if (!studentForEvaluationImport) return;

    setIsLoading(true);
    try {
      const analyzedData = await GeminiService.analyzeEvaluationText(text, studentForEvaluationImport.name);

      const newEvaluation: Evaluation = {
        date: new Date().toISOString(),
        value: analyzedData.value || 'Non specificato',
        notes: analyzedData.notes || 'Nessuna nota.',
        weekNumber: analyzedData.weekNumber,
        module: analyzedData.module,
        pillar: analyzedData.pillar,
      };

      addEvaluationToStudent(studentForEvaluationImport.id, newEvaluation);
      showToast('Valutazione importata e analizzata con successo!', 'success');
    } catch (error) {
      console.error('Failed to import evaluation:', error);
      showToast(error instanceof Error ? error.message : "Errore durante l'importazione.", 'error');
    } finally {
      setIsLoading(false);
      setStudentForEvaluationImport(null);
    }
  };

  const handleExportCourseBook = () => {
    showToast('Generazione del libro del corso in corso...', 'info');
    try {
      const htmlContent = generateCourseBookHtml(
        masterContext.systemInstruction,
        {
          progettazione: masterContext.progettazione,
          route: masterContext.routeContext,
          crew: masterContext.crewContext,
          rules: masterContext.rulesContext,
        },
        conversationsRef.current,
        students
      );

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'libro_del_corso_ada.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Libro del corso esportato con successo!', 'success');
    } catch (error) {
      console.error('Course book export failed:', error);
      showToast("Errore durante l'esportazione del libro del corso.", 'error');
    }
  };

  return {
    handleExportData,
    handleFileSelectedForImport,
    handleAttemptImport,
    handleConfirmRestore,
    handleOpenImportModal,
    handleConfirmImportEvaluation,
    handleExportCourseBook,
  };
}
