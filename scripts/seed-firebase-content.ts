import { createRequire } from "node:module";
import { bundledContent } from "../src/content";
import { packLibrary, unpackLibrary } from "../src/lib/cloud-content";
const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const project = process.argv[process.argv.indexOf("--project") + 1];
if (
  !process.argv.includes("--project") ||
  !project ||
  !/^[a-z][a-z0-9-]+$/.test(project)
)
  throw new Error(
    "Chỉ định project rõ ràng: npm run firebase:seed -- --project hanzigo-eea7d",
  );
// This script uses the existing Firebase CLI session in memory. No credential
// is written to the repository or embedded in the client application.
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account)
  throw new Error("Đăng nhập Firebase CLI trước: npx firebase login");
await requireAuth({ project, projectRoot: process.cwd(), ...account });
const api = new Client({
  urlPrefix: "https://firestore.googleapis.com",
  apiVersion: "v1",
  auth: true,
});
const database = `projects/${project}/databases/(default)`;
const name = `${database}/documents/content/library`;
const current = await api.get(`/${name}`, { resolveOnHTTPError: true });
if (current.status !== 200 && current.status !== 404)
  throw new Error(`Không đọc được thư viện Firebase (HTTP ${current.status}).`);
if (current.status === 404) {
  await api.post(`/${database}/documents:commit`, {
    writes: [
      {
        update: {
          name,
          fields: {
            raw: { stringValue: packLibrary(bundledContent) },
            updatedBy: { stringValue: "firebase-cli-bootstrap" },
          },
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
}
const confirmed = await api.get(`/${name}`);
const library = unpackLibrary(confirmed.body.fields?.raw?.stringValue);
console.log(
  JSON.stringify({
    project,
    action: current.status === 404 ? "initialized" : "kept-existing",
    stories: library.stories.length,
    vocabulary: library.stories.flatMap((s) => s.glossary).length,
    quotes: library.quotes.length,
  }),
);
