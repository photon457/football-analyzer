/**
 * Tactic Service
 * Manages tactical configurations, formation layouts, team instructions across game phases,
 * tactical archetypes/presets, tactical radar metrics, and local storage persistence.
 */

export type FormationKey =
  | '4-3-3 Holding'
  | '4-2-3-1 Pivot'
  | '3-4-2-1 Box'
  | '3-5-2 Wings'
  | '4-4-2 Diamond'
  | '5-3-2 Counter'
  | '4-1-4-1 Control'
  | 'Custom';

export type TeamMentality = 'cautious' | 'balanced' | 'positive' | 'attacking';
export type AttackingWidth = 'narrow' | 'balanced' | 'wide';
export type BuildUpPlay = 'play_out_of_back' | 'mixed' | 'direct';
export type PassingDirectness = 'short' | 'standard' | 'direct';
export type TacticalTempo = 'patient' | 'standard' | 'high_tempo';
export type FinalThirdEntry = 'work_into_box' | 'mixed' | 'shoot_on_sight' | 'early_crosses';

export type LossTransition = 'counter_press' | 'regroup';
export type WinTransition = 'counter' | 'hold_shape';
export type GkDistribution = 'short_cb' | 'roll_out' | 'long_kick';

export type DefensiveLineHeight = 'high_line' | 'mid_block' | 'low_block';
export type PressingEngagementLine = 'high_press' | 'mid_block' | 'deep_contain';
export type PressingIntensity = 'cautious' | 'standard' | 'aggressive' | 'extreme';
export type TacklingAggression = 'stay_on_feet' | 'balanced' | 'get_stuck_in';

export interface FormationSlot {
  slotId: string;
  roleCode: string;
  roleName: string;
  duty: 'Attack' | 'Support' | 'Defend';
  x: number; // percentage 0-100 on pitch length (0 = GK, 100 = Opponent Goal)
  y: number; // percentage 0-100 on pitch width (0 = Right touchline, 100 = Left touchline)
  assignedPlayerId?: string | null;
  assignedPlayerName?: string | null;
  assignedJerseyNumber?: number | null;
  assignedPosition?: string | null;
  individualInstructions?: {
    dribbling: 'dribble_more' | 'balanced' | 'dribble_less';
    risks: 'take_risks' | 'balanced' | 'play_safe';
    positioning: 'roam' | 'hold_position';
    shooting: 'shoot_more' | 'balanced' | 'shoot_less';
  };
}

export interface TacticalConnection {
  fromIndex: number;
  toIndex: number;
  weight: number;
}

export interface TacticConfiguration {
  id: string;
  name: string;
  isPreset?: boolean;
  formation: FormationKey;
  mentality: TeamMentality;
  inPossession: {
    width: AttackingWidth;
    buildUp: BuildUpPlay;
    passingDirectness: PassingDirectness;
    tempo: TacticalTempo;
    finalThird: FinalThirdEntry;
  };
  inTransition: {
    lossTransition: LossTransition;
    winTransition: WinTransition;
    gkDistribution: GkDistribution;
  };
  outOfPossession: {
    defensiveLine: DefensiveLineHeight;
    pressingLine: PressingEngagementLine;
    pressingIntensity: PressingIntensity;
    tacklingAggression: TacklingAggression;
    offsideTrap: boolean;
  };
  slots: FormationSlot[];
  lastModified?: string;
}

// -------------------------------------------------------------------------
// FORMATION SLOTS & COORDINATE TEMPLATES
// -------------------------------------------------------------------------

export const FORMATION_TEMPLATES: Record<FormationKey, { slots: Omit<FormationSlot, 'assignedPlayerId' | 'assignedPlayerName' | 'assignedJerseyNumber' | 'assignedPosition'>[]; connections: TacticalConnection[] }> = {
  '4-3-3 Holding': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rb', roleCode: 'RB', roleName: 'Inverted Fullback', duty: 'Support', x: 28, y: 18 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Ball-Playing Defender', duty: 'Defend', x: 25, y: 38 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 25, y: 62 },
      { slotId: 'lb', roleCode: 'LB', roleName: 'Attacking Wingback', duty: 'Support', x: 28, y: 82 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Anchor Pivot', duty: 'Defend', x: 44, y: 50 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Mezzala', duty: 'Attack', x: 56, y: 32 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Box-to-Box Midfielder', duty: 'Support', x: 56, y: 68 },
      { slotId: 'rw', roleCode: 'RW', roleName: 'Inside Forward', duty: 'Attack', x: 74, y: 20 },
      { slotId: 'st', roleCode: 'ST', roleName: 'Complete Forward', duty: 'Attack', x: 84, y: 50 },
      { slotId: 'lw', roleCode: 'LW', roleName: 'Inverted Winger', duty: 'Support', x: 74, y: 80 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 3.5 },
      { fromIndex: 0, toIndex: 3, weight: 3.5 },
      { fromIndex: 2, toIndex: 1, weight: 4.0 },
      { fromIndex: 3, toIndex: 4, weight: 4.0 },
      { fromIndex: 2, toIndex: 3, weight: 4.5 },
      { fromIndex: 2, toIndex: 5, weight: 4.0 },
      { fromIndex: 3, toIndex: 5, weight: 4.0 },
      { fromIndex: 1, toIndex: 5, weight: 3.0 },
      { fromIndex: 4, toIndex: 5, weight: 3.0 },
      { fromIndex: 5, toIndex: 6, weight: 4.5 },
      { fromIndex: 5, toIndex: 7, weight: 4.5 },
      { fromIndex: 6, toIndex: 7, weight: 3.5 },
      { fromIndex: 6, toIndex: 8, weight: 4.0 },
      { fromIndex: 7, toIndex: 10, weight: 4.0 },
      { fromIndex: 6, toIndex: 9, weight: 3.5 },
      { fromIndex: 7, toIndex: 9, weight: 3.5 },
      { fromIndex: 8, toIndex: 9, weight: 3.5 },
      { fromIndex: 10, toIndex: 9, weight: 3.5 },
      { fromIndex: 1, toIndex: 8, weight: 3.0 },
      { fromIndex: 4, toIndex: 10, weight: 3.0 },
    ],
  },
  '4-2-3-1 Pivot': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rb', roleCode: 'RB', roleName: 'Wingback', duty: 'Support', x: 28, y: 18 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Ball-Playing Defender', duty: 'Defend', x: 25, y: 38 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 25, y: 62 },
      { slotId: 'lb', roleCode: 'LB', roleName: 'Fullback', duty: 'Defend', x: 28, y: 82 },
      { slotId: 'dm_r', roleCode: 'DM', roleName: 'Deep Playmaker', duty: 'Defend', x: 42, y: 35 },
      { slotId: 'dm_l', roleCode: 'DM', roleName: 'Ball Winning Midfielder', duty: 'Defend', x: 42, y: 65 },
      { slotId: 'am', roleCode: 'AM', roleName: 'Shadow Striker', duty: 'Attack', x: 64, y: 50 },
      { slotId: 'rw', roleCode: 'RW', roleName: 'Inside Forward', duty: 'Attack', x: 72, y: 20 },
      { slotId: 'st', roleCode: 'ST', roleName: 'Advanced Forward', duty: 'Attack', x: 84, y: 50 },
      { slotId: 'lw', roleCode: 'LW', roleName: 'Inverted Winger', duty: 'Support', x: 72, y: 80 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 3.5 },
      { fromIndex: 0, toIndex: 3, weight: 3.5 },
      { fromIndex: 2, toIndex: 1, weight: 3.8 },
      { fromIndex: 3, toIndex: 4, weight: 3.8 },
      { fromIndex: 2, toIndex: 3, weight: 4.5 },
      { fromIndex: 2, toIndex: 5, weight: 4.2 },
      { fromIndex: 3, toIndex: 6, weight: 4.2 },
      { fromIndex: 5, toIndex: 6, weight: 4.0 },
      { fromIndex: 5, toIndex: 7, weight: 4.5 },
      { fromIndex: 6, toIndex: 7, weight: 4.5 },
      { fromIndex: 7, toIndex: 8, weight: 4.0 },
      { fromIndex: 7, toIndex: 10, weight: 4.0 },
      { fromIndex: 7, toIndex: 9, weight: 4.5 },
      { fromIndex: 8, toIndex: 9, weight: 3.5 },
      { fromIndex: 10, toIndex: 9, weight: 3.5 },
      { fromIndex: 1, toIndex: 8, weight: 3.5 },
      { fromIndex: 4, toIndex: 10, weight: 3.5 },
    ],
  },
  '3-4-2-1 Box': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Wide Center Back', duty: 'Support', x: 25, y: 24 },
      { slotId: 'cb_c', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 24, y: 50 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Ball-Playing Defender', duty: 'Defend', x: 25, y: 76 },
      { slotId: 'rwb', roleCode: 'RWB', roleName: 'Wingback (Wide)', duty: 'Support', x: 48, y: 14 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Central Pivot', duty: 'Defend', x: 48, y: 38 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Deep Playmaker', duty: 'Support', x: 48, y: 62 },
      { slotId: 'lwb', roleCode: 'LWB', roleName: 'Wingback (Wide)', duty: 'Support', x: 48, y: 86 },
      { slotId: 'am_r', roleCode: 'AM', roleName: 'Half-Space Creator', duty: 'Attack', x: 68, y: 35 },
      { slotId: 'am_l', roleCode: 'AM', roleName: 'Second Striker', duty: 'Attack', x: 68, y: 65 },
      { slotId: 'st', roleCode: 'ST', roleName: 'Complete Forward', duty: 'Attack', x: 85, y: 50 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 4.0 },
      { fromIndex: 1, toIndex: 2, weight: 4.0 },
      { fromIndex: 3, toIndex: 2, weight: 4.0 },
      { fromIndex: 1, toIndex: 4, weight: 3.5 },
      { fromIndex: 3, toIndex: 7, weight: 3.5 },
      { fromIndex: 1, toIndex: 5, weight: 4.0 },
      { fromIndex: 3, toIndex: 6, weight: 4.0 },
      { fromIndex: 2, toIndex: 5, weight: 3.8 },
      { fromIndex: 2, toIndex: 6, weight: 3.8 },
      { fromIndex: 5, toIndex: 6, weight: 4.5 },
      { fromIndex: 5, toIndex: 8, weight: 4.2 },
      { fromIndex: 6, toIndex: 9, weight: 4.2 },
      { fromIndex: 8, toIndex: 9, weight: 3.5 },
      { fromIndex: 4, toIndex: 8, weight: 3.8 },
      { fromIndex: 7, toIndex: 9, weight: 3.8 },
      { fromIndex: 8, toIndex: 10, weight: 4.0 },
      { fromIndex: 9, toIndex: 10, weight: 4.0 },
    ],
  },
  '3-5-2 Wings': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Wide Center Back', duty: 'Defend', x: 25, y: 24 },
      { slotId: 'cb_c', roleCode: 'CB', roleName: 'Libero / Sweeper', duty: 'Defend', x: 24, y: 50 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Wide Center Back', duty: 'Defend', x: 25, y: 76 },
      { slotId: 'rwb', roleCode: 'RWB', roleName: 'Attacking Wingback', duty: 'Attack', x: 50, y: 14 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Holding Anchor', duty: 'Defend', x: 44, y: 50 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Box-to-Box', duty: 'Support', x: 58, y: 35 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Advanced Playmaker', duty: 'Support', x: 58, y: 65 },
      { slotId: 'lwb', roleCode: 'LWB', roleName: 'Attacking Wingback', duty: 'Attack', x: 50, y: 86 },
      { slotId: 'st_r', roleCode: 'ST', roleName: 'Target Forward', duty: 'Support', x: 82, y: 38 },
      { slotId: 'st_l', roleCode: 'ST', roleName: 'Poacher', duty: 'Attack', x: 82, y: 62 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 4.0 },
      { fromIndex: 1, toIndex: 2, weight: 4.0 },
      { fromIndex: 3, toIndex: 2, weight: 4.0 },
      { fromIndex: 2, toIndex: 5, weight: 4.5 },
      { fromIndex: 1, toIndex: 4, weight: 4.0 },
      { fromIndex: 3, toIndex: 8, weight: 4.0 },
      { fromIndex: 5, toIndex: 6, weight: 4.2 },
      { fromIndex: 5, toIndex: 7, weight: 4.2 },
      { fromIndex: 6, toIndex: 7, weight: 3.5 },
      { fromIndex: 4, toIndex: 6, weight: 3.5 },
      { fromIndex: 8, toIndex: 7, weight: 3.5 },
      { fromIndex: 4, toIndex: 9, weight: 4.0 },
      { fromIndex: 8, toIndex: 10, weight: 4.0 },
      { fromIndex: 6, toIndex: 9, weight: 3.5 },
      { fromIndex: 7, toIndex: 10, weight: 3.5 },
      { fromIndex: 9, toIndex: 10, weight: 4.0 },
    ],
  },
  '4-4-2 Diamond': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Goalkeeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rb', roleCode: 'RB', roleName: 'Complete Wingback', duty: 'Attack', x: 28, y: 18 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Ball-Playing Defender', duty: 'Defend', x: 25, y: 38 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 25, y: 62 },
      { slotId: 'lb', roleCode: 'LB', roleName: 'Complete Wingback', duty: 'Attack', x: 28, y: 82 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Half-Back', duty: 'Defend', x: 42, y: 50 },
      { slotId: 'rm', roleCode: 'CM', roleName: 'Carrilero', duty: 'Support', x: 56, y: 26 },
      { slotId: 'lm', roleCode: 'CM', roleName: 'Box-to-Box', duty: 'Support', x: 56, y: 74 },
      { slotId: 'am', roleCode: 'AM', roleName: 'Enganche / Playmaker', duty: 'Attack', x: 66, y: 50 },
      { slotId: 'st_r', roleCode: 'ST', roleName: 'Pressing Forward', duty: 'Support', x: 83, y: 38 },
      { slotId: 'st_l', roleCode: 'ST', roleName: 'Advanced Forward', duty: 'Attack', x: 83, y: 62 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 3.5 },
      { fromIndex: 0, toIndex: 3, weight: 3.5 },
      { fromIndex: 2, toIndex: 3, weight: 4.2 },
      { fromIndex: 2, toIndex: 5, weight: 4.5 },
      { fromIndex: 3, toIndex: 5, weight: 4.5 },
      { fromIndex: 5, toIndex: 6, weight: 4.0 },
      { fromIndex: 5, toIndex: 7, weight: 4.0 },
      { fromIndex: 6, toIndex: 8, weight: 4.2 },
      { fromIndex: 7, toIndex: 8, weight: 4.2 },
      { fromIndex: 1, toIndex: 6, weight: 3.5 },
      { fromIndex: 4, toIndex: 7, weight: 3.5 },
      { fromIndex: 8, toIndex: 9, weight: 4.0 },
      { fromIndex: 8, toIndex: 10, weight: 4.0 },
      { fromIndex: 9, toIndex: 10, weight: 3.8 },
    ],
  },
  '5-3-2 Counter': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rwb', roleCode: 'RWB', roleName: 'Defensive Wingback', duty: 'Support', x: 32, y: 14 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 24, y: 28 },
      { slotId: 'cb_c', roleCode: 'CB', roleName: 'Covering Center Back', duty: 'Defend', x: 22, y: 50 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 24, y: 72 },
      { slotId: 'lwb', roleCode: 'LWB', roleName: 'Defensive Wingback', duty: 'Support', x: 32, y: 86 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Ball-Winning Midfielder', duty: 'Defend', x: 44, y: 50 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Central Midfielder', duty: 'Support', x: 52, y: 32 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Deep Counter Launcher', duty: 'Support', x: 52, y: 68 },
      { slotId: 'st_r', roleCode: 'ST', roleName: 'Target Man', duty: 'Support', x: 82, y: 38 },
      { slotId: 'st_l', roleCode: 'ST', roleName: 'Fast Break Forward', duty: 'Attack', x: 82, y: 62 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 3, weight: 4.0 },
      { fromIndex: 2, toIndex: 3, weight: 4.2 },
      { fromIndex: 4, toIndex: 3, weight: 4.2 },
      { fromIndex: 1, toIndex: 2, weight: 3.8 },
      { fromIndex: 5, toIndex: 4, weight: 3.8 },
      { fromIndex: 3, toIndex: 6, weight: 4.5 },
      { fromIndex: 6, toIndex: 7, weight: 4.0 },
      { fromIndex: 6, toIndex: 8, weight: 4.0 },
      { fromIndex: 7, toIndex: 8, weight: 3.2 },
      { fromIndex: 7, toIndex: 9, weight: 4.2 },
      { fromIndex: 8, toIndex: 10, weight: 4.2 },
      { fromIndex: 9, toIndex: 10, weight: 4.0 },
    ],
  },
  '4-1-4-1 Control': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rb', roleCode: 'RB', roleName: 'Fullback', duty: 'Support', x: 28, y: 18 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Ball-Playing Defender', duty: 'Defend', x: 25, y: 38 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Central Defender', duty: 'Defend', x: 25, y: 62 },
      { slotId: 'lb', roleCode: 'LB', roleName: 'Fullback', duty: 'Support', x: 28, y: 82 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Regista / Deep Anchor', duty: 'Defend', x: 42, y: 50 },
      { slotId: 'rm', roleCode: 'RM', roleName: 'Wide Midfielder', duty: 'Support', x: 60, y: 18 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Central Playmaker', duty: 'Support', x: 60, y: 38 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Box-to-Box', duty: 'Support', x: 60, y: 62 },
      { slotId: 'lm', roleCode: 'LM', roleName: 'Wide Midfielder', duty: 'Support', x: 60, y: 82 },
      { slotId: 'st', roleCode: 'ST', roleName: 'Lone Striker', duty: 'Attack', x: 84, y: 50 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 3.5 },
      { fromIndex: 0, toIndex: 3, weight: 3.5 },
      { fromIndex: 2, toIndex: 1, weight: 3.8 },
      { fromIndex: 3, toIndex: 4, weight: 3.8 },
      { fromIndex: 2, toIndex: 5, weight: 4.5 },
      { fromIndex: 3, toIndex: 5, weight: 4.5 },
      { fromIndex: 5, toIndex: 7, weight: 4.2 },
      { fromIndex: 5, toIndex: 8, weight: 4.2 },
      { fromIndex: 7, toIndex: 6, weight: 3.8 },
      { fromIndex: 8, toIndex: 9, weight: 3.8 },
      { fromIndex: 7, toIndex: 10, weight: 3.5 },
      { fromIndex: 8, toIndex: 10, weight: 3.5 },
      { fromIndex: 6, toIndex: 10, weight: 3.0 },
      { fromIndex: 9, toIndex: 10, weight: 3.0 },
    ],
  },
  'Custom': {
    slots: [
      { slotId: 'gk', roleCode: 'GK', roleName: 'Sweeper Keeper', duty: 'Defend', x: 12, y: 50 },
      { slotId: 'rb', roleCode: 'RB', roleName: 'Right Fullback', duty: 'Support', x: 28, y: 18 },
      { slotId: 'cb_r', roleCode: 'CB', roleName: 'Right Center Back', duty: 'Defend', x: 25, y: 38 },
      { slotId: 'cb_l', roleCode: 'CB', roleName: 'Left Center Back', duty: 'Defend', x: 25, y: 62 },
      { slotId: 'lb', roleCode: 'LB', roleName: 'Left Fullback', duty: 'Support', x: 28, y: 82 },
      { slotId: 'dm', roleCode: 'DM', roleName: 'Holding Pivot', duty: 'Defend', x: 44, y: 50 },
      { slotId: 'cm_r', roleCode: 'CM', roleName: 'Central Midfielder', duty: 'Support', x: 56, y: 32 },
      { slotId: 'cm_l', roleCode: 'CM', roleName: 'Central Midfielder', duty: 'Support', x: 56, y: 68 },
      { slotId: 'rw', roleCode: 'RW', roleName: 'Right Attacker', duty: 'Attack', x: 74, y: 20 },
      { slotId: 'st', roleCode: 'ST', roleName: 'Center Forward', duty: 'Attack', x: 84, y: 50 },
      { slotId: 'lw', roleCode: 'LW', roleName: 'Left Attacker', duty: 'Attack', x: 74, y: 80 },
    ],
    connections: [
      { fromIndex: 0, toIndex: 2, weight: 3.5 },
      { fromIndex: 0, toIndex: 3, weight: 3.5 },
      { fromIndex: 2, toIndex: 1, weight: 3.8 },
      { fromIndex: 3, toIndex: 4, weight: 3.8 },
      { fromIndex: 2, toIndex: 3, weight: 4.2 },
      { fromIndex: 2, toIndex: 5, weight: 4.0 },
      { fromIndex: 3, toIndex: 5, weight: 4.0 },
      { fromIndex: 5, toIndex: 6, weight: 4.2 },
      { fromIndex: 5, toIndex: 7, weight: 4.2 },
      { fromIndex: 6, toIndex: 8, weight: 3.8 },
      { fromIndex: 7, toIndex: 10, weight: 3.8 },
      { fromIndex: 6, toIndex: 9, weight: 3.8 },
      { fromIndex: 7, toIndex: 9, weight: 3.8 },
      { fromIndex: 8, toIndex: 9, weight: 3.5 },
      { fromIndex: 10, toIndex: 9, weight: 3.5 },
    ],
  },
};

// -------------------------------------------------------------------------
// TACTICAL ARCHETYPES / BLUEPRINTS
// -------------------------------------------------------------------------

export interface TacticalArchetype {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  recommendedFormation: FormationKey;
  mentality: TeamMentality;
  inPossession: TacticConfiguration['inPossession'];
  inTransition: TacticConfiguration['inTransition'];
  outOfPossession: TacticConfiguration['outOfPossession'];
}

export const TACTICAL_ARCHETYPES: TacticalArchetype[] = [
  {
    id: 'gegenpress',
    name: 'Gegenpressing',
    subtitle: 'High-Octane Transition & Squeeze',
    description: 'Relentless forward hunting upon possession loss. High defensive line squeezing space, rapid vertical counter-attacks upon ball recovery.',
    recommendedFormation: '4-3-3 Holding',
    mentality: 'attacking',
    inPossession: {
      width: 'balanced',
      buildUp: 'mixed',
      passingDirectness: 'direct',
      tempo: 'high_tempo',
      finalThird: 'shoot_on_sight',
    },
    inTransition: {
      lossTransition: 'counter_press',
      winTransition: 'counter',
      gkDistribution: 'roll_out',
    },
    outOfPossession: {
      defensiveLine: 'high_line',
      pressingLine: 'high_press',
      pressingIntensity: 'extreme',
      tacklingAggression: 'get_stuck_in',
      offsideTrap: true,
    },
  },
  {
    id: 'possession_control',
    name: 'Positional Play / Tiki-Taka',
    subtitle: 'Geometric Superiority & Patient Circulation',
    description: 'Total spatial dominance through short triangles. Inverted fullbacks structure the rest-defense, waiting for the defensive structure to crack.',
    recommendedFormation: '3-4-2-1 Box',
    mentality: 'positive',
    inPossession: {
      width: 'wide',
      buildUp: 'play_out_of_back',
      passingDirectness: 'short',
      tempo: 'patient',
      finalThird: 'work_into_box',
    },
    inTransition: {
      lossTransition: 'counter_press',
      winTransition: 'hold_shape',
      gkDistribution: 'short_cb',
    },
    outOfPossession: {
      defensiveLine: 'high_line',
      pressingLine: 'high_press',
      pressingIntensity: 'aggressive',
      offsideTrap: true,
      tacklingAggression: 'stay_on_feet',
    },
  },
  {
    id: 'low_block_counter',
    name: 'Catenaccio & Vertical Break',
    subtitle: 'Impenetrable Box & Direct Velocity',
    description: 'Disciplined deep block denying central half-spaces. Aggressive recovery into vertical long balls targeting split central forwards.',
    recommendedFormation: '5-3-2 Counter',
    mentality: 'cautious',
    inPossession: {
      width: 'narrow',
      buildUp: 'direct',
      passingDirectness: 'direct',
      tempo: 'high_tempo',
      finalThird: 'early_crosses',
    },
    inTransition: {
      lossTransition: 'regroup',
      winTransition: 'counter',
      gkDistribution: 'long_kick',
    },
    outOfPossession: {
      defensiveLine: 'low_block',
      pressingLine: 'deep_contain',
      pressingIntensity: 'cautious',
      offsideTrap: false,
      tacklingAggression: 'get_stuck_in',
    },
  },
  {
    id: 'fluid_wing_play',
    name: 'Fluid Wing Play & Overloads',
    subtitle: 'Touchline Stretch & Cross Deliveries',
    description: 'Exploits the flanks with overlapping wingbacks and wide wingers. Heavy penalty area presence feeding on whipped deliveries.',
    recommendedFormation: '3-5-2 Wings',
    mentality: 'positive',
    inPossession: {
      width: 'wide',
      buildUp: 'mixed',
      passingDirectness: 'standard',
      tempo: 'standard',
      finalThird: 'early_crosses',
    },
    inTransition: {
      lossTransition: 'counter_press',
      winTransition: 'counter',
      gkDistribution: 'roll_out',
    },
    outOfPossession: {
      defensiveLine: 'mid_block',
      pressingLine: 'mid_block',
      pressingIntensity: 'standard',
      offsideTrap: false,
      tacklingAggression: 'balanced',
    },
  },
];

// -------------------------------------------------------------------------
// RADAR METRICS & TACTICAL ANALYSIS
// -------------------------------------------------------------------------

export function calculateTacticalRadar(tactic: TacticConfiguration): Record<string, number> {
  let attacking = 50;
  let circulation = 50;
  let solidity = 50;
  let pressing = 50;
  let mobility = 50;

  // Mentality effects
  if (tactic.mentality === 'attacking') {
    attacking += 24;
    pressing += 16;
    solidity -= 14;
    mobility += 10;
  } else if (tactic.mentality === 'positive') {
    attacking += 14;
    circulation += 10;
    pressing += 8;
  } else if (tactic.mentality === 'cautious') {
    attacking -= 15;
    solidity += 24;
    pressing -= 12;
  }

  // In Possession
  if (tactic.inPossession.passingDirectness === 'short') {
    circulation += 22;
    mobility += 5;
  } else if (tactic.inPossession.passingDirectness === 'direct') {
    mobility += 18;
    circulation -= 12;
    attacking += 8;
  }

  if (tactic.inPossession.tempo === 'high_tempo') {
    mobility += 20;
    pressing += 8;
  } else if (tactic.inPossession.tempo === 'patient') {
    circulation += 18;
    mobility -= 8;
  }

  if (tactic.inPossession.buildUp === 'play_out_of_back') {
    circulation += 15;
    solidity += 4;
  } else if (tactic.inPossession.buildUp === 'direct') {
    attacking += 10;
    circulation -= 10;
  }

  // In Transition
  if (tactic.inTransition.lossTransition === 'counter_press') {
    pressing += 22;
    mobility += 10;
  } else {
    solidity += 18;
    pressing -= 14;
  }

  if (tactic.inTransition.winTransition === 'counter') {
    mobility += 15;
    attacking += 10;
  } else {
    circulation += 14;
  }

  // Out of Possession
  if (tactic.outOfPossession.defensiveLine === 'high_line') {
    pressing += 18;
    attacking += 8;
    solidity -= 8;
  } else if (tactic.outOfPossession.defensiveLine === 'low_block') {
    solidity += 26;
    pressing -= 16;
  }

  if (tactic.outOfPossession.pressingIntensity === 'extreme') {
    pressing += 25;
    mobility += 12;
    solidity -= 10;
  } else if (tactic.outOfPossession.pressingIntensity === 'cautious') {
    pressing -= 20;
    solidity += 15;
  }

  // Clamp 15 - 95
  const clamp = (val: number) => Math.max(15, Math.min(95, Math.round(val)));

  return {
    Attacking: clamp(attacking),
    Circulation: clamp(circulation),
    Solidity: clamp(solidity),
    Pressing: clamp(pressing),
    Mobility: clamp(mobility),
  };
}

export function generateTacticalStrengthsAndRisks(tactic: TacticConfiguration): {
  strengths: string[];
  vulnerabilities: string[];
  directives: string[];
} {
  const strengths: string[] = [];
  const vulnerabilities: string[] = [];
  const directives: string[] = [];

  // Pressing analysis
  if (tactic.inTransition.lossTransition === 'counter_press' && tactic.outOfPossession.pressingIntensity === 'extreme') {
    strengths.push('Aggressive immediate pressure suffocates opponent build-up in the first 5 seconds of turnover.');
    vulnerabilities.push('High physical exertion risks late-game fatigue and leaves space in wide channels if initial wave is bypassed.');
  } else if (tactic.outOfPossession.defensiveLine === 'low_block') {
    strengths.push('Exceptionally resilient penalty-box coverage denies through-balls and central half-space entry.');
    vulnerabilities.push('Extended pressure on defensive backline invites sustained shots and set-piece exposure.');
  }

  // Circulation analysis
  if (tactic.inPossession.passingDirectness === 'short' && tactic.inPossession.buildUp === 'play_out_of_back') {
    strengths.push('High-volume geometric pass triangles ensure sustained territory control and minimize unforced turnovers.');
    directives.push('Maintain calm under aggressive opposition pressing; rely on goalkeeper and pivot for third-man combinations.');
  } else if (tactic.inPossession.passingDirectness === 'direct') {
    strengths.push('Rapid forward penetration bypasses congested midfields and attacks backlines before they organize.');
    vulnerabilities.push('Higher turnover rate requires disciplined rest-defense to prevent fast counter-breaks.');
  }

  // Formation specific
  if (tactic.formation.includes('3-')) {
    strengths.push('Three central defenders guarantee numerical superiority against two-striker setups.');
    directives.push('Wingbacks must track back aggressively on turnovers to prevent wide overloads.');
  } else if (tactic.formation === '4-3-3 Holding') {
    strengths.push('Holding anchor pivot forms a secure shield for dynamic interior midfielders.');
    directives.push('Utilize inverted wingers to isolate opposing fullbacks and open underlapping runs.');
  }

  if (strengths.length === 0) {
    strengths.push('Balanced structural distribution maintains solid parity across all game phases.');
  }
  if (vulnerabilities.length === 0) {
    vulnerabilities.push('Lack of extreme specialization requires individual technical superiority to break deadlocks.');
  }
  if (directives.length === 0) {
    directives.push('Enforce strict adherence to positional shape and tactical rest-defense.');
  }

  return { strengths, vulnerabilities, directives };
}

// -------------------------------------------------------------------------
// LOCAL STORAGE & PERSISTENCE
// -------------------------------------------------------------------------

const STORAGE_ACTIVE_TACTIC_KEY = 'football_analyzer_active_tactic';
const STORAGE_SAVED_TACTICS_KEY = 'football_analyzer_saved_tactics';

export function getDefaultTactic(): TacticConfiguration {
  const template = FORMATION_TEMPLATES['4-3-3 Holding'];
  return {
    id: 'default_433',
    name: 'Primary Match Blueprint',
    formation: '4-3-3 Holding',
    mentality: 'positive',
    inPossession: {
      width: 'balanced',
      buildUp: 'play_out_of_back',
      passingDirectness: 'short',
      tempo: 'standard',
      finalThird: 'work_into_box',
    },
    inTransition: {
      lossTransition: 'counter_press',
      winTransition: 'counter',
      gkDistribution: 'short_cb',
    },
    outOfPossession: {
      defensiveLine: 'high_line',
      pressingLine: 'high_press',
      pressingIntensity: 'aggressive',
      tacklingAggression: 'balanced',
      offsideTrap: true,
    },
    slots: template.slots.map((s) => ({ ...s })),
    lastModified: new Date().toISOString(),
  };
}

export function getActiveTactic(): TacticConfiguration {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_TACTIC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.formation && FORMATION_TEMPLATES[parsed.formation as FormationKey]) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return getDefaultTactic();
}

export function saveActiveTactic(tactic: TacticConfiguration): void {
  try {
    const updated = { ...tactic, lastModified: new Date().toISOString() };
    localStorage.setItem(STORAGE_ACTIVE_TACTIC_KEY, JSON.stringify(updated));
    // Dispatch window event so other views (like dashboard) update reactively
    window.dispatchEvent(new CustomEvent('tactic-updated', { detail: updated }));
  } catch (err) {
    console.error('Failed to save active tactic to localStorage', err);
  }
}

export function getSavedCustomTactics(): TacticConfiguration[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_TACTICS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveCustomTacticPreset(tactic: TacticConfiguration): void {
  try {
    const current = getSavedCustomTactics();
    const existingIdx = current.findIndex((t) => t.id === tactic.id);
    const updatedTactic = { ...tactic, lastModified: new Date().toISOString() };
    if (existingIdx >= 0) {
      current[existingIdx] = updatedTactic;
    } else {
      current.push(updatedTactic);
    }
    localStorage.setItem(STORAGE_SAVED_TACTICS_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save custom tactic preset', err);
  }
}

export function deleteCustomTacticPreset(tacticId: string): void {
  try {
    const current = getSavedCustomTactics().filter((t) => t.id !== tacticId);
    localStorage.setItem(STORAGE_SAVED_TACTICS_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to delete custom tactic preset', err);
  }
}

export function applyArchetypeToTactic(
  current: TacticConfiguration,
  archetype: TacticalArchetype
): TacticConfiguration {
  const newFormation = archetype.recommendedFormation;
  const template = FORMATION_TEMPLATES[newFormation];

  // Map over existing player assignments if compatible
  const oldAssigned = current.slots.filter((s) => s.assignedPlayerId);

  const newSlots: FormationSlot[] = template.slots.map((templateSlot, idx) => {
    // Try to preserve player in equivalent index
    const preserved = oldAssigned[idx];
    return {
      ...templateSlot,
      assignedPlayerId: preserved?.assignedPlayerId || null,
      assignedPlayerName: preserved?.assignedPlayerName || null,
      assignedJerseyNumber: preserved?.assignedJerseyNumber || null,
      assignedPosition: preserved?.assignedPosition || null,
    };
  });

  return {
    ...current,
    name: `${archetype.name} (${newFormation})`,
    formation: newFormation,
    mentality: archetype.mentality,
    inPossession: { ...archetype.inPossession },
    inTransition: { ...archetype.inTransition },
    outOfPossession: { ...archetype.outOfPossession },
    slots: newSlots,
    lastModified: new Date().toISOString(),
  };
}

export function detectCustomFormationName(slots: FormationSlot[]): string {
  // Outfield players (excluding GK which is typically x <= 18)
  const outfield = slots.filter((s) => s.slotId !== 'gk' && s.x > 18);
  if (outfield.length === 0) return 'Custom XI';

  // Sort outfield by x ascending (from defensive to attacking)
  const defenders = outfield.filter((s) => s.x <= 38).length;
  const defMidfielders = outfield.filter((s) => s.x > 38 && s.x <= 48).length;
  const midMidfielders = outfield.filter((s) => s.x > 48 && s.x <= 64).length;
  const attMidfielders = outfield.filter((s) => s.x > 64 && s.x <= 74).length;
  const forwards = outfield.filter((s) => s.x > 74).length;

  // Build line representation
  const lines: number[] = [];
  if (defenders > 0) lines.push(defenders);
  if (defMidfielders > 0) lines.push(defMidfielders);
  if (midMidfielders > 0) lines.push(midMidfielders);
  if (attMidfielders > 0) lines.push(attMidfielders);
  if (forwards > 0) lines.push(forwards);

  if (lines.length >= 2) {
    return lines.join('-');
  }
  return 'Custom Shape';
}

export function getPitchZoneDescription(x: number, y: number): string {
  let depth = 'Middle 3rd';
  if (x <= 34) depth = 'Defensive 3rd';
  else if (x >= 66) depth = 'Attacking 3rd';

  let channel = 'Central Corridor';
  if (y <= 24) channel = 'Right Touchline';
  else if (y <= 38) channel = 'Right Half-Space';
  else if (y >= 76) channel = 'Left Touchline';
  else if (y >= 62) channel = 'Left Half-Space';

  return `${depth} • ${channel}`;
}

export function suggestRoleForCoordinates(x: number, y: number): { roleCode: string; roleName: string } {
  if (x <= 18) {
    return { roleCode: 'GK', roleName: 'Sweeper Keeper' };
  }
  if (x <= 38) {
    if (y <= 24) return { roleCode: 'RB', roleName: 'Right Fullback' };
    if (y >= 76) return { roleCode: 'LB', roleName: 'Left Fullback' };
    return { roleCode: 'CB', roleName: 'Center Back' };
  }
  if (x <= 50) {
    if (y <= 24) return { roleCode: 'RWB', roleName: 'Right Wingback' };
    if (y >= 76) return { roleCode: 'LWB', roleName: 'Left Wingback' };
    return { roleCode: 'DM', roleName: 'Holding Midfielder' };
  }
  if (x <= 70) {
    if (y <= 26) return { roleCode: 'RM', roleName: 'Right Midfielder' };
    if (y >= 74) return { roleCode: 'LM', roleName: 'Left Midfielder' };
    if (x > 60) return { roleCode: 'AM', roleName: 'Attacking Midfielder' };
    return { roleCode: 'CM', roleName: 'Central Midfielder' };
  }
  // x > 70
  if (y <= 30) return { roleCode: 'RW', roleName: 'Right Winger' };
  if (y >= 70) return { roleCode: 'LW', roleName: 'Left Winger' };
  return { roleCode: 'ST', roleName: 'Center Forward' };
}

export function generateDynamicConnections(slots: FormationSlot[]): TacticalConnection[] {
  const connections: TacticalConnection[] = [];
  const connectionSet = new Set<string>();

  const addEdge = (i: number, j: number, w: number) => {
    const key = i < j ? `${i}_${j}` : `${j}_${i}`;
    if (!connectionSet.has(key)) {
      connectionSet.add(key);
      connections.push({ fromIndex: Math.min(i, j), toIndex: Math.max(i, j), weight: w });
    }
  };

  // Find GK (usually index 0 or lowest x)
  const gkIndex = slots.findIndex((s) => s.slotId === 'gk' || s.x <= 18);
  if (gkIndex >= 0) {
    // Connect GK to the 2 closest outfield players
    const outfieldDistances = slots
      .map((s, idx) => ({
        idx,
        dist: Math.hypot(s.x - slots[gkIndex].x, s.y - slots[gkIndex].y),
      }))
      .filter((item) => item.idx !== gkIndex)
      .sort((a, b) => a.dist - b.dist);

    outfieldDistances.slice(0, 2).forEach((item) => {
      addEdge(gkIndex, item.idx, 3.8);
    });
  }

  // Connect each outfield player to their 2 closest teammates
  for (let i = 0; i < slots.length; i++) {
    if (i === gkIndex) continue;
    const distances = slots
      .map((s, idx) => ({
        idx,
        dist: Math.hypot(s.x - slots[i].x, s.y - slots[i].y),
      }))
      .filter((item) => item.idx !== i && item.idx !== gkIndex)
      .sort((a, b) => a.dist - b.dist);

    distances.slice(0, 2).forEach((item) => {
      const weight = Math.max(2.5, Math.min(4.8, 5.5 - item.dist * 0.05));
      addEdge(i, item.idx, weight);
    });
  }

  return connections;
}

export function switchFormation(
  current: TacticConfiguration,
  newFormation: FormationKey
): TacticConfiguration {
  if (newFormation === 'Custom') {
    return {
      ...current,
      formation: 'Custom',
      name: current.name.startsWith('Custom') ? current.name : `Custom Formation (${detectCustomFormationName(current.slots)})`,
      lastModified: new Date().toISOString(),
    };
  }

  const template = FORMATION_TEMPLATES[newFormation];
  // Preserve assigned players where possible
  const oldAssigned = current.slots.filter((s) => s.assignedPlayerId);

  const newSlots: FormationSlot[] = template.slots.map((templateSlot, idx) => {
    const preserved = oldAssigned[idx];
    return {
      ...templateSlot,
      assignedPlayerId: preserved?.assignedPlayerId || null,
      assignedPlayerName: preserved?.assignedPlayerName || null,
      assignedJerseyNumber: preserved?.assignedJerseyNumber || null,
      assignedPosition: preserved?.assignedPosition || null,
    };
  });

  return {
    ...current,
    formation: newFormation,
    slots: newSlots,
    lastModified: new Date().toISOString(),
  };
}
