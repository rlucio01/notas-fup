import { describe, it, expect, beforeEach, vi } from "vitest";
import { isAutostartEnabled, setAutostart, syncAutostartSetting } from "./commands";

describe("autostart commands in web fallback mode", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns false by default when not in tauri and no config in localStorage", async () => {
    const enabled = await isAutostartEnabled();
    expect(enabled).toBe(false);
  });

  it("reads autostart value from localStorage in web mode", async () => {
    localStorage.setItem("notas_fup_config", JSON.stringify({ autostart: true }));
    expect(await isAutostartEnabled()).toBe(true);

    localStorage.setItem("notas_fup_config", JSON.stringify({ autostart: false }));
    expect(await isAutostartEnabled()).toBe(false);
  });

  it("returns requested enabled boolean in web mode for setAutostart", async () => {
    expect(await setAutostart(true)).toBe(true);
    expect(await setAutostart(false)).toBe(false);
  });

  it("syncAutostartSetting does nothing and returns false in web mode", async () => {
    const res = await syncAutostartSetting();
    expect(res).toBe(false);
  });
});
