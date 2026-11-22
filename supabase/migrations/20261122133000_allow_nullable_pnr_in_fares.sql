-- Migration: Allow NULL and default empty string on fares.pnr for Party Group fares
ALTER TABLE public.fares ALTER COLUMN pnr DROP NOT NULL;
ALTER TABLE public.fares ALTER COLUMN pnr SET DEFAULT '';
