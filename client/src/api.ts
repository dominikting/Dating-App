export interface Profile {
  id: number;
  name: string;
  age: number;
  bio: string;
  location: string;
  hue: number;
}

export interface Message {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
}

export interface MatchProfile extends Profile {
  lastMessage: { body: string; sender_id: number; created_at: string } | null;
}

export interface SwipeResult {
  match: boolean;
  matchedUser: Profile | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => fetch("/api/me").then(json<Profile>),
  candidates: () => fetch("/api/candidates").then(json<Profile[]>),
  matches: () => fetch("/api/matches").then(json<MatchProfile[]>),
  swipe: (targetId: number, direction: "like" | "pass") =>
    fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, direction }),
    }).then(json<SwipeResult>),
  messages: (userId: number) => fetch(`/api/matches/${userId}/messages`).then(json<Message[]>),
  sendMessage: (userId: number, body: string) =>
    fetch(`/api/matches/${userId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).then(json<Message>),
};
