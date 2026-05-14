# Topas Prompt Library — Chrome Extension Workshop

Chrome Extension cho Topas team truy cập prompt library qua Side Panel API.

> Universal rules cho mọi AI agent.

---

## Brain links

- **Memory**: `~/Documents/AI CEO/01-Projects/01-topas/sub/prompt-library-ext/memory/`
- **Decisions**: `~/Documents/AI CEO/01-Projects/01-topas/sub/prompt-library-ext/decisions/`
- **Parent Topas hub**: `~/Documents/AI CEO/01-Projects/01-topas/AGENTS.md`
- **Twin web version**: `~/Documents/AI Forge/Web prompt library/` (same Supabase backend, different UI)

---

## Xưng hô

- Bruce: "tao"/"mày". AI: "em"/"sếp".

---

## 🏗️ Stack

- **Chrome Extension** Manifest v3
- **Side Panel API** (Chrome 114+)
- **Auth**: Google OAuth
- **Backend**: Supabase (shared với `prompt-library-web`)
- **UI**: Custom DOM modals (alert/confirm không hoạt động trong Side Panel)

## 📂 Structure

```
manifest.json
sidepanel.html       # Main UI
sidepanel.js
auth/                # Google OAuth flow
api/                 # Supabase client + queries
components/          # Custom modal, prompt cards
```

## ✨ Features

- Truy cập Prompt Library qua Chrome Side Panel
- Đăng nhập Google
- **Pin Prompt** — ghim các prompt thường dùng
- Copy Prompt 1-click
- **Role-based UI permissions** — admin vs user view

## ⚠️ Critical gotchas

1. **Side Panel KHÔNG support `alert()`/`confirm()`** — phải dùng custom DOM modals (đã fix 8w trước).
2. **OAuth in Side Panel** — phải dùng `chrome.identity.launchWebAuthFlow` (popup blocked trong panel).

## ⚙️ Install dev

```
chrome://extensions/ → Developer mode → Load unpacked → select this folder
```

## Git

- Branch `claude/<feature>` cho dev
- Repo: `pirateson/extension-topas-prompt-library`

## Status: stable (last commit 8w)

Mature, bug-fix on-demand.
