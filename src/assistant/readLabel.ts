import { t } from '../i18n/store';

/** What each of the assistant's read tools looked at, as a topic whose words are `app.assistant.topic.<topic>`. */
const TOPICS: Record<string, string> = {
  get_me: 'profile',
  list_accounts: 'accounts',
  get_account: 'accounts',
  list_transactions: 'transactions',
  list_statements: 'statements',
  get_statement: 'statements',
  list_payments: 'payments',
  get_payment: 'payments',
  list_recipients: 'recipients',
  get_recipient: 'recipients',
  list_cards: 'cards',
  get_card: 'cards',
  list_tickets: 'support',
  get_ticket: 'support',
  list_applications: 'application',
  get_application: 'application',
  required_disclosures: 'disclosures',
};

/** "Checked your accounts and transactions", or null when no known read ran (an unknown tool is never shown raw). */
export function readLabel(tools: string[]): string | null {
  const topics = [...new Set(tools.map((x) => TOPICS[x]).filter((x): x is string => !!x))].map((x) =>
    t(`app.assistant.topic.${x}`),
  );
  if (!topics.length) return null;
  const list =
    topics.length === 1
      ? topics[0]!
      : t('app.assistant.read.list', {
          items: topics.slice(0, -1).join(t('app.assistant.read.separator')),
          last: topics[topics.length - 1]!,
        });
  return t('app.assistant.read.checked', { list });
}
