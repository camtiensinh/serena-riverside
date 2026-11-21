export type WheelCandidate = {
  id: string;
  name: string;
  team: string;
};

export function chooseWheelWinner<T extends WheelCandidate>(
  eligible: T[],
  presetEntryId: string | null,
  randomIndex: (length: number) => number,
) {
  if (presetEntryId)
    return eligible.find((entry) => entry.id === presetEntryId) || null;
  if (!eligible.length) return null;
  return eligible[randomIndex(eligible.length)] || null;
}
