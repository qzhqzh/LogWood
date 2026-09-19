---
name: logwood-article-publisher
description: "Draft, edit or publish an article in LogWood when requested; publishing requires authorization for the reviewed version."
---

# LogWood Article Publisher

Treat the current chat as the writing room and LogWood as the archive and publication surface. Do not require the author to repeat the discussion in `/forge`; that page is an optional fallback.

## Work in the conversation first

- Discuss and clarify the idea in the current chat. Do not save or publish each message automatically.
- When the idea is ready—or the author asks—present a complete review draft in chat: title, optional excerpt, body, and tags.
- Preserve the author's actual judgments and uncertainty. Mark unsupported facts or missing sources instead of inventing them.
- Keep revisions in chat until the author reviews the complete current draft.

When the author explicitly asks to archive an unfinished topic, save it as a private inspiration rather than an Article draft. Set `visibility` to `private`, use the tag `article-topic`, record the settled thesis, open questions, missing references, and current writing status, and keep it unpublished. Prefer `logwood_inspiration_record`; the fallback command is:

```bash
bun .agents/skills/logwood-article-publisher/scripts/logwood-article-mcp.ts topic /tmp/logwood-article-topic.json
```

## Require a publication gate

Only publish when the author gives an unambiguous confirmation that refers to the complete draft currently shown, such as “确认发表” or “按这一版发表”. A request to continue discussing, rewrite, shorten, or adjust any part invalidates earlier confirmation.

After confirmation:

1. Create a LogWood draft with `logwood_article_publish`. Always send `status: draft` and complete AI attribution; never claim human-only authorship for AI-organized prose.
2. Read the returned `id` and `currentVersion`.
3. Publish that exact version with `logwood_article_confirm_publish`, passing:
   - `articleId`: the returned article id;
   - `expectedVersion`: the returned current version;
   - `confirmation`: `CONFIRM_PUBLISH_CURRENT_VERSION`.
4. Report the public article URL and the published version.

Prefer the connected LogWood MCP tools. If they are unavailable but this repository is accessible, use the deterministic fallback client:

```bash
bun .agents/skills/logwood-article-publisher/scripts/logwood-article-mcp.ts check
bun .agents/skills/logwood-article-publisher/scripts/logwood-article-mcp.ts topic /tmp/logwood-article-topic.json
bun .agents/skills/logwood-article-publisher/scripts/logwood-article-mcp.ts draft /tmp/logwood-article-draft.json
bun .agents/skills/logwood-article-publisher/scripts/logwood-article-mcp.ts publish /tmp/logwood-article-publish.json
```

The fallback reads `LOGWOOD_MCP_API_KEY` from the repository environment and never prints it. Put article content in a JSON file rather than shell arguments. Set `LOGWOOD_MCP_URL` only when the endpoint differs from `http://127.0.0.1:10000/api/mcp`.

If draft creation returns an uncertain transport failure, do not create another draft automatically: report the uncertainty and inspect the article manager first. If publication fails, leave the draft intact and report the exact error; never weaken the version or confirmation checks.

## WeChat version

After the LogWood article is published—or when the author separately requests it—derive a WeChat Official Account version in chat. It may use a more direct title, opening hook, shorter paragraphs, and platform-friendly subheadings, but must preserve facts, sources, and uncertainty. Do not overwrite the LogWood article and do not post to WeChat unless the author separately authorizes an available external publishing tool.
