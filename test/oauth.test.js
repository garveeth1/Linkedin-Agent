import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorizationUrl,
  createOAuthState,
  exchangeAuthorizationCode,
  fetchCurrentMember,
  verifyOAuthState
} from "../src/oauth/linkedin-oauth.js";

test("builds an authorization URL with write scope and CSRF state", () => {
  const state = createOAuthState();
  const url = new URL(buildAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "https://example.com/callback",
    state
  }));

  assert.equal(url.origin + url.pathname, "https://www.linkedin.com/oauth/v2/authorization");
  assert.equal(url.searchParams.get("scope"), "w_member_social");
  assert.equal(url.searchParams.get("state"), state);
  assert.ok(state.length >= 32);
});

test("rejects a mismatched OAuth state", () => {
  assert.throws(() => verifyOAuthState("expected", "returned"), /state validation failed/);
});

test("exchanges an authorization code without placing the secret in the URL", async () => {
  let request;
  const token = await exchangeAuthorizationCode({
    code: "auth-code",
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://example.com/callback",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json({ access_token: "access-token", expires_in: 3600 });
    }
  });

  assert.equal(request.url, "https://www.linkedin.com/oauth/v2/accessToken");
  assert.equal(request.url.includes("client-secret"), false);
  assert.equal(new URLSearchParams(request.options.body).get("client_secret"), "client-secret");
  assert.equal(token.access_token, "access-token");
});

test("derives the member author URN from OpenID user info", async () => {
  const member = await fetchCurrentMember({
    accessToken: "access-token",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.linkedin.com/v2/userinfo");
      assert.equal(options.headers.Authorization, "Bearer access-token");
      return Response.json({ sub: "member-123", name: "Example Member" });
    }
  });

  assert.deepEqual(member, {
    authorUrn: "urn:li:person:member-123",
    name: "Example Member"
  });
});