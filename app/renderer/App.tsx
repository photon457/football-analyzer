import React, { useState, useEffect } from 'react';
import {
  Menu,
  Calendar,
  Layers,
  Sliders,
  Users,
  HelpCircle,
  LogOut,
  UserCheck,
  LayoutDashboard,
  Shield,
  Target,
} from 'lucide-react';
import {
  checkBackendHealth,
  HealthResponse,
  fetchFocusTeam,
  setFocusTeam,
  resetDatabase,
} from './services/api';
import ProfileCard from './components/ProfileCard/ProfileCard';
import managerAvatar from './assets/manager-avatar.jpg';
import { ManagerDashboard } from './components/ManagerDashboard/ManagerDashboard';
import { MatchUpload } from './components/MatchUpload/MatchUpload';
import { MatchHistory } from './components/MatchHistory/MatchHistory';
import { MyTeam } from './components/MyTeam/MyTeam';
import { SeasonCalendar } from './components/SeasonCalendar/SeasonCalendar';
import { AuthScreen } from './components/Auth/AuthScreen';
import { TacticSetter } from './components/TacticSetter/TacticSetter';
import { OpponentTactics } from './components/OpponentTactics/OpponentTactics';
import {
  ManagerUser,
  getStoredSession,
  logoutManager,
  updateCurrentUserClub,
} from './services/auth';

type NavTab = 'dashboard' | 'tactics' | 'opponents' | 'squad' | 'calendar' | 'journal' | 'import' | 'settings';

const TAB_LABELS: Record<NavTab, string> = {
  dashboard: 'Matches',
  tactics: 'Tactic Setter',
  opponents: 'Opponents Tactics',
  squad: 'My Team',
  calendar: 'Season Calendar',
  journal: 'Player Details',
  import: 'Import',
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
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [focusClub, setFocusClub] = useState<string>(() => currentUser?.club || 'Chelsea');
  const [clubMsg, setClubMsg] = useState<string>('');
  const [dbResetting, setDbResetting] = useState<boolean>(false);
  const [dbResetMsg, setDbResetMsg] = useState<string>('');

  useEffect(() => {
    if (currentUser?.club) {
      setFocusClub(currentUser.club);
      setFocusTeam(currentUser.club).catch(() => {});
    } else {
      fetchFocusTeam().then(setFocusClub).catch(() => {});
    }
  }, [currentUser]);

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

  return (
    <div className="entry-window">
      {/* Top App Header — matches reference exactly */}
      <header className="nav-header">
        {/* Left: Hamburger + Nav Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d1d5db',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
            title="Menu"
          >
            <Menu size={18} />
          </button>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {(['dashboard', 'tactics', 'opponents', 'squad', 'calendar', 'journal', 'import', 'settings'] as const).map((tab) => {
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

        {/* Center: TACTICAL ANALYST — exact reference style */}
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

        {/* Right: Manager profile badge + Import button + Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px 4px 6px',
              background: '#121620',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '9999px',
            }}
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
            onClick={() => setActiveTab('import')}
            style={{
              background: 'rgba(200, 150, 62, 0.15)',
              border: '1px solid rgba(200, 150, 62, 0.4)',
              color: '#c8963e',
              borderRadius: '9999px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>+ Import Match</span>
          </button>

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
              title="Opponents Tactics & Opposition Scouting"
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
              className={`rail-btn ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
              title="Import Match"
            >
              <Layers size={18} />
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
            <button className="rail-btn" title="Help & Docs" onClick={() => setActiveTab('settings')}>
              <HelpCircle size={17} />
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
              onNavigateToUpload={() => setActiveTab('import')}
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
                onNavigateToUpload={() => setActiveTab('import')}
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

          {activeTab === 'import' && (
            <div style={{ padding: '24px 28px' }}>
              <MatchUpload
                onImportSuccess={(matchId) => {
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
                <h1 className="page-title">Manager settings</h1>
                <p className="page-description">
                  Tactical credentials, analytical normalization standards, and backend integration status.
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
                  contactText="Settings"
                  avatarUrl={managerAvatar}
                  showUserInfo={true}
                  enableTilt={true}
                  enableMobileTilt={false}
                  behindGlowEnabled={false}
                  onContactClick={() => {}}
                />
              </div>

              {/* Settings Configuration Panels */}
              <div className="settings-group">
                <div className="surface-panel">
                  <div className="surface-panel-header">
                    <div className="surface-panel-title">Tactical profile</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                    <div className="settings-field">
                      <span className="settings-label">Manager</span>
                      <div className="settings-value">{currentUser.name}</div>
                    </div>
                    <div className="settings-field">
                      <span className="settings-label">Role</span>
                      <div className="settings-value">{currentUser.role}</div>
                    </div>
                    <div className="settings-field">
                      <span className="settings-label">Managed club</span>
                      <div className="settings-value">{currentUser.club}</div>
                    </div>
                    <div className="settings-field">
                      <span className="settings-label">Account email</span>
                      <div className="settings-value">{currentUser.email}</div>
                    </div>
                  </div>
                </div>

                <div className="surface-panel">
                  <div className="surface-panel-header">
                    <div className="surface-panel-title">Analysis &amp; normalization</div>
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
                      <div className="settings-value">Mandatory 7-chart D3 suite</div>
                    </div>
                    <div className="settings-field">
                      <span className="settings-label">Persistence engine</span>
                      <div className="settings-value">Supabase PostgreSQL with SQLite fallback</div>
                    </div>
                  </div>
                </div>

                <div className="surface-panel">
                  <div className="surface-panel-header">
                    <div className="surface-panel-title">Club focus &amp; season fixtures</div>
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

                <div className="surface-panel">
                  <div className="surface-panel-header">
                    <div className="surface-panel-title">System runtime</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Python analysis engine</span>
                      <span style={{ color: backendHealth?.status === 'ok' ? '#4ade80' : '#f59e0b', fontWeight: '500' }}>
                        {backendHealth ? `Online (v${backendHealth.version})` : 'Offline'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Desktop application shell</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>Electron 34 + React 18</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Data visualization runtime</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>D3.js v7 SVG engine</span>
                    </div>
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
