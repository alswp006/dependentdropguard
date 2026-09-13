import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MonthlyIncomeRecord, RecordsStore } from "@/lib/types";

/**
 * Packet 0004: 월별 소득 기록 저장소(CRUD+검증) + 전체 삭제
 *
 * AC-1: upsertRecord after single insert, getRecords length & values
 * AC-2: Multiple upsert with month ordering and update
 * AC-3: Input validation (month, amounts, memo length)
 * AC-4: Graceful degradation for corrupted storage
 * AC-5: Clear all ddg:* keys
 */

describe("Packet 0004: 월별 소득 기록 저장소(CRUD+검증) + 전체 삭제", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ AC-1: Basic upsert and retrieve ============
  describe("AC-1: upsertRecord stores a single record with correct version", () => {
    it("AC-1.1: upsertRecord({month:'2026-08', sideIncome:200000}) creates record, getRecords length === 1", async () => {
      const { upsertRecord, getRecords } = await import("@/storage/records");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: true, data: null });

      const records = getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].month).toBe("2026-08");
      expect(records[0].sideIncome).toBe(200000);
      expect(records[0].salaryIncome).toBe(0);
      expect(records[0].otherIncome).toBe(0);
      expect(records[0].memo).toBe("");
    });

    it("AC-1.2: localStorage['ddg:records:v1'] contains version 1", async () => {
      const { upsertRecord } = await import("@/storage/records");

      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      const stored = localStorage.getItem("ddg:records:v1");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe(1);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items).toHaveLength(1);
    });

    it("AC-1.3: updatedAt is set to ISO 8601 string", async () => {
      const { upsertRecord, getRecords } = await import("@/storage/records");

      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      const records = getRecords();
      expect(records[0].updatedAt).toBeDefined();
      expect(typeof records[0].updatedAt).toBe("string");
      // ISO 8601 format check
      expect(new Date(records[0].updatedAt).getTime()).not.toBeNaN();
    });
  });

  // ============ AC-2: Multiple records with ordering ============
  describe("AC-2: Multiple upserts maintain month order and update existing records", () => {
    it("AC-2.1: insert 2026-08, then 2026-01, then update 2026-08 → length 2, month order correct", async () => {
      const { upsertRecord, getRecords, getRecord } = await import(
        "@/storage/records"
      );

      // Insert 2026-08
      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "August income",
      });

      expect(getRecords()).toHaveLength(1);

      // Insert 2026-01
      upsertRecord({
        month: "2026-01",
        salaryIncome: 5000000,
        sideIncome: 100000,
        otherIncome: 0,
        memo: "January income",
      });

      expect(getRecords()).toHaveLength(2);
      const afterSecond = getRecords();
      expect(afterSecond[0].month).toBe("2026-01");
      expect(afterSecond[1].month).toBe("2026-08");

      // Update 2026-08 with new sideIncome
      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 300000,
        otherIncome: 0,
        memo: "August income updated",
      });

      expect(getRecords()).toHaveLength(2);
      const updated = getRecords();
      expect(updated[0].month).toBe("2026-01");
      expect(updated[1].month).toBe("2026-08");
      expect(updated[1].sideIncome).toBe(300000);
      expect(updated[1].memo).toBe("August income updated");
    });

    it("AC-2.2: getRecord(month) retrieves correct record", async () => {
      const { upsertRecord, getRecord } = await import("@/storage/records");

      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      upsertRecord({
        month: "2026-01",
        salaryIncome: 5000000,
        sideIncome: 100000,
        otherIncome: 0,
        memo: "January",
      });

      const record = getRecord("2026-01");
      expect(record).not.toBeNull();
      expect(record!.month).toBe("2026-01");
      expect(record!.salaryIncome).toBe(5000000);
      expect(record!.sideIncome).toBe(100000);
    });

    it("AC-2.3: getRecord(nonexistent) returns null", async () => {
      const { getRecord } = await import("@/storage/records");

      const record = getRecord("2026-99");
      expect(record).toBeNull();
    });

    it("AC-2.4: deleteRecord(month) removes record and maintains order", async () => {
      const { upsertRecord, getRecords, deleteRecord } = await import(
        "@/storage/records"
      );

      upsertRecord({
        month: "2026-01",
        salaryIncome: 5000000,
        sideIncome: 0,
        otherIncome: 0,
        memo: "",
      });

      upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      upsertRecord({
        month: "2026-12",
        salaryIncome: 0,
        sideIncome: 300000,
        otherIncome: 0,
        memo: "",
      });

      expect(getRecords()).toHaveLength(3);

      const deleteResult = deleteRecord("2026-08");
      expect(deleteResult).toEqual({ ok: true, data: null });

      const remaining = getRecords();
      expect(remaining).toHaveLength(2);
      expect(remaining[0].month).toBe("2026-01");
      expect(remaining[1].month).toBe("2026-12");
    });

    it("AC-2.5: deleteRecord(nonexistent) still returns success (idempotent)", async () => {
      const { deleteRecord } = await import("@/storage/records");

      const result = deleteRecord("2026-99");
      expect(result).toEqual({ ok: true, data: null });
    });
  });

  // ============ AC-3: Input validation ============
  describe("AC-3: Input validation — reject invalid month, amounts, memo length; setItem not called on failure", () => {
    it("AC-3.1: rejects month='2026-13' (invalid month)", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "2026-13",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.2: rejects month='abc' (invalid format)", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "abc",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.3: rejects sideIncome=-1 (negative)", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: -1,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.4: rejects salaryIncome=1.5 (fractional)", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 1.5,
        sideIncome: 0,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.5: rejects otherIncome=1_000_000_001 (exceeds limit)", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 0,
        otherIncome: 1_000_000_001,
        memo: "",
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.6: rejects memo longer than 30 characters", async () => {
      const { upsertRecord } = await import("@/storage/records");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: "x".repeat(31),
      });

      expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(setItemSpy).toHaveBeenCalledTimes(0);

      setItemSpy.mockRestore();
    });

    it("AC-3.7: accepts memo exactly 30 characters", async () => {
      const { upsertRecord, getRecords } = await import("@/storage/records");

      const memo30 = "a".repeat(30);
      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 200000,
        otherIncome: 0,
        memo: memo30,
      });

      expect(result).toEqual({ ok: true, data: null });
      expect(getRecords()[0].memo).toBe(memo30);
    });

    it("AC-3.8: accepts amount exactly 1_000_000_000", async () => {
      const { upsertRecord, getRecords } = await import("@/storage/records");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 1_000_000_000,
        sideIncome: 0,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: true, data: null });
      expect(getRecords()[0].salaryIncome).toBe(1_000_000_000);
    });

    it("AC-3.9: accepts amount 0", async () => {
      const { upsertRecord, getRecords } = await import("@/storage/records");

      const result = upsertRecord({
        month: "2026-08",
        salaryIncome: 0,
        sideIncome: 0,
        otherIncome: 0,
        memo: "",
      });

      expect(result).toEqual({ ok: true, data: null });
    });
  });

  // ============ AC-4: Corrupted storage graceful degradation ============
  describe("AC-4: Corrupted storage returns empty array, console.error called 0 times", () => {
    it("AC-4.1: broken JSON '{broken' returns empty array", async () => {
      localStorage.setItem("ddg:records:v1", "{broken");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getRecords } = await import("@/storage/records");
      const result = getRecords();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

      consoleErrorSpy.mockRestore();
    });

    it("AC-4.2: 'null' string returns empty array", async () => {
      localStorage.setItem("ddg:records:v1", "null");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getRecords } = await import("@/storage/records");
      const result = getRecords();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

      consoleErrorSpy.mockRestore();
    });

    it("AC-4.3: items is not array returns empty array", async () => {
      localStorage.setItem(
        "ddg:records:v1",
        JSON.stringify({ version: 1, items: "not-array" })
      );
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getRecords } = await import("@/storage/records");
      const result = getRecords();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

      consoleErrorSpy.mockRestore();
    });

    it("AC-4.4: empty localStorage returns empty array", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getRecords } = await import("@/storage/records");
      const result = getRecords();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

      consoleErrorSpy.mockRestore();
    });

    it("AC-4.5: missing version returns empty array", async () => {
      localStorage.setItem("ddg:records:v1", JSON.stringify({ items: [] }));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getRecords } = await import("@/storage/records");
      const result = getRecords();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

      consoleErrorSpy.mockRestore();
    });
  });

  // ============ AC-5: Clear all ddg:* keys ============
  describe("AC-5: clearAllData removes all ddg:* keys (4 keys: records, settings, profile, reports)", () => {
    it("AC-5.1: clearAllData removes all 4 ddg:* keys, returns {ok:true}", async () => {
      // Pre-populate all 4 keys
      localStorage.setItem("ddg:records:v1", JSON.stringify({ version: 1, items: [] }));
      localStorage.setItem(
        "ddg:settings:v1",
        JSON.stringify({ version: 1, reminderEnabled: true, dismissedReminderMonth: null })
      );
      localStorage.setItem(
        "ddg:profile:v1",
        JSON.stringify({
          version: 1,
          hasBusinessRegistration: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(
        "ddg:reports:v1",
        JSON.stringify({ version: 1, unlockedMonth: "2026-08" })
      );

      expect(localStorage.getItem("ddg:records:v1")).not.toBeNull();
      expect(localStorage.getItem("ddg:settings:v1")).not.toBeNull();
      expect(localStorage.getItem("ddg:profile:v1")).not.toBeNull();
      expect(localStorage.getItem("ddg:reports:v1")).not.toBeNull();

      const { clearAllData } = await import("@/storage/clearAll");
      const result = clearAllData();

      expect(result).toEqual({ ok: true, data: null });

      // All 4 keys must be removed
      expect(localStorage.getItem("ddg:records:v1")).toBeNull();
      expect(localStorage.getItem("ddg:settings:v1")).toBeNull();
      expect(localStorage.getItem("ddg:profile:v1")).toBeNull();
      expect(localStorage.getItem("ddg:reports:v1")).toBeNull();
    });

    it("AC-5.2: clearAllData with unrelated keys leaves them untouched", async () => {
      localStorage.setItem("ddg:records:v1", JSON.stringify({ version: 1, items: [] }));
      localStorage.setItem("other:key", "should remain");

      const { clearAllData } = await import("@/storage/clearAll");
      clearAllData();

      expect(localStorage.getItem("ddg:records:v1")).toBeNull();
      expect(localStorage.getItem("other:key")).toBe("should remain");
    });

    it("AC-5.3: clearAllData on empty storage still returns {ok:true}", async () => {
      const { clearAllData } = await import("@/storage/clearAll");
      const result = clearAllData();

      expect(result).toEqual({ ok: true, data: null });
    });

    it("AC-5.4: clearAllData returns {ok:false, error:'STORAGE_UNAVAILABLE'} on removeItem throw", async () => {
      localStorage.setItem("ddg:records:v1", JSON.stringify({ version: 1, items: [] }));

      const removeItemSpy = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementationOnce(() => {
          throw new Error("Storage access denied");
        });

      const { clearAllData } = await import("@/storage/clearAll");
      const result = clearAllData();

      expect(result).toEqual({ ok: false, error: "STORAGE_UNAVAILABLE" });

      removeItemSpy.mockRestore();
    });
  });
});
