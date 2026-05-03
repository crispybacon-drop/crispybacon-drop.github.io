import type { Player, Session } from "./types";

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function splitParticipantNames(value: string | undefined): string[] {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:&|,|\/|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addUnique(out: string[], name: string | undefined) {
  const clean = (name ?? "").trim();
  if (!clean) return;
  const key = clean.toLowerCase();
  if (!out.some((item) => item.toLowerCase() === key)) out.push(clean);
}

function addPlayerName(out: string[], players: Player[], id: string | undefined) {
  if (!id) return;
  addUnique(out, players.find((player) => player.id === id)?.name);
}

export function sessionParticipantNames(session: Session, players: Player[] = []): string[] {
  const names: string[] = [];
  const sc = session.score;
  if (!sc) return names;

  addUnique(names, sc.partnerName);
  addPlayerName(names, players, sc.partnerId);
  addPlayerName(names, players, sc.opponentId);
  for (const name of splitParticipantNames(sc.opponent)) addUnique(names, name);
  for (const name of splitParticipantNames(sc.opponentsLabel)) addUnique(names, name);
  for (const id of sc.opponentIds ?? []) addPlayerName(names, players, id);
  for (const name of sc.partnerNames ?? []) addUnique(names, name);
  for (const id of sc.partnerIds ?? []) addPlayerName(names, players, id);

  return names;
}

export function sessionOpponentNames(session: Session, players: Player[] = []): string[] {
  const names: string[] = [];
  const sc = session.score;
  if (!sc) return names;

  for (const name of splitParticipantNames(sc.opponentsLabel || sc.opponent))
    addUnique(names, name);
  addPlayerName(names, players, sc.opponentId);
  for (const id of sc.opponentIds ?? []) addPlayerName(names, players, id);

  return names;
}

export function sessionIncludesPlayer(session: Session, player: Player): boolean {
  const sc = session.score;
  const playerName = norm(player.name);
  if (sc) {
    if (sc.opponentId === player.id || sc.partnerId === player.id) return true;
    if (sc.opponentIds?.includes(player.id)) return true;
    if (sc.partnerIds?.includes(player.id)) return true;

    const names = [sc.opponent, sc.partnerName, sc.opponentsLabel, ...(sc.partnerNames ?? [])];
    if (names.some((name) => norm(name) === playerName)) return true;
    if (
      [sc.opponent, sc.opponentsLabel].some((label) =>
        splitParticipantNames(label).some((name) => norm(name) === playerName),
      )
    ) {
      return true;
    }
  }

  return !!session.customResults?.some(
    (result) => result.partnerId === player.id || norm(result.partnerName) === playerName,
  );
}
