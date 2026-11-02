/** What each of the assistant's read tools looked at, in the founder's words (ongem-core ToolCatalogue). */
const TOPICS: Record<string, string> = {
  get_me: 'your profile',
  list_accounts: 'your accounts',
  get_account: 'your accounts',
  list_transactions: 'transactions',
  list_statements: 'statements',
  get_statement: 'statements',
  list_payments: 'payments',
  get_payment: 'payments',
  list_recipients: 'recipients',
  get_recipient: 'recipients',
  list_cards: 'cards',
  get_card: 'cards',
  list_tickets: 'support requests',
  get_ticket: 'support requests',
  list_applications: 'your application',
  get_application: 'your application',
  required_disclosures: 'disclosures',
};

/** "Checked your accounts and transactions", or null when no known read ran (an unknown tool is never shown raw). */
export function readLabel(tools: string[]): string | null {
  const topics = [...new Set(tools.map((t) => TOPICS[t]).filter((t): t is string => !!t))];
  if (!topics.length) return null;
  const list =
    topics.length === 1 ? topics[0] : `${topics.slice(0, -1).join(', ')} and ${topics[topics.length - 1]}`;
  return `Checked ${list}`;
}
