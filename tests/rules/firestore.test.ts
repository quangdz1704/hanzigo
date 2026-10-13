import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
let env: RulesTestEnvironment;
const now = () => Timestamp.now();
const past = () => Timestamp.fromMillis(Date.now() - 60000);
const future = () => Timestamp.fromMillis(Date.now() + 3600000);
function message(overrides: Record<string, unknown> = {}) {
  return {
    recipientUid: "wife",
    title: "Thư cho em",
    zhText: "",
    pinyin: "",
    viText: "Chúc em một ngày thật vui.",
    theme: "rose",
    deliveryType: "instant",
    status: "published",
    visibleAt: past(),
    scheduledAt: null,
    milestoneKind: "stories",
    milestoneCount: 1,
    publishedAt: past(),
    createdAt: past(),
    updatedAt: past(),
    ...overrides,
  };
}
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
  await env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore();
    await setDoc(doc(f, "config", "admins"), { uids: ["husband"] });
    await setDoc(doc(f, "messages", "instant"), message());
    await setDoc(
      doc(f, "messages", "draft"),
      message({ status: "draft", publishedAt: null }),
    );
    await setDoc(
      doc(f, "messages", "future"),
      message({
        status: "scheduled",
        deliveryType: "scheduled",
        scheduledAt: future(),
        visibleAt: future(),
      }),
    );
    await setDoc(
      doc(f, "messages", "due"),
      message({
        status: "scheduled",
        deliveryType: "scheduled",
        scheduledAt: past(),
        visibleAt: past(),
      }),
    );
    await setDoc(
      doc(f, "messages", "other"),
      message({ recipientUid: "other-wife" }),
    );
  });
});
describe("deny-by-default message security", () => {
  it("unauthenticated clients cannot read any letters or write messages", async () => {
    const f = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(f, "messages", "instant")));
    await assertFails(getDoc(doc(f, "messages", "draft")));
    await assertFails(setDoc(doc(f, "messages", "forged"), message()));
  });
  it("learners can only read their own delivered letters", async () => {
    const f = env.authenticatedContext("wife").firestore();
    await assertSucceeds(getDoc(doc(f, "messages", "instant")));
    await assertSucceeds(getDoc(doc(f, "messages", "due")));
    await assertFails(getDoc(doc(f, "messages", "other")));
    await assertFails(getDoc(doc(f, "messages", "draft")));
    await assertFails(getDoc(doc(f, "messages", "future")));
  });
  it("server time rejects future reads and malicious future query bounds", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const q = query(
      collection(f, "messages"),
      where("recipientUid", "==", "wife"),
      where("status", "in", ["published", "scheduled"]),
      where("visibleAt", "<=", future()),
      orderBy("visibleAt", "desc"),
    );
    await assertFails(getDocs(q));
  });
  it("the exact production query only returns due recipient messages", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const q = query(
      collection(f, "messages"),
      where("recipientUid", "==", "wife"),
      where("status", "in", ["published", "scheduled"]),
      where("visibleAt", "<=", Timestamp.fromMillis(Date.now() - 5000)),
      orderBy("visibleAt", "desc"),
    );
    const s = await assertSucceeds(getDocs(q));
    expect(s.docs.map((d) => d.id).sort()).toEqual(["due", "instant"]);
  });
  it("instant publication supports realtime without a client time bound", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const q = query(
      collection(f, "messages"),
      where("recipientUid", "==", "wife"),
      where("status", "==", "published"),
      orderBy("visibleAt", "desc"),
    );
    const s = await assertSucceeds(getDocs(q));
    expect(s.docs.map((d) => d.id)).toEqual(["instant"]);
  });
  it("learners cannot edit, create or delete the admin body", async () => {
    const f = env.authenticatedContext("wife").firestore();
    await assertFails(
      updateDoc(doc(f, "messages", "instant"), { viText: "forged" }),
    );
    await assertFails(setDoc(doc(f, "messages", "forged"), message()));
    await assertFails(deleteDoc(doc(f, "messages", "instant")));
  });
  it("being authenticated alone is insufficient for admin access", async () => {
    const f = env.authenticatedContext("not-whitelisted").firestore();
    await assertFails(getDoc(doc(f, "config", "admins")));
    await assertFails(getDocs(collection(f, "messages")));
    await assertFails(setDoc(doc(f, "messages", "forged"), message()));
  });
  it("whitelisted admin can create, update, archive and delete messages", async () => {
    const f = env.authenticatedContext("husband").firestore();
    await assertSucceeds(getDocs(collection(f, "messages")));
    await assertSucceeds(
      setDoc(
        doc(f, "messages", "new"),
        message({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          visibleAt: serverTimestamp(),
          publishedAt: serverTimestamp(),
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(f, "messages", "new"), {
        title: "New title",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(f, "messages", "draft"), {
        status: "archived",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(f, "messages", "new")));
  });
  it("admin scheduling validates delivery semantics", async () => {
    const f = env.authenticatedContext("husband").firestore();
    const at = future();
    await assertSucceeds(
      setDoc(
        doc(f, "messages", "scheduled"),
        message({
          status: "scheduled",
          deliveryType: "scheduled",
          visibleAt: at,
          scheduledAt: at,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: serverTimestamp(),
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(f, "messages", "bad-schedule"),
        message({
          status: "published",
          deliveryType: "scheduled",
          visibleAt: at,
          scheduledAt: at,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: serverTimestamp(),
        }),
      ),
    );
  });
  it("the admin allowlist cannot be changed by any client", async () => {
    const f = env.authenticatedContext("husband").firestore();
    await assertFails(
      updateDoc(doc(f, "config", "admins"), { uids: ["wife"] }),
    );
    const learner = env.authenticatedContext("wife").firestore();
    await assertFails(
      setDoc(doc(learner, "config", "admins"), { uids: ["wife"] }),
    );
  });
});
describe("recipient identity and separated receipts", () => {
  it("learners register only their own device, with server timestamps", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const data = {
      uid: "wife",
      label: "Phone",
      createdAt: serverTimestamp(),
      lastPing: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(f, "devices", "wife"), data));
    await assertFails(
      setDoc(doc(f, "devices", "other"), { ...data, uid: "other" }),
    );
    await assertFails(getDocs(collection(f, "devices")));
  });
  it("only the recipient can mark read or heart; body remains untouched", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const receipt = {
      recipientUid: "wife",
      messageId: "instant",
      seenAt: serverTimestamp(),
      readAt: serverTimestamp(),
      heartedAt: serverTimestamp(),
      favoritedAt: null,
      dismissedAt: null,
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(f, "devices", "wife", "receipts", "instant"), receipt),
    );
    const other = env.authenticatedContext("other-wife").firestore();
    await assertFails(
      setDoc(doc(other, "devices", "wife", "receipts", "instant"), receipt),
    );
    await assertFails(
      getDoc(doc(other, "devices", "wife", "receipts", "instant")),
    );
    await assertSucceeds(
      getDoc(
        doc(
          env.authenticatedContext("husband").firestore(),
          "devices",
          "wife",
          "receipts",
          "instant",
        ),
      ),
    );
  });
  it("receipts cannot add body fields or refer to a future or other-recipient message", async () => {
    const f = env.authenticatedContext("wife").firestore();
    const receipt = {
      recipientUid: "wife",
      messageId: "future",
      seenAt: serverTimestamp(),
      readAt: null,
      heartedAt: null,
      favoritedAt: null,
      dismissedAt: null,
      updatedAt: serverTimestamp(),
    };
    await assertFails(
      setDoc(doc(f, "devices", "wife", "receipts", "future"), receipt),
    );
    await assertFails(
      setDoc(doc(f, "devices", "wife", "receipts", "other"), {
        ...receipt,
        messageId: "other",
      }),
    );
    await assertFails(
      setDoc(doc(f, "devices", "wife", "receipts", "instant"), {
        ...receipt,
        messageId: "instant",
        viText: "forged",
      }),
    );
  });
  it("denies arbitrary collection access", async () => {
    const f = env.authenticatedContext("wife").firestore();
    await assertFails(getDoc(doc(f, "secrets", "one")));
    await assertFails(setDoc(doc(f, "secrets", "one"), { secret: true }));
  });
});

describe("account profile metadata", () => {
  const token = {
    email: "wife@example.test",
    firebase: { sign_in_provider: "password" as const },
  };
  const data = () => ({
    uid: "wife",
    label: "Mai",
    name: "Mai",
    email: "wife@example.test",
    createdAt: serverTimestamp(),
    lastPing: serverTimestamp(),
  });
  it("the account owner writes their name/email and the admin can identify the recipient", async () => {
    const f = env.authenticatedContext("wife", token).firestore();
    await assertSucceeds(setDoc(doc(f, "devices", "wife"), data()));
    const admin = env.authenticatedContext("husband").firestore();
    const list = await assertSucceeds(getDocs(collection(admin, "devices")));
    expect(list.docs[0].data().name).toBe("Mai");
    expect(list.docs[0].data().email).toBe("wife@example.test");
    await assertSucceeds(
      updateDoc(doc(f, "devices", "wife"), {
        name: "Mai Anh",
        label: "Mai Anh",
        lastPing: serverTimestamp(),
      }),
    );
    // Heartbeat updates preserve optional profile fields and legacy documents still work.
    await assertSucceeds(
      updateDoc(doc(f, "devices", "wife"), { lastPing: serverTimestamp() }),
    );
    expect((await getDoc(doc(f, "devices", "wife"))).data()?.name).toBe(
      "Mai Anh",
    );
  });
  it("rejects forged emails, extra fields, long names and foreign profile access", async () => {
    const f = env.authenticatedContext("wife", token).firestore();
    await assertFails(
      setDoc(doc(f, "devices", "wife"), {
        ...data(),
        email: "victim@example.test",
      }),
    );
    await assertFails(
      setDoc(doc(f, "devices", "wife"), { ...data(), name: "x".repeat(41) }),
    );
    await assertFails(
      setDoc(doc(f, "devices", "wife"), { ...data(), role: "admin" }),
    );
    await assertSucceeds(setDoc(doc(f, "devices", "wife"), data()));
    const other = env.authenticatedContext("other-wife", token).firestore();
    await assertFails(getDoc(doc(other, "devices", "wife")));
    await assertFails(
      updateDoc(doc(other, "devices", "wife"), {
        name: "Forged",
        lastPing: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(
        doc(env.authenticatedContext("husband").firestore(), "devices", "wife"),
        { name: "Forged", lastPing: serverTimestamp() },
      ),
    );
  });
  it("guests can keep legacy device records but cannot write an account name/email", async () => {
    const f = env
      .authenticatedContext("wife", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore();
    await assertFails(setDoc(doc(f, "devices", "wife"), data()));
    const { name: _name, email: _email, ...legacy } = data();
    await assertSucceeds(setDoc(doc(f, "devices", "wife"), legacy));
    await assertFails(
      updateDoc(doc(f, "devices", "wife"), {
        name: "Cloud guest",
        lastPing: serverTimestamp(),
      }),
    );
    const owner = env.authenticatedContext("wife", token).firestore();
    await assertSucceeds(
      updateDoc(doc(owner, "devices", "wife"), {
        name: "Mai",
        email: token.email,
        lastPing: serverTimestamp(),
      }),
    );
  });
});
