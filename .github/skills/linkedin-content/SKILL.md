---
name: linkedin-content
description: "Create, research, optimize, approve, and publish authentic LinkedIn posts from a Scrum Master's real experiences. Use for LinkedIn ideas, drafts, content calendars, post reviews, or performance analysis."
argument-hint: "Describe a Scrum Master experience, lesson, event, or post idea"
---

# LinkedIn Content Workflow

Turn a real experience into a credible LinkedIn post without inventing facts or exposing confidential information.

## Workflow

1. Capture the experience, optional media, sources, tag requests, and permissions using [the intake template](./assets/intake-template.md).
2. Normalize it against [the content record](./references/content-record.md).
3. Confirm uncertain facts and anonymize sensitive details before drafting.
4. Draft for one audience and one content pillar using [the voice guide](./references/voice-and-pillars.md).
5. Research only claims that depend on current information. Record source URLs and access dates.
6. Optimize with [the review rubric](./assets/review-rubric.md) without changing facts. Keep 3–5 relevant hashtags, meaningful alt text, and a verified reference/tag handoff.
7. Ask for explicit approval. Approval must refer to the exact final version.
8. Publish through the official LinkedIn API only when authorized; otherwise prepare a manual handoff.
9. Record the post ID, publication time, and later performance metrics.

## Required Controls

- Never invent experiences, outcomes, quotations, metrics, or trend claims.
- Never expose client, colleague, financial, security, or unreleased company information.
- Never describe a topic as trending without current dated evidence.
- Never publish a draft or infer approval from earlier conversation.
- Never use browser automation to log in, type, click Post, or automate engagement on LinkedIn.
- Never store credentials or OAuth tokens in content files or the repository.
- Never infer publication permission for a person, internal screen, logo, document, or location visible in media.
- Never present plain text such as `@Company` as a native LinkedIn tag. Store it as a tag request until a verified publishing method can create the mention.
- Never publish a media-bearing post through a text-only adapter. Use the official media upload API or a manual handoff that preserves the selected files, references, and tag requests.

## Publishing Decision

Use this order:

1. Ask the user which final action they want: `Publish now` or `Send me the text for manual LinkedIn scheduling`.
2. For `Publish now`, use the official LinkedIn Posts API with `w_member_social` only after explicit approval and a separate publish confirmation.
3. For manual scheduling, return the exact approved text, hashtags, and any attachment/tag instructions. The user schedules it in LinkedIn; do not run the local scheduler.

The Posts API publishes immediately. Keep drafts and approval state locally, and send only approved content. Do not imply that a local scheduled job will run after the user's computer shuts down.