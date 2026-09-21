import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { LinkedInClient } from "../publishing/linkedin-client.js";
import { publishApprovedText } from "../publishing/publisher.js";

const workspaceRoot = process.cwd();
const approvedDirectory = path.resolve(workspaceRoot, "content", "approved");
const suppliedPath = process.argv[2];

if (!suppliedPath) {
  throw new Error("Usage: npm run publish -- content/approved/<record>.json");
}

const recordPath = path.resolve(workspaceRoot, suppliedPath);
if (path.dirname(recordPath) !== approvedDirectory || path.extname(recordPath) !== ".json") {
  throw new Error("Publishing input must be a JSON file directly under content/approved.");
}

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
const authorUrn = process.env.LINKEDIN_AUTHOR_URN;
const apiVersion = process.env.LINKEDIN_API_VERSION;
if (!accessToken || !authorUrn || !apiVersion) {
  throw new Error("LinkedIn access token, author URN, and API version must be provided at runtime.");
}

const record = JSON.parse(await readFile(recordPath, "utf8"));
const client = new LinkedInClient({ accessToken, apiVersion });
const publishedRecord = await publishApprovedText(record, { client, authorUrn });
const temporaryPath = `${recordPath}.tmp`;

await writeFile(temporaryPath, `${JSON.stringify(publishedRecord, null, 2)}\n`, { flag: "wx" });
await rename(temporaryPath, recordPath);

console.log(JSON.stringify({
  status: publishedRecord.status,
  linkedin_post_id: publishedRecord.publishing.linkedin_post_id,
  published_at: publishedRecord.publishing.published_at
}));