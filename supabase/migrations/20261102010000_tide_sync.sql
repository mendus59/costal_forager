-- sync-tides fetches a few stations per run; remember how far ahead each
-- station's cached predictions reach so the next run picks up the rest.
alter table tide_stations add column if not exists predictions_until date;
