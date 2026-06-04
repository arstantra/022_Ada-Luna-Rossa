/**
 * @deprecated DORMIENTE — 2026-06-04
 * Il sistema Activity (ActivityFormaLavoro, ActivityStatus ecc.) è stato sostituito
 * dalla Distribuzione + Abbinamento in LessonPreparationTab.tsx (v2).
 * Non eliminare: LessonInCorsoTab e alcuni hook usano ancora Activity per visualizzare
 * dati storici. Verificare prima di rimuovere.
 */
import type { Activity, ActivitySubmissionRecord, ActivityObservation } from '../../types';
import * as db from '../../services/db';

export interface ActivityDeps {
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setViewFn: (v: string) => void;
}

export function createActivityHandlers(deps: ActivityDeps) {
  const { showToast } = deps;

  const createActivity = async (blockId: string, weekNumber: number, data: Partial<Activity>): Promise<Activity> => {
    const now = new Date().toISOString();
    const activity: Activity = {
      id: crypto.randomUUID(),
      blockId,
      weekNumber,
      title: '',
      formaLavoro: 'individuale',
      contesto: 'in_aula',
      deliverable: 'elaborato',
      status: 'progettata',
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    await db.saveActivity(activity);
    return activity;
  };

  const updateActivity = async (activityId: string, updates: Partial<Activity>): Promise<void> => {
    const existing = await db.getActivity(activityId);
    if (!existing) {
      console.warn(`updateActivity: activity ${activityId} not found`);
      return;
    }
    const updated: Activity = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await db.saveActivity(updated);
  };

  const deleteActivity = async (activityId: string): Promise<void> => {
    await db.deleteActivity(activityId);
    showToast('Attività eliminata.', 'info');
  };

  const launchActivity = async (activityId: string, _blockId: string): Promise<void> => {
    const existing = await db.getActivity(activityId);
    if (!existing) return;
    const updated: Activity = {
      ...existing,
      status: 'lanciata',
      launchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveActivity(updated);
    showToast('Attività lanciata.', 'success');
  };

  const recordSubmission = async (activityId: string, record: ActivitySubmissionRecord): Promise<void> => {
    const existing = await db.getActivity(activityId);
    if (!existing) return;
    const records = [...(existing.submissionRecords ?? [])];
    const idx = records.findIndex(r => r.refId === record.refId && r.refType === record.refType);
    if (idx >= 0) {
      records[idx] = record;
    } else {
      records.push(record);
    }
    const allDelivered = records.every(r => r.submittedAt);
    const updated: Activity = {
      ...existing,
      submissionRecords: records,
      status: allDelivered ? 'consegnata' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    await db.saveActivity(updated);
  };

  const addObservation = async (
    activityId: string,
    obs: Omit<ActivityObservation, 'id' | 'timestamp'>
  ): Promise<void> => {
    const existing = await db.getActivity(activityId);
    if (!existing) return;
    const newObs: ActivityObservation = {
      ...obs,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const updated: Activity = {
      ...existing,
      observations: [...(existing.observations ?? []), newObs],
      updatedAt: new Date().toISOString(),
    };
    await db.saveActivity(updated);
  };

  return {
    createActivity,
    updateActivity,
    deleteActivity,
    launchActivity,
    recordSubmission,
    addObservation,
  };
}
