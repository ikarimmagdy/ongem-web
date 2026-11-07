/**
 * Founder-facing words for API states (UI review 2026-11-07, OG-030 R-UX-3): internal names such as COLLECTING never
 * reach a founder. One short label for chips and lists, one sentence where a state needs explaining.
 */
const APPLICATION: Record<string, [label: string, sentence: string]> = {
  PREFILLING: ['Getting ready', 'We are filling in what your partner already sent us.'],
  COLLECTING: ['Details needed', 'We need a few details from you to finish your application.'],
  READY_FOR_DISCLOSURES: [
    'Agreements to accept',
    'Read and accept the bank agreements to send your application.',
  ],
  SUBMITTED: ['Sent to the bank', 'Your application is with the bank.'],
  VERIFYING: ['Being checked', 'The bank is checking your company and its owners.'],
  MORE_INFO: ['More details needed', 'The bank asked for more details. Open your application to send them.'],
  IN_REVIEW: ['In review', 'The bank is reviewing your application. We will tell you when it decides.'],
  EDD: ['More questions', 'The bank asked a few more questions about your business.'],
  PENDING_BANK: ['Waiting for the bank', 'Waiting for the bank to decide.'],
  APPROVED: ['Approved', 'The bank approved your company. Your account is being opened.'],
  REJECTED: ['Not approved', 'The bank could not approve your application.'],
  PROVISIONING: ['Opening your account', 'The bank approved your company. Your account is being opened.'],
  ACTIVE: ['Open', 'Your account is open.'],
};

const PAYMENT: Record<string, string> = {
  PENDING_APPROVAL: 'Waiting for approval',
  DRAFT: 'Sending',
  PRECHECKED: 'Sending',
  SUBMITTED: 'Sent',
  BANK_REVIEW: 'With the bank',
  SETTLED: 'Settled',
  RETURNED: 'Returned',
  FAILED: 'Not sent',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

const fallback = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const applicationLabel = (state: string) => APPLICATION[state]?.[0] ?? fallback(state);
export const applicationSentence = (state: string) =>
  APPLICATION[state]?.[1] ?? `Your application is ${fallback(state).toLowerCase()}.`;
export const paymentLabel = (state: string) => PAYMENT[state] ?? fallback(state);
