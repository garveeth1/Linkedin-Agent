import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import { ApprovalError, hashApprovedContent } from "../src/publishing/approval.js";
import { LinkedInClient } from "../src/publishing/linkedin-client.js";
import { publishApprovedText } from "../src/publishing/publisher.js";
import { approveRecord } from "../src/publishing/record-store.js";
import { scheduleApprovedRecord } from "../src/publishing/scheduler.js";

const execFileAsync = promisify(execFile);

function approvedRecord(final = "A real Scrum Master lesson.") {
  return {
    status: "approved",
    content: { final },
    approval: {
      approved: true,
      approved_content_hash: hashApprovedContent(final)
    },
    publishing: { linkedin_post_id: null }
  };
}

test("approves an optimized record and hashes the exact final text", () => {
  const record = approveRecord({
    status: "optimized",
    content: { final: "A specific lesson." },
    review: { blocking_issues: [] },
    approval: { approved: false }
  }, () => new Date("2026-09-18T09:00:00.000Z"));

  assert.equal(record.status, "approved");
  assert.equal(record.approval.approved_at, "2026-09-18T09:00:00.000Z");
  assert.equal(record.approval.approved_content_hash, hashApprovedContent("A specific lesson."));
});

test("blocks approval while review issues remain", () => {
  assert.throws(() => approveRecord({
    status: "optimized",
    content: { final: "A specific lesson." },
    review: { blocking_issues: ["Client name is visible."] }
  }), /blocking review issues/);
});

test("schedules an approved record without publishing it", () => {
  const scheduled = scheduleApprovedRecord(
    approvedRecord(),
    "2026-09-22T09:00:00.000Z",
    () => new Date("2026-09-21T09:00:00.000Z")
  );

  assert.equal(scheduled.status, "approved");
  assert.equal(scheduled.publishing.scheduled_at, "2026-09-22T09:00:00.000Z");
  assert.equal(scheduled.publishing.linkedin_post_id, null);
});

test("rejects a schedule in the past", () => {
  assert.throws(
    () => scheduleApprovedRecord(
      approvedRecord(),
      "2026-09-20T09:00:00.000Z",
      () => new Date("2026-09-21T09:00:00.000Z")
    ),
    /future date and time/
  );
});

test("approval command moves an optimized JSON record into the approved queue", async () => {
  const id = `test-${process.pid}-${Date.now()}`;
  const draftPath = `content/drafts/${id}.json`;
  const approvedPath = `content/approved/${id}.json`;

  await mkdir("content/drafts", { recursive: true });
  await writeFile(draftPath, JSON.stringify({
    status: "optimized",
    content: { final: "A command-level approval test." },
    review: { blocking_issues: [] },
    approval: { approved: false }
  }));

  try {
    const { stdout } = await execFileAsync(process.execPath, ["src/cli/approve-record.js", draftPath]);
    const result = JSON.parse(stdout);
    const approved = JSON.parse(await readFile(approvedPath, "utf8"));

    assert.equal(result.status, "approved");
    assert.equal(approved.status, "approved");
    assert.equal(approved.approval.approved, true);
    await assert.rejects(readFile(draftPath, "utf8"), /ENOENT/);
  } finally {
    await rm(draftPath, { force: true });
    await rm(approvedPath, { force: true });
  }
});

test("publishes the exact approved text and records the LinkedIn response", async () => {
  let request;
  const client = new LinkedInClient({
    accessToken: "test-token",
    apiVersion: "202609",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" }
      });
    }
  });

  const published = await publishApprovedText(approvedRecord(), {
    client,
    authorUrn: "urn:li:person:abc",
    now: () => new Date("2026-09-18T10:00:00.000Z")
  });

  assert.equal(request.url, "https://api.linkedin.com/rest/posts");
  assert.equal(request.options.headers["Linkedin-Version"], "202609");
  assert.equal(JSON.parse(request.options.body).commentary, "A real Scrum Master lesson.");
  assert.equal(published.status, "published");
  assert.equal(published.publishing.linkedin_post_id, "urn:li:share:123");
});

test("blocks content changed after approval", async () => {
  const record = approvedRecord();
  record.content.final = "Changed after approval.";

  await assert.rejects(
    publishApprovedText(record, {
      client: { createTextPost: () => assert.fail("API must not be called") },
      authorUrn: "urn:li:person:abc"
    }),
    ApprovalError
  );
});

test("blocks a record that already has a LinkedIn post ID", async () => {
  const record = approvedRecord();
  record.publishing.linkedin_post_id = "urn:li:share:existing";

  await assert.rejects(
    publishApprovedText(record, {
      client: { createTextPost: () => assert.fail("API must not be called") },
      authorUrn: "urn:li:person:abc"
    }),
    /already has a LinkedIn post ID/
  );
});

test("surfaces retryable status without automatically retrying a publish", async () => {
  let attempts = 0;
  const client = new LinkedInClient({
    accessToken: "test-token",
    apiVersion: "202609",
    fetchImpl: async () => {
      attempts += 1;
      return new Response("rate limited", { status: 429 });
    }
  });

  await assert.rejects(
    publishApprovedText(approvedRecord(), {
      client,
      authorUrn: "urn:li:person:abc"
    }),
    (error) => error.status === 429 && error.retryable === true
  );
  assert.equal(attempts, 1);
});