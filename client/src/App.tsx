import { useCallback, useEffect, useState } from "react";
import { api, type MatchProfile, type Message, type Profile } from "./api";
import Avatar from "./Avatar";

type Tab = "discover" | "matches";

export default function App() {
  const [tab, setTab] = useState<Tab>("discover");
  const [me, setMe] = useState<Profile | null>(null);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [matchPopup, setMatchPopup] = useState<Profile | null>(null);
  const [activeChat, setActiveChat] = useState<MatchProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setMatches(await api.matches());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, cands] = await Promise.all([api.me(), api.candidates()]);
        setMe(meRes);
        setCandidates(cands);
        await loadMatches();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [loadMatches]);

  const current = candidates[0];

  async function handleSwipe(direction: "like" | "pass") {
    if (!current) return;
    const swiped = current;
    setCandidates((prev) => prev.slice(1));
    try {
      const result = await api.swipe(swiped.id, direction);
      if (result.match && result.matchedUser) {
        setMatchPopup(result.matchedUser);
        await loadMatches();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swipe failed");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span> Spark
        </div>
        {me && (
          <div className="me">
            <Avatar name={me.name} hue={me.hue} size={34} />
            <span>{me.name}</span>
          </div>
        )}
      </header>

      <nav className="tabs">
        <button className={tab === "discover" ? "active" : ""} onClick={() => setTab("discover")}>
          Discover
        </button>
        <button className={tab === "matches" ? "active" : ""} onClick={() => setTab("matches")}>
          Matches{matches.length > 0 ? ` (${matches.length})` : ""}
        </button>
      </nav>

      {error && <div className="banner error">{error}</div>}

      <main className="content">
        {tab === "discover" && (
          <DiscoverView current={current} remaining={candidates.length} onSwipe={handleSwipe} />
        )}
        {tab === "matches" && (
          <MatchesView matches={matches} onOpenChat={(m) => setActiveChat(m)} />
        )}
      </main>

      {matchPopup && (
        <div className="modal-backdrop" onClick={() => setMatchPopup(null)}>
          <div className="match-modal" onClick={(e) => e.stopPropagation()}>
            <div className="match-title">It's a match! 🎉</div>
            <Avatar name={matchPopup.name} hue={matchPopup.hue} size={120} />
            <p>
              You and <strong>{matchPopup.name}</strong> liked each other.
            </p>
            <div className="match-actions">
              <button
                className="btn primary"
                onClick={() => {
                  const m = matches.find((x) => x.id === matchPopup.id) ?? null;
                  setMatchPopup(null);
                  if (m) {
                    setTab("matches");
                    setActiveChat(m);
                  }
                }}
              >
                Send a message
              </button>
              <button className="btn ghost" onClick={() => setMatchPopup(null)}>
                Keep swiping
              </button>
            </div>
          </div>
        </div>
      )}

      {activeChat && (
        <ChatView match={activeChat} onClose={() => { setActiveChat(null); loadMatches(); }} />
      )}
    </div>
  );
}

function DiscoverView({
  current,
  remaining,
  onSwipe,
}: {
  current: Profile | undefined;
  remaining: number;
  onSwipe: (direction: "like" | "pass") => void;
}) {
  if (!current) {
    return (
      <div className="empty">
        <div className="empty-emoji">🌙</div>
        <h2>You're all caught up</h2>
        <p>No more profiles nearby right now. Check your matches!</p>
      </div>
    );
  }
  return (
    <div className="deck">
      <article className="card" key={current.id}>
        <div className="card-photo" style={{ background: `linear-gradient(160deg, hsl(${current.hue} 80% 60%), hsl(${(current.hue + 50) % 360} 75% 42%))` }}>
          <Avatar name={current.name} hue={current.hue} size={140} />
        </div>
        <div className="card-body">
          <h2>
            {current.name}, <span className="age">{current.age}</span>
          </h2>
          <div className="location">📍 {current.location}</div>
          <p className="bio">{current.bio}</p>
        </div>
      </article>
      <div className="swipe-actions">
        <button className="round pass" onClick={() => onSwipe("pass")} aria-label="Pass">
          ✕
        </button>
        <button className="round like" onClick={() => onSwipe("like")} aria-label="Like">
          ♥
        </button>
      </div>
      <div className="remaining">{remaining} profile{remaining === 1 ? "" : "s"} left</div>
    </div>
  );
}

function MatchesView({
  matches,
  onOpenChat,
}: {
  matches: MatchProfile[];
  onOpenChat: (m: MatchProfile) => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="empty">
        <div className="empty-emoji">💛</div>
        <h2>No matches yet</h2>
        <p>Like someone in Discover — when they like you back, they'll show up here.</p>
      </div>
    );
  }
  return (
    <ul className="match-list">
      {matches.map((m) => (
        <li key={m.id} className="match-row" onClick={() => onOpenChat(m)}>
          <Avatar name={m.name} hue={m.hue} size={56} />
          <div className="match-info">
            <div className="match-name">
              {m.name}, {m.age}
            </div>
            <div className="match-preview">
              {m.lastMessage ? m.lastMessage.body : "Say hi 👋"}
            </div>
          </div>
          <span className="chevron">›</span>
        </li>
      ))}
    </ul>
  );
}

function ChatView({ match, onClose }: { match: MatchProfile; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api.messages(match.id).then(setMessages).catch(() => setMessages([]));
  }, [match.id]);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const msg = await api.sendMessage(match.id, text);
    setMessages((prev) => [...prev, msg]);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chat" onClick={(e) => e.stopPropagation()}>
        <header className="chat-header">
          <button className="back" onClick={onClose} aria-label="Back">
            ‹
          </button>
          <Avatar name={match.name} hue={match.hue} size={40} />
          <div className="chat-name">{match.name}</div>
        </header>
        <div className="chat-messages">
          {messages.length === 0 && <div className="chat-hint">This is the start of your conversation with {match.name}.</div>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender_id === 1 ? "mine" : "theirs"}`}>
              {m.body}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            value={draft}
            placeholder={`Message ${match.name}…`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn primary" onClick={send}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
