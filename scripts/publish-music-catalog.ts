import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import musicSeed from "../src/content/music-seed.json";
import { musicCatalogSchema } from "../src/content/music-schema";
import { musicManifestSchema } from "../src/lib/music-catalog";
import { packLibrary, unpackLibrary } from "../src/lib/cloud-content";
const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const project = process.argv[process.argv.indexOf("--project") + 1];
if (!process.argv.includes("--project") || project !== "hanzigo-eea7d")
  throw new Error(
    "Chỉ chạy với --project hanzigo-eea7d; --apply để ghi; --profiles để tạo hồ sơ Auth còn thiếu.",
  );
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Cần đăng nhập Firebase CLI.");
await requireAuth({ project, projectRoot: process.cwd(), ...account });
const api = new Client({
  urlPrefix: "https://firestore.googleapis.com",
  apiVersion: "v1",
  auth: true,
});
const database = `projects/${project}/databases/(default)`;
const root = `${database}/documents`;
type Value = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: Value[] };
};
function encode(value: unknown): Value {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  throw new Error("Unsupported metadata value.");
}
function decode(value: Value): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  return null;
}
const read = async (path: string) => {
  const response = await api.get(`/${root}/${path}`, {
    resolveOnHTTPError: true,
  });
  if (![200, 404].includes(response.status))
    throw new Error(
      `Không đọc được ${path.split("/")[0]} (HTTP ${response.status}).`,
    );
  return response.status === 200 ? response.body : null;
};
const fieldsOf = (row: { fields: Record<string, Value> }) =>
  Object.fromEntries(
    Object.entries(row.fields).map(([key, value]) => [key, decode(value)]),
  );
const libraryDoc = await read("content/library");
if (!libraryDoc) throw new Error("Thư viện truyện chưa tồn tại.");
const library = unpackLibrary(libraryDoc.fields.raw.stringValue);
const manifestDoc = await read("musicCatalog/current");
const existing = new Map<string, { updateTime: string }>();
let canonical;
if (manifestDoc) {
  const {
    updatedAt: _at,
    updatedBy: _by,
    ...manifestData
  } = fieldsOf(manifestDoc);
  const manifest = musicManifestSchema.parse(manifestData);
  const load = async (collection: string, id: string) => {
    const path = `${collection}/${id}`,
      row = await read(path);
    if (!row)
      throw new Error(
        "Thư viện nhạc hiện tại thiếu dữ liệu; dừng để tránh ghi đè.",
      );
    existing.set(path, row);
    const { revision, updatedAt: _at, updatedBy: _by, ...data } = fieldsOf(row);
    if (revision !== manifest.revision)
      throw new Error("Catalog revision mismatch.");
    return data;
  };
  const [tracks, playlists] = await Promise.all([
    Promise.all(manifest.trackIds.map((id) => load("musicTracks", id))),
    Promise.all(manifest.playlistIds.map((id) => load("musicPlaylists", id))),
  ]);
  canonical = musicCatalogSchema.parse({ version: 1, tracks, playlists });
}
const seed = musicCatalogSchema.parse(musicSeed);
const base = canonical ??
  library.music ?? { version: 1, tracks: [], playlists: [] };
const tracks = [
  ...new Map(
    [...seed.tracks, ...base.tracks].map((t) => [t.videoId, t]),
  ).values(),
];
const playlists = [
  ...new Map(
    [...seed.playlists, ...base.playlists].map((p) => [p.id, p]),
  ).values(),
];
const music = musicCatalogSchema.parse({ version: 1, tracks, playlists });
const { music: _legacyMusic, ...storyLibrary } = library;
const raw = packLibrary(storyLibrary);
const profiles: {
  uid: string;
  name: string;
  email: string | null;
  createdAt?: string;
}[] = [];
if (process.argv.includes("--profiles")) {
  const identity = new Client({
    urlPrefix: "https://identitytoolkit.googleapis.com",
    apiVersion: "v1",
    auth: true,
  });
  let pageToken: string | undefined;
  do {
    const response: {
      body: {
        users?: {
          localId: string;
          displayName?: string;
          email?: string;
          providerUserInfo?: unknown[];
          createdAt?: string;
        }[];
        nextPageToken?: string;
      };
    } = await identity.get(`/projects/${project}/accounts:batchGet`, {
      queryParams: {
        maxResults: 1000,
        ...(pageToken ? { nextPageToken: pageToken } : {}),
      },
    });
    for (const user of response.body.users ?? []) {
      if (!user.email && !user.providerUserInfo?.length) continue;
      if (await read(`users/${user.localId}`)) continue;
      const created = Number(user.createdAt);
      profiles.push({
        uid: user.localId,
        name:
          String(user.displayName || user.email?.split("@")[0] || "Tài khoản")
            .trim()
            .slice(0, 40) || "Tài khoản",
        email: user.email ?? null,
        ...(Number.isFinite(created) && created > 0
          ? { createdAt: new Date(created).toISOString() }
          : {}),
      });
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
}
const writes: unknown[] = [];
const catalogChanged =
  !canonical || JSON.stringify(canonical) !== JSON.stringify(music);
const revision = crypto.randomUUID();
function catalogWrite(
  path: string,
  data: Record<string, unknown>,
  prior?: { updateTime: string } | null,
) {
  return {
    update: {
      name: `${root}/${path}`,
      fields: Object.fromEntries(
        Object.entries({
          ...data,
          revision,
          updatedBy: "firebase-cli-music-migration",
        }).map(([key, value]) => [key, encode(value)]),
      ),
    },
    updateTransforms: [
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
    ],
    currentDocument: prior
      ? { updateTime: prior.updateTime }
      : { exists: false },
  };
}
if (catalogChanged) {
  for (const track of music.tracks) {
    const path = `musicTracks/${track.videoId}`;
    writes.push(catalogWrite(path, track, existing.get(path)));
  }
  for (const list of music.playlists) {
    const path = `musicPlaylists/${list.id}`;
    writes.push(catalogWrite(path, list, existing.get(path)));
  }
  writes.push(
    catalogWrite(
      "musicCatalog/current",
      {
        version: 1,
        trackIds: tracks.map((t) => t.videoId),
        playlistIds: playlists.map((p) => p.id),
      },
      manifestDoc,
    ),
  );
}
if (raw !== libraryDoc.fields.raw.stringValue)
  writes.push({
    update: {
      name: `${root}/content/library`,
      fields: {
        raw: encode(raw),
        updatedBy: encode("firebase-cli-music-migration"),
      },
    },
    updateTransforms: [
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
    ],
    currentDocument: { updateTime: libraryDoc.updateTime },
  });
for (const profile of profiles)
  writes.push({
    update: {
      name: `${root}/users/${profile.uid}`,
      fields: {
        uid: encode(profile.uid),
        name: encode(profile.name),
        email: encode(profile.email),
        ...(profile.createdAt
          ? { createdAt: { timestampValue: profile.createdAt } }
          : {}),
      },
    },
    updateTransforms: [
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
      ...(!profile.createdAt
        ? [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]
        : []),
    ],
    currentDocument: { exists: false },
  });
if (process.argv.includes("--apply") && writes.length) {
  if (writes.length > 450)
    throw new Error(
      "Quá nhiều thay đổi cho một lần migration; cần chia batch rõ ràng.",
    );
  await writeFile(
    "/tmp/hanzigo-before-normalized-music.json",
    JSON.stringify({ library: libraryDoc, manifest: manifestDoc }),
    { mode: 0o600 },
  );
  await api.post(`/${database}/documents:commit`, { writes });
  const confirmed = unpackLibrary(
    (await read("content/library")).fields.raw.stringValue,
  );
  if (JSON.stringify(confirmed) !== JSON.stringify(storyLibrary))
    throw new Error("Non-music library readback mismatch.");
  const manifest = fieldsOf(await read("musicCatalog/current"));
  if (
    JSON.stringify(manifest.trackIds) !==
    JSON.stringify(tracks.map((t) => t.videoId))
  )
    throw new Error("Music manifest readback mismatch.");
  for (const profile of profiles)
    if (!(await read(`users/${profile.uid}`)))
      throw new Error("Profile readback missing.");
}
console.log(
  JSON.stringify({
    project,
    action: process.argv.includes("--apply")
      ? writes.length
        ? "migrated-and-verified"
        : "already-current"
      : "preview",
    tracks: tracks.length,
    playlists: playlists.length,
    profilesToCreate: profiles.length,
    storiesPreserved: storyLibrary.stories.length,
    storyBytes: Buffer.byteLength(raw),
    writes: writes.length,
  }),
);
