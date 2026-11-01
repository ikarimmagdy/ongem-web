import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  StatusChip,
  TextArea,
} from '../design-system';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import { Load, human, stateStatus } from './common';

const CATEGORIES = ['PAYMENT', 'CARD', 'ACCOUNT', 'ONBOARDING', 'OTHER'];

function NewTicket() {
  const { api } = useSession();
  const drafts = useDrafts();
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const [subject, setSubject] = useState(q.get('subject') ?? '');
  const [category, setCategory] = useState(q.get('category') ?? 'OTHER');
  const [body, setBody] = useState(q.get('body') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const open = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const t = await api.openTicket({ subject: subject.trim(), category, body: body.trim() });
      await drafts.done(['SUPPORT_TICKET'], t.ticket.id);
      navigate(`/support/${t.ticket.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Card title="New request" data-testid="ticket-form">
      <div className="fw-form">
        <Field label="Subject">
          <Input
            data-testid="ticket-subject"
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field label="About">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c, label: human(c) }))}
          />
        </Field>
        <Field label="Message" hint="Never type a full card or account number.">
          <TextArea
            data-testid="ticket-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        {error && <Notice status="failure">{error}</Notice>}
        <Button
          data-testid="ticket-send"
          disabled={busy || !subject.trim() || !body.trim()}
          onClick={() => void open()}
        >
          Send request
        </Button>
      </div>
    </Card>
  );
}

function Ticket({ id }: { id: string }) {
  const { api } = useSession();
  const drafts = useDrafts();
  const [q] = useSearchParams();
  const [n, setN] = useState(0);
  const ticket = useAsync(() => api.ticket(id), [api, id, n]);
  const [reply, setReply] = useState(q.get('reply') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const once = async (f: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const send = () =>
    once(async () => {
      await api.replyToTicket(id, reply);
      setReply('');
      await drafts.done(['TICKET_REPLY'], id, { ticketId: id });
      setN((x) => x + 1);
    });
  const attach = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Cleared so the same file can be chosen again after a failure.
    input.value = '';
    if (!file) return;
    void once(async () => {
      await api.attachToTicket(id, file);
      setN((x) => x + 1);
    });
  };
  return (
    <Load state={ticket} label="ticket">
      {(t) => (
        <Card
          title={t.ticket.subject}
          data-testid="ticket-detail"
          actions={<StatusChip status={stateStatus(t.ticket.status)}>{human(t.ticket.status)}</StatusChip>}
        >
          <div className="fw-thread" data-testid="ticket-thread">
            {t.messages.map((m) => (
              <div key={m.id} className={`fw-msg${m.authorKind === 'MEMBER' ? ' fw-msg--mine' : ''}`}>
                <div className="fw-msg__who">
                  {m.authorName} · {formatDate(m.at, { time: true })}
                </div>
                <p className="og-message__body">{m.body}</p>
              </div>
            ))}
            {t.attachments.map((a) => (
              <div key={a.id} className="fw-row__sub" data-testid="ticket-attachment">
                Attached {a.name}
              </div>
            ))}
          </div>
          {t.resolution && <Notice status="success">{t.resolution}</Notice>}
          <div className="fw-form">
            <Field label="Reply">
              <TextArea
                data-testid="ticket-reply"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </Field>
            <div className="fw-actions">
              <Button
                data-testid="ticket-reply-send"
                disabled={busy || !reply.trim()}
                onClick={() => void send()}
              >
                Send reply
              </Button>
              <label className="og-btn og-btn--secondary og-btn--md">
                Attach a file
                <input
                  data-testid="ticket-file"
                  type="file"
                  className="og-visually-hidden"
                  accept="image/*,application/pdf"
                  disabled={busy}
                  onChange={(e) => attach(e.currentTarget)}
                />
              </label>
            </div>
            {error && <Notice status="failure">{error}</Notice>}
          </div>
        </Card>
      )}
    </Load>
  );
}

export function SupportScreen() {
  const { api } = useSession();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = location.pathname.endsWith('/support/new');
  const list = useAsync(() => api.tickets(), [api, id, isNew]);
  const detail = isNew || Boolean(id);
  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Ask OnGem's team; we answer here."
        actions={
          <Button data-testid="ticket-new" onClick={() => navigate('/support/new')}>
            New request
          </Button>
        }
      />
      <div className={`fw-split${detail ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="tickets">
            {(rows) =>
              rows.length ? (
                <ul className="fw-list" data-testid="tickets-list">
                  {rows.map((t) => (
                    <li key={t.id}>
                      <button
                        className={`fw-row${t.id === id ? ' is-active' : ''}`}
                        data-testid={`ticket-${t.id}`}
                        onClick={() => navigate(`/support/${t.id}`)}
                      >
                        <span className="fw-row__main">
                          <strong>{t.subject}</strong>
                          <span className="fw-row__sub">{formatDate(t.updatedAt)}</span>
                        </span>
                        <StatusChip status={stateStatus(t.status)}>{human(t.status)}</StatusChip>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No requests yet">
                  Ask us anything about your account, payments or cards.
                </EmptyState>
              )
            }
          </Load>
        </div>
        <div>
          {detail && (
            <Button variant="ghost" onClick={() => navigate('/support')}>
              Back to support
            </Button>
          )}
          {isNew ? <NewTicket /> : id ? <Ticket id={id} /> : null}
        </div>
      </div>
    </>
  );
}
