import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { approveRecord } from "../publishing/record-store.js";

const workspaceRoot = process.cwd();
const draftsDirectory = path.resolve(workspaceRoot, "content", "drafts");
const approvedDirectory = path.resolve(workspaceRoot, "content", "approved");
const suppliedPath = process.argv[2];

if (!suppliedPath) {
  throw new Error("Usage: npm run approve -- content/drafts/<record>.json");
}

const sourcePath = path.resolve(workspaceRoot, suppliedPath);
if (path.dirname(sourcePath) !== draftsDirectory || path.extname(sourcePath) !== ".json") {
  throw new Error("Approval input must be a JSON file directly under content/drafts.");
}

const record = JSON.parse(await readFile(sourcePath, "utf8"));
const approvedRecord = approveRecord(record);
const destinationPath = path.join(approvedDirectory, path.basename(sourcePath));
const temporaryPath = `${destinationPath}.tmp`;

await mkdir(approvedDirectory, { recursive: true });
await writeFile(temporaryPath, `${JSON.stringify(approvedRecord, null, 2)}\n`, { flag: "wx" });
await rename(temporaryPath, destinationPath);
await unlink(sourcePath);

console.log(JSON.stringify({
  status: approvedRecord.status,
  record: path.relative(workspaceRoot, destinationPath),
  approved_at: approvedRecord.approval.approved_at
}));