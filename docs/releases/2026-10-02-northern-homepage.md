# Northern homepage — Production release preparation

## Scope

Release the approved cinematic northern LegalTech homepage, with native-scroll storytelling, a Three.js hero, the Blender legal-atlas asset and the Higgsfield process film. Client and employee workspaces, API handlers, auth, private downloads, RPCs and migrations are not changed.

## Verified starting point

- Repository: `max12334123/dogovoroff`; Production branch: `main`.
- Previous Production commit: `e56d730b16d942d8247ee8264c5cf22bee016fb3`.
- Previous Production deployment: `dpl_FkyGixpcY8qq4FfgYauE3R6gZfx6`.
- Rollback URL: `https://dogovoroff-i7ax68u49-dogovoroff.vercel.app`.
- Main domain: `https://dogovoroff.vercel.app`.
- Vercel project: `prj_BhZAA6uclF07BnSa7Hex6TYcMre8`; team: `team_Jot747qYaAxFSM5jUSY1lpz1` (`dogovoroff`).
- Vercel project runtime: Node `24.x`; package-lock is committed.

## Evidence

On 2026-10-02, the full local suite passed 350/350, the optimized Next.js build succeeded, and hosted Preview checks covered the rendered 3D/video, mobile navigation, overflow and one real approved synthetic contact. Google Sheets receipt was observed. Preview intentionally did not write to the Production Supabase intake queue.

See `design-qa.md` for evidence and limitations. Actual Telegram chat receipt and real Safari/iPhone performance were not inspected.

## Release procedure

1. Inspect and selectively commit the homepage, lockfile, regression tests and the five referenced runtime assets. Do not include secrets, temporary QA runners, intermediate source renders or Blender backups.
2. Export the release Git commit into a clean release directory. Link the exact Vercel project; do not modify its settings or environment variables.
3. Build a fresh Production candidate with Production environment, while leaving the main domain on the previous deployment:

   ```powershell
   vercel deploy --target=production --skip-domain --project dogovoroff --scope dogovoroff --yes
   ```

   Never simply promote the existing Preview: its `CONTACT_INBOX_ENABLED` is disabled, unlike Production.
4. Verify candidate `/`, `/api/health`, static media, security headers and unauthenticated cabinet/staff/login boundaries. An invalid contact payload may be used to prove validation without creating a new application. A successful Production contact submission requires separately scoped test authorization.
5. Inspect scoped candidate runtime logs and confirm the main domain still resolves to the previous deployment. Record the release commit and candidate deployment ID/URL in the pull request.
6. Only after approval of public publication, merge the release PR through the configured main-branch workflow, or promote the verified Production-environment candidate. Do not force-push or alter domain settings.
7. After public switching, recheck the actual main domain, form validation, auth boundaries and runtime logs. If a new critical regression appears, restore the previous deployment below.

## Rollback

The exact previously working deployment is retained. The rollback operation changes the main site's traffic and is only for a failed public release:

```powershell
vercel rollback dogovoroff-i7ax68u49-dogovoroff.vercel.app --scope dogovoroff
```

Then verify `/api/health`, the main page and auth boundaries. Do not compensate for a frontend failure with database or permission changes.

## Packaging

Required new runtime assets: `higgsfield-northern-film.mp4`, `legal-atlas.glb`, `legal-atlas-poster.webp`, `northern-chrome-hero.webp`, `northern-horizon.webp` in `public/media`.

`.vercelignore` excludes `.env*`, local Vercel files, dependency/build caches, design sources, tests and non-runtime repository directories. Its `/supabase/` entry excludes only root migration sources, not runtime `lib/supabase`.

Canonical Blender/source material remains in the local worktree, outside the deployable export. The current runtime files are immutable, but exact source-media regeneration is not yet fully portable: Blender/font versions and image/video conversion commands have not been standardized.
