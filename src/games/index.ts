// The list of games. Adding a game = a folder in games/ + one line here.
import type { GameContract } from '../core/contract';
import { hsr } from './hsr/contract';
import { zzz } from './zzz/contract';

export const games: GameContract[] = [hsr, zzz];
