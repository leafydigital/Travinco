-- Adds a single video URL field to travel_packages. Supports YouTube and
-- Vimeo links; the application layer converts the pasted URL into an
-- embeddable player URL so the video plays inline on the package detail
-- page instead of redirecting to YouTube/Vimeo.
alter table public.travel_packages
  add column video_url text;

comment on column public.travel_packages.video_url is
  'Optional YouTube or Vimeo URL (any common format). Rendered as an inline embedded player on the public package detail page, never as an outbound link.';
