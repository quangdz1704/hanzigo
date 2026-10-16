import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { contentSchema, type Story } from "../content/schema";
import { bundledContent } from "../content";
import { musicCatalogSchema } from "@/content/music-schema";
import { mergeStory } from "./content-editor";
export const MAX_LIBRARY_BYTES = 800_000;
export function packLibrary(input: unknown) {
  const value = contentSchema.parse(input);
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > MAX_LIBRARY_BYTES)
    throw new Error(
      "Thư viện quá lớn: tối đa 800 KB. Cần chia thư viện trước khi thêm nội dung.",
    );
  return raw;
}
export function unpackLibrary(raw: unknown) {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > MAX_LIBRARY_BYTES
  )
    throw new Error("Dữ liệu thư viện không hợp lệ.");
  return contentSchema.parse(JSON.parse(raw));
}
export async function publishLibrary(
  store: Firestore,
  uid: string,
  input: unknown,
  initializeOnly = false,
) {
  const raw = packLibrary(input);
  await runTransaction(store, async (transaction) => {
    const ref = doc(store, "content", "library");
    const old = await transaction.get(ref);
    if (initializeOnly && old.exists())
      throw new Error("Firebase đã có thư viện. Không ghi đè bằng bản mẫu.");
    transaction.set(ref, { raw, updatedBy: uid, updatedAt: serverTimestamp() });
  });
}
export async function publishStory(
  store: Firestore,
  uid: string,
  story: Story,
) {
  await runTransaction(store, async (transaction) => {
    const ref = doc(store, "content", "library");
    const old = await transaction.get(ref);
    const base = old.exists() ? unpackLibrary(old.data().raw) : bundledContent;
    transaction.set(ref, {
      raw: packLibrary(mergeStory(base, story)),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function publishMusicCatalog(
  store: Firestore,
  uid: string,
  input: unknown,
) {
  const music = musicCatalogSchema.parse(input);
  await runTransaction(store, async (transaction) => {
    const ref = doc(store, "content", "library");
    const old = await transaction.get(ref);
    const library = old.exists()
      ? unpackLibrary(old.data().raw)
      : bundledContent;
    transaction.set(ref, {
      raw: packLibrary({ ...library, music }),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  });
}
