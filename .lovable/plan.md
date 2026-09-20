# Targeted image and font loading optimization

## Scope
- Update only image element metadata in `src/routes/*` and `src/components/*`.
- Add font connection hints in the TanStack document head (`src/routes/__root.tsx`, which serves the role of `index.html`).
- Do not change colors, layouts, component structure, booking logic, or other behavior.

## Changes
1. **Images**
   - Add `decoding="async"` to every rendered `<img>`.
   - Mark images below the first viewport with `loading="lazy"`.
   - Mark genuinely above-fold images with `loading="eager"` and React’s `fetchPriority="high"` attribute.
   - Add explicit numeric `width` and `height` attributes based on the image’s actual intrinsic size when known, or its fixed rendered canvas/preview size for generated and uploaded images whose source dimensions vary.
   - Replace empty or generic alt text with context-specific descriptions; retain meaningful existing alt text.

2. **Fonts**
   - Add preconnect links for Google Fonts and Google’s font asset host before the existing stylesheet link.
   - Keep the existing Google Fonts request’s `display=swap` setting.
   - No local `@font-face` declarations currently exist in `src/styles.css`, so no CSS declaration needs modification.

3. **Route splitting verification**
   - Verify the generated TanStack route setup and production chunks.
   - Do not rewrite route components with `React.lazy` unless verification proves the framework is bundling them together; TanStack Start already owns route-module splitting, and an unnecessary conversion would exceed this low-risk image/font-only pass.

4. **Verification and report**
   - Run the requested production build once through the project’s `build` script.
   - Audit every `<img>` after the edit for `alt`, `width`, `height`, `loading`, and `decoding`.
   - Review the final diff to confirm only image metadata and document-head font hints changed.
   - Report all changed files, the full diff summary, the top five newly lazy-loaded images, and any image whose dynamic source prevents truthful intrinsic dimensions.
