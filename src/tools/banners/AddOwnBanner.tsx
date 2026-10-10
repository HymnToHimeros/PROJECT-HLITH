import { useState, type ReactNode } from 'react';
import type { Banner, GameContract } from '../../core/contract';
import { BottomSheet } from '../../core/ui';
import { EditMode } from '../edit-mode/EditMode';

/**
 * "Add my own banner" for empty banner lists (Banners and the Planner): opens
 * Edit mode for banners in a side panel. Returns the opener and the panel to render.
 */
export function useAddOwnBanner(game: GameContract, examples: readonly Banner[] | undefined): { openSheet: () => void; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const sheet = (
    <BottomSheet open={open} title={`Edit mode · Banners · ${game.short}`} onClose={() => setOpen(false)} side>
      <EditMode game={game} kind="banners" examples={examples} />
    </BottomSheet>
  );
  return { openSheet: () => setOpen(true), sheet };
}
