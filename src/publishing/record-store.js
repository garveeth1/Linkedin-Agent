import { hashApprovedContent } from "./approval.js";

export function approveRecord(record, now = () => new Date()) {
  if (record?.status !== "optimized") {
    throw new Error("Only an optimized record can be approved.");
  }
  if (record?.review?.blocking_issues?.length > 0) {
    throw new Error("A record with blocking review issues cannot be approved.");
  }

  const approvedAt = now();
  return {
    ...record,
    status: "approved",
    updated_at: approvedAt.toISOString().slice(0, 10),
    approval: {
      ...record.approval,
      approved: true,
      approved_at: approvedAt.toISOString(),
      approved_content_hash: hashApprovedContent(record?.content?.final)
    }
  };
}