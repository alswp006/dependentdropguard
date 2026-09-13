import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * AC-1: 빈 localStorage에서 getProfile() === null, getReportUnlock() === null
 *       getSettings()는 {version:1, reminderEnabled:true, dismissedReminderMonth:null}과 deepEqual
 */
describe("AC-1: Default values in empty storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-1.1: getProfile() returns null when storage is empty", async () => {
    const { getProfile } = await import("@/storage/profile");
    const result = getProfile();
    expect(result).toBeNull();
  });

  it("AC-1.2: getReportUnlock() returns null when storage is empty", async () => {
    const { getReportUnlock } = await import("@/storage/reportUnlock");
    const result = getReportUnlock();
    expect(result).toBeNull();
  });

  it("AC-1.3: getSettings() returns default {version:1, reminderEnabled:true, dismissedReminderMonth:null}", async () => {
    const { getSettings } = await import("@/storage/settings");
    const result = getSettings();
    expect(result).toEqual({
      version: 1,
      reminderEnabled: true,
      dismissedReminderMonth: null,
    });
  });
});

/**
 * AC-2: localStorage['ddg:settings:v1'] = '"abc"'이면 getSettings()는 기본값을 반환하고,
 *       console.error spy 호출은 0회다
 */
describe("AC-2: Invalid JSON graceful degradation (no console.error)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-2.1: getSettings() returns default when stored value is invalid JSON, console.error called 0 times", async () => {
    localStorage.setItem("ddg:settings:v1", '"abc"');
    const consoleErrorSpy = vi.spyOn(console, "error");

    const { getSettings } = await import("@/storage/settings");
    const result = getSettings();

    expect(result).toEqual({
      version: 1,
      reminderEnabled: true,
      dismissedReminderMonth: null,
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    consoleErrorSpy.mockRestore();
  });
});

/**
 * AC-3: setItem이 new DOMException('', 'QuotaExceededError')를 던지면
 *       saveSettings({reminderEnabled:false})는 {ok:false, error:'STORAGE_FULL'}이다.
 *       code===22인 예외도 STORAGE_FULL이고,
 *       일반 Error는 {ok:false, error:'STORAGE_UNAVAILABLE'}이다
 */
describe("AC-3: Storage quota & error handling", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-3.1: saveSettings returns {ok:false, error:'STORAGE_FULL'} on QuotaExceededError", async () => {
    const originalSetItem = localStorage.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      const err = new DOMException("QuotaExceeded", "QuotaExceededError");
      throw err;
    });

    const { saveSettings } = await import("@/storage/settings");
    const result = saveSettings({ reminderEnabled: false });

    expect(result).toEqual({ ok: false, error: "STORAGE_FULL" });
  });

  it("AC-3.2: saveSettings returns {ok:false, error:'STORAGE_FULL'} on legacy exception with code 22", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      // DOMException.code is a getter-only property and cannot be reassigned — legacy
      // browsers signal quota errors via a plain exception carrying a numeric `code` instead.
      const err = new Error("QuotaExceeded") as Error & { code: number };
      err.code = 22;
      throw err;
    });

    const { saveSettings } = await import("@/storage/settings");
    const result = saveSettings({ reminderEnabled: false });

    expect(result).toEqual({ ok: false, error: "STORAGE_FULL" });
  });

  it("AC-3.3: saveSettings returns {ok:false, error:'STORAGE_UNAVAILABLE'} on general Error", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("Access denied");
    });

    const { saveSettings } = await import("@/storage/settings");
    const result = saveSettings({ reminderEnabled: false });

    expect(result).toEqual({ ok: false, error: "STORAGE_UNAVAILABLE" });
  });
});

/**
 * AC-4: saveProfile({hasBusinessRegistration:true})를 두 번 호출하면
 *       createdAt은 첫 저장값 그대로이고 updatedAt만 바뀐다
 */
describe("AC-4: Timestamp preservation on update", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-4.1: saveProfile twice preserves createdAt, updates updatedAt", async () => {
    const { saveProfile, getProfile } = await import("@/storage/profile");

    // First save
    const firstResult = saveProfile({ hasBusinessRegistration: true });
    expect(firstResult.ok).toBe(true);

    const afterFirstSave = getProfile();
    expect(afterFirstSave).not.toBeNull();
    expect(afterFirstSave!.hasBusinessRegistration).toBe(true);
    const firstCreatedAt = afterFirstSave!.createdAt;
    const firstUpdatedAt = afterFirstSave!.updatedAt;

    // Wait a bit to ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));

    // Second save
    const secondResult = saveProfile({ hasBusinessRegistration: true });
    expect(secondResult.ok).toBe(true);

    const afterSecondSave = getProfile();
    expect(afterSecondSave).not.toBeNull();
    expect(afterSecondSave!.createdAt).toBe(firstCreatedAt);
    // createdAt/updatedAt are ISO 8601 strings (per shared UserProfile contract, packet 0001) —
    // compare as timestamps rather than via toBeGreaterThan(OrEqual), which requires number/bigint.
    expect(new Date(afterSecondSave!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(firstUpdatedAt).getTime()
    );
    expect(new Date(afterSecondSave!.updatedAt).getTime()).toBeGreaterThan(
      new Date(firstCreatedAt).getTime()
    );
  });
});

/**
 * AC-5: saveReportUnlock('2026-09') 후 getReportUnlock()은 {version:1, unlockedMonth:'2026-09'}이다
 */
describe("AC-5: Report unlock persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-5.1: saveReportUnlock('2026-09') then getReportUnlock() returns {version:1, unlockedMonth:'2026-09'}", async () => {
    const { saveReportUnlock, getReportUnlock } = await import(
      "@/storage/reportUnlock"
    );

    const saveResult = saveReportUnlock("2026-09");
    expect(saveResult.ok).toBe(true);

    const result = getReportUnlock();
    expect(result).toEqual({
      version: 1,
      unlockedMonth: "2026-09",
    });
  });

  it("AC-5.2: saveReportUnlock updates existing unlock", async () => {
    const { saveReportUnlock, getReportUnlock } = await import(
      "@/storage/reportUnlock"
    );

    saveReportUnlock("2026-08");
    expect(getReportUnlock()?.unlockedMonth).toBe("2026-08");

    saveReportUnlock("2026-09");
    expect(getReportUnlock()?.unlockedMonth).toBe("2026-09");
  });
});

/**
 * Additional: safeStorage core functions
 */
describe("safeStorage core functions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("readJson validates with provided validator and returns parsed JSON", async () => {
    const { readJson } = await import("@/storage/safeStorage");
    localStorage.setItem("test:key", JSON.stringify({ count: 5 }));

    const result = readJson(
      "test:key",
      (v: unknown): v is { count: number } =>
        typeof v === "object" && v !== null && typeof (v as { count: unknown }).count === "number",
      { count: 0 }
    );
    expect(result).toEqual({ count: 5 });
  });

  it("readJson returns fallback when validator rejects", async () => {
    const { readJson } = await import("@/storage/safeStorage");
    localStorage.setItem("test:key", JSON.stringify({ invalid: true }));

    const fallback = { count: 0 };
    const result = readJson(
      "test:key",
      (v: unknown): v is { count: number } =>
        typeof v === "object" && v !== null && typeof (v as { count: unknown }).count === "number",
      fallback
    );
    expect(result).toBe(fallback);
  });

  it("writeJson returns {ok:true, data:null} on success, sets item exactly once", async () => {
    const { writeJson } = await import("@/storage/safeStorage");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const result = writeJson("test:key", { count: 10 });
    expect(result).toEqual({ ok: true, data: null });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith("test:key", JSON.stringify({ count: 10 }));
  });

  it("removeKeys removes all provided keys in one go", async () => {
    const { removeKeys } = await import("@/storage/safeStorage");
    localStorage.setItem("key1", "value1");
    localStorage.setItem("key2", "value2");
    localStorage.setItem("key3", "value3");

    removeKeys(["key1", "key2"]);

    expect(localStorage.getItem("key1")).toBeNull();
    expect(localStorage.getItem("key2")).toBeNull();
    expect(localStorage.getItem("key3")).toBe("value3");
  });
});
