# WebTile workflow instructions

## User verification and releases

- Any change that the user is expected to verify manually must be delivered through a complete release workflow: run the relevant tests and production build, commit all intended project changes, push the commit to `origin`, and publish a corresponding GitHub release/tag.
- Do not ask the user to test an uncommitted or unpushed working tree.
- Use semantic versioning and keep `package.json` and `package-lock.json` versions aligned with the release tag.
- Include a concise release note describing user-visible changes and verification performed.
- Whenever reporting a deployment or asking the user to verify it, state the exact semantic version prominently so they can compare it with the version shown by the application.
- Before committing, preserve unrelated user changes and inspect the final diff for accidental files or secrets.
