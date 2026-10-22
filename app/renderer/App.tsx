import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Sliders,
  Users,
  LogOut,
  UserCheck,
  LayoutDashboard,
  Shield,
  Target,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import {
  checkBackendHealth,
  HealthResponse,
  fetchFocusTeam,
  setFocusTeam,
  resetDatabase,
  fetchMatches,
  MatchSummary,
} from './services/api';
import ProfileCard from './components/ProfileCard/ProfileCard';
import managerAvatar from './assets/manager-avatar.jpg';
import { ManagerDashboard } from './components/ManagerDashboard/ManagerDashboard';
import { MatchHistory } from './components/MatchHistory/MatchHistory';
import { MyTeam } from './components/MyTeam/MyTeam';
import { SeasonCalendar } from './components/SeasonCalendar/SeasonCalendar';
import { AuthScreen } from './components/Auth/AuthScreen';
import { TacticSetter } from './components/TacticSetter/TacticSetter';
import { OpponentTactics } from './components/OpponentTactics/OpponentTactics';
import { ManagerPerformanceDonut } from './components/visualizations/ManagerPerformanceDonut';
import {
  ManagerUser,
  getStoredSession,
  logoutManager,
  updateCurrentUserClub,
  updateManagerProfile,
} from './services/auth';

type NavTab = 'dashboard' | 'tactics' | 'opponents' | 'squad' | 'calendar' | 'journal' | 'settings';

const TAB_LABELS: Record<NavTab, string> = {
  dashboard: 'Matches',
  tactics: 'Tactic Setter',
  opponents: 'Opposition Tactics',
  squad: 'My Team',
  calendar: 'Season Calendar',
  journal: 'Player Details',
  settings: 'Settings',
};

const PREMIER_LEAGUE_CLUBS = [
  'Chelsea',
  'Arsenal',
  'Aston Villa',
  'Bournemouth',
  'Brentford',
  'Brighton & Hove Albion',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Ipswich Town',
  'Leicester City',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Newcastle United',
  'Nottingham Forest',
  'Southampton',
  'Tottenham Hotspur',
  'West Ham United',
  'Wolverhampton Wanderers',
];

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<ManagerUser | null>(() => {
    const session = getStoredSession();
    return session?.user || null;
  });
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedOpponentScout, setSelectedOpponentScout] = useState<string | undefined>(undefined);
  const [_backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [focusClub, setFocusClub] = useState<string>(() => currentUser?.club || 'Chelsea');
  const [clubMsg, setClubMsg] = useState<string>('');
  const [dbResetting, setDbResetting] = useState<boolean>(false);
  const [dbResetMsg, setDbResetMsg] = useState<string>('');

  // Real Match Records for Manager W-D-L Donut
  const [matches, setMatches] = useState<MatchSummary[]>([]);

  // Manager Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || '',
    role: currentUser?.role || 'Head Coach',
    club: currentUser?.club || 'Chelsea',
    email: currentUser?.email || '',
    tactical_philosophy: currentUser?.tactical_philosophy || 'Positional Play & Counter-Pressing',
    season_objective: currentUser?.season_objective || 'Premier League Title & Top 4 Finish',
  });
  const [profileSaveMsg, setProfileSaveMsg] = useState<string>('');

  useEffect(() => {
    if (currentUser?.club) {
      setFocusClub(currentUser.club);
      setFocusTeam(currentUser.club).catch(() => {});
    } else {
      fetchFocusTeam().then(setFocusClub).catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name,
        role: currentUser.role,
        club: currentUser.club,
        email: currentUser.email,
        tactical_philosophy: currentUser.tactical_philosophy || 'Positional Play & Counter-Pressing',
        season_objective: currentUser.season_objective || 'Premier League Title & Top 4 Finish',
      });
    }
  }, [currentUser]);

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .catch(() => setMatches([]));
  }, [focusClub]);

  const managerRecords = useMemo(() => {
    const wins = matches.filter((m) => m.result === 'W').length;
    const draws = matches.filter((m) => m.result === 'D').length;
    const losses = matches.filter((m) => m.result === 'L').length;
    return { wins, draws, losses };
  }, [matches]);

  useEffect(() => {
    const check = () => {
      checkBackendHealth()
        .then((res) => {
          setBackendHealth((prev) => {
            if (prev && prev.status === res.status && prev.version === res.version) {
              return prev;
            }
            return res;
          });
        })
        .catch(() => setBackendHealth((prev) => (prev === null ? prev : null)));
  };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logoutManager();
    setCurrentUser(null);
  };

  const handleSaveProfile = () => {
    if (!currentUser) return;
    try {
      const updated = updateManagerProfile(currentUser.id, {
        name: profileForm.name.trim() || currentUser.name,
        role: profileForm.role.trim() || currentUser.role,
        club: profileForm.club,
        email: profileForm.email.trim() || currentUser.email,
        tactical_philosophy: profileForm.tactical_philosophy.trim(),
        season_objective: profileForm.season_objective.trim(),
      });
      if (updated) {
        setCurrentUser(updated);
        if (updated.club !== focusClub) {
          setFocusClub(updated.club);
          setFocusTeam(updated.club).catch(() => {});
        }
        setIsEditingProfile(false);
        setProfileSaveMsg('Manager profile saved successfully!');
        setTimeout(() => setProfileSaveMsg(''), 3500);
      }
    } catch {
      setProfileSaveMsg('Failed to persist profile updates');
    }
  };

  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.club) {
            setFocusClub(user.club);
            setFocusTeam(user.club).catch(() => {});
          }
        }}
      />
    );
  }

  const NAV_TAB_LIST: NavTab[] = [
    'dashboard',
    'tactics',
    'opponents',
    'squad',
    'calendar',
    'journal',
    'settings',
  ];

  return (
    <div className="entry-window">
      {/* Top App Header */}
      <header className="nav-header">
        {/* Left: Nav Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {NAV_TAB_LIST.map((tab) => {
              const label = TAB_LABELS[tab];
              return (
                <button
                  key={tab}
                  id={`nav-tab-${tab}`}
                  onClick={() => {
                    if (tab === 'dashboard') {
                      setSelectedMatchId(null);
                    }
                    setActiveTab(tab);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: activeTab === tab ? '#ffffff' : '#8b8f9a',
                    fontSize: '15px',
                    fontWeight: activeTab === tab ? '600' : '400',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderBottom: activeTab === tab ? '2px solid #ffffff' : '2px solid transparent',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: TACTICAL ANALYST */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0',
          }}
        >
          <span
            style={{
              fontSize: '14.5px',
              fontWeight: '500',
              letterSpacing: '0.20em',
              color: '#c8c8d0',
              textTransform: 'uppercase',
            }}
          >
            TACTICAL{' '}
          </span>
          <span
            style={{
              fontSize: '14.5px',
              fontWeight: '500',
              letterSpacing: '0.20em',
              color: '#c8963e',
              textTransform: 'uppercase',
            }}
          >
            ANALYST
          </span>
        </div>

        {/* Right: Manager profile badge + Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px 4px 6px',
              background: '#121620',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            title="Manager Settings"
          >
            <img
              src={managerAvatar}
              alt={currentUser.name}
              style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
              {currentUser.name}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-gold)',
                background: 'rgba(198, 135, 21, 0.15)',
                padding: '1px 6px',
                borderRadius: '3px',
              }}
            >
              {currentUser.club}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#9ca3af',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              transition: 'all 0.12s ease',
            }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Body Layout: Sidebar Rail + Main Workspace */}
      <div className="app-layout-shell">
        {/* Left Vertical Icon Rail */}
        <aside className="left-icon-rail">
          <div className="rail-group">
            <button
              className={`rail-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMatchId(null);
                setActiveTab('dashboard');
              }}
              title="Matches Overview"
            >
              <LayoutDashboard size={18} />
            </button>
            <button
              className={`rail-btn ${activeTab === 'tactics' ? 'active' : ''}`}
              onClick={() => setActiveTab('tactics')}
              title="Tactic Setter & Strategy Command"
            >
              <Shield size={18} />
            </button>
            <button
              className={`rail-btn ${activeTab === 'opponents' ? 'active' : ''}`}
              onClick={() => setActiveTab('opponents')}
              title="Opposition Tactics"
            >
              <Target size={18} />
            </button>
            <button
              className={`rail-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
              title="Season Fixtures Calendar"
            >
              <Calendar size={18} />
            </button>
            <button
              className={`rail-btn ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveTab('journal')}
              title="Individual Player Details & Performance"
            >
              <UserCheck size={18} />
            </button>
            <button
              className={`rail-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              title="Settings"
            >
              <Sliders size={18} />
            </button>
          </div>

          <div className="rail-group">
            <button
              className={`rail-btn ${activeTab === 'squad' ? 'active' : ''}`}
              title="My Team"
              onClick={() => setActiveTab('squad')}
            >
              <Users size={17} />
            </button>
            <button className="rail-btn" title="Logout" onClick={handleLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'dashboard' && (
            <ManagerDashboard
              initialMatchId={selectedMatchId}
              managedTeam={focusClub}
              onNavigateToUpload={() => setActiveTab('dashboard')}
              onNavigateToHistory={() => setActiveTab('journal')}
              onNavigateToTactics={() => setActiveTab('tactics')}
              onNavigateToOpponents={(opp) => {
                setSelectedOpponentScout(opp);
                setActiveTab('opponents');
              }}
            />
          )}

          {activeTab === 'tactics' && (
            <TacticSetter
              managedTeam={focusClub}
              onNavigateToMatches={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'opponents' && (
            <div style={{ padding: '24px 28px' }}>
              <OpponentTactics
                managedTeam={focusClub}
                initialOpponent={selectedOpponentScout}
                onNavigateToMatches={() => setActiveTab('dashboard')}
              />
            </div>
          )}

          {activeTab === 'squad' && (
            <div style={{ padding: '24px 28px' }}>
              <MyTeam
                onSelectMatch={(matchId) => {
                  setSelectedMatchId(matchId);
                  setActiveTab('dashboard');
                }}
                onNavigateToUpload={() => setActiveTab('dashboard')}
                managedTeam={focusClub}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div style={{ padding: '24px 28px' }}>
              <SeasonCalendar
                onSelectMatch={(matchId) => {
                  setSelectedMatchId(matchId);
                  setActiveTab('dashboard');
                }}
              />
            </div>
          )}

          {activeTab === 'journal' && (
            <div style={{ padding: '24px 28px' }}>
              <MatchHistory
                onSelectMatch={(matchId) => {
                  setSelectedMatchId(matchId);
                  setActiveTab('dashboard');
                }}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ padding: '24px 28px' }}>
              <div className="page-header">
                <h1 className="page-title">Manager Settings</h1>
                <p className="page-description">
                  Tactical credentials, club responsibilities, normalization standards, and season performance.
                </p>
              </div>

              <div className="settings-grid">
                {/* Profile Card */}
                <div>
                  <ProfileCard
                    name={currentUser.name}
                    title={currentUser.role}
                    handle={currentUser.email.split('@')[0]}
                    status="Active"
                    contactText="Tactical Settings"
                    avatarUrl={managerAvatar}
                    showUserInfo={true}
                    enableTilt={true}
                    enableMobileTilt={false}
                    behindGlowEnabled={false}
                    onContactClick={() => setIsEditingProfile(true)}
                  />
                </div>

                {/* Settings Configuration Panels */}
                <div className="settings-group">
                  {/* Manager Tactical Profile Surface Panel with Donut Chart in Upper Right */}
                  <div className="surface-panel" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '14px' }}>
                      <div>
                        <div className="surface-panel-title">Manager Profile &amp; Tactical Philosophy</div>
                        <div className="surface-panel-caption">
                          Strategic approach, tactical system, and competitive record
                        </div>
                      </div>

                      {/* Upper Right: W-D-L Performance Donut & Edit Profile Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <ManagerPerformanceDonut
                          wins={managerRecords.wins}
                          draws={managerRecords.draws}
                          losses={managerRecords.losses}
                          title="Season Record"
                          size={155}
                        />

                        {!isEditingProfile ? (
                          <button
                            onClick={() => setIsEditingProfile(true)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(200, 150, 62, 0.15)',
                              border: '1px solid rgba(200, 150, 62, 0.4)',
                              color: '#c8963e',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              alignSelf: 'flex-start',
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Edit Profile</span>
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
                            <button
                              onClick={handleSaveProfile}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#22c55e',
                                border: 'none',
                                color: '#090d14',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Check size={13} />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingProfile(false);
                                setProfileForm({
                                  name: currentUser.name,
                                  role: currentUser.role,
                                  club: currentUser.club,
                                  email: currentUser.email,
                                  tactical_philosophy: currentUser.tactical_philosophy || 'Positional Play & Counter-Pressing',
                                  season_objective: currentUser.season_objective || 'Premier League Title & Top 4 Finish',
                                });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                              }}
                            >
                              <X size={13} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {profileSaveMsg && (
                      <div
                        style={{
                          marginBottom: '14px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          border: '1px solid #22c55e',
                          color: '#22c55e',
                          fontSize: '12.5px',
                          fontWeight: 600,
                        }}
                      >
                        {profileSaveMsg}
                      </div>
                    )}

                    {!isEditingProfile ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                        <div className="settings-field">
                          <span className="settings-label">Manager Name</span>
                          <div className="settings-value">{currentUser.name}</div>
                        </div>
                        <div className="settings-field">
                          <span className="settings-label">Role</span>
                          <div className="settings-value">{currentUser.role}</div>
                        </div>
                        <div className="settings-field">
                          <span className="settings-label">Managed Club</span>
                          <div className="settings-value">{currentUser.club}</div>
                        </div>
                        <div className="settings-field">
                          <span className="settings-label">Account Email</span>
                          <div className="settings-value">{currentUser.email}</div>
                        </div>
                        <div className="settings-field" style={{ gridColumn: 'span 2' }}>
                          <span className="settings-label">Tactical Philosophy</span>
                          <div className="settings-value">{currentUser.tactical_philosophy || 'Positional Play & Counter-Pressing'}</div>
                        </div>
                        <div className="settings-field" style={{ gridColumn: 'span 2' }}>
                          <span className="settings-label">Season Objective</span>
                          <div className="settings-value">{currentUser.season_objective || 'Premier League Title & Top 4 Finish'}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Manager Name</label>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Manager Role</label>
                          <input
                            type="text"
                            value={profileForm.role}
                            onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Managed Club</label>
                          <select
                            value={profileForm.club}
                            onChange={(e) => setProfileForm({ ...profileForm, club: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          >
                            {PREMIER_LEAGUE_CLUBS.map((club) => (
                              <option key={club} value={club}>{club}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Account Email</label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Tactical Philosophy</label>
                          <input
                            type="text"
                            value={profileForm.tactical_philosophy}
                            onChange={(e) => setProfileForm({ ...profileForm, tactical_philosophy: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Season Objective</label>
                          <input
                            type="text"
                            value={profileForm.season_objective}
                            onChange={(e) => setProfileForm({ ...profileForm, season_objective: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#161d2a',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#ffffff',
                              fontSize: '13.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Analysis & Normalization Standard */}
                  <div className="surface-panel">
                    <div className="surface-panel-header">
                      <div className="surface-panel-title">Analysis &amp; Normalization</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div className="settings-field">
                        <span className="settings-label">Comparison baseline</span>
                        <div className="settings-value">Per-90 minutes (Rule 10 standard)</div>
                      </div>
                      <div className="settings-field">
                        <span className="settings-label">Expected goals (xG) calibration</span>
                        <div className="settings-value">Spatial distance &amp; angle model</div>
                      </div>
                      <div className="settings-field">
                        <span className="settings-label">Visual framework</span>
                        <div className="settings-value">Mandatory 7-chart tactical suite</div>
                      </div>
                      <div className="settings-field">
                        <span className="settings-label">Persistence engine</span>
                        <div className="settings-value">Supabase PostgreSQL with SQLite fallback</div>
                      </div>
                    </div>
                  </div>

                  {/* My Club Surface Panel */}
                  <div className="surface-panel">
                    <div className="surface-panel-header">
                      <div className="surface-panel-title">My Club</div>
                      <div className="surface-panel-caption">Select managed squad and manage fixture calendar synchronization</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '13.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Managed Premier League Club:
                          </label>
                          <select
                            value={focusClub}
                            onChange={async (e) => {
                              const newClub = e.target.value;
                              setFocusClub(newClub);
                              const updatedUser = updateCurrentUserClub(newClub);
                              if (updatedUser) {
                                setCurrentUser(updatedUser);
                              }
                              try {
                                await setFocusTeam(newClub);
                                setClubMsg(`Saved focus club: ${newClub}`);
                                setTimeout(() => setClubMsg(''), 3000);
                              } catch {
                                setClubMsg('Failed to update focus club');
                              }
                            }}
                            style={{
                              background: '#161c26',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '7px 14px',
                              fontSize: '14.5px',
                            }}
                          >
                            {PREMIER_LEAGUE_CLUBS.map((club) => (
                              <option key={club} value={club}>
                                {club}
                              </option>
                            ))}
                          </select>
                        </div>

                        {clubMsg && (
                          <span style={{ fontSize: '13.5px', color: 'var(--accent-gold)' }}>
                            {clubMsg}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Fixture Allocation &amp; Sample Database Reseed
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Wipe local database and initialize all 380 fixtures with sample CSV matches.
                          </div>
                        </div>

                        <button
                          disabled={dbResetting}
                          onClick={async () => {
                            if (!window.confirm('Reset local database and reload 380 Premier League fixtures with sample matches?')) return;
                            setDbResetting(true);
                            setDbResetMsg('');
                            try {
                              const res = await resetDatabase(true, focusClub);
                              setDbResetMsg(`Database reset: ${res.fixtures_count} fixtures, ${res.matches_imported} matches reseeded.`);
                              setTimeout(() => setDbResetMsg(''), 4500);
                            } catch (err: any) {
                              setDbResetMsg(`Error: ${err.message}`);
                            } finally {
                              setDbResetting(false);
                            }
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            padding: '7px 16px',
                            borderRadius: '4px',
                            fontSize: '13.5px',
                            fontWeight: 500,
                            cursor: dbResetting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {dbResetting ? 'Resetting Database...' : 'Reset & Reseed Database'}
                        </button>
                      </div>

                      {dbResetMsg && (
                        <div style={{ fontSize: '13.5px', color: 'var(--accent-gold)', background: 'rgba(210, 174, 94, 0.1)', padding: '6px 10px', borderRadius: '4px' }}>
                          {dbResetMsg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
