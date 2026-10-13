import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  startProfileSync,
  type ProfileTransport,
  type ProfileStatus,
} from "../../src/lib/profile-sync";
import {
  accountNameLocal,
  restoreGuestName,
  useNameCache,
} from "../../src/lib/account-profile";
import { usePreferences } from "../../src/lib/store";

function harness(name = "Tên trên máy") {
  let value = { name, pending: false };
  let change = () => {};
  let remoteChange = (_name: string) => {};
  const accept = vi.fn((name: string) => {
    value = { name, pending: false };
  });
  const sync = vi.fn(
    async (_name: string, _overwrite: boolean) => "Tên tài khoản",
  );
  const stopWatch = vi.fn();
  const remote: ProfileTransport = {
    sync,
    watch: (next) => {
      remoteChange = next;
      return stopWatch;
    },
  };
  const statuses: ProfileStatus[] = [];
  const controller = startProfileSync(
    {
      get: () => value,
      accept,
      subscribe: (next) => {
        change = next;
        return vi.fn();
      },
    },
    remote,
    (s) => statuses.push(s),
  );
  return {
    controller,
    sync,
    accept,
    statuses,
    stopWatch,
    get: () => value,
    edit: (name: string) => {
      value = { name, pending: true };
      change();
    },
    remoteEdit: (name: string) => remoteChange(name),
  };
}
const settled = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("account name synchronization", () => {
  it("loads the server name instead of overwriting it with a new browser's default", async () => {
    const h = harness();
    await settled();
    expect(h.sync).toHaveBeenCalledWith("Tên trên máy", false);
    expect(h.get()).toEqual({ name: "Tên tài khoản", pending: false });
    h.remoteEdit("Đổi trên máy khác");
    expect(h.get().name).toBe("Đổi trên máy khác");
    h.controller.stop();
  });
  it("debounces typing and keeps an offline edit pending until retry succeeds", async () => {
    const h = harness();
    await settled();
    h.sync.mockRejectedValueOnce(new Error("offline"));
    h.edit("Mai");
    h.edit("Mai Anh");
    h.remoteEdit("Server cũ");
    expect(h.get().name).toBe("Mai Anh");
    await vi.advanceTimersByTimeAsync(500);
    expect(h.sync).toHaveBeenLastCalledWith("Mai Anh", true);
    expect(h.get().pending).toBe(true);
    expect(h.statuses.at(-1)).toBe("error");
    h.sync.mockResolvedValueOnce("Mai Anh");
    h.controller.retry();
    await settled();
    expect(h.get()).toEqual({ name: "Mai Anh", pending: false });
    h.controller.stop();
  });
  it("does not acknowledge a newer edit while an older write is in flight", async () => {
    const h = harness();
    await settled();
    let resolve!: (name: string) => void;
    h.sync.mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );
    h.edit("Tên đầu");
    await vi.advanceTimersByTimeAsync(500);
    h.edit("Tên mới");
    resolve("Tên đầu");
    await settled();
    expect(h.get()).toEqual({ name: "Tên mới", pending: true });
    h.sync.mockResolvedValueOnce("Tên mới");
    await vi.advanceTimersByTimeAsync(500);
    expect(h.get()).toEqual({ name: "Tên mới", pending: false });
    h.controller.stop();
  });
  it("ignores late responses after logout and cancels pending writes", async () => {
    const h = harness();
    h.controller.stop();
    await settled();
    expect(h.accept).not.toHaveBeenCalled();
    expect(h.stopWatch).toHaveBeenCalledOnce();
    h.edit("Không ghi");
    await vi.advanceTimersByTimeAsync(500);
    expect(h.sync).toHaveBeenCalledOnce();
  });
  it("separates guest/A/B names and resumes each account's pending edit", () => {
    useNameCache.setState({ guestName: null, migrated: false, accounts: {} });
    restoreGuestName();
    usePreferences.setState({ name: "Tên khách cũ" });
    const a = accountNameLocal({ uid: "A", displayName: "Google A" });
    expect(a.get().name).toBe("Tên khách cũ");
    a.accept("Tên A từ server");
    const stop = a.subscribe(() => {});
    usePreferences.getState().set({ name: "Tên A offline" });
    stop();
    restoreGuestName();
    expect(usePreferences.getState().name).toBe("Tên khách cũ");
    const b = accountNameLocal({ uid: "B", displayName: "Google B" });
    expect(b.get()).toEqual({ name: "Google B", pending: false });
    expect(a.get()).toEqual({ name: "Tên A offline", pending: true });
    expect(
      accountNameLocal({ uid: "A", displayName: null }).get().pending,
    ).toBe(true);
    expect(usePreferences.getState().name).toBe("Tên A offline");
    restoreGuestName();
  });
});
