# Upstream runtime workspace

This directory is intentionally empty in Git. Run `npm run upstream:sync` to clone the pinned permissive upstream engine set from `upstreams.lock.json`.

GPL-family engines are **not** cloned by default. Use `XRUN_INCLUDE_GPL=1 npm run upstream:sync` only after reviewing the licensing implications for the way you plan to distribute WinWeb.

The WinWeb shell and runtime API must remain buildable without these source checkouts. Engine-specific build integration belongs behind adapters.
