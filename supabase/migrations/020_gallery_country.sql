-- Adds a country column so the gallery has a genuine two-level folder
-- structure: country (e.g. "India") as the outer folder, and the
-- existing category column (e.g. "Munnar", "Goa") as the place/subfolder
-- inside it. Backfills existing rows to "India" so nothing already
-- uploaded loses its place in the new structure.
alter table public.gallery
  add column country varchar(100);

update public.gallery set country = 'India' where country is null;

create index idx_gallery_country on public.gallery (country);
