import { randomBytes } from "node:crypto";

const AUTHORIZE_ENDPOINT = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const USER_INFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function buildAuthorizationUrl({ clientId, redirectUri, state, scopes = ["w_member_social"] }) {
  if (!clientId || !redirectUri || !state) {
    throw new TypeError("clientId, redirectUri, and state are required.");
  }

  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(" ")
  }).toString();
  return url.toString();
}

export function verifyOAuthState(expectedState, returnedState) {
  if (!expectedState || expectedState !== returnedState) {
    throw new Error("LinkedIn OAuth state validation failed.");
  }
}

export async function exchangeAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = globalThis.fetch
}) {
  if (!code || !clientId || !clientSecret || !redirectUri) {
    throw new TypeError("code, clientId, clientSecret, and redirectUri are required.");
  }

  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`LinkedIn OAuth token exchange failed with HTTP ${response.status}.`);
  }

  return response.json();
}

export async function fetchCurrentMember({ accessToken, fetchImpl = globalThis.fetch }) {
  if (!accessToken) {
    throw new TypeError("accessToken is required.");
  }

  const response = await fetchImpl(USER_INFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`LinkedIn user info request failed with HTTP ${response.status}.`);
  }

  const profile = await response.json();
  if (typeof profile.sub !== "string" || profile.sub.length === 0) {
    throw new Error("LinkedIn user info did not return a member identifier.");
  }

  return {
    authorUrn: `urn:li:person:${profile.sub}`,
    name: profile.name ?? null
  };
}