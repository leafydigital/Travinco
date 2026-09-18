-- Makes destination_id optional on travel_packages. Some packages
-- (multi-country tours, general offers) don't map cleanly to a single
-- destination, so this is no longer a hard requirement at the database
-- level. Existing rows and the public destinations page are unaffected —
-- a package with a destination still shows and filters by it exactly as
-- before; a package with none simply omits that label/filter.
alter table public.travel_packages
  alter column destination_id drop not null;
