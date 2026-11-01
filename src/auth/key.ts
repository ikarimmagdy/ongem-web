/**
 * The Clerk customer instance's publishable key (ADR-0045), never the ops instance's and never a secret key. Blank until
 * Karim creates the customer instance: then the web app runs in demo mode only (OG-030 R1).
 */
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
