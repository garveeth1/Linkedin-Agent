import { createHash, timingSafeEqual } from "node:crypto";

export class ApprovalError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApprovalError";
  }
}

export function hashApprovedContent(content) {
  if (typeof content !== "string" || content.length === 0) {
    throw new ApprovalError("Final content must be a non-empty string.");
  }

  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function assertApprovedRecord(record) {
  if (record?.status !== "approved" || record?.approval?.approved !== true) {
    throw new ApprovalError("The exact final post has not been approved.");
  }

  if (record?.publishing?.linkedin_post_id) {
    throw new ApprovalError("This record already has a LinkedIn post ID.");
  }

  const expectedHash = record?.approval?.approved_content_hash;
  if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new ApprovalError("The approval hash is missing or invalid.");
  }

  const actualHash = hashApprovedContent(record?.content?.final);
  const expectedBuffer = Buffer.from(expectedHash.toLowerCase(), "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new ApprovalError("The final post changed after approval.");
  }

  return actualHash;
}