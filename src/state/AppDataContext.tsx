import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AppSettings, MonthlyIncomeRecord, ReportUnlock, StorageResult, UserProfile } from '@/lib/types';
import { getProfile, saveProfile as saveProfileStorage } from '@/storage/profile';
import {
  getRecords,
  upsertRecord as upsertRecordStorage,
  deleteRecord as deleteRecordStorage,
  type UpsertRecordInput,
} from '@/storage/records';
import { getSettings, saveSettings as saveSettingsStorage } from '@/storage/settings';
import { getReportUnlock, saveReportUnlock as saveReportUnlockStorage } from '@/storage/reportUnlock';
import { clearAllData } from '@/storage/clearAll';

interface AppDataContextValue {
  profile: UserProfile | null;
  records: MonthlyIncomeRecord[];
  settings: AppSettings;
  reportUnlock: ReportUnlock | null;
  saveProfile: (patch: { hasBusinessRegistration: boolean }) => StorageResult<UserProfile>;
  upsertRecord: (input: UpsertRecordInput) => StorageResult<null>;
  deleteRecord: (month: string) => StorageResult<null>;
  saveSettings: (
    patch: Partial<Pick<AppSettings, 'reminderEnabled' | 'dismissedReminderMonth'>>,
  ) => StorageResult<AppSettings>;
  saveReportUnlock: (unlockedMonth: string) => StorageResult<ReportUnlock>;
  clearAll: () => StorageResult<null>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(() => getProfile());
  const [records, setRecords] = useState<MonthlyIncomeRecord[]>(() => getRecords());
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [reportUnlock, setReportUnlock] = useState<ReportUnlock | null>(() => getReportUnlock());

  const saveProfile: AppDataContextValue['saveProfile'] = (patch) => {
    const result = saveProfileStorage(patch);
    if (result.ok) setProfile(result.data);
    return result;
  };

  const upsertRecord: AppDataContextValue['upsertRecord'] = (input) => {
    const result = upsertRecordStorage(input);
    if (result.ok) setRecords(getRecords());
    return result;
  };

  const deleteRecord: AppDataContextValue['deleteRecord'] = (month) => {
    const result = deleteRecordStorage(month);
    if (result.ok) setRecords(getRecords());
    return result;
  };

  const saveSettings: AppDataContextValue['saveSettings'] = (patch) => {
    const result = saveSettingsStorage(patch);
    if (result.ok) setSettings(result.data);
    return result;
  };

  const saveReportUnlock: AppDataContextValue['saveReportUnlock'] = (unlockedMonth) => {
    const result = saveReportUnlockStorage(unlockedMonth);
    if (result.ok) setReportUnlock(result.data);
    return result;
  };

  const clearAll: AppDataContextValue['clearAll'] = () => {
    const result = clearAllData();
    if (result.ok) {
      setProfile(null);
      setRecords([]);
      setSettings(getSettings());
      setReportUnlock(null);
    }
    return result;
  };

  const value: AppDataContextValue = {
    profile,
    records,
    settings,
    reportUnlock,
    saveProfile,
    upsertRecord,
    deleteRecord,
    saveSettings,
    saveReportUnlock,
    clearAll,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
