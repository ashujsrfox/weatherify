# Contributing to Weatherify

First, thank you for considering contributing to Weatherify — your help is appreciated!

This document explains how to contribute, the branching and commit message conventions we use, how to open a good pull request, and basic code-style and testing expectations.

---

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [Getting started (fork & clone)](#getting-started-fork--clone)
- [Branch naming conventions](#branch-naming-conventions)
- [Commit message format](#commit-message-format)
- [How to raise a Pull Request (PR)](#how-to-raise-a-pull-request-pr)
- [Pull request checklist](#pull-request-checklist)
- [Code style & linters](#code-style--linters)
- [Testing](#testing)
- [Review & merging process](#review--merging-process)
- [Reporting security issues](#reporting-security-issues)
- [Acknowledgements](#acknowledgements)

---

## Code of Conduct

Please follow our Code of Conduct in all interactions. Be respectful, constructive, and welcoming. 

---

## Getting started (fork & clone)

1. Fork the repository (top-right of the GitHub page).
2. Clone your fork locally:
   - git clone https://github.com/<your-username>/weatherify.git
3. Add the original repo as an upstream remote and fetch:
   - git remote add upstream https://github.com/ashujsrfox/weatherify.git
   - git fetch upstream
4. Keep your local main branch up to date:
   - git checkout main
   - git pull upstream main
   - git push origin main

Work on a feature branch (see branch naming below) — never commit directly to `main`.

---

## Branch naming conventions

Use clear, descriptive branch names. Examples:

- feat/<short-description> (new feature)
- fix/<short-description> (bug fix)
- docs/<short-description> (documentation changes)
- chore/<short-description> (maintenance)
- test/<short-description> (tests)

If referencing an issue, include the issue number:

- feat/123-add-weather-cache
- fix/45-temperature-format

Keep names kebab-cased and under ~50 characters when possible.

---

## Commit message format

We follow the Conventional Commits style for clear history and automated tooling compatibility.

Format:
- type(scope?): short description
- blank line
- optional longer description
- optional footer(s) (e.g., `Closes #23`)

Common types:
- feat: a new feature
- fix: a bug fix
- docs: documentation only changes
- style: formatting, missing semicolons, no code change
- refactor: code change that neither fixes a bug nor adds a feature
- perf: changes that improve performance
- test: adding missing tests or correcting existing tests
- chore: build process or auxiliary tools

Example:
- feat(api): add caching for weather responses

If your change closes an issue, reference it in the footer:
- Closes #6

Please keep commit messages concise and meaningful.

---

## How to raise a Pull Request (PR)

1. Create a new branch from an up-to-date `main`.
2. Make your changes and commit them following the commit message format.
3. Push the branch to your fork:
   - git push origin feat/123-add-weather-cache
4. Open a pull request against `ashujsrfox/weatherify:main`.
5. In the PR description:
   - Explain the problem and the solution.
   - Reference any related issues (e.g., `Closes #6`).
   - Add screenshots or logs when relevant.
   - List testing steps and any potential impact.

---

## Pull request checklist

Before requesting a review, ensure:

- [ ] Branch is up to date with `main`.
- [ ] All tests pass locally.
- [ ] Linting and formatting checks pass.
- [ ] New code has tests where appropriate.
- [ ] PR description clearly explains changes and motivation.
- [ ] Any sensitive data or credentials are not included.
- [ ] If the change is breaking, provide clear instructions and a migration path.

Maintainers may ask for changes — please address review comments in a timely manner.

---

## Code style & linters

Follow the existing project's code style. If the repository includes linters, formatters, or config files (ESLint, Prettier, clang-format, black, gofmt, etc.), run them and follow their suggestions.

If you are unsure of the style for a particular file or language, mirror how existing code in the repository is written.

Helpful commands (project-specific; replace with ones in this repo when present):
- npm run lint
- npm run format
- make lint
- go fmt ./...

---

## Testing

- Add unit/integration tests for new functionality or bug fixes.
- Run the test suite locally before opening a PR:
  - npm test
  - or the repository's test command
- Aim for tests that are deterministic and fast.
- If your change requires long-running tasks (e.g., external API calls), mock external services in tests where possible.

---

## Review & merging process

- Pull requests will be reviewed by maintainers or assigned reviewers.
- CI checks must pass before merge.
- We prefer squashed or rebased merges to keep `main` linear (maintainers will choose the final strategy).
- Large or disruptive changes may require a design discussion before implementation — open an issue or start a discussion first.

---

## Reporting security issues

If you discover a security vulnerability, do not open a public issue. Contact the repository owner privately and provide enough detail to reproduce and fix the issue. If you need a formal process, we can add a SECURITY.md and a specific contact method.

---

## Acknowledgements

Thanks for helping improve Weatherify. Contributions — big or small — are welcome. If you're unsure where to start, check open issues labeled `good first issue` or ask in an issue and we can help you get started.

---
