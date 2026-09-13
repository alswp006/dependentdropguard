import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { AppDataProvider } from "@/state/AppDataContext";
import type { UserProfile } from "@/lib/types";
import Profile from "@/pages/Profile";

/**
 * Packet 0007: ProfilePage — 사업자등록 여부 온보딩/수정 (/profile)
 *
 * - parseProfileState(location.state)로 onboarding/edit 모드를 정한다.
 * - onboarding: 선택 전 SubmitFooter disabled → 저장 시 navigate('/', {replace:true})
 * - edit: 기존 값 미리 선택 → 저장 시 navigate('/settings', {replace:true}), createdAt 유지
 * - 저장 실패(QuotaExceededError): Toast 노출, navigate 미호출
 *
 * TDS는 jsdom에서 충돌하므로 mockTds() 사용. react-router-dom은 useLocation은 실제 동작을
 * 유지하고(그래야 mode/state가 파싱된다) useNavigate만 스파이로 교체한다.
 */

mockTds();
mockAppsInToss();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const { mockNavigate: navSpy } = await import("@/__tests__/__helpers__/mocks");
  return { ...actual, useNavigate: () => navSpy };
});

const PROFILE_KEY = "ddg:profile:v1";

function seedProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

async function renderProfile(state: { mode: "onboarding" | "edit" } | null) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/profile", state }] },
      React.createElement(AppDataProvider, null, React.createElement(Profile)),
    ),
  );
}

describe("ProfilePage — 사업자등록 여부 온보딩/수정 (/profile)", () => {
  it("AC-1[P0]: onboarding — 선택 전 저장 버튼 disabled, '없음' 선택 후 저장하면 localStorage에 false로 기록되고 '/'로 replace 이동한다", async () => {
    await renderProfile(null);

    const submitButton = screen.getByRole("button") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    fireEvent.click(screen.getByTestId("biz-option-no"));

    await waitFor(() => {
      expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(localStorage.getItem(PROFILE_KEY)).not.toBeNull();
    });
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) as string);
    expect(stored.hasBusinessRegistration).toBe(false);
    expect(stored.version).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-2[P0]: edit 모드 + 기존 hasBusinessRegistration=true — '있음'이 선택된 상태로 열리고 Top 제목은 '사업자등록 여부'. '없음'으로 바꿔 저장하면 createdAt은 유지되고 '/settings'로 이동한다", async () => {
    const original = seedProfile({
      hasBusinessRegistration: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await renderProfile({ mode: "edit" });

    expect(screen.getByText("사업자등록 여부")).toBeInTheDocument();
    expect(screen.getByTestId("biz-option-yes").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId("biz-option-no"));
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/settings", { replace: true });
    });
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) as string);
    expect(stored.hasBusinessRegistration).toBe(false);
    expect(stored.createdAt).toBe(original.createdAt);
  });

  it("AC-3[P0]: setItem이 QuotaExceededError를 던지면 navigate가 호출되지 않고('/profile'에 머물고) Toast가 보인다", async () => {
    await renderProfile(null);

    fireEvent.click(screen.getByTestId("biz-option-yes"));

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("QuotaExceeded", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it("AC-4: 저장 버튼을 누르면 generateHapticFeedback({type:'success'})가 정확히 1회 호출된다", async () => {
    const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");

    await renderProfile(null);

    fireEvent.click(screen.getByTestId("biz-option-no"));
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(localStorage.getItem(PROFILE_KEY)).not.toBeNull();
    });

    expect(generateHapticFeedback).toHaveBeenCalledTimes(1);
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
  });
});
