import { randomBytes } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
  buildAuthorizationUrl,
  createOAuthState,
  exchangeAuthorizationCode,
  fetchCurrentMember,
  verifyOAuthState
} from "./oauth/linkedin-oauth.js";
import { LinkedInClient } from "./publishing/linkedin-client.js";
import { publishApprovedText } from "./publishing/publisher.js";

const workspaceRoot = process.cwd();
const approvedDirectory = path.resolve(workspaceRoot, "content", "approved");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const csrfToken = randomBytes(32).toString("base64url");
const oauthStates = new Map();
let accessToken = null;
let authorizedMember = null;
let scheduleCheckInProgress = false;

function configuration() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI,
    apiVersion: process.env.LINKEDIN_API_VERSION
  };
}

function missingConfiguration(config) {
  return Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").filter(Boolean).map((entry) => {
    const [name, ...parts] = entry.trim().split("=");
    return [name, decodeURIComponent(parts.join("="))];
  }));
}

async function approvedRecords() {
  let names = [];
  try {
    names = await readdir(approvedDirectory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const records = [];
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    const record = JSON.parse(await readFile(path.join(approvedDirectory, name), "utf8"));
    if (record.status === "approved" && record.approval?.approved === true) {
      records.push({ name, record });
    }
  }
  return records;
}

async function renderHome(message = "") {
  const config = configuration();
  const missing = missingConfiguration(config);
  const records = await approvedRecords();
  const configured = missing.length === 0;

  const recordMarkup = records.length === 0
    ? "<p class=empty>No approved posts are waiting.</p>"
    : records.map(({ name, record }) => {
      const scheduledAt = record.publishing?.scheduled_at;
      const needsManualHandoff = (record.assets?.media?.length ?? 0) > 0
        || (record.assets?.company_tag_requests?.length ?? 0) > 0;
      const scheduleMarkup = needsManualHandoff
        ? `<p class=status>Manual LinkedIn handoff required: upload the approved media and select the requested native company tag. This text-only scheduler is disabled for this post.</p>`
        : scheduledAt
        ? `<p class=status>Legacy local schedule: ${escapeHtml(scheduledAt)}. Keep this server running and LinkedIn authorized.</p>`
        : `<p class=status>For a future post, copy this exact text into LinkedIn and use its native scheduler.</p>
        <form method=post action=/publish-now>
          <input type=hidden name=csrf value="${csrfToken}">
          <input type=hidden name=record value="${escapeHtml(name)}">
          <label><input type=checkbox name=confirm value=publish required> I confirm this exact approved post should be published now.</label>
          <button type=submit ${accessToken ? "" : "disabled"}>Publish now</button>
        </form>`;
      return `
      <article>
        <div class=meta>${escapeHtml(record.id ?? name)} · approved ${escapeHtml(record.approval.approved_at ?? "")}</div>
        <pre>${escapeHtml(record.content.final)}</pre>
        ${scheduleMarkup}
      </article>`;
    }).join("");

  return `<!doctype html>
<html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>LinkedIn Content Control</title>
<style>
:root{color-scheme:light;--ink:#17202a;--muted:#5d6d7e;--line:#d5d8dc;--green:#196f3d;--amber:#9a6700;--paper:#f7f9f9;--accent:#0a66c2}*{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#eef4f2,#f8fafc 55%,#edf3f9);color:var(--ink);font:16px/1.5 Georgia,serif;min-height:100vh}main{width:min(920px,calc(100% - 32px));margin:0 auto;padding:48px 0 72px}header{border-bottom:2px solid var(--ink);padding-bottom:18px;margin-bottom:30px}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1;margin:0 0 12px;letter-spacing:0}h2{font-size:1.35rem;margin:34px 0 12px;letter-spacing:0}.status{font-family:Consolas,monospace;color:var(--muted)}.ok{color:var(--green)}.warn{color:var(--amber)}.notice{background:#fff;border-left:4px solid var(--accent);padding:12px 16px;margin:18px 0}article{background:#fff;border:1px solid var(--line);border-radius:6px;padding:22px;margin:18px 0;box-shadow:0 8px 24px #1f29370d}.meta{font:13px/1.4 Consolas,monospace;color:var(--muted);margin-bottom:16px}pre{white-space:pre-wrap;word-break:break-word;font:16px/1.55 Georgia,serif;margin:0 0 22px}form{border-top:1px solid var(--line);padding-top:18px}label{display:block;margin-bottom:14px}button,.button{display:inline-flex;align-items:center;background:var(--accent);color:#fff;border:0;border-radius:4px;padding:10px 15px;text-decoration:none;font:600 14px/1.2 Consolas,monospace;cursor:pointer}button:disabled{background:#aab7b8;cursor:not-allowed}.empty{color:var(--muted);font-style:italic}code{font-family:Consolas,monospace;background:#fff;padding:2px 5px;border:1px solid var(--line)}
</style></head><body><main>
<header><h1>LinkedIn Content Control</h1><div class=status>Human approval · official API · no browser automation</div></header>
${message ? `<div class=notice>${escapeHtml(message)}</div>` : ""}
<h2>Connection</h2>
<p class="status ${configured ? "ok" : "warn"}">${configured ? "Runtime configuration found." : `Missing runtime settings: ${escapeHtml(missing.join(", "))}`}</p>
  <p class="status ${accessToken ? "ok" : "warn"}">${accessToken ? `LinkedIn authorized for this server session${authorizedMember?.name ? ` as ${escapeHtml(authorizedMember.name)}` : ""}.` : "LinkedIn is not authorized for this server session."}</p>
${configured ? "<a class=button href=/auth/linkedin/start>Authorize LinkedIn</a>" : "<p>Set the runtime values described in <code>docs/publishing.md</code>, then restart this server.</p>"}
<h2>Approved Queue</h2>${recordMarkup}
</main></body></html>`;
}

async function readForm(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
  response.end(body);
}

async function saveRecord(recordPath, record) {
  const temporaryPath = `${recordPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  await rename(temporaryPath, recordPath);
}

async function publishDueScheduledPosts() {
  if (scheduleCheckInProgress || !accessToken || !authorizedMember) return;
  scheduleCheckInProgress = true;

  try {
    const config = configuration();
    const records = await approvedRecords();
    for (const { name, record } of records) {
      const scheduledAt = Date.parse(record.publishing?.scheduled_at ?? "");
      if (Number.isNaN(scheduledAt) || scheduledAt > Date.now() || record.publishing?.schedule_failed_at) continue;

      const recordPath = path.join(approvedDirectory, name);
      const client = new LinkedInClient({ accessToken, apiVersion: config.apiVersion });
      try {
        const publishedRecord = await publishApprovedText(record, { client, authorUrn: authorizedMember.authorUrn });
        await saveRecord(recordPath, publishedRecord);
        console.log(`Published scheduled post: ${name}`);
      } catch (error) {
        await saveRecord(recordPath, {
          ...record,
          publishing: {
            ...record.publishing,
            schedule_failed_at: new Date().toISOString(),
            schedule_failure: error.message
          }
        });
        console.error(`Scheduled post failed and will not be retried automatically: ${name}`, error.message);
      }
    }
  } finally {
    scheduleCheckInProgress = false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/") {
      return send(response, 200, await renderHome());
    }

    if (request.method === "GET" && url.pathname === "/auth/linkedin/start") {
      const config = configuration();
      if (missingConfiguration(config).length > 0) return send(response, 503, await renderHome("Complete runtime configuration first."));

      const state = createOAuthState();
      oauthStates.set(state, Date.now() + 10 * 60 * 1000);
      const authorizationUrl = buildAuthorizationUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state,
        scopes: ["openid", "profile", "w_member_social"]
      });
      response.writeHead(302, {
        Location: authorizationUrl,
        "Set-Cookie": `linkedin_oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
      });
      return response.end();
    }

    if (request.method === "GET" && url.pathname === "/auth/linkedin/callback") {
      const config = configuration();
      const returnedState = url.searchParams.get("state");
      const expectedState = parseCookies(request.headers.cookie).linkedin_oauth_state;
      verifyOAuthState(expectedState, returnedState);
      const expiresAt = oauthStates.get(returnedState);
      oauthStates.delete(returnedState);
      if (!expiresAt || expiresAt < Date.now()) throw new Error("LinkedIn OAuth state expired.");
      if (url.searchParams.get("error")) throw new Error("LinkedIn authorization was declined or failed.");

      const token = await exchangeAuthorizationCode({
        code: url.searchParams.get("code"),
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri
      });
      accessToken = token.access_token;
      authorizedMember = await fetchCurrentMember({ accessToken });
      return send(response, 200, await renderHome("LinkedIn authorization completed for this server session."), {
        "Set-Cookie": "linkedin_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
      });
    }

    if (request.method === "POST" && url.pathname === "/publish-now") {
      if (!accessToken) return send(response, 401, await renderHome("Authorize LinkedIn before publishing."));
      const form = await readForm(request);
      if (form.get("csrf") !== csrfToken || form.get("confirm") !== "publish") {
        return send(response, 400, await renderHome("Publish confirmation was invalid."));
      }

      const recordName = path.basename(form.get("record") ?? "");
      if (!recordName.endsWith(".json") || recordName !== form.get("record")) {
        return send(response, 400, await renderHome("Invalid approved record."));
      }

      const recordPath = path.join(approvedDirectory, recordName);
      const record = JSON.parse(await readFile(recordPath, "utf8"));
      if ((record.assets?.media?.length ?? 0) > 0 || (record.assets?.company_tag_requests?.length ?? 0) > 0) {
        return send(response, 400, await renderHome("Use the manual LinkedIn handoff for media or native company tags."));
      }
      const config = configuration();
      const client = new LinkedInClient({ accessToken, apiVersion: config.apiVersion });
      const publishedRecord = await publishApprovedText(record, { client, authorUrn: authorizedMember.authorUrn });
      await saveRecord(recordPath, publishedRecord);
      return send(response, 200, await renderHome(`Published successfully: ${publishedRecord.publishing.linkedin_post_id}`));
    }

    send(response, 404, "<h1>Not found</h1>");
  } catch (error) {
    console.error(error.name, error.message);
    send(response, 500, await renderHome(`Request failed: ${error.message}`));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LinkedIn Content Control: http://127.0.0.1:${port}`);
});

setInterval(() => void publishDueScheduledPosts(), 30_000);