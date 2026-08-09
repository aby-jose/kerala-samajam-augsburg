import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY || '';

if (!apiKey || apiKey === 'sk_test_placeholder') {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing or using placeholder. Payment features will be disabled.');
}

// Initialize with a dummy key if missing to prevent module evaluation errors in some environments,
// but real calls will still fail with a 401 which is better than a startup crash.
export const stripe = new Stripe(apiKey || 'sk_test_dummy_key_to_prevent_startup_crash', {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
});
