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
3. Install dependencies
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

- [ ] The app builds without TypeScript errors (`npx tsc --noEmit`)
- [ ] The app runs in browser mode (`npm run dev`)
- [ ] Your change doesn't break existing roster/team functionality
- [ ] If touching P2P layer — test with two local instances on different ports

---

## 📬 Submitting a Pull Request

1. Make sure your branch is up to date with `main`
2. Write a clear PR description — what changed and why
3. Reference any related issues
4. Keep PRs focused — one concern per PR

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
