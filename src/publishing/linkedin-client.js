const POSTS_ENDPOINT = "https://api.linkedin.com/rest/posts";

export class LinkedInApiError extends Error {
  constructor(message, { status, responseBody } = {}) {
    super(message);
    this.name = "LinkedInApiError";
    this.status = status;
    this.responseBody = responseBody;
    this.retryable = status === 429 || status >= 500;
  }
}

export class LinkedInClient {
  constructor({ accessToken, apiVersion, fetchImpl = globalThis.fetch }) {
    if (!accessToken) {
      throw new TypeError("A LinkedIn access token is required.");
    }
    if (!/^\d{6}$/.test(apiVersion)) {
      throw new TypeError("LinkedIn API version must use YYYYMM format.");
    }
    if (typeof fetchImpl !== "function") {
      throw new TypeError("A fetch implementation is required.");
    }

    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.fetch = fetchImpl;
  }

  async createTextPost({ authorUrn, commentary }) {
    if (!/^urn:li:(person|organization):.+/.test(authorUrn ?? "")) {
      throw new TypeError("A valid LinkedIn person or organization URN is required.");
    }
    if (typeof commentary !== "string" || commentary.length === 0) {
      throw new TypeError("Post commentary must be non-empty.");
    }

    const response = await this.fetch(POSTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Linkedin-Version": this.apiVersion,
        "X-Restli-Protocol-Version": "2.0.0"
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      })
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new LinkedInApiError(`LinkedIn rejected the post with HTTP ${response.status}.`, {
        status: response.status,
        responseBody
      });
    }

    const postId = response.headers.get("x-restli-id");
    if (!postId) {
      throw new LinkedInApiError("LinkedIn accepted the request without returning a post ID.", {
        status: response.status
      });
    }

    return { postId, status: response.status };
  }
}