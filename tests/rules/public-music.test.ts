import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
let env: RulesTestEnvironment;
const uid = "music-owner";
const id = randomUUID();
const value = {
  id,
  name: "Playlist của tôi",
  raw: "[]",
  deleted: false,
  visibility: "public",
  updatedAt: 10,
};
const privateRef = (store: ReturnType<RulesTestContext["firestore"]>) =>
  doc(store, "users", uid, "musicPlaylists", id);
const publicRef = (store: ReturnType<RulesTestContext["firestore"]>) =>
  doc(store, "publicMusicPlaylists", `${uid}_${id}`);
const wrapper = (v: Record<string, unknown>) => ({
  value: v,
  updatedAt: serverTimestamp(),
});
const projection = (extra = {}) => ({
  playlistId: id,
  ownerUid: uid,
  authorName: "Người tạo",
  name: value.name,
  raw: value.raw,
  sourceUpdatedAt: value.updatedAt,
  updatedAt: serverTimestamp(),
  ...extra,
});
const owner = () =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "password" } })
    .firestore();
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hanzigo",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "users", uid), { name: "Người tạo" }),
  );
});
async function publish(extra = {}) {
  const store = owner();
  const batch = writeBatch(store);
  batch.set(privateRef(store), wrapper(value));
  batch.set(publicRef(store), projection(extra));
  return batch.commit();
}
it("requires atomic publication and displays public data to guests without exposing private rows", async () => {
  const store = owner();
  await assertFails(setDoc(privateRef(store), wrapper(value)));
  await assertFails(setDoc(publicRef(store), projection()));
  await assertSucceeds(publish());
  const guest = env.unauthenticatedContext().firestore();
  expect(
    (await assertSucceeds(getDocs(collection(guest, "publicMusicPlaylists"))))
      .size,
  ).toBe(1);
  await assertFails(getDoc(privateRef(guest)));
  const other = env.authenticatedContext("another-user").firestore();
  await assertFails(getDoc(privateRef(other)));
  await assertFails(
    setDoc(publicRef(other), projection({ authorName: "Forged" })),
  );
  await assertFails(deleteDoc(publicRef(other)));
});
it("rejects forged author, email exposure, mismatched content and anonymous publication", async () => {
  for (const extra of [
    { authorName: "Giả mạo" },
    { email: "private@example.test" },
    { raw: '["different"]' },
    { ownerUid: "victim" },
    { sourceUpdatedAt: 11 },
  ])
    await assertFails(publish(extra));
  const anon = env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore();
  const batch = writeBatch(anon);
  batch.set(privateRef(anon), wrapper(value));
  batch.set(publicRef(anon), projection());
  await assertFails(batch.commit());
});
it("atomically revokes public copies when switching to private or hiding", async () => {
  await assertSucceeds(publish());
  const store = owner();
  await assertFails(
    setDoc(
      privateRef(store),
      wrapper({ ...value, visibility: "private", updatedAt: 20 }),
    ),
  );
  await assertFails(deleteDoc(publicRef(store)));
  let batch = writeBatch(store);
  batch.set(
    privateRef(store),
    wrapper({ ...value, visibility: "private", updatedAt: 20 }),
  );
  batch.delete(publicRef(store));
  await assertSucceeds(batch.commit());
  expect((await getDoc(publicRef(store))).exists()).toBe(false);
  await assertSucceeds(publish());
  batch = writeBatch(store);
  batch.set(
    privateRef(store),
    wrapper({ ...value, deleted: true, updatedAt: 30 }),
  );
  batch.delete(publicRef(store));
  await assertSucceeds(batch.commit());
  expect((await getDoc(publicRef(store))).exists()).toBe(false);
});
