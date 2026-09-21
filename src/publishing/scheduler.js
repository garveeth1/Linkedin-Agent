import { assertApprovedRecord } from "./approval.js";

export function scheduleApprovedRecord(record, scheduledAt, now = () => new Date()) {
  assertApprovedRecord(record);

  if (record?.publishing?.linkedin_post_id) {
    throw new Error("A record that was already published cannot be scheduled.");
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= now()) {
    throw new TypeError("Scheduled time must be a valid future date and time.");
  }

  return {
    ...record,
    updated_at: now().toISOString().slice(0, 10),
    publishing: {
      ...record.publishing,
      mode: "linkedin-api",
      scheduled_at: scheduledDate.toISOString()
    }
  };
}