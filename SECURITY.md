# Security

This repo is public. Never commit API keys, tokens, passwords, .env files or personal info.

- CI secret scan: gitleaks workflow (.github/workflows/secret-scan.yml) runs on every push and pull request and fails if a secret is found. Added separately.
- Local guard: run `git config core.hooksPath .githooks` once per clone to block commits with secrets (needs gitleaks installed).
- If a secret ever lands in a commit, treat it as exposed: revoke and replace the key first, then clean up.
