# Mobile Support Plan for Arsenix

## Executive Summary

This plan outlines a comprehensive approach to adding proper mobile support to Arsenix. While the application has some responsive design elements (93+ responsive breakpoints across 36 files), critical areas like the build editor, navigation, and complex layouts need significant mobile optimization to provide a usable touch-first experience.

## Current State Analysis

### ✅ What's Working

1. **Browse Page**
   - Item grid is responsive (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`)
   - Search/filter bar adapts (`flex-col sm:flex-row`)
   - Good mobile-first grid starting at 2 columns

2. **Landing Page**
   - Responsive typography (`text-4xl sm:text-5xl md:text-6xl lg:text-7xl`)
   - Flexible CTAs (`flex-col sm:flex-row`)
   - Hero and features sections have basic responsiveness

3. **Footer**
   - Responsive grid layout (`grid gap-8 md:grid-cols-2 lg:grid-cols-4`)
   - Mobile-friendly link sections

4. **General UI Components**
   - shadcn/ui components have built-in mobile support
   - Dialogs, popovers, tooltips work on touch devices

### ❌ Major Issues

1. **Header/Navigation**
   - Desktop nav hidden on mobile (`hidden md:flex`) with **NO mobile menu**
   - Navigation items completely inaccessible on mobile
   - No hamburger menu or drawer navigation

2. **Build Editor (Critical)**
   - Fixed-width sidebar (`w-[260px]`) doesn't adapt for mobile
   - Mod slots are fixed size (`w-[184px] h-[100px]`) - too large for mobile screens
   - Horizontal layout assumes desktop screen width
   - Drag-and-drop may not work well on touch devices
   - No mobile-optimized mod selection interface

3. **Build Container Layout**
   - Side-by-side layout (sidebar + mod grid) doesn't stack on mobile
   - Build header with actions may overflow on small screens
   - Partner builds and guide sections not optimized for mobile

4. **Mod Cards & Arcane Cards**
   - Fixed dimensions may not scale well on small screens
   - Hover interactions need touch equivalents
   - Polarity selection popover may be hard to use on touch

5. **Guides Pages**
   - Sidebar navigation may not collapse on mobile
   - Rich text editor (Lexical) needs mobile-specific touch handling

6. **Browse Page Detail View**
   - Item detail pages may have fixed-width content
   - Build preview cards may not adapt well

## Implementation Plan

### Phase 1: Navigation & Core Layout (Priority: Critical)

**Estimated Effort:** 3-5 files, ~300-500 lines of code

#### 1.1 Mobile Navigation Menu
**Files:** `src/components/header.tsx`, new `src/components/mobile-nav.tsx`

**Tasks:**
- Add hamburger menu button (visible on mobile, hidden on desktop)
- Create mobile navigation drawer using Sheet component from shadcn/ui
- Include all navigation items from desktop nav
- Add user menu integration
- Ensure proper z-index layering
- Add smooth animations

**Implementation:**
```typescript
// Mobile nav requirements:
- Use Sheet component from shadcn/ui
- Trigger: Menu icon button (visible < md breakpoint)
- Content: Full-height drawer with nav links
- Include user auth state and profile link
- Close on navigation
```

#### 1.2 Responsive Container Widths
**Files:** `src/app/layout.tsx`, global styles

**Tasks:**
- Review all `container` usage for mobile padding
- Ensure consistent mobile spacing (px-4 on mobile, px-6 on tablet)
- Add viewport meta tag verification

### Phase 2: Build Editor Mobile Experience (Priority: Critical)

**Estimated Effort:** 5-8 files, ~800-1200 lines of code

#### 2.1 Responsive Build Container Layout
**Files:** `src/components/build-editor/build-container.tsx`

**Tasks:**
- Convert fixed sidebar to responsive width
  - Hidden on mobile by default
  - Accessible via collapsible panel or bottom sheet
  - Full width on mobile, side-by-side on tablet+
- Stack header elements vertically on mobile
- Adapt build name input for mobile (full width)
- Make action buttons responsive (icon-only on mobile, full labels on desktop)

**Breakpoints:**
```
Mobile (< 768px): Stacked layout, collapsible sidebar
Tablet (768-1024px): Hybrid layout, smaller sidebar
Desktop (1024px+): Current layout
```

#### 2.2 Touch-Optimized Mod Grid
**Files:** `src/components/build-editor/mod-grid.tsx`

**Tasks:**
- Make mod slots responsive:
  - Mobile: 2-3 slots per row, smaller size
  - Tablet: 4 slots per row
  - Desktop: Current 4 slots per row
- Increase touch target sizes (min 44x44px)
- Add touch-friendly spacing between slots
- Implement tap-to-select (no hover states)

**Mobile Slot Sizing:**
```
Mobile: w-[120px] h-[80px] (or fluid with min/max)
Tablet: w-[150px] h-[90px]
Desktop: w-[184px] h-[100px]
```

#### 2.3 Mobile Mod Search Interface
**Files:** `src/components/build-editor/mod-search-grid.tsx`, `src/components/build-editor/arcane-search-panel.tsx`

**Tasks:**
- Convert search grid to mobile-friendly layout
  - 2-3 columns on mobile vs current 4-6
  - Larger tap targets for mod cards
  - Sticky search bar on mobile
- Add filter chips instead of complex dropdowns
- Optimize search input for mobile keyboards
- Consider bottom sheet for mod selection on mobile

#### 2.4 Touch Interactions
**Files:** Multiple components using drag-and-drop

**Tasks:**
- Test and optimize @dnd-kit for touch devices
- Add visual feedback for touch drag operations
- Implement alternative tap-to-place workflow for mobile:
  1. Tap empty slot to activate
  2. Search/select mod
  3. Auto-place in active slot
- Add long-press for context menus (forma, remove)
- Replace hover tooltips with tap-to-show

#### 2.5 Item Sidebar Mobile Layout
**Files:** `src/components/build-editor/item-sidebar.tsx`

**Tasks:**
- Convert to collapsible panel or bottom sheet on mobile
- Sticky toggle button to show/hide
- Condensed stats display for mobile
- Stack stats vertically, reduce spacing
- Make Helminth ability selection touch-friendly

### Phase 3: Browse & Discovery (Priority: High)

**Estimated Effort:** 3-4 files, ~200-400 lines of code

#### 3.1 Browse Page Optimization
**Files:** `src/components/browse/browse-container.tsx`, filter components

**Tasks:**
- Move filters to bottom sheet on mobile
- Stack search bar and filter button
- Optimize category tabs for horizontal scrolling
- Add "scroll to top" button for long lists

#### 3.2 Item Cards & Grid
**Files:** `src/components/browse/item-card.tsx`, `src/components/browse/item-grid.tsx`

**Tasks:**
- Already responsive, but verify spacing on small screens
- Ensure images load efficiently on mobile networks
- Add loading states for mobile

#### 3.3 Build List Pages
**Files:** `src/app/builds/page.tsx`, `src/app/favorites/page.tsx`

**Tasks:**
- Optimize build cards for mobile stacking
- Condensed metadata display
- Touch-friendly vote/favorite buttons

### Phase 4: Guides & Content (Priority: Medium)

**Estimated Effort:** 4-5 files, ~300-500 lines of code

#### 4.1 Guide Reader
**Files:** `src/components/guides/guide-reader.tsx`, sidebar components

**Tasks:**
- Convert sidebar to collapsible mobile menu
- Full-width content on mobile
- Optimize Lexical editor content for mobile reading
- Ensure code blocks and tables are horizontally scrollable

#### 4.2 Guide Editor (Lexical)
**Files:** `src/components/build-editor/inline-guide-editor.tsx`, editor components

**Tasks:**
- Test and optimize Lexical toolbar for mobile
- Sticky toolbar on mobile
- Touch-friendly formatting controls
- Mobile keyboard optimization

#### 4.3 Guide List Pages
**Files:** `src/components/guides/guide-list.tsx`, featured components

**Tasks:**
- Responsive card layouts
- Stack guide metadata vertically on mobile
- Optimize preview text truncation

### Phase 5: Component Library & UI Polish (Priority: Medium)

**Estimated Effort:** 8-12 files, ~400-600 lines of code

#### 5.1 Mod & Arcane Cards
**Files:** `src/components/mod-card/`, `src/components/arcane-card/`

**Tasks:**
- Add responsive sizing variants (sm, md, lg)
- Ensure touch targets meet minimum size
- Optimize rank sliders for touch
- Replace hover effects with tap/active states

#### 5.2 Dialogs & Modals
**Files:** Various dialog components

**Tasks:**
- Ensure all dialogs are mobile-friendly
- Full-screen dialogs on mobile where appropriate
- Sheet component for bottom-up panels
- Proper mobile keyboard handling

#### 5.3 Forms & Inputs
**Files:** Input, textarea, select components

**Tasks:**
- Verify input types for mobile keyboards
- Proper autocomplete attributes
- Mobile-friendly select dropdowns
- Date/time pickers for mobile

### Phase 6: Performance & UX Refinements (Priority: Low)

**Estimated Effort:** Ongoing optimization

#### 6.1 Performance
**Tasks:**
- Lazy load images on mobile
- Optimize bundle size for mobile networks
- Add offline support considerations
- Implement skeleton loading states
- Progressive image loading

#### 6.2 Touch UX Enhancements
**Tasks:**
- Swipe gestures where appropriate
- Pull-to-refresh on lists
- Touch-friendly table scrolling
- Pinch-to-zoom for images (if applicable)

#### 6.3 Mobile-Specific Features
**Tasks:**
- Share API for mobile browsers
- Add to home screen prompt
- Mobile-optimized meta tags for social sharing
- Consider PWA features

#### 6.4 Accessibility
**Tasks:**
- Verify touch target sizes (min 44x44px)
- Test with mobile screen readers
- Ensure proper focus management
- Test with one-handed use in mind

## Technical Guidelines

### Responsive Breakpoints

Use Tailwind's default breakpoints consistently:
```
sm: 640px   - Large phones (landscape)
md: 768px   - Tablets
lg: 1024px  - Small laptops
xl: 1280px  - Desktops
2xl: 1536px - Large desktops
```

### Mobile-First Approach

Always write styles mobile-first:
```typescript
// ✅ Good
<div className="flex flex-col md:flex-row gap-4 md:gap-6">

// ❌ Bad
<div className="flex flex-row md:flex-col gap-6 md:gap-4">
```

### Touch Target Guidelines

- Minimum touch target: 44x44px (iOS HIG, Android Material)
- Recommended: 48x48px
- Spacing between targets: minimum 8px

### Testing Checklist

**Devices:**
- [ ] iPhone SE (375px - smallest modern phone)
- [ ] iPhone 12/13/14 (390px)
- [ ] iPhone 14 Pro Max (430px)
- [ ] Android Small (360px)
- [ ] iPad Mini (768px)
- [ ] iPad Pro (1024px)

**Browsers:**
- [ ] Safari iOS
- [ ] Chrome Android
- [ ] Chrome iOS
- [ ] Firefox Mobile
- [ ] Samsung Internet

**Orientations:**
- [ ] Portrait mode
- [ ] Landscape mode

**Interactions:**
- [ ] Touch/tap
- [ ] Drag and drop
- [ ] Long press
- [ ] Scroll
- [ ] Form input with keyboard

## Implementation Priority

### Must Have (MVP)
1. Mobile navigation menu (Phase 1.1)
2. Responsive build editor layout (Phase 2.1-2.3)
3. Touch-optimized mod grid (Phase 2.2)
4. Browse page mobile optimization (Phase 3.1)

### Should Have
5. Touch interactions for drag-and-drop (Phase 2.4)
6. Mobile-friendly guides (Phase 4.1-4.2)
7. Component library polish (Phase 5.1-5.2)

### Nice to Have
8. Performance optimizations (Phase 6.1)
9. Mobile-specific features (Phase 6.3)
10. Advanced touch gestures (Phase 6.2)

## Success Metrics

### Usability
- Users can complete all core tasks on mobile (browse, create builds, view guides)
- Build editor is usable on phones 375px+ wide
- No horizontal scrolling on any page
- All interactive elements are easily tappable

### Performance
- Lighthouse mobile score > 90
- First Contentful Paint < 2s on 3G
- Time to Interactive < 4s on 3G

### Adoption
- Mobile traffic increases (track via analytics)
- Mobile session duration matches desktop
- Mobile conversion rate (guest → signup) comparable to desktop

## Risks & Mitigations

### Risk: Build Editor Too Complex for Mobile
**Mitigation:**
- Focus on view-only mode first
- Simplify editing workflow with tap-to-place
- Consider creating mobile-optimized "quick build" mode
- Allow users to start builds on mobile, finish on desktop

### Risk: Touch Drag-and-Drop Performance
**Mitigation:**
- Implement alternative tap-to-place workflow as primary on mobile
- Keep drag-and-drop as secondary option
- Test extensively on real devices

### Risk: Breaking Desktop Experience
**Mitigation:**
- Use mobile-first CSS but test desktop thoroughly
- Keep desktop as primary development target
- Add visual regression testing
- Gradual rollout with feature flags

### Risk: Increased Bundle Size
**Mitigation:**
- Code-split mobile-specific components
- Lazy load mobile navigation
- Optimize images for mobile
- Monitor bundle size in CI

## Next Steps

1. **Get stakeholder buy-in** on approach and priorities
2. **Create detailed tickets** for Phase 1 tasks
3. **Set up mobile testing environment** (BrowserStack, real devices)
4. **Establish baseline metrics** (current mobile usage, performance)
5. **Start with Phase 1.1** (mobile navigation) as quick win
6. **Iterate based on user feedback** from mobile users

## Open Questions

1. **Should we support phones < 375px wide?** (iPhone SE 1st gen is 320px)
   - Recommendation: No, focus on 375px+ (covers 95%+ of users)

2. **PWA or native app in the future?**
   - Recommendation: Start with responsive web, evaluate PWA features after Phase 6

3. **Should build editor have full feature parity on mobile?**
   - Recommendation: Phase 1 - view only, Phase 2 - full editing with optimized UX

4. **Touch vs. mouse drag-and-drop priority?**
   - Recommendation: Tap-to-place primary on mobile, drag-and-drop secondary

5. **How to handle mod card info on small screens?**
   - Recommendation: Tap to expand, bottom sheet for full details

## Conclusion

This plan provides a roadmap for comprehensive mobile support across Arsenix. By prioritizing the navigation and build editor first, we ensure the core user journey works on mobile. Subsequent phases add polish and mobile-specific optimizations.

**Estimated Total Effort:**
- Core mobile support (Phases 1-3): 15-20 files, ~1500-2000 lines of code
- Full mobile optimization (All phases): 25-35 files, ~2500-3500 lines of code

**Timeline Estimate:**
- Phase 1: 1-2 weeks
- Phase 2: 3-4 weeks
- Phase 3: 1-2 weeks
- Phase 4: 2-3 weeks
- Phase 5: 2-3 weeks
- Phase 6: Ongoing

**Total: 9-14 weeks** for complete mobile support with polish.
