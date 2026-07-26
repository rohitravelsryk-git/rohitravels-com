ALTER TABLE public.self_group_passengers DROP CONSTRAINT IF EXISTS self_group_passengers_fare_id_fkey;
ALTER TABLE public.self_group_passengers ADD CONSTRAINT self_group_passengers_fare_id_fkey FOREIGN KEY (fare_id) REFERENCES public.fares(id) ON DELETE CASCADE;
ALTER TABLE public.self_group_passengers DROP CONSTRAINT IF EXISTS self_group_passengers_ticket_id_fkey;
ALTER TABLE public.self_group_passengers ADD CONSTRAINT self_group_passengers_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.group_tickets(id) ON DELETE CASCADE;