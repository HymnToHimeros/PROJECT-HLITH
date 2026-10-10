/**
 * Shared by the kit importers (LOGIC-CORE). Beta game files can carry a raw text key where a name belongs
 * ("Severian_Talent_01_Title": the name isn't written yet). Such a key is never shown: "No name yet" instead, and the
 * piece's game text stays (owner's ruling via MANAGER, T39).
 */
export const NO_NAME = 'No name yet';

const RAW_KEY = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/;

export const shownName = (name: string) => (RAW_KEY.test(name.trim()) ? NO_NAME : name);

/** Leaked characters to read too: the manifest's new characters for this game that aren't released yet. */
export const leakedIds = (manifestNew: { character?: (number | string)[] } | undefined, live: Record<string, unknown>) =>
  (manifestNew?.character ?? []).map(String).filter((id) => !(id in live));
