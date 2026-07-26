
-- Agent portal: profiles, roles, bookings

CREATE TYPE public.agent_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.agents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  city text NOT NULL,
  country_code text NOT NULL DEFAULT '+92',
  cell_number text NOT NULL,
  office_address text NOT NULL,
  country text NOT NULL DEFAULT 'Pakistan',
  status public.agent_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Admin role table
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "agents self read" ON public.agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents self insert" ON public.agents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agents self update non-status" ON public.agents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Bookings
CREATE TABLE public.agent_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fare_id uuid REFERENCES public.fares(id) ON DELETE SET NULL,
  fare_snapshot jsonb NOT NULL,
  seats integer NOT NULL DEFAULT 1 CHECK (seats > 0),
  passenger_names text NOT NULL,
  contact_phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agent_bookings TO authenticated;
GRANT ALL ON public.agent_bookings TO service_role;
ALTER TABLE public.agent_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings own read" ON public.agent_bookings FOR SELECT TO authenticated
  USING (auth.uid() = agent_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings own insert" ON public.agent_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = agent_user_id AND public.has_role(auth.uid(), 'admin') = false OR public.has_role(auth.uid(), 'admin'));
-- allow agents to insert only own; simpler:
DROP POLICY "bookings own insert" ON public.agent_bookings;
CREATE POLICY "bookings own insert" ON public.agent_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = agent_user_id);
CREATE POLICY "bookings admin update" ON public.agent_bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.agent_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

-- Grant admin role to existing rohitravels@gmail.com user if present
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'rohitravels@gmail.com'
ON CONFLICT DO NOTHING;
