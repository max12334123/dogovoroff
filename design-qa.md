# Design QA — staff workspace

## Evidence

- Source visual truth: `C:\Users\yur03\.codex\generated_images\019fff8a-ef94-7aa1-82a2-32ccb76da14e\exec-7202c756-1c53-4ec4-b2fa-07a81dbdbdbd.png`
- Source pixels: 1487 × 1058, density 1x.
- Desktop implementation: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-desktop-final.png`
- Desktop screenshot pixels: 1425 × 975; browser CSS viewport: 1440 × 1025; density 1x. The in-app browser screenshot excludes browser chrome and the scrollbar gutter.
- Mobile implementation: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-mobile-final.png`
- Mobile screenshot pixels: 375 × 844; browser CSS viewport: 390 × 844; density 1x. The 15 px width difference is the scrollbar gutter.
- Mobile drawer state: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-mobile-drawer-final.png`
- Side-by-side comparison: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-comparison-final.png`
- Comparison normalization: source and desktop capture were normalized to 1440 × 1024 at 1x and placed side by side. Browser chrome was not included.
- State: authenticated staff dashboard represented with realistic non-personal test fixtures; active matter selected; mobile creation drawer open in the interaction capture.

## Full-view comparison evidence

- Information architecture matches the approved target: compact account header, fixed navigation rail, task-first queues, persistent matter detail, search, and primary “Новое дело” action.
- Layout rhythm preserves the target's three-column balance, thin rules, square controls, large editorial heading, and dense but scannable matter rows.
- Colors map to the approved black, graphite, white, muted gray, and ice-blue palette. Active and focus states remain distinguishable without introducing decorative gradients or shadows.
- Typography follows the site's existing premium sans-serif system and the target hierarchy. All visible leaf text now renders at 12 px or larger.
- The only visible image asset is the existing Dogovoroff logo; it uses the real project asset rather than a code-drawn substitute.
- App copy is shorter and task-oriented. Dynamic fixture counts and matter names intentionally differ from the concept image.

## Focused region evidence

A separate crop was not required because the native source and final desktop capture keep the header, queue rows, detail timeline, controls, and logo legible in the combined comparison. Small-control and responsive fidelity were additionally checked in the dedicated mobile dashboard and mobile drawer captures.

## Interaction and responsive checks

- “Все дела” opens the register; status filter and text search reduce the visible set correctly.
- “Новое дело” opens an accessible two-step drawer; step progression works, Escape/close returns focus to the trigger, and no submission was made during QA.
- “Написать клиенту” exposes the message composer; “Открыть документы” moves focus to the document section.
- Desktop and 390 px mobile layouts have no horizontal document overflow.
- The mobile drawer fills the viewport, locks background scrolling, and remains vertically scrollable.
- Browser console: no warnings or errors in the final pass.

## Findings

No actionable P0, P1, or P2 findings remain.

- Accepted product constraint: the current authorized matter payload does not expose client names or responsible-person names. The implementation uses matter title, reference, organization, status, and update time instead of inventing personal data or broadening the authorization boundary.
- Accepted responsive adaptation: the desktop side rail becomes a horizontally scrollable navigation strip on narrow screens so all destinations remain reachable without squeezing labels.

## Comparison history

### Pass 1

- [P2] Several compact labels rendered below 12 px and were too small for comfortable scanning.
- Fix: raised every sub-12 px staff-workspace declaration to 12 px while retaining the target's compact hierarchy.
- Earlier evidence: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-comparison.png`.

### Pass 2

- Post-fix evidence: `C:\Users\yur03\.codex\visualizations\2026\08\14\019fff8a-ef94-7aa1-82a2-32ccb76da14e\staff-comparison-final.png`.
- Browser measurement confirms a 12 px minimum visible leaf-text size, no horizontal overflow at 1440 px or 390 px, and no console warnings or errors.
- No actionable P0, P1, or P2 mismatch remains.

## Follow-up polish

- [P3] When the backend safely exposes assigned staff and client display names, those fields can replace the privacy-preserving matter labels and bring the detail density even closer to the concept.

## Implementation checklist

- [x] Match approved desktop composition and visual tokens.
- [x] Preserve existing authorization and server-action contracts.
- [x] Verify primary navigation, search, filters, document/message actions, and two-step creation flow.
- [x] Verify desktop and mobile overflow behavior.
- [x] Verify final browser console.

final result: passed
