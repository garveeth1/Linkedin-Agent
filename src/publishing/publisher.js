import { assertApprovedRecord } from "./approval.js";

export async function publishApprovedText(record, { client, authorUrn, now = () => new Date() }) {
  assertApprovedRecord(record);

  const result = await client.createTextPost({
    authorUrn,
    commentary: record.content.final
  });
  const publishedAt = now();

  return {
    ...record,
    status: "published",
    updated_at: publishedAt.toISOString().slice(0, 10),
    publishing: {
      ...record.publishing,
      mode: "linkedin-api",
      published_at: publishedAt.toISOString(),
      linkedin_post_id: result.postId,
      response_status: result.status,
      api_version: client.apiVersion
    }
  };
}