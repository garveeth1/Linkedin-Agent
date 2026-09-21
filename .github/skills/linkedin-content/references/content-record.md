# Content Record

Use one record throughout the workflow. Do not replace known values with rewritten guesses.
Persist each working record as UTF-8 JSON. The YAML below documents the field structure compactly; use the same keys when saving JSON.

```yaml
id: YYYY-MM-DD-short-topic
status: idea # idea | clarified | drafted | researched | optimized | approved | published
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD

experience:
  situation: ""
  challenge: ""
  scrum_master_action: ""
  outcome: ""
  lesson: ""
  evidence: []
  uncertain_details: []

strategy:
  audience: "" # practitioners | leaders-hiring-managers
  content_pillar: ""
  reader_value: ""
  desired_conversation: ""

privacy:
  contains_client_information: false
  contains_colleague_information: false
  contains_internal_metrics: false
  permissions_confirmed: false
  anonymization_notes: []

content:
  draft: ""
  final: ""
  alternate_hook: ""
  hashtags: []
  image_paths: []
  image_alt_text: ""

assets:
  media: [] # path, type: image|video, alt_text, permission_confirmed
  references: [] # title, url, purpose: evidence|further-reading|attribution
  company_tag_requests: [] # company_name, linkedin_page_url, permission_confirmed

research:
  current_claims: []
  sources: []
  unsupported_claims_removed: []

review:
  scores: {}
  changes_made: []
  blocking_issues: []

approval:
  approved: false
  approved_at: null
  approved_content_hash: null

publishing:
  mode: null # linkedin-api | authorized-scheduler | manual
  scheduled_at: null
  published_at: null
  linkedin_post_id: null
  linkedin_post_url: null
  api_version: null
  response_status: null

metrics:
  after_24_hours: null
  after_7_days: null
  qualitative_notes: []
```

## State Rules

- Move to `clarified` only when the situation, action, outcome, lesson, and audience are known.
- Move to `researched` only when time-sensitive claims have sources or have been removed.
- Move to `optimized` only when the review has no blocking issue.
- Move to `approved` only after the user approves the exact final text.
- Calculate and store `approved_content_hash` when approval is recorded.
- Any final-text change after approval resets approval to `false`.
- Move to `published` only after receiving a post ID or manual confirmation.
- Preserve media paths and reference URLs exactly as supplied; do not infer what an image or video proves.
- A company tag request requires the official company name, its public LinkedIn Page URL, and confirmation that the company may be named.
- Do not put `@` before a company name unless the publishing method can create a verified native LinkedIn mention. Plain text is not a tag.
- Hashtags must be relevant to the post, use 3–5 unless the user requests otherwise, and must not imply unverified trending status.

## Source Entry

```yaml
- claim: ""
  title: ""
  publisher: ""
  url: ""
  published_at: YYYY-MM-DD
  accessed_at: YYYY-MM-DD
```

## Metric Snapshot

```yaml
captured_at: YYYY-MM-DDTHH:mm:ssZ
impressions: null
reactions: null
comments: null
reposts: null
profile_views: null
audience_quality_notes: ""
```

Keep raw metrics. Calculate engagement rate only when the denominator and included interactions are consistent across compared posts.

## Media Entry

```yaml
- path: ""
  type: image # image | video
  alt_text: ""
  permission_confirmed: false
  notes: ""
```