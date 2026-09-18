/**
 * Guest identity management — generates and persists a random guest ID in
 * localStorage so a guest user keeps the same identity across sessions.
 */

const GUEST_ID_KEY = "speakup_guest_id";
const GUEST_NAME_KEY = "speakup_guest_name";

const ADJECTIVES = [
  "Swift", "Bright", "Calm", "Bold", "Wise", "Kind", "Lucky", "Brave",
  "Clever", "Gentle", "Sunny", "Cosmic",
];

const NOUNS = [
  "Lion", "Eagle", "Wolf", "Falcon", "Tiger", "Otter", "Hawk", "Panda",
  "Fox", "Owl", "Whale", "Deer",
];

function randomGuestName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestName(): string {
  let name = localStorage.getItem(GUEST_NAME_KEY);
  if (!name) {
    name = randomGuestName();
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
  return name;
}

export function clearGuestIdentity(): void {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_NAME_KEY);
}
