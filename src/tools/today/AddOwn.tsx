import { useState } from 'react';
import type { Banner, GameContract, GameEvent } from '../../core/contract';
import { BottomSheet, Button } from '../../core/ui';
import { EditMode } from '../edit-mode/EditMode';
import { exampleEvents } from '../events/examples';
import { exampleBannerSchedule } from '../pulls/examples';
import type { GameLists } from './lists';

const NOUN = { events: { one: 'event', list: 'Events' }, banners: { one: 'banner', list: 'Banners' } } as const;

/**
 * "Add your own event/banner": the way forward from an empty Today or Calendar list.
 * Opens Edit mode for that game and list in a side panel (PC) or sheet (phone).
 * `examples`: the example items, so ones you hid can be shown again (Edit mode shows
 * them only while the game's list is empty).
 */
export function AddOwnButton({ game, kind, examples, tag }: { game: GameContract; kind: 'events' | 'banners'; examples?: readonly (GameEvent | Banner)[] | undefined; tag: boolean }) {
  const [open, setOpen] = useState(false);
  const noun = NOUN[kind];
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Add your own {noun.one}
        {tag ? ` · ${game.short}` : ''}
      </Button>
      <BottomSheet open={open} title={`Edit mode · ${noun.list} · ${game.short}`} onClose={() => setOpen(false)} side>
        <EditMode game={game} kind={kind} examples={examples} />
      </BottomSheet>
    </>
  );
}

/** The same example items withOwnItems mixes in, for AddOwnButton; undefined while examples are hidden. */
export function examplesFor(game: GameContract, lists: GameLists, kind: 'events' | 'banners', now: number, showExamples: boolean): (GameEvent | Banner)[] | undefined {
  if (!showExamples) return undefined;
  return kind === 'events' ? exampleEvents(game, now) : exampleBannerSchedule(game, lists.characters, now, (lists.sampleArt ?? []).map((a) => a.characterId));
}
