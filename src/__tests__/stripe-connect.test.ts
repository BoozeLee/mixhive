import { splitCents, onboardingStateFromAccount } from '@/lib/stripe-connect';
import type Stripe from 'stripe';

describe('stripe-connect', () => {
  describe('splitCents', () => {
    it('splits tiered gear fees correctly', () => {
      expect(splitCents(10_000, 5)).toEqual({ feeCents: 500, netCents: 9500 });
      expect(splitCents(50_000, 2.5)).toEqual({ feeCents: 1250, netCents: 48_750 });
    });

    it('splits agent 70/30 correctly', () => {
      const { feeCents, netCents } = splitCents(2999, 30);
      expect(feeCents).toBe(900);
      expect(netCents).toBe(2099);
      expect(feeCents + netCents).toBe(2999);
    });
  });

  describe('onboardingStateFromAccount', () => {
    it('returns enabled when payouts are active', () => {
      const account = { payouts_enabled: true, requirements: {} } as Stripe.Account;
      expect(onboardingStateFromAccount(account)).toBe('enabled');
    });

    it('returns restricted when Stripe disabled the account', () => {
      const account = {
        payouts_enabled: false,
        requirements: { disabled_reason: 'requirements.past_due' },
      } as Stripe.Account;
      expect(onboardingStateFromAccount(account)).toBe('restricted');
    });

    it('returns pending while onboarding is incomplete', () => {
      const account = { payouts_enabled: false, requirements: {} } as Stripe.Account;
      expect(onboardingStateFromAccount(account)).toBe('pending');
    });
  });
});
