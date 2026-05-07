CREATE TABLE IF NOT EXISTS public.customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod        text NOT NULL UNIQUE,
  documento  text NOT NULL,
  nome       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Somente autenticados leem
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- Somente supervisores escrevem
CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT WITH CHECK (public.is_supervisor());

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE USING (public.is_supervisor());

CREATE INDEX IF NOT EXISTS idx_customers_cod ON public.customers (cod);
