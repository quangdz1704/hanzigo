export interface LocalProfile {
  get: () => { name: string; pending: boolean };
  accept: (name: string) => void;
  subscribe: (next: () => void) => () => void;
}
export interface ProfileTransport {
  sync: (name: string, overwrite: boolean) => Promise<string>;
  watch: (
    next: (name: string) => void,
    error: (error: unknown) => void,
  ) => () => void;
}
export type ProfileStatus = "loading" | "saving" | "synced" | "error";
export const profileName = (name: string) => name.trim().slice(0, 40) || "em";

// A pending local edit wins on reconnect; otherwise the server's name wins.
// Keep the pending flag until the exact edit has been acknowledged.
export function startProfileSync(
  local: LocalProfile,
  remote: ProfileTransport,
  status: (status: ProfileStatus) => void,
) {
  let stopped = false;
  let busy = false;
  let initialized = false;
  let watchFailed = false;
  let stopWatch = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 500);
  };
  const fail = () => {
    if (!stopped) status("error");
  };
  const flush = async () => {
    if (stopped || busy) return;
    if (watchFailed) attachWatch();
    busy = true;
    const sent = local.get();
    if (sent.pending || !initialized)
      status(sent.pending ? "saving" : "loading");
    try {
      const name = await remote.sync(profileName(sent.name), sent.pending);
      if (stopped) return;
      initialized = true;
      const current = local.get();
      if (current.name === sent.name && current.pending === sent.pending)
        local.accept(name);
      if (local.get().pending) schedule();
      else status("synced");
    } catch {
      fail();
    } finally {
      busy = false;
    }
  };
  const attachWatch = () => {
    stopWatch();
    watchFailed = false;
    stopWatch = remote.watch(
      (name) => {
        if (!stopped && initialized && !busy && !local.get().pending) {
          local.accept(profileName(name));
          status("synced");
        }
      },
      () => {
        watchFailed = true;
        fail();
      },
    );
  };
  attachWatch();
  const stopLocal = local.subscribe(() => {
    if (!stopped && local.get().pending) {
      status("saving");
      schedule();
    }
  });
  void flush();
  return {
    retry: () => void flush(),
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      stopWatch();
      stopLocal();
    },
  };
}
