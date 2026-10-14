import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  Activity,
  Check,
  RotateCcw,
  Users,
  Sparkles,
  Zap,
  AlertTriangle,
  Target,
  X,
  Bookmark,
  Layers,
  ArrowRight,
  Move,
  Compass,
} from 'lucide-react';
import {
  FormationKey,
  TacticConfiguration,
  FORMATION_TEMPLATES,
  TACTICAL_ARCHETYPES,
  TacticalArchetype,
  getActiveTactic,
  saveActiveTactic,
  getDefaultTactic,
  applyArchetypeToTactic,
  switchFormation,
  calculateTacticalRadar,
  generateTacticalStrengthsAndRisks,
  saveCustomTacticPreset,
  getSavedCustomTactics,
  TeamMentality,
  detectCustomFormationName,
  getPitchZoneDescription,
  suggestRoleForCoordinates,
  generateDynamicConnections,
} from '../../services/tacticService';
import { fetchSquadSeason, SquadPlayerSeason } from '../../services/api';
import { JellyRadio } from '../JellyRadio/JellyRadio';
import { RadarChart } from '../visualizations/RadarChart';
import { BorderGlow } from '../BorderGlow/BorderGlow';
import { OpponentTactics } from '../OpponentTactics/OpponentTactics';

interface TacticSetterProps {
  managedTeam: string;
  onTacticDeployed?: (tactic: TacticConfiguration) => void;
  onNavigateToMatches?: () => void;
  initialPerspective?: 'my_team' | 'opponents';
}

const TOKENS = {
  bgApp: '#090d14',
  bgCard: '#111722',
  bgCardHover: '#161e2c',
  bgInset: '#0a0e16',
  border: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  gold: '#c8963e',
  goldDim: 'rgba(200, 150, 62, 0.15)',
  goldBorder: 'rgba(200, 150, 62, 0.40)',
  cyan: '#38bdf8',
  cyanDim: 'rgba(56, 189, 248, 0.12)',
  green: '#22c55e',
  greenDim: 'rgba(34, 197, 94, 0.15)',
  amber: '#f59e0b',
  crimson: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: '#a0aab8',
  textMuted: '#687484',
};

const FORMATION_OPTIONS: FormationKey[] = [
  '4-3-3 Holding',
  '4-2-3-1 Pivot',
  '3-4-2-1 Box',
  '3-5-2 Wings',
  '4-4-2 Diamond',
  '5-3-2 Counter',
  '4-1-4-1 Control',
  'Custom',
];

const LEAGUE_BASELINE_RADAR: Record<string, number> = {
  Attacking: 50,
  Circulation: 50,
  Solidity: 50,
  Pressing: 50,
  Mobility: 50,
};

export const TacticSetter: React.FC<TacticSetterProps> = ({
  managedTeam,
  onTacticDeployed,
  onNavigateToMatches,
  initialPerspective,
}) => {
  const [tacticsPerspective, setTacticsPerspective] = useState<'my_team' | 'opponents'>(
    initialPerspective || 'my_team'
  );
  const [tactic, setTactic] = useState<TacticConfiguration>(() => getActiveTactic());
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayerSeason[]>([]);
  const [loadingSquad, setLoadingSquad] = useState<boolean>(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activePhaseTab, setActivePhaseTab] = useState<
    'in_possession' | 'in_transition' | 'out_of_possession' | 'radar_matrix'
  >('in_possession');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<TacticConfiguration[]>([]);
  const [isPlayerAssignModalOpen, setIsPlayerAssignModalOpen] = useState<boolean>(false);
  const [slotPositionFilter, setSlotPositionFilter] = useState<string>('ALL');

  // Dragging state on the tactical pitch chalkboard
  const pitchRef = useRef<HTMLDivElement>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragCoords, setDragCoords] = useState<{
    x: number;
    y: number;
    zone: string;
    suggestedRole: string;
  } | null>(null);

  // Dynamic detected custom shape name
  const detectedCustomName = useMemo(() => {
    return detectCustomFormationName(tactic.slots);
  }, [tactic.slots]);

  // Load squad roster for current managed team
  useEffect(() => {
    let isMounted = true;
    setLoadingSquad(true);
    fetchSquadSeason(undefined, managedTeam)
      .then((res) => {
        if (isMounted) {
          setSquadPlayers(res.players || []);
          setLoadingSquad(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load squad for tactics', err);
        if (isMounted) setLoadingSquad(false);
      });

    setSavedPresets(getSavedCustomTactics());

    return () => {
      isMounted = false;
    };
  }, [managedTeam]);

  // Sync active slot on formation change
  useEffect(() => {
    if (!selectedSlotId && tactic.slots.length > 0) {
      setSelectedSlotId(tactic.slots[0].slotId);
    } else if (selectedSlotId && !tactic.slots.some((s) => s.slotId === selectedSlotId)) {
      setSelectedSlotId(tactic.slots[0]?.slotId || null);
    }
  }, [tactic.formation]);

  const selectedSlot = useMemo(() => {
    return tactic.slots.find((s) => s.slotId === selectedSlotId) || tactic.slots[0];
  }, [tactic.slots, selectedSlotId]);

  // Calculate live radar metrics and tactical evaluation
  const radarData = useMemo(() => calculateTacticalRadar(tactic), [tactic]);
  const tacticalInsights = useMemo(() => generateTacticalStrengthsAndRisks(tactic), [tactic]);

  // Current formation connections (uses dynamic nearest-neighbor algorithm if in Custom mode!)
  const formationConnections = useMemo(() => {
    if (tactic.formation === 'Custom') {
      return generateDynamicConnections(tactic.slots);
    }
    const template = FORMATION_TEMPLATES[tactic.formation];
    return template ? template.connections : [];
  }, [tactic.formation, tactic.slots]);

  const handlePointerDownSlot = (slotId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggedSlotId(slotId);
    setSelectedSlotId(slotId);
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMovePitch = (e: React.PointerEvent) => {
    if (!draggedSlotId || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(8, Math.min(92, Math.round(rawX)));
    const clampedY = Math.max(8, Math.min(92, Math.round(rawY)));

    const zone = getPitchZoneDescription(clampedX, clampedY);
    const roleSuggestion = suggestRoleForCoordinates(clampedX, clampedY);

    setDragCoords({
      x: clampedX,
      y: clampedY,
      zone,
      suggestedRole: `${roleSuggestion.roleCode} (${roleSuggestion.roleName})`,
    });

    setTactic((prev) => {
      const updatedSlots = prev.slots.map((s) => {
        if (s.slotId === draggedSlotId) {
          return {
            ...s,
            x: clampedX,
            y: clampedY,
            roleCode: prev.formation === 'Custom' ? roleSuggestion.roleCode : s.roleCode,
            roleName: prev.formation === 'Custom' ? roleSuggestion.roleName : s.roleName,
          };
        }
        return s;
      });

      return {
        ...prev,
        formation: 'Custom',
        slots: updatedSlots,
      };
    });
  };

  const handlePointerUpPitch = (e: React.PointerEvent) => {
    if (draggedSlotId) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
      setDraggedSlotId(null);
      setDragCoords(null);
      saveActiveTactic(tactic);
      showNotice(`Custom Position Saved (${detectCustomFormationName(tactic.slots)})`);
    }
  };

  // Auto-Fill Squad XI into formation slots based on positional match & minutes
  const handleAutoFillSquad = () => {
    if (squadPlayers.length === 0) return;

    const assignedPlayerIds = new Set<string>();
    const updatedSlots = tactic.slots.map((slot) => {
      // Find best available player for role
      const posMap: Record<string, string> = {
        GK: 'GK',
        RB: 'DF',
        LB: 'DF',
        CB: 'DF',
        RWB: 'DF',
        LWB: 'DF',
        DM: 'MF',
        CM: 'MF',
        AM: 'MF',
        RM: 'MF',
        LM: 'MF',
        RW: 'FW',
        LW: 'FW',
        ST: 'FW',
      };

      const targetPos = posMap[slot.roleCode] || 'MF';

      // Find candidates matching position not yet assigned
      const candidates = squadPlayers.filter(
        (p) =>
          !assignedPlayerIds.has(p.player_id) &&
          (p.primary_position === targetPos || p.detailed_position?.includes(slot.roleCode))
      );

      // Sort by minutes played
      candidates.sort((a, b) => b.minutes - a.minutes);

      const picked = candidates[0] || squadPlayers.find((p) => !assignedPlayerIds.has(p.player_id));

      if (picked) {
        assignedPlayerIds.add(picked.player_id);
        return {
          ...slot,
          assignedPlayerId: picked.player_id,
          assignedPlayerName: picked.player_name,
          assignedJerseyNumber: picked.squad_number,
          assignedPosition: picked.primary_position,
        };
      }
      return slot;
    });

    const updatedTactic: TacticConfiguration = {
      ...tactic,
      slots: updatedSlots,
    };
    setTactic(updatedTactic);
    saveActiveTactic(updatedTactic);
    showNotice('Squad Auto-Allocated into Starting XI');
  };

  const handleFormationChange = (newFormation: FormationKey) => {
    const updated = switchFormation(tactic, newFormation);
    setTactic(updated);
    saveActiveTactic(updated);
    showNotice(`Formation Switched to ${newFormation}`);
  };

  const handleApplyArchetype = (archetype: TacticalArchetype) => {
    const updated = applyArchetypeToTactic(tactic, archetype);
    setTactic(updated);
    saveActiveTactic(updated);
    showNotice(`Tactical Blueprint Applied: ${archetype.name}`);
  };

  const handleDeployTactic = () => {
    saveActiveTactic(tactic);
    if (onTacticDeployed) {
      onTacticDeployed(tactic);
    }
    showNotice('Tactical Blueprint Deployed to Match Day Engine');
  };

  const handleResetToDefault = () => {
    const def = getDefaultTactic();
    setTactic(def);
    saveActiveTactic(def);
    showNotice('Reset to Default Primary Blueprint');
  };

  const handleSaveAsPreset = () => {
    const presetName = prompt('Enter a name for this tactical preset:', tactic.name);
    if (!presetName) return;

    const newPreset: TacticConfiguration = {
      ...tactic,
      id: `preset_${Date.now()}`,
      name: presetName,
      isPreset: true,
    };
    saveCustomTacticPreset(newPreset);
    setSavedPresets(getSavedCustomTactics());
    showNotice(`Preset Saved: "${presetName}"`);
  };

  const showNotice = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3200);
  };

  const updateInstruction = <K extends keyof TacticConfiguration>(
    section: K,
    key: string,
    value: any
  ) => {
    setTactic((prev) => {
      const sectionVal = prev[section];
      let updatedSection: any;
      if (typeof sectionVal === 'object' && sectionVal !== null) {
        updatedSection = { ...sectionVal, [key]: value };
      } else {
        updatedSection = value;
      }

      const nextTactic = {
        ...prev,
        [section]: updatedSection,
      };
      saveActiveTactic(nextTactic);
      return nextTactic;
    });
  };

  const handleAssignPlayerToSlot = (player: SquadPlayerSeason) => {
    if (!selectedSlotId) return;

    const updatedSlots = tactic.slots.map((s) => {
      // If player already in another slot, clear that slot
      if (s.assignedPlayerId === player.player_id && s.slotId !== selectedSlotId) {
        return {
          ...s,
          assignedPlayerId: null,
          assignedPlayerName: null,
          assignedJerseyNumber: null,
          assignedPosition: null,
        };
      }
      if (s.slotId === selectedSlotId) {
        return {
          ...s,
          assignedPlayerId: player.player_id,
          assignedPlayerName: player.player_name,
          assignedJerseyNumber: player.squad_number,
          assignedPosition: player.primary_position,
        };
      }
      return s;
    });

    const updatedTactic: TacticConfiguration = {
      ...tactic,
      slots: updatedSlots,
    };
    setTactic(updatedTactic);
    saveActiveTactic(updatedTactic);
    setIsPlayerAssignModalOpen(false);
    showNotice(`Assigned ${player.player_name} to ${selectedSlot?.roleName}`);
  };

  const handleUpdateSlotDuty = (duty: 'Attack' | 'Support' | 'Defend') => {
    if (!selectedSlotId) return;
    const updatedSlots = tactic.slots.map((s) => (s.slotId === selectedSlotId ? { ...s, duty } : s));
    const next = { ...tactic, slots: updatedSlots };
    setTactic(next);
    saveActiveTactic(next);
  };

  const handleUpdateIndividualInstruction = (
    instKey: 'dribbling' | 'risks' | 'positioning' | 'shooting',
    val: any
  ) => {
    if (!selectedSlotId) return;
    const updatedSlots = tactic.slots.map((s) => {
      if (s.slotId === selectedSlotId) {
        return {
          ...s,
          individualInstructions: {
            dribbling: (s.individualInstructions?.dribbling || 'balanced') as 'dribble_more' | 'balanced' | 'dribble_less',
            risks: (s.individualInstructions?.risks || 'balanced') as 'take_risks' | 'balanced' | 'play_safe',
            positioning: (s.individualInstructions?.positioning || 'hold_position') as 'roam' | 'hold_position',
            shooting: (s.individualInstructions?.shooting || 'balanced') as 'shoot_more' | 'balanced' | 'shoot_less',
            [instKey]: val,
          },
        };
      }
      return s;
    });
    const next = { ...tactic, slots: updatedSlots };
    setTactic(next);
    saveActiveTactic(next);
  };

  return (
    <div
      style={{
        backgroundColor: TOKENS.bgApp,
        minHeight: '100%',
        color: TOKENS.textPrimary,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* SUCCESS / FEEDBACK BANNER */}
      {saveSuccessMsg && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            right: '28px',
            backgroundColor: '#13281c',
            border: '1px solid #22c55e',
            color: '#86efac',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        >
          <Check size={16} color="#22c55e" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* PERSPECTIVE SWITCHER: MY TEAM STRATEGY VS OPPONENTS SCOUTING */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '-4px' }}>
        <JellyRadio
          value={tacticsPerspective}
          onChange={(val) => setTacticsPerspective(val as 'my_team' | 'opponents')}
          items={[
            { value: 'my_team', label: `${managedTeam} Strategy & Chalkboard`, icon: <Shield size={14} /> },
            { value: 'opponents', label: 'Opponents Tactics & Scouting', icon: <Target size={14} /> },
          ]}
          size="md"
        />
      </div>

      {tacticsPerspective === 'opponents' ? (
        <OpponentTactics
          managedTeam={managedTeam}
          onNavigateToMatches={onNavigateToMatches}
        />
      ) : (
        <>
          {/* TOP HEADER & CONTROL BAR */}
          <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: TOKENS.goldDim,
                border: `1px solid ${TOKENS.goldBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: TOKENS.gold,
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                  color: '#ffffff',
                }}
              >
                TACTIC SETTER &amp; STRATEGY COMMAND
              </h1>
              <div style={{ fontSize: '13px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                Master tactical framework, formation geometry, and phase directives for{' '}
                <strong style={{ color: TOKENS.gold }}>{managedTeam}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleResetToDefault}
            title="Reset to default tactic"
            style={{
              background: '#151c28',
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.textSecondary,
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>

          <button
            onClick={handleSaveAsPreset}
            style={{
              background: '#151c28',
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.cyan,
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Bookmark size={14} />
            <span>Save Blueprint</span>
          </button>

          <button
            onClick={handleDeployTactic}
            style={{
              background: TOKENS.gold,
              border: 'none',
              color: '#0d1117',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.02em',
            }}
          >
            <Zap size={15} fill="#0d1117" />
            <span>Deploy Match Tactic</span>
          </button>

          {onNavigateToMatches && (
            <button
              onClick={onNavigateToMatches}
              style={{
                background: 'transparent',
                border: `1px solid ${TOKENS.borderLight}`,
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>View in Matches</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* QUICK TACTICAL ARCHETYPE PRESETS BAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: TOKENS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            1-Click Tactical Archetypes &amp; Managerial Blueprints
          </div>
          {savedPresets.length > 0 && (
            <div style={{ fontSize: '11.5px', color: TOKENS.cyan }}>
              {savedPresets.length} Custom Presets Saved
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '12px',
          }}
        >
          {TACTICAL_ARCHETYPES.map((arch) => {
            const isActive =
              tactic.name.includes(arch.name) ||
              (tactic.formation === arch.recommendedFormation &&
                tactic.inPossession.passingDirectness === arch.inPossession.passingDirectness &&
                tactic.outOfPossession.defensiveLine === arch.outOfPossession.defensiveLine);

            return (
              <div
                key={arch.id}
                onClick={() => handleApplyArchetype(arch)}
                style={{
                  backgroundColor: isActive ? 'rgba(200, 150, 62, 0.12)' : TOKENS.bgCard,
                  border: `1px solid ${isActive ? TOKENS.gold : TOKENS.border}`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    {arch.name}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isActive ? TOKENS.gold : '#1a2232',
                      color: isActive ? '#0e1218' : TOKENS.textSecondary,
                      fontWeight: 700,
                    }}
                  >
                    {arch.recommendedFormation}
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: TOKENS.gold, fontWeight: 600 }}>
                  {arch.subtitle}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: TOKENS.textSecondary,
                    lineHeight: 1.4,
                    marginTop: '2px',
                  }}
                >
                  {arch.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT PITCH CHALKBOARD, RIGHT DIRECTIVES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* =========================================================================
            LEFT COLUMN: FORMATION SELECTION, PITCH CHALKBOARD & SQUAD ALLOCATION
           ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Formation Picker Bar */}
          <div
            style={{
              backgroundColor: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color={TOKENS.gold} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#ffffff',
                  }}
                >
                  Formation System Architecture
                </span>
              </div>

              <button
                onClick={handleAutoFillSquad}
                disabled={loadingSquad || squadPlayers.length === 0}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: TOKENS.cyan,
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Users size={13} />
                <span>Auto-Allocate Squad XI</span>
              </button>
            </div>

            {/* Jelly Radio Formation Selector */}
            <div style={{ display: 'flex', width: '100%', overflowX: 'auto', paddingBottom: '4px' }}>
              <JellyRadio
                value={tactic.formation}
                onChange={(val) => handleFormationChange(val as FormationKey)}
                items={FORMATION_OPTIONS.map((f) => ({
                  value: f,
                  label: f,
                }))}
                size="sm"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Interactive Pitch Diagram Board */}
          <div
            style={{
              backgroundColor: '#0c1017',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.7)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Pitch Header Status Bar */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'rgba(16, 22, 32, 0.9)',
                borderBottom: `1px solid ${TOKENS.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: TOKENS.gold }}>
                  {tactic.formation === 'Custom'
                    ? `Custom Formation (${detectedCustomName})`
                    : tactic.formation}
                </span>
                <span style={{ fontSize: '12px', color: TOKENS.textMuted }}>•</span>
                <span style={{ fontSize: '12px', color: TOKENS.textSecondary }}>
                  {tactic.slots.filter((s) => s.assignedPlayerId).length} / 11 Players Assigned
                </span>
                {tactic.formation === 'Custom' && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: TOKENS.cyan,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Move size={11} />
                    <span>Free Drag Mode Active</span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tactic.formation === 'Custom' && (
                  <button
                    onClick={() => handleFormationChange('4-3-3 Holding')}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${TOKENS.borderLight}`,
                      color: TOKENS.textSecondary,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Reset to 4-3-3
                  </button>
                )}
                <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                  Drag any player node across the pitch to craft your custom tactical formation
                </div>
              </div>
            </div>

            {/* SVG Pitch Canvas with Drag and Drop */}
            <div
              ref={pitchRef}
              onPointerMove={handlePointerMovePitch}
              onPointerUp={handlePointerUpPitch}
              onPointerLeave={handlePointerUpPitch}
              style={{
                position: 'relative',
                width: '100%',
                height: '430px',
                backgroundColor: '#0a0e16',
                cursor: draggedSlotId ? 'grabbing' : 'default',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              {/* Tactical Floating HUD while dragging */}
              {dragCoords && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${dragCoords.x}%`,
                    top: `calc(${dragCoords.y}% - 46px)`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(9, 13, 20, 0.95)',
                    border: `1px solid ${TOKENS.gold}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#ffffff',
                    pointerEvents: 'none',
                    zIndex: 100,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Compass size={12} color={TOKENS.gold} />
                  <span>{dragCoords.zone}</span>
                  <span style={{ color: TOKENS.cyan }}>({dragCoords.x}%, {dragCoords.y}%)</span>
                </div>
              )}

              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                <defs>
                  <pattern id="pitchGrass" width="10" height="100" patternUnits="userSpaceOnUse">
                    <rect width="5" height="100" fill="#0d131d" />
                    <rect x="5" width="5" height="100" fill="#0a0f18" />
                  </pattern>
                </defs>

                {/* Pitch Background */}
                <rect width="100" height="100" fill="url(#pitchGrass)" />

                {/* Pitch Border Lines */}
                <rect
                  x="4"
                  y="4"
                  width="92"
                  height="92"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />

                {/* Halfway Line */}
                <line
                  x1="50"
                  y1="4"
                  x2="50"
                  y2="96"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />

                {/* Center Circle & Spot */}
                <circle
                  cx="50"
                  cy="50"
                  r="12"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />
                <circle cx="50" cy="50" r="0.8" fill="rgba(255, 255, 255, 0.25)" />

                {/* Left Penalty Box (Own Half) */}
                <rect
                  x="4"
                  y="24"
                  width="18"
                  height="52"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />
                {/* Left 6-Yard Box */}
                <rect
                  x="4"
                  y="36"
                  width="6"
                  height="28"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />
                {/* Left Penalty Arc */}
                <path
                  d="M 22 42 A 8 8 0 0 1 22 58"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />

                {/* Right Penalty Box (Opponent Half) */}
                <rect
                  x="78"
                  y="24"
                  width="18"
                  height="52"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />
                {/* Right 6-Yard Box */}
                <rect
                  x="90"
                  y="36"
                  width="6"
                  height="28"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />
                {/* Right Penalty Arc */}
                <path
                  d="M 78 42 A 8 8 0 0 0 78 58"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="0.6"
                />

                {/* Tactical Passing Connection Chords */}
                {formationConnections.map((conn, idx) => {
                  const fromSlot = tactic.slots[conn.fromIndex];
                  const toSlot = tactic.slots[conn.toIndex];
                  if (!fromSlot || !toSlot) return null;

                  return (
                    <line
                      key={`conn_${idx}`}
                      x1={fromSlot.x}
                      y1={fromSlot.y}
                      x2={toSlot.x}
                      y2={toSlot.y}
                      stroke={TOKENS.gold}
                      strokeWidth={conn.weight ? conn.weight * 0.25 : 0.8}
                      strokeOpacity={0.28}
                      strokeDasharray="1.5, 1"
                    />
                  );
                })}
              </svg>

              {/* Formation Slot Nodes */}
              {tactic.slots.map((slot) => {
                const isSelected = slot.slotId === selectedSlotId;
                const isCurrentDrag = slot.slotId === draggedSlotId;
                const dutyColor =
                  slot.duty === 'Attack'
                    ? TOKENS.crimson
                    : slot.duty === 'Support'
                    ? TOKENS.gold
                    : TOKENS.cyan;

                return (
                  <div
                    key={slot.slotId}
                    onPointerDown={(e) => handlePointerDownSlot(slot.slotId, e)}
                    onClick={() => {
                      setSelectedSlotId(slot.slotId);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: isCurrentDrag ? 'grabbing' : 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      zIndex: isCurrentDrag ? 50 : isSelected ? 35 : 20,
                      userSelect: 'none',
                      touchAction: 'none',
                    }}
                  >
                    {/* Circular Player / Role Badge */}
                    <div
                      style={{
                        width: isCurrentDrag ? '38px' : '34px',
                        height: isCurrentDrag ? '38px' : '34px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? TOKENS.gold : '#141b27',
                        border: `2px solid ${isSelected ? '#ffffff' : dutyColor}`,
                        color: isSelected ? '#0d1118' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isCurrentDrag ? '13px' : '11.5px',
                        fontWeight: 800,
                        boxShadow: isCurrentDrag
                          ? '0 0 0 4px rgba(56, 189, 248, 0.45), 0 8px 16px rgba(0,0,0,0.8)'
                          : isSelected
                          ? '0 0 0 3px rgba(200, 150, 62, 0.35)'
                          : 'none',
                        transition: isCurrentDrag ? 'none' : 'all 0.15s ease',
                      }}
                    >
                      {slot.assignedJerseyNumber || slot.roleCode}
                    </div>

                    {/* Player Name / Role Tag */}
                    <div
                      style={{
                        backgroundColor: 'rgba(10, 14, 22, 0.92)',
                        border: `1px solid ${isSelected ? TOKENS.gold : 'rgba(255, 255, 255, 0.15)'}`,
                        borderRadius: '4px',
                        padding: '1px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: isSelected ? TOKENS.gold : '#ffffff',
                          maxWidth: '90px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {slot.assignedPlayerName
                          ? slot.assignedPlayerName.split(' ').slice(-1)[0]
                          : slot.roleCode}
                      </span>
                      <span
                        style={{
                          fontSize: '8.5px',
                          color: dutyColor,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {slot.duty.slice(0, 3)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Slot Inspector Bar */}
            {selectedSlot && (
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#121824',
                  borderTop: `1px solid ${TOKENS.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(200, 150, 62, 0.15)',
                      border: `1px solid ${TOKENS.goldBorder}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: TOKENS.gold }}>
                      {selectedSlot.roleCode}
                    </span>
                    <span style={{ fontSize: '8px', color: TOKENS.textMuted }}>
                      #{selectedSlot.assignedJerseyNumber || '--'}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                        {selectedSlot.assignedPlayerName || 'Unassigned Slot'}
                      </span>
                      {selectedSlot.assignedPosition && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: '#1f2937',
                            color: TOKENS.cyan,
                          }}
                        >
                          {selectedSlot.assignedPosition}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginTop: '2px' }}>
                      Role: <strong style={{ color: TOKENS.gold }}>{selectedSlot.roleName}</strong> ({selectedSlot.duty}) • <span style={{ color: TOKENS.cyan }}>Pitch: {selectedSlot.x}%, {selectedSlot.y}%</span> ({getPitchZoneDescription(selectedSlot.x, selectedSlot.y)})
                    </div>

                    {tactic.formation === 'Custom' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10.5px', color: TOKENS.textMuted }}>Custom Role Tag:</span>
                        {(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              const updatedSlots = tactic.slots.map((s) =>
                                s.slotId === selectedSlot.slotId ? { ...s, roleCode: r } : s
                              );
                              const next = { ...tactic, slots: updatedSlots };
                              setTactic(next);
                              saveActiveTactic(next);
                            }}
                            style={{
                              background: selectedSlot.roleCode === r ? TOKENS.gold : '#1a2232',
                              color: selectedSlot.roleCode === r ? '#0d1117' : TOKENS.textSecondary,
                              border: `1px solid ${selectedSlot.roleCode === r ? TOKENS.gold : TOKENS.border}`,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '9.5px',
                              fontWeight: selectedSlot.roleCode === r ? 800 : 600,
                              cursor: 'pointer',
                            }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duty Toggle & Assign Player Trigger */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Duty Switcher */}
                  <div
                    style={{
                      display: 'flex',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: `1px solid ${TOKENS.border}`,
                    }}
                  >
                    {(['Defend', 'Support', 'Attack'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => handleUpdateSlotDuty(d)}
                        style={{
                          background: selectedSlot.duty === d ? TOKENS.gold : '#171f2c',
                          color: selectedSlot.duty === d ? '#0e1218' : TOKENS.textSecondary,
                          border: 'none',
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSlotPositionFilter('ALL');
                      setIsPlayerAssignModalOpen(true);
                    }}
                    style={{
                      backgroundColor: 'rgba(200, 150, 62, 0.15)',
                      border: `1px solid ${TOKENS.goldBorder}`,
                      color: TOKENS.gold,
                      padding: '7px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Users size={13} />
                    <span>Change Squad Player</span>
                  </button>
                </div>

                {/* Individual Instructions Bar */}
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    paddingTop: '10px',
                    borderTop: `1px solid ${TOKENS.border}`,
                    flexWrap: 'wrap',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ color: TOKENS.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                    Player Duties &amp; Instructions:
                  </span>

                  {/* Dribbling */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: TOKENS.textSecondary }}>Dribble:</span>
                    {(['dribble_less', 'balanced', 'dribble_more'] as const).map((opt) => {
                      const cur = selectedSlot.individualInstructions?.dribbling || 'balanced';
                      const label = opt === 'dribble_less' ? 'Less' : opt === 'dribble_more' ? 'More' : 'Norm';
                      return (
                        <button
                          key={opt}
                          onClick={() => handleUpdateIndividualInstruction('dribbling', opt)}
                          style={{
                            background: cur === opt ? TOKENS.cyan : '#171f2c',
                            color: cur === opt ? '#0e1218' : TOKENS.textSecondary,
                            border: `1px solid ${cur === opt ? TOKENS.cyan : TOKENS.border}`,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10.5px',
                            fontWeight: cur === opt ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Risks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: TOKENS.textSecondary }}>Risks:</span>
                    {(['play_safe', 'balanced', 'take_risks'] as const).map((opt) => {
                      const cur = selectedSlot.individualInstructions?.risks || 'balanced';
                      const label = opt === 'play_safe' ? 'Safe' : opt === 'take_risks' ? 'Risk' : 'Norm';
                      return (
                        <button
                          key={opt}
                          onClick={() => handleUpdateIndividualInstruction('risks', opt)}
                          style={{
                            background: cur === opt ? TOKENS.gold : '#171f2c',
                            color: cur === opt ? '#0e1218' : TOKENS.textSecondary,
                            border: `1px solid ${cur === opt ? TOKENS.gold : TOKENS.border}`,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10.5px',
                            fontWeight: cur === opt ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Positioning */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: TOKENS.textSecondary }}>Shape:</span>
                    {(['hold_position', 'roam'] as const).map((opt) => {
                      const cur = selectedSlot.individualInstructions?.positioning || 'hold_position';
                      const label = opt === 'hold_position' ? 'Hold' : 'Roam';
                      return (
                        <button
                          key={opt}
                          onClick={() => handleUpdateIndividualInstruction('positioning', opt)}
                          style={{
                            background: cur === opt ? TOKENS.green : '#171f2c',
                            color: cur === opt ? '#0e1218' : TOKENS.textSecondary,
                            border: `1px solid ${cur === opt ? TOKENS.green : TOKENS.border}`,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10.5px',
                            fontWeight: cur === opt ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: PHASE-BY-PHASE DIRECTIVES, TACTICAL RADAR & ASSESSMENT
           ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Phase Sub-Tabs Switcher */}
          <div
            style={{
              backgroundColor: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '10px',
              padding: '12px 16px',
            }}
          >
            <JellyRadio
              value={activePhaseTab}
              onChange={(val) =>
                setActivePhaseTab(
                  val as 'in_possession' | 'in_transition' | 'out_of_possession' | 'radar_matrix'
                )
              }
              items={[
                { value: 'in_possession', label: 'In Possession', icon: <Activity size={13} /> },
                { value: 'in_transition', label: 'Transitions', icon: <Zap size={13} /> },
                { value: 'out_of_possession', label: 'Out of Possession', icon: <Shield size={13} /> },
                { value: 'radar_matrix', label: 'Tactical Radar', icon: <Target size={13} /> },
              ]}
              size="sm"
              style={{ width: '100%' }}
            />
          </div>

          {/* TAB 1: IN POSSESSION DIRECTIVES */}
          {activePhaseTab === 'in_possession' && (
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color={TOKENS.gold} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  In Possession Directives &amp; Build-Up
                </span>
              </div>

              {/* Mentality */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Team Mentality:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(['cautious', 'balanced', 'positive', 'attacking'] as TeamMentality[]).map(
                    (ment) => (
                      <button
                        key={ment}
                        onClick={() => updateInstruction('mentality', '', ment)}
                        style={{
                          backgroundColor:
                            tactic.mentality === ment ? TOKENS.gold : '#161d2a',
                          color: tactic.mentality === ment ? '#0d1117' : TOKENS.textSecondary,
                          border: `1px solid ${tactic.mentality === ment ? TOKENS.gold : TOKENS.border}`,
                          padding: '8px 4px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {ment}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Attacking Width */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Attacking Width:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(['narrow', 'balanced', 'wide'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => updateInstruction('inPossession', 'width', w)}
                      style={{
                        backgroundColor:
                          tactic.inPossession.width === w ? TOKENS.cyan : '#161d2a',
                        color: tactic.inPossession.width === w ? '#0d1117' : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inPossession.width === w ? TOKENS.cyan : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Build Up Play */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Build-up Approach:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'play_out_of_back', label: 'Play Out of Back' },
                    { val: 'mixed', label: 'Balanced' },
                    { val: 'direct', label: 'Direct Route' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('inPossession', 'buildUp', item.val)}
                      style={{
                        backgroundColor:
                          tactic.inPossession.buildUp === item.val ? TOKENS.gold : '#161d2a',
                        color:
                          tactic.inPossession.buildUp === item.val ? '#0d1117' : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inPossession.buildUp === item.val ? TOKENS.gold : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passing Directness */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Passing Directness:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'short', label: 'Short / Tiki-Taka' },
                    { val: 'standard', label: 'Standard' },
                    { val: 'direct', label: 'Direct / Vertical' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() =>
                        updateInstruction('inPossession', 'passingDirectness', item.val)
                      }
                      style={{
                        backgroundColor:
                          tactic.inPossession.passingDirectness === item.val
                            ? TOKENS.cyan
                            : '#161d2a',
                        color:
                          tactic.inPossession.passingDirectness === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inPossession.passingDirectness === item.val ? TOKENS.cyan : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tempo */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Tactical Tempo:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'patient', label: 'Patient & Measured' },
                    { val: 'standard', label: 'Standard' },
                    { val: 'high_tempo', label: 'High Tempo' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('inPossession', 'tempo', item.val)}
                      style={{
                        backgroundColor:
                          tactic.inPossession.tempo === item.val ? TOKENS.gold : '#161d2a',
                        color:
                          tactic.inPossession.tempo === item.val ? '#0d1117' : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inPossession.tempo === item.val ? TOKENS.gold : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Third Entry */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Final Third Execution:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { val: 'work_into_box', label: 'Work into Box' },
                    { val: 'mixed', label: 'Balanced' },
                    { val: 'shoot_on_sight', label: 'Shoot on Sight' },
                    { val: 'early_crosses', label: 'Early Crosses' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('inPossession', 'finalThird', item.val)}
                      style={{
                        backgroundColor:
                          tactic.inPossession.finalThird === item.val ? TOKENS.cyan : '#161d2a',
                        color:
                          tactic.inPossession.finalThird === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inPossession.finalThird === item.val ? TOKENS.cyan : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSITION DIRECTIVES */}
          {activePhaseTab === 'in_transition' && (
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color={TOKENS.gold} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Game State Transition Directives
                </span>
              </div>

              {/* Upon Losing Possession */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  When Possession is Lost:
                </div>
                <div style={{ fontSize: '11.5px', color: TOKENS.textMuted, marginBottom: '8px' }}>
                  Determines immediate squad reaction during defensive disorganization
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => updateInstruction('inTransition', 'lossTransition', 'counter_press')}
                    style={{
                      backgroundColor:
                        tactic.inTransition.lossTransition === 'counter_press'
                          ? TOKENS.gold
                          : '#161d2a',
                      color:
                        tactic.inTransition.lossTransition === 'counter_press'
                          ? '#0d1117'
                          : TOKENS.textSecondary,
                      border: `1px solid ${tactic.inTransition.lossTransition === 'counter_press' ? TOKENS.gold : TOKENS.border}`,
                      padding: '12px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Counter-Press</span>
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>
                      Hunt ball immediately within 5s
                    </span>
                  </button>

                  <button
                    onClick={() => updateInstruction('inTransition', 'lossTransition', 'regroup')}
                    style={{
                      backgroundColor:
                        tactic.inTransition.lossTransition === 'regroup' ? TOKENS.cyan : '#161d2a',
                      color:
                        tactic.inTransition.lossTransition === 'regroup'
                          ? '#0d1117'
                          : TOKENS.textSecondary,
                      border: `1px solid ${tactic.inTransition.lossTransition === 'regroup' ? TOKENS.cyan : TOKENS.border}`,
                      padding: '12px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Regroup &amp; Drop</span>
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>
                      Retreat into compact shape
                    </span>
                  </button>
                </div>
              </div>

              {/* Upon Winning Possession */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  When Possession is Won:
                </div>
                <div style={{ fontSize: '11.5px', color: TOKENS.textMuted, marginBottom: '8px' }}>
                  Directs attacking transition speed and verticality
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => updateInstruction('inTransition', 'winTransition', 'counter')}
                    style={{
                      backgroundColor:
                        tactic.inTransition.winTransition === 'counter' ? TOKENS.gold : '#161d2a',
                      color:
                        tactic.inTransition.winTransition === 'counter'
                          ? '#0d1117'
                          : TOKENS.textSecondary,
                      border: `1px solid ${tactic.inTransition.winTransition === 'counter' ? TOKENS.gold : TOKENS.border}`,
                      padding: '12px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Counter-Attack</span>
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>
                      Vertical fast-break to exploit voids
                    </span>
                  </button>

                  <button
                    onClick={() => updateInstruction('inTransition', 'winTransition', 'hold_shape')}
                    style={{
                      backgroundColor:
                        tactic.inTransition.winTransition === 'hold_shape'
                          ? TOKENS.cyan
                          : '#161d2a',
                      color:
                        tactic.inTransition.winTransition === 'hold_shape'
                          ? '#0d1117'
                          : TOKENS.textSecondary,
                      border: `1px solid ${tactic.inTransition.winTransition === 'hold_shape' ? TOKENS.cyan : TOKENS.border}`,
                      padding: '12px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Hold Shape &amp; Recycle</span>
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>
                      Maintain possession and control
                    </span>
                  </button>
                </div>
              </div>

              {/* Goalkeeper Distribution */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  Goalkeeper Distribution:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'short_cb', label: 'Distribute to CBs' },
                    { val: 'roll_out', label: 'Roll Out to FBs' },
                    { val: 'long_kick', label: 'Long Forward Kick' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('inTransition', 'gkDistribution', item.val)}
                      style={{
                        backgroundColor:
                          tactic.inTransition.gkDistribution === item.val
                            ? TOKENS.gold
                            : '#161d2a',
                        color:
                          tactic.inTransition.gkDistribution === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.inTransition.gkDistribution === item.val ? TOKENS.gold : TOKENS.border}`,
                        padding: '10px 6px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OUT OF POSSESSION DIRECTIVES */}
          {activePhaseTab === 'out_of_possession' && (
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color={TOKENS.gold} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Defensive Structure &amp; Pressing Block
                </span>
              </div>

              {/* Defensive Line */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Defensive Line Height:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'high_line', label: 'High Line' },
                    { val: 'mid_block', label: 'Mid Block' },
                    { val: 'low_block', label: 'Deep Low Block' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('outOfPossession', 'defensiveLine', item.val)}
                      style={{
                        backgroundColor:
                          tactic.outOfPossession.defensiveLine === item.val
                            ? TOKENS.gold
                            : '#161d2a',
                        color:
                          tactic.outOfPossession.defensiveLine === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.outOfPossession.defensiveLine === item.val ? TOKENS.gold : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line of Engagement */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Line of Engagement:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'high_press', label: 'High Press' },
                    { val: 'mid_block', label: 'Mid Block' },
                    { val: 'deep_contain', label: 'Deep Contain' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => updateInstruction('outOfPossession', 'pressingLine', item.val)}
                      style={{
                        backgroundColor:
                          tactic.outOfPossession.pressingLine === item.val
                            ? TOKENS.cyan
                            : '#161d2a',
                        color:
                          tactic.outOfPossession.pressingLine === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.outOfPossession.pressingLine === item.val ? TOKENS.cyan : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pressing Intensity */}
              <div>
                <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                  Trigger Press Intensity:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { val: 'cautious', label: 'Cautious' },
                    { val: 'standard', label: 'Standard' },
                    { val: 'aggressive', label: 'Aggressive' },
                    { val: 'extreme', label: 'Extreme' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() =>
                        updateInstruction('outOfPossession', 'pressingIntensity', item.val)
                      }
                      style={{
                        backgroundColor:
                          tactic.outOfPossession.pressingIntensity === item.val
                            ? TOKENS.gold
                            : '#161d2a',
                        color:
                          tactic.outOfPossession.pressingIntensity === item.val
                            ? '#0d1117'
                            : TOKENS.textSecondary,
                        border: `1px solid ${tactic.outOfPossession.pressingIntensity === item.val ? TOKENS.gold : TOKENS.border}`,
                        padding: '8px 4px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tackling Aggression & Offside Trap */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  paddingTop: '8px',
                  borderTop: `1px solid ${TOKENS.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                    Tackling Aggression:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { val: 'stay_on_feet', label: 'Stay on Feet' },
                      { val: 'balanced', label: 'Balanced' },
                      { val: 'get_stuck_in', label: 'Get Stuck In' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        onClick={() =>
                          updateInstruction('outOfPossession', 'tacklingAggression', item.val)
                        }
                        style={{
                          backgroundColor:
                            tactic.outOfPossession.tacklingAggression === item.val
                              ? TOKENS.cyan
                              : '#161d2a',
                          color:
                            tactic.outOfPossession.tacklingAggression === item.val
                              ? '#0d1117'
                              : TOKENS.textSecondary,
                          border: `1px solid ${tactic.outOfPossession.tacklingAggression === item.val ? TOKENS.cyan : TOKENS.border}`,
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: TOKENS.textSecondary, marginBottom: '6px' }}>
                    Offside Trap:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => updateInstruction('outOfPossession', 'offsideTrap', true)}
                      style={{
                        backgroundColor:
                          tactic.outOfPossession.offsideTrap ? TOKENS.green : '#161d2a',
                        color:
                          tactic.outOfPossession.offsideTrap ? '#0d1117' : TOKENS.textSecondary,
                        border: `1px solid ${tactic.outOfPossession.offsideTrap ? TOKENS.green : TOKENS.border}`,
                        padding: '8px 10px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Step Up (Trap Active)
                    </button>
                    <button
                      onClick={() => updateInstruction('outOfPossession', 'offsideTrap', false)}
                      style={{
                        backgroundColor:
                          !tactic.outOfPossession.offsideTrap ? TOKENS.gold : '#161d2a',
                        color:
                          !tactic.outOfPossession.offsideTrap ? '#0d1117' : TOKENS.textSecondary,
                        border: `1px solid ${!tactic.outOfPossession.offsideTrap ? TOKENS.gold : TOKENS.border}`,
                        padding: '8px 10px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Hold Line (No Trap)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TACTICAL RADAR & EXECUTIVE ASSESSMENT */}
          {activePhaseTab === 'radar_matrix' && (
            <div
              style={{
                backgroundColor: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={16} color={TOKENS.gold} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Live 5-Axis Tactical Radar &amp; Model Assessment
                </span>
              </div>

              {/* D3 Radar Chart */}
              <BorderGlow
                backgroundColor="#0c1017"
                borderRadius={8}
                colors={['#c8963e', '#38bdf8', '#c084fc']}
              >
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <RadarChart
                    data={radarData}
                    playerName="Current Tactical Setup"
                    comparisonData={LEAGUE_BASELINE_RADAR}
                    comparisonName="Balanced League Baseline"
                    comparisonColor="#38bdf8"
                    color="#c8963e"
                    size={260}
                  />
                </div>
              </BorderGlow>

              {/* Radar Scores Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                }}
              >
                {Object.entries(radarData).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      backgroundColor: '#151c28',
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: '6px',
                      padding: '8px 6px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: TOKENS.textMuted, textTransform: 'uppercase' }}>
                      {key}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: TOKENS.gold, marginTop: '2px' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Strengths & Vulnerabilities */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Strengths */}
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: TOKENS.green,
                      marginBottom: '6px',
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Tactical Strengths &amp; Exploitation</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: TOKENS.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    {tacticalInsights.strengths.map((str, i) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>

                {/* Vulnerabilities */}
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: TOKENS.crimson,
                      marginBottom: '6px',
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Tactical Vulnerabilities &amp; Risks</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: TOKENS.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    {tacticalInsights.vulnerabilities.map((vuln, i) => (
                      <li key={i}>{vuln}</li>
                    ))}
                  </ul>
                </div>

                {/* Directives */}
                <div
                  style={{
                    backgroundColor: 'rgba(200, 150, 62, 0.08)',
                    border: `1px solid ${TOKENS.goldBorder}`,
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: TOKENS.gold,
                      marginBottom: '6px',
                    }}
                  >
                    <Zap size={14} />
                    <span>Match Day Coaching Directives</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: TOKENS.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    {tacticalInsights.directives.map((dir, i) => (
                      <li key={i}>{dir}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          PLAYER ASSIGNMENT MODAL
         ========================================================================= */}
      {isPlayerAssignModalOpen && selectedSlot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 14, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPlayerAssignModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#121722',
              border: `1px solid ${TOKENS.borderLight}`,
              borderRadius: '12px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 22px',
                borderBottom: `1px solid ${TOKENS.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#0e131d',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={18} color={TOKENS.gold} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                    Assign Squad Player to {selectedSlot.roleCode} ({selectedSlot.roleName})
                  </div>
                  <div style={{ fontSize: '12px', color: TOKENS.textMuted }}>
                    Select from {managedTeam} active roster
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsPlayerAssignModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: TOKENS.textSecondary,
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Position Filter Pills */}
            <div
              style={{
                padding: '12px 22px',
                borderBottom: `1px solid ${TOKENS.border}`,
                display: 'flex',
                gap: '8px',
                backgroundColor: '#101520',
              }}
            >
              {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSlotPositionFilter(pos)}
                  style={{
                    backgroundColor: slotPositionFilter === pos ? TOKENS.gold : '#171e2c',
                    color: slotPositionFilter === pos ? '#0d1117' : TOKENS.textSecondary,
                    border: `1px solid ${slotPositionFilter === pos ? TOKENS.gold : TOKENS.border}`,
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Players List */}
            <div style={{ overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {squadPlayers
                .filter(
                  (p) => slotPositionFilter === 'ALL' || p.primary_position === slotPositionFilter
                )
                .map((player) => {
                  const isAssignedToThis = selectedSlot.assignedPlayerId === player.player_id;
                  const isAssignedElsewhere =
                    !isAssignedToThis &&
                    tactic.slots.some((s) => s.assignedPlayerId === player.player_id);

                  return (
                    <div
                      key={player.player_id}
                      onClick={() => handleAssignPlayerToSlot(player)}
                      style={{
                        backgroundColor: isAssignedToThis
                          ? 'rgba(200, 150, 62, 0.15)'
                          : '#161c28',
                        border: `1px solid ${isAssignedToThis ? TOKENS.gold : TOKENS.border}`,
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#20293a',
                            color: TOKENS.gold,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                          }}
                        >
                          {player.squad_number || '-'}
                        </div>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
                            {player.player_name}
                          </div>
                          <div style={{ fontSize: '11px', color: TOKENS.textMuted }}>
                            {player.primary_position} • {player.appearances} Apps • {player.minutes} Mins
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isAssignedElsewhere && (
                          <span style={{ fontSize: '10.5px', color: TOKENS.amber, fontWeight: 600 }}>
                            Assigned Elsewhere
                          </span>
                        )}
                        {isAssignedToThis && (
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: TOKENS.gold,
                              color: '#0d1117',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
