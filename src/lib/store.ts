import { create } from "zustand";
import { persist } from "zustand/middleware";
interface Preferences {
  autoLetters: boolean;
  pinyin: boolean;
  translation: boolean;
  sound: boolean;
  fontSize: number;
  theme: "light" | "dark" | "system";
  name: string;
  set: (next: Partial<Omit<Preferences, "set">>) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      autoLetters: true,
      pinyin: true,
      translation: false,
      sound: true,
      fontSize: 26,
      theme: "light",
      name: "em",
      set: (next) => set(next),
    }),
    {
      name: "hanzigo-preferences",
      version: 1,
      merge: (saved, current) => {
        const s = saved as Partial<Preferences> | undefined;
        return {
          ...current,
          autoLetters:
            typeof s?.autoLetters === "boolean" ? s.autoLetters : true,
          pinyin: typeof s?.pinyin === "boolean" ? s.pinyin : current.pinyin,
          translation:
            typeof s?.translation === "boolean"
              ? s.translation
              : current.translation,
          sound: typeof s?.sound === "boolean" ? s.sound : current.sound,
          fontSize:
            typeof s?.fontSize === "number"
              ? Math.max(20, Math.min(36, s.fontSize))
              : current.fontSize,
          theme:
            s?.theme === "dark" || s?.theme === "system" ? s.theme : "light",
          name: typeof s?.name === "string" ? s.name.slice(0, 40) : "em",
        };
      },
    },
  ),
);
interface UI {
  toast: string | null;
  notify: (message: string) => void;
  clearToast: () => void;
}
export const useUI = create<UI>((set) => ({
  toast: null,
  notify: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
export function reportError(error: unknown) {
  console.error(error);
  useUI
    .getState()
    .notify(
      error instanceof Error ? error.message : "Có lỗi xảy ra. Em thử lại nhé.",
    );
}
export const run = (action: () => Promise<unknown>) => {
  void action().catch(reportError);
};
