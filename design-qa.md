# Dogovoroff — cinematic homepage QA

Latest verification: 2026-10-02. Vercel Preview and a fresh local production build.
The earlier protected-workspace report is preserved locally in design-qa-staff.md and in Git history.

final result: passed (local and Preview verification; Production candidate preparation in progress, main domain unchanged)

## Result and scope

The approved homepage is deployed at https://dogovoroff-arb6tr4fy-dogovoroff.vercel.app/ (Preview dpl_BTP4FkgDcKrLabtDLM3eD2dKz9qK), not yet published to the main Production domain. No database, authorization, private-download, cabinet or staff workflow was changed in this revision. On 2026-10-02, exactly one explicitly approved synthetic application returned HTTP 200 and appeared as row 17 in the configured Google Sheet. Receipt inside the Telegram chat was not independently inspected. Preview has CONTACT_INBOX_ENABLED disabled, so this test did not exercise the Production Supabase intake queue.

The old repeated section grids were replaced with a scroll-lit manifesto, five practice chapters around a Blender sculpture, a four-chapter cinematic process, open format rows and an editorial team section. Contact and precheck use the same dark visual language. All operational copy and controls are native HTML.

## Visual comparison and fidelity ledger

References: the approved black-chrome hero exec-ef117ad7-8874-4cfb-a8f6-3f01cbe814e9.png and design-assets/story-v3-{manifesto,practices,process,formats,team}.png. These are visual direction, not fabricated staff or factual service content.

The references and rendered screenshots were opened with the image viewer for comparison. Primary rendered viewport: 1536 × 1024 CSS px at DPR 1; additional views: 1366 × 768, 1280 × 650, 768 × 1024, 390 × 844 and 360 × 780. Reference rasters do not define responsive states or browser chrome, so this is a composition comparison, not a pixel-parity claim.

1. Typography: Geologica Variable replaces the earlier classical Prata treatment. Thin 150–270 display weights, tight spacing, Cyrillic and three-line hero hierarchy are present. Body text is intentionally denser than the raster concept to retain real service details. No interface text is flattened into an image.
2. Composition and rhythm: the manifesto retains three large lines and three open principle columns; practices retain left-hand copy, a right-hand sculpture and bottom chapter navigation. Formats retain three open rows instead of cards. Short viewports deliberately switch to document flow.
3. Palette and materials: near-black backgrounds, cold white lettering, glacial highlights and titanium/chrome remain consistent across the page, including both precheck steps and its result. No neon or boxed primary CTA treatment was introduced.
4. Artwork and motion: the practice sculpture is a real curved, engraved Blender GLB animated with Three.js. Its fan, lighting and silhouette differ from the generated concept. The real Higgsfield film is a moving black-chrome northern ridge rather than the concept's exact cliff shot. These are intentional production assets, not exact image reproductions.
5. Controls and content: borderless line-arrow actions, keyboard chapter navigation, visible selection/focus and the full-width contact invitation follow the direction. Actual prices, services, consent wording and company facts remain intact.
6. Team: the two departments and outlined 07/05 experience markers carry over; invented office people in the concept were intentionally omitted. Real staff photographs can be introduced later only from supplied material.

Findings fixed during comparison: serif hero mismatch; illegible chapter stops halfway through transitions; pointer events intercepted by the live text overlay; the sculpture touching price copy at laptop height; a light precheck panel inconsistent with the new palette. No remaining local P1/P2 functional finding was observed. Visual preference and real-device performance still require user review.

## Verification evidence

- 2026-10-02 full unit/contract suite: 350 passed, 0 failed.
- 2026-10-02 fresh npm.cmd run build: passed; homepage 28.1 kB route JS / 174 kB first-load JS. These are bundle sizes, not measured internet load times.
- 2026-10-02 hosted Chrome checks: live Three.js hero and Blender sculpture, actual Higgsfield video playback/offscreen pause, real synthetic contact success, mobile navigation at 390 px and first screen at 360 px. No JavaScript errors were observed. No horizontal overflow was observed at those mobile widths.
- 2026-10-02 independent read-only reviews: no blocking correctness, focus, motion-lifecycle or protected-workflow regression found. Runtime assets must be included in an immutable release commit; the Preview environment must not be promoted as a substitute for a Production build.

Historical local checks below were performed on 2026-09-27:

- Full unit/contract suite: 347 passed, 0 failed after the motion and success-focus fixes.
- After final CSS/dependency cleanup, the focused homepage, precheck, accessibility, security-config and team suite passed 35/35.
- Final npm.cmd run build: passed; homepage is static, 27.3 kB route JS / 173 kB first-load JS reported by Next. This is bundle size, not a measured internet load time.
- Main Chrome/Playwright production pass: 53/53 assertions passed. Includes changing hero frames, delayed media loading, chapter click/keyboard navigation, inactive inert panels, precheck service mapping, validation focus, mocked quick-form success and idempotency ID, formats, video playback, offscreen video/GPU pause, mobile menu focus and overflow checks.
- Final visual-polish pass: 18/18 assertions passed at 1536, 1366 and 390 px. Both precheck steps and mocked successful submission work, optional AI consent starts unchecked, price stays outside the sculpture surface and there are no application runtime errors.
- Reduced motion, data-saving and no-JavaScript runs made zero GLB/video requests; the hero and practice content remained available. Mobile WebGL was absent. On ordinary mobile connections, the film remains optional/lazy video playback.
- Initial desktop hero made zero GLB/video requests; each was requested only when its section entered view. GPU draw calls and video stopped offscreen. These observations do not establish FPS on all customer devices.
- Local-only Vercel analytics endpoints return 404/MIME errors because the preview is not hosted on Vercel. They were logged separately, not misreported as application errors.
- git diff --check passed. Independent read-only lifecycle/a11y review found no current P1/P2 issue.

## Assets and reproducibility

- public/media/legal-atlas.glb: 840,948 bytes. Three curved titanium sheets, machined edge materials and Cyrillic engraving. Builder: design-assets/build-legal-atlas.py; saved final source: design-assets/legal-atlas-v2.blend.
- public/media/legal-atlas-poster.webp: 39,708 bytes; transparent static fallback.
- public/media/higgsfield-northern-film.mp4: 850,006 bytes, 1366 × 768, seamless 5.2-second loop without audio. Higgsfield job and source provenance are in design-assets/motion-direction.md.
- Blender MCP was used for the initial isolated scene; the final asset was built through the installed Blender background CLI. The user's original live scene was not modified.

## Local evidence files

Directory: C:/Users/yur03/.codex/visualizations/2026/08/14/019fff8a-ef94-7aa1-82a2-32ccb76da14e/

- final-hero.png, final-manifesto.png, final-process.png, final-formats.png, final-team.png, final-contact.png.
- Latest sculpture: polished-practices-1536.png, polished-practices-1366.png.
- Latest precheck: polished-precheck-1536.png, polished-precheck-contacts-390.png, polished-precheck-result-390.png.
- Responsive/fallback: final-hero-360.png, final-practices-390.png, final-reduced.png, final-saveData.png, final-noScript.png.
- Machine-readable results: final-story-qa.json, polished-story-qa.json. Temporary test runners are removed after verification; screenshots and reports remain outside the repository.

Next release gate: prepare a clean Production build from the release commit with Production environment variables, verify its separate deployment address, then explicitly switch the main domain. Real Safari/iPhone performance and Telegram chat receipt remain unverified. No migrations are part of this homepage release.
