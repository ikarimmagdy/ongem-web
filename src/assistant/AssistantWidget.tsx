import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorText } from '../api/errors';
import type { AssistantTurn } from '../api/types';
import { Button, Input } from '../design-system';
import { useSession } from '../session';
import { useDrafts } from './drafts';

/** The floating assistant (OG-031 R4): reads and drafts only; a draft opens the normal screen for the founder to confirm. */
export function AssistantWidget({ recordingSessionId }: { recordingSessionId?: string | null }) {
  const { api } = useSession();
  const drafts = useDrafts();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<string | null>(null);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [turns]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setError(null);
    try {
      const id = conversation ?? (await api.startConversation('WEB', recordingSessionId)).id;
      setConversation(id);
      const turn = await api.sendAssistantMessage(id, message);
      setTurns((t) => [...t, turn]);
      setText('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const rate = async (turn: AssistantTurn, rating: 'UP' | 'DOWN') => {
    await api.rateAssistantTurn(turn.id, rating).catch(() => undefined);
    setTurns((t) => t.map((x) => (x.id === turn.id ? { ...x, rating } : x)));
  };

  return (
    <div className="fw-assistant">
      {open && (
        <section className="fw-assistant__panel" aria-label="Assistant" data-testid="assistant-panel">
          <header className="fw-assistant__head">
            <strong>Assistant</strong>
            <Button variant="ghost" size="sm" aria-label="Close the assistant" onClick={() => setOpen(false)}>
              Close
            </Button>
          </header>
          <div className="fw-assistant__body" aria-live="polite">
            {turns.length === 0 && (
              <p className="fw-row__sub">
                Ask about your balances, payments, cards or support. I draft actions; you confirm them on the
                normal screen.
              </p>
            )}
            {turns.map((t) => {
              const state = t.draft ? (drafts.decided[t.draft.id] ?? t.draft.state) : null;
              return (
                <div key={t.id} className="fw-thread" data-testid="assistant-turn">
                  <div className="fw-msg fw-msg--mine" data-mask="">
                    {t.text}
                  </div>
                  <div className="fw-msg" data-testid="assistant-reply">
                    <p className="og-message__body" data-mask="">
                      {t.reply}
                    </p>
                    {t.reads.length > 0 && (
                      <div className="fw-msg__who">
                        Read {t.reads.map((r) => r.tool.replace(/_/g, ' ')).join(', ')}
                      </div>
                    )}
                  </div>
                  {t.draft && (
                    <div className="fw-assistant__draft" data-testid="assistant-draft">
                      <span data-mask="">{t.draft.summary}</span>
                      {state === 'OPEN' ? (
                        <div className="fw-actions">
                          <Button
                            size="sm"
                            data-testid="assistant-review"
                            onClick={() => drafts.review(t.draft!)}
                          >
                            Review
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void drafts.dismiss(t.draft!)}>
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <span className="fw-row__sub" data-testid="assistant-draft-state">
                          {state === 'CONFIRMED' ? 'Confirmed by you' : 'Dismissed'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="fw-actions">
                    <Button
                      size="sm"
                      variant={t.rating === 'UP' ? 'secondary' : 'ghost'}
                      aria-label="Helpful"
                      aria-pressed={t.rating === 'UP'}
                      onClick={() => void rate(t, 'UP')}
                    >
                      Helpful
                    </Button>
                    <Button
                      size="sm"
                      variant={t.rating === 'DOWN' ? 'secondary' : 'ghost'}
                      aria-label="Not helpful"
                      aria-pressed={t.rating === 'DOWN'}
                      onClick={() => void rate(t, 'DOWN')}
                    >
                      Not helpful
                    </Button>
                  </div>
                </div>
              );
            })}
            {error && <p className="fw-stale">{error}</p>}
            <div ref={end} />
          </div>
          <form className="fw-assistant__form" onSubmit={send}>
            <label className="og-visually-hidden" htmlFor="assistant-input">
              Message the assistant
            </label>
            <Input
              id="assistant-input"
              data-testid="assistant-input"
              value={text}
              maxLength={2000}
              placeholder="Ask the assistant"
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" data-testid="assistant-send" disabled={busy || !text.trim()}>
              Send
            </Button>
          </form>
        </section>
      )}
      <Button
        className="fw-assistant__fab"
        data-testid="assistant-open"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        {open ? 'Hide assistant' : 'Assistant'}
      </Button>
    </div>
  );
}
