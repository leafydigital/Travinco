-- =========================================================
-- MIGRATION 026: Separate "tile image" for package listing cards.
--
-- cover_image_url is the big hero banner on a package's own detail page.
-- tile_image_url is what shows on the compact package cards on the
-- packages listing page and the homepage's "Snapshot of Our Packages"
-- grid — admins can now pick a different, more square-friendly crop for
-- that spot instead of reusing the hero banner. Falls back to
-- cover_image_url automatically when left blank (handled in app code).
-- =========================================================

alter table public.travel_packages
  add column tile_image_url text;
