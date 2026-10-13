import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { usePreferences } from "./store";
import {
  profileName,
  startProfileSync,
  type LocalProfile,
  type ProfileStatus,
  type ProfileTransport,
} from "./profile-sync";

interface NameCache {
  guestName: string | null;
  migrated: boolean;
  accounts: Record<string, { name: string; pending: boolean }>;
}
export const useNameCache = create<NameCache>()(
  persist<NameCache>(
    () => ({
      guestName: null,
      migrated: false,
      accounts: {},
    }),
    {
      name: "hanzigo-account-names",
      version: 1,
      merge: (saved, current) => {
        const data = saved as Partial<NameCache> | undefined;
        const accounts: NameCache["accounts"] = {};
        if (data?.accounts && typeof data.accounts === "object") {
          for (const [uid, entry] of Object.entries(data.accounts)) {
            if (entry && typeof entry.name === "string")
              accounts[uid] = {
                name: entry.name.slice(0, 40),
                pending: entry.pending === true,
              };
          }
        }
        return {
          ...current,
          accounts,
          migrated: data?.migrated === true,
          guestName:
            typeof data?.guestName === "string"
              ? data.guestName.slice(0, 40)
              : null,
        };
      },
    },
  ),
);

let owner: string | null = null;
export function restoreGuestName() {
  const cache = useNameCache.getState();
  const name =
    cache.guestName ?? (cache.migrated ? "em" : usePreferences.getState().name);
  owner = null;
  useNameCache.setState({ guestName: name });
  usePreferences.setState({ name });
}

export function deviceProfileTransport(
  store: Firestore,
  user: Pick<User, "uid" | "email">,
): ProfileTransport {
  const ref = doc(store, "devices", user.uid);
  return {
    sync: (name, overwrite) =>
      runTransaction(store, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const old = snapshot.data();
        const chosen =
          !overwrite && typeof old?.name === "string"
            ? profileName(old.name)
            : profileName(name);
        transaction.set(
          ref,
          {
            uid: user.uid,
            name: chosen,
            label: chosen,
            email: user.email,
            createdAt: old?.createdAt ?? serverTimestamp(),
            lastPing: serverTimestamp(),
          },
          { merge: true },
        );
        return chosen;
      }),
    watch: (next, error) =>
      onSnapshot(
        ref,
        (snapshot) => {
          const name = snapshot.data()?.name;
          if (!snapshot.metadata.hasPendingWrites && typeof name === "string")
            next(name);
        },
        error,
      ),
  };
}

export function accountNameLocal(
  user: Pick<User, "uid" | "displayName">,
): LocalProfile {
  const cache = useNameCache.getState();
  // Import the old browser-only name once, without copying account A's name to B.
  const guestName =
    cache.guestName ?? (cache.migrated ? "em" : usePreferences.getState().name);
  const initial =
    !cache.migrated && guestName.trim() && guestName !== "em"
      ? guestName
      : (user.displayName ?? "em");
  const entry = cache.accounts[user.uid] ?? {
    name: profileName(initial),
    pending: false,
  };
  owner = user.uid;
  useNameCache.setState({
    guestName,
    migrated: true,
    accounts: { ...cache.accounts, [user.uid]: entry },
  });
  usePreferences.setState({ name: entry.name });
  let applying = false;
  return {
    get: () => useNameCache.getState().accounts[user.uid],
    accept: (name) => {
      if (owner !== user.uid) return;
      applying = true;
      useNameCache.setState((current) => ({
        accounts: { ...current.accounts, [user.uid]: { name, pending: false } },
      }));
      usePreferences.setState({ name });
      applying = false;
    },
    subscribe: (next) =>
      usePreferences.subscribe((current, previous) => {
        if (applying || owner !== user.uid || current.name === previous.name)
          return;
        useNameCache.setState((cache) => ({
          accounts: {
            ...cache.accounts,
            [user.uid]: { name: current.name, pending: true },
          },
        }));
        next();
      }),
  };
}

export function connectAccountProfile(
  store: Firestore,
  user: User,
  status: (status: ProfileStatus) => void,
) {
  return startProfileSync(
    accountNameLocal(user),
    deviceProfileTransport(store, user),
    status,
  );
}

// Guests keep their own browser name even after a registered user logs out.
usePreferences.subscribe((current, previous) => {
  if (owner === null && current.name !== previous.name)
    useNameCache.setState({ guestName: current.name });
});
