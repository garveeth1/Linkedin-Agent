# LinkedIn Content Workflow Architecture

```mermaid
flowchart TD
  User[Scrum Master] --> Orchestrator[LinkedIn Content Orchestrator]
  Orchestrator --> Miner[Experience Miner]
  Orchestrator --> Writer[Story Writer]
  Orchestrator --> Researcher[Niche Researcher]
  Orchestrator --> Optimizer[Post Optimizer]

  Miner --> Record[(Local content record)]
  Writer --> Record
  Researcher --> Record
  Optimizer --> Record

  Record --> Approval{Exact version approved?}
  Approval -- No --> Orchestrator
  Approval -- Yes --> Choice{Final action}

  Choice -- Publish now: text only --> Control[Local Content Control]
  Control --> OAuth[LinkedIn OAuth]
  OAuth --> PostsAPI[LinkedIn Posts API]
  PostsAPI --> LivePost[Published LinkedIn post]

  Choice -- Schedule later or includes media/tag --> Handoff[Exact text and publishing package]
  Handoff --> NativeScheduler[LinkedIn native scheduler]
  NativeScheduler --> LivePost
```

## Decision Rules

- The official API path publishes an already-approved **text-only** post immediately after a separate confirmation.
- For a post scheduled later, or one containing an image, video, document, or native company tag, use LinkedIn's native scheduler with the supplied publishing package.
- Manual LinkedIn scheduling continues when the local computer and control panel are off.
- A changed final post, attachment package, or tag request requires fresh approval.
- Playwright is reserved for local control-panel validation and never automates LinkedIn account actions.