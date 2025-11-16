# Myriad Green Image Modernization & Audit

## Overview
This project modernizes image handling for key Myriad Green web pages, ensuring robust, high-performance delivery with WebP and fallback formats, correct paths, and visual accuracy. The process includes auditing, conversion, and patching of HTML/CSS for overlays, hero images, and product images.

---

## What Has Been Done

- **Audit of all <img> and <picture> tags** on key pages (service pages, index, Pretoria leak detection)
- **Conversion of .jpg images to .webp** using ImageMagick for `images/services/irrigation` and other folders
- **Verification of .webp file presence** for all referenced images
- **HTML/CSS patching**:
  - Broken .webp references removed or replaced with valid fallback (.png/.jpg)
  - `<picture>` tags updated to use only available formats
  - Emergency overlay and hero images fixed for correct display
- **Scripted checks** for missing .webp files for both .jpg and .png sources
- **Documented all findings and fixes**

---

## To Do Checklist


### 1. Image File Conversion & Verification
- [x] Convert all .jpg images in `images/services/irrigation` to .webp
- [x] Convert all .jpg images in other relevant folders to .webp
- [x] Check for missing .webp files for .jpg images (all folders)
- [x] Check for missing .webp files for .png images (all folders)
- [ ] Convert any remaining .png images (e.g., `irrigation-installation-maintenance-repair-hero-image.png`) to .webp
- [ ] Convert any new .jpg or .png images added in the future

### 2. HTML & CSS Audit and Patching
- [x] Audit all <img> and <picture> tags for .webp usage and fallback on:
    - [x] index.html
    - [x] services/leak-detection.html
    - [x] services/irrigation.html
    - [x] services/drain-unblocking.html
    - [x] services/backup-water-systems.html
    - [x] services/leak-detection/pretoria.html
- [x] Patch HTML/CSS to remove or fix broken .webp references
- [x] Ensure overlays and hero images display correctly (all target pages)
- [ ] Update HTML to use new .webp for PNGs where appropriate
- [ ] Check for and fix any inline style issues flagged by linter

### 3. Folder-by-Folder Image Audit
- [x] `images/services/irrigation` (jpg/png/webp all checked)
- [ ] `images/services/blocked drains` (check for pngs/jpgs without webp)
- [ ] `images/services/leak-detection` (check for pngs/jpgs without webp)
- [ ] `images/services/backup-water-systems` (check for pngs/jpgs without webp)
- [ ] `images/services/drain-unblocking` (check for pngs/jpgs without webp)
- [ ] `images/products` (check for pngs/jpgs without webp)
- [ ] Any new folders/images added in the future

### 4. Documentation & Process
- [x] Create and maintain this README checklist
- [ ] Document any new findings or issues as they arise
- [ ] Add before/after screenshots or code samples for major changes
- [ ] Update this checklist after each work session

### 5. Final Review & Testing
- [ ] Manually test all target pages in browser for image display and performance
- [ ] Validate lazy loading and async decoding are present on all images
- [ ] Confirm all image paths are correct and relative
- [ ] Run linter and fix any remaining issues

---

## How-To: Image Conversion & Audit

### 1. Convert .jpg and .png to .webp

**For .jpg:**
```powershell
Get-ChildItem -Path "images/services" -Recurse -Filter *.jpg | ForEach-Object {
    $webp = $_.FullName -replace '.jpg$', '.webp'
    magick convert "$($_.FullName)" -quality 90 "$webp"
}
```

**For .png:**
```powershell
Get-ChildItem -Path "images/services" -Recurse -Filter *.png | ForEach-Object {
    $webp = $_.FullName -replace '.png$', '.webp'
    if (!(Test-Path $webp)) {
        magick convert "$($_.FullName)" -quality 90 "$webp"
    }
}
```

### 2. Check for missing .webp files

**For .jpg:**
```powershell
Get-ChildItem -Path "images/services" -Recurse -Filter *.jpg | ForEach-Object {
    $webp = $_.FullName -replace '.jpg$', '.webp'
    if (!(Test-Path $webp)) { Write-Output $_.Name }
}
```

**For .png:**
```powershell
Get-ChildItem -Path "images/services" -Recurse -Filter *.png | ForEach-Object {
    $webp = $_.FullName -replace '.png$', '.webp'
    if (!(Test-Path $webp)) { Write-Output $_.Name }
}
```

### 3. Patch HTML/CSS
- Remove or update `<source>` tags referencing missing .webp files
- Ensure `<img>` fallback points to a valid .jpg or .png
- For overlays/hero images, use only available formats

### 4. Re-audit and Document
- After any new image additions, repeat the above checks
- Update this checklist and README with new findings

---

## Notes
- Always verify image paths are correct relative to HTML file location
- Use lazy loading and async decoding for all images
- Keep this README updated for future contributors

---

## Last Updated
2025-11-16

---

**Contact:** For questions or to continue this work, review this README and the checklist above before proceeding.
