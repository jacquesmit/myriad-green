# Backup Water Systems — Page Checklist

This file tracks work to finish and polish the `services/backup-water-systems.html` page. Keep this checklist updated and commit changes to the branch `feature-incomplete-section` so the team can follow progress.

## How to use

- Update the checkbox when you finish a task (change `- [ ]` to `- [x]`).
- Commit the file with a short message such as `docs(checklist): mark <task> completed`.
- Use this file as the source-of-truth for page-completion status.

## Quick status

- Branch: `feature-incomplete-section`
- Page: `services/backup-water-systems.html`

## Tasks

- [x] Scan `services/backup-water-systems.html` for incorrect references and irrigation-specific content (weather widget excluded)
- [x] Produce suggested replacements for headings, CTAs, schema and copy
- [x] Replace visible "Irrigation" references in the Weather section with Backup Water Systems wording
- [x] Update iframe title attribute from "Irrigation" to "Backup Water Services"
- [x] Update CTA headings and copy that mention "Smart Irrigation" → "Smart Water Monitoring" or similar
- [x] Update `trust-heading` sr-only text referencing "Irrigation" to "Backup Water Services"
- [x] Fix testimonial image alt text mismatches
- [x] Reconcile installation numbers (500+ vs 800+) across the page
- [x] Scan & replace remaining 'irrigation' mentions on page
- [ ] Review and update any remaining product descriptions that imply irrigation scheduling
- [ ] Remove or gate the manual weather debug script (optional)
- [ ] Run a local build / smoke test of site (if applicable)
- [ ] Commit all changes with descriptive messages

## Recent actions

- 2025-10-10 — Replaced irrigation/weather-facing copy in `#weather` and related cards, updated iframe title, CTA copy and data-service attributes, and ensured testimonial alt attributes. Committed on branch `feature-incomplete-section`.


## Commit conventions

- Use `docs(checklist):` for checklist-only updates.
- Use `fix(service-page):` for content fixes and `feat(service-page):` for added sections.

## Updating checklist programmatically

If you want automated updates when tasks complete, consider a small helper script or GitHub Action to modify the markdown and commit. This is optional — ask me and I can scaffold it.

---
Generated: 2025-10-10
