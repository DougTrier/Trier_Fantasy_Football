# Contributing to Trier Fantasy Football

First off — thanks for checking this project out.

This is not just a fantasy football app.  
It's an experiment in **interactive design, local-first systems, and peer-to-peer coordination**.

If you want to contribute, you're in the right place.

---

## 🧠 Philosophy

This project is built around three core ideas:

- **Feel matters** — interactions should feel tactile and intuitive (cards, motion, UX)
- **Local-first** — the app should work without relying on centralized infrastructure
- **Deterministic systems** — state should be predictable and reproducible across peers

When contributing, try to respect those principles.

---

## 🚧 What You Can Work On

Good areas for contribution:

- UI/UX improvements (cards, animations, layout)
- Performance optimizations
- Bug fixes
- Accessibility improvements
- Documentation
- Non-core feature enhancements

---

## ⚠️ What NOT to Modify Without Discussion

The following areas are **core architecture** and should not be changed without opening an issue first:

- P2P networking layer (`P2PService`)
- Identity / cryptographic systems (`IdentityService`)
- Event synchronization model
- Core game state logic

If you have ideas here — great — just start a discussion first.

---

## 🔧 Getting Started

1. Fork the repository
2. Clone your fork
3. Use Node 22.12+ and install dependencies with `npm ci`
4. Run the app locally
5. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

---

## 📦 Project Structure

```
src/
  components/     # UI components
  services/       # Core services (P2P, Identity, Discovery, EventStore)
  utils/          # Helpers and utilities
  types/          # TypeScript type definitions
  data/           # Static data and mock DB
src-tauri/        # Rust backend (Tauri commands, mDNS, networking)
scripts/          # Dev and build utilities
```

---

## 🧪 Testing Your Changes

Before submitting a PR, please verify:

- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run test:unit`
- [ ] Run `npm audit --audit-level=high` and `npm run build`
- [ ] For game-day changes, run `npx playwright test tests/e2e/18_gameday_locks.spec.ts tests/e2e/08_admin_commissioner.spec.ts`
- [ ] The app runs in browser mode (`npm run dev`)
- [ ] Your change doesn't break existing roster/team functionality
- [ ] If touching P2P layer — test with two local instances on different ports

---

## 📬 Submitting a Pull Request

1. Make sure your branch is up to date with `master`
2. Write a clear PR description — what changed and why
3. Reference any related issues
4. Keep PRs focused — one concern per PR

## Windows Releases

1. Update `package.json`, the root entries in `package-lock.json`, `src-tauri/Cargo.toml`, the application entry in `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json` to the same version.
2. Update the README, changelog, relevant guides, and any in-app help affected by the change. `scripts/generate_build_info.js` reads the display version from `package.json`.
3. Complete the checks above and push the release commit to `master`.
4. Create and push an annotated version tag, such as `v3.3.2`. `.github/workflows/release.yml` builds Windows x64 MSI and NSIS EXE installers and uploads them to a draft GitHub release.
5. Verify the workflow succeeded, both installer assets are present, their versions match the tag, and release notes explain the changes. Publish the draft only after verification.

To build both installers locally on a Windows machine with Rust and Tauri prerequisites installed:

```bash
npm run tauri -- build --bundles msi,nsis
```

Keep binary installers in GitHub Releases rather than committing them to the source tree. Future documentation-only corrections can be committed normally; installer-visible help changes require rebuilding the installers.

---

## 💬 Opening Issues

Use issues for:

- Bug reports (include steps to reproduce)
- Feature requests (describe the use case, not just the solution)
- Architecture discussions (label with `discussion`)

---

## 🤝 Code Style

- TypeScript everywhere — no `any` shortcuts in core services
- Prefer explicit types over inferred ones in service interfaces
- Keep components focused and small
- Comment non-obvious logic — especially anything touching P2P or crypto

---

## 📝 Code Comment Guidelines

We aim for ~10% comment density — but quality matters more than quantity.

Comments should explain:
- WHY something exists
- Architectural decisions
- Non-obvious logic

**Required:**
- JSDoc-style comments for non-trivial functions
- Explanations for P2P, security, and sync logic

**Avoid:**
- Redundant or obvious comments
- Line-by-line narration of code

If a piece of code would confuse a new contributor, it needs a comment.

---

Thanks again. This project is being built deliberately — contributions that respect that spirit are welcome.
