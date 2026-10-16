import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { bundledContent } from "../src/content";
import { musicCatalogSchema } from "../src/content/music-schema";
import { packLibrary, unpackLibrary } from "../src/lib/cloud-content";
const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const project = process.argv[process.argv.indexOf("--project") + 1];
if (!process.argv.includes("--project") || project !== "hanzigo-eea7d")
  throw new Error(
    "Chỉ chạy với --project hanzigo-eea7d. Mặc định xem trước; --apply để lưu.",
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
const name = `${database}/documents/content/library`;
const current = await api.get(`/${name}`);
const library = unpackLibrary(current.body.fields?.raw?.stringValue);
const seed = musicCatalogSchema.parse(bundledContent.music);
const base = library.music ?? { version: 1, tracks: [], playlists: [] };
// Add missing bundled tracks/lists; refresh only the explicitly requested playlist.
// Existing editorial metadata, other playlists and all non-music content stay intact.
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
const imported = seed.playlists.find((p) => p.id === "nhac-hoa-the-quang")!;
const music = musicCatalogSchema.parse({
  version: 1,
  tracks,
  playlists: playlists.map((p) => (p.id === imported.id ? imported : p)),
});
const raw = packLibrary({ ...library, music });
const changed = raw !== current.body.fields.raw.stringValue;
if (process.argv.includes("--apply") && changed) {
  await writeFile(
    "/tmp/hanzigo-library-before-music.json",
    JSON.stringify(current.body, null, 2),
    { mode: 0o600 },
  );
  // updateTime rejects concurrent edits rather than silently overwriting them.
  await api.post(`/${database}/documents:commit`, {
    writes: [
      {
        update: {
          name,
          fields: {
            raw: { stringValue: raw },
            updatedBy: { stringValue: "firebase-cli-music-import" },
          },
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { updateTime: current.body.updateTime },
      },
    ],
  });
  const verified = unpackLibrary(
    (await api.get(`/${name}`)).body.fields?.raw?.stringValue,
  );
  if (JSON.stringify(verified.music) !== JSON.stringify(music))
    throw new Error("Catalog readback mismatch.");
  if (
    JSON.stringify({ ...verified, music: undefined }) !==
    JSON.stringify({ ...library, music: undefined })
  )
    throw new Error(
      "Non-music content changed during readback; inspect the latest library.",
    );
}
console.log(
  JSON.stringify({
    project,
    action: process.argv.includes("--apply")
      ? changed
        ? "published-and-verified"
        : "already-current"
      : "preview",
    previousTracks: base.tracks.length,
    tracks: music.tracks.length,
    playlists: music.playlists.length,
    importedTracks: imported.videoIds.length,
    storiesPreserved: library.stories.length,
  }),
);
