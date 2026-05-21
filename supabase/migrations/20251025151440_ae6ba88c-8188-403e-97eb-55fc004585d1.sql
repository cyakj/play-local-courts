-- Create stripe_accounts table for coaches
CREATE TABLE public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coaches(user_id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_request_id UUID NOT NULL REFERENCES public.lesson_requests(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payouts table
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_id UUID NOT NULL REFERENCES public.stripe_accounts(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  arrival_date TIMESTAMPTZ,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Stripe accounts policies
CREATE POLICY "Coaches can view their own stripe account"
  ON public.stripe_accounts FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert their own stripe account"
  ON public.stripe_accounts FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their own stripe account"
  ON public.stripe_accounts FOR UPDATE
  USING (coach_id = auth.uid());

-- Transactions policies
CREATE POLICY "Players can view their own transactions"
  ON public.transactions FOR SELECT
  USING (player_id = auth.uid());

CREATE POLICY "Coaches can view their transactions"
  ON public.transactions FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Players can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (player_id = auth.uid());

-- Payouts policies
CREATE POLICY "Coaches can view their payouts"
  ON public.payouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stripe_accounts
    WHERE stripe_accounts.id = payouts.stripe_account_id
    AND stripe_accounts.coach_id = auth.uid()
  ));

-- Add updated_at triggers
CREATE TRIGGER update_stripe_accounts_updated_at
  BEFORE UPDATE ON public.stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes
CREATE INDEX idx_stripe_accounts_coach_id ON public.stripe_accounts(coach_id);
CREATE INDEX idx_transactions_lesson_request_id ON public.transactions(lesson_request_id);
CREATE INDEX idx_transactions_player_id ON public.transactions(player_id);
CREATE INDEX idx_transactions_coach_id ON public.transactions(coach_id);
CREATE INDEX idx_payouts_stripe_account_id ON public.payouts(stripe_account_id);