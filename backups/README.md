# Backups Directory

This directory contains timestamped backups of important website states and components.

## Current Backups

### 📁 2025-11-08-stable-state
**Date:** November 8, 2025  
**Purpose:** Stable foundation backup after reverting problematic changes  
**Contains:**
- index.html (stable state)
- services/ (all service pages)
- Complete documentation and status reports

**Key Features:**
- ✅ All major redesigned pages working (contact, checkout, privacy policy, about, booking)
- ✅ Stable index.html without problematic alterations
- ✅ Service pages with content fixes and SEO optimization
- ✅ No CSS architecture violations or conflicts
- ✅ Working JavaScript and booking modal functionality

## Usage Guidelines

### When to Use Backups
1. **Before Major Changes:** Always backup before significant modifications
2. **After Stable States:** Create backups when reaching stable milestones
3. **Problem Recovery:** Use backups to restore when issues arise
4. **Development Branches:** Reference backups when branching for new features

### Backup Naming Convention
- **Format:** YYYY-MM-DD-description
- **Examples:**
  - 2025-11-08-stable-state
  - 2025-11-15-hero-redesign
  - 2025-11-20-service-modernization

### What to Backup
- **Critical Files:** index.html, main service pages
- **Documentation:** README, status reports, technical notes
- **Git Context:** Commit hashes, branch information, change summaries
- **Dependencies:** Related CSS, JS, and asset files

## Restoration Process

### Quick File Restore
```bash
# Navigate to project root
cd myriad-green-v2

# Copy specific backup
cp backups/[backup-name]/index.html ./
cp -r backups/[backup-name]/services/ ./
```

### Git-Based Restoration
```bash
# Check backup documentation for commit hash
# Reset to specific commit
git reset --hard [commit-hash]
```

## Backup Maintenance

### Regular Tasks
- [ ] Create weekly backups during active development
- [ ] Document major changes and their rationale
- [ ] Clean up old backups (keep monthly archives)
- [ ] Verify backup integrity and restoration procedures

### Documentation Requirements
Each backup should include:
- [ ] README.md with overview and context
- [ ] Technical documentation of state
- [ ] Git commit references and branch information
- [ ] Known issues and recommendations
- [ ] Restoration instructions

## Best Practices

### Before Creating Backup
1. Ensure current state is stable and tested
2. Document any known issues or limitations
3. Include git commit hash and branch information
4. Test critical functionality (booking, forms, navigation)

### Backup Content
- Include all modified files, not just changed ones
- Document dependencies and related components
- Preserve directory structure and file relationships
- Include any configuration or environment notes

### Recovery Planning
- Test restoration procedures before needing them
- Keep multiple backups of critical states
- Document recovery procedures clearly
- Maintain both file-based and git-based recovery options

This backup system ensures the Myriad Green website can always return to stable, working states during development and maintenance.