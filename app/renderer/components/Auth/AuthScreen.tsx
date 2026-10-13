import React, { useState } from 'react';
import {
  ManagerUser,
  DEFAULT_TEST_ACCOUNT,
  loginManager,
  registerManager,
} from '../../services/auth';
import { setFocusTeam } from '../../services/api';
import {
  Shield,
  Mail,
  Lock,
  User,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle,
  Check,
  Compass,
  Sparkles,
} from 'lucide-react';
import './AuthScreen.css';
import { MicroSlats } from '../MicroSlats/MicroSlats';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface AuthScreenProps {
  onLoginSuccess: (user: ManagerUser) => void;
}

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

const ROLE_SUGGESTIONS = [
  'Head Coach & Tactical Analyst',
  'Director of Football',
  'First-Team Performance Analyst',
  'Chief Tactical Scout',
];

const OBJECTIVE_OPTIONS = [
  { value: 'Title Race', label: 'Premier League Title' },
  { value: 'Top 4 UCL', label: 'Top 4 & UCL' },
  { value: 'Europe', label: 'European Football' },
  { value: 'Build Stability', label: 'Squad Stability' },
];

const SHAPE_OPTIONS = [
  { value: '4-3-3 Holding', label: '4-3-3 Holding' },
  { value: '4-2-3-1 Double Pivot', label: '4-2-3-1 Pivot' },
  { value: '3-4-2-1 Asymmetric', label: '3-4-2-1 Box' },
  { value: '3-5-2 Wing-Backs', label: '3-5-2 Wings' },
];

const PHILOSOPHY_SUGGESTIONS = [
  'Positional Play & Transition Control',
  'High-Pressing Counter-Attack',
  'Direct Vertical Progression',
  'Compact Low-Block Counter',
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Step state for guided registration wizard (1: Identity, 2: Club & Role, 3: Tactical Blueprint)
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  // Step 1: Identity & Credentials
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Club & Authority
  const [regClub, setRegClub] = useState('Chelsea');
  const [regRole, setRegRole] = useState('Head Coach & Performance Analyst');
  const [regObjective, setRegObjective] = useState('Title Race');

  // Step 3: Tactical Blueprint
  const [regPreferredShape, setRegPreferredShape] = useState('4-3-3 Holding');
  const [regTacticalPhilosophy, setRegTacticalPhilosophy] = useState('Positional Play & Transition Control');

  // Error / status feedback & loading
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleFillTestCredentials = () => {
    setActiveTab('login');
    setLoginEmail(DEFAULT_TEST_ACCOUNT.email);
    setLoginPassword(DEFAULT_TEST_ACCOUNT.passwordHash);
    setErrorMessage(null);
    setSuccessMessage('Loaded test manager account credentials.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = loginManager(loginEmail, loginPassword, rememberMe);
    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      return;
    }

    onLoginSuccess(res.user);
  };

  // Step 1 validation
  const validateStep1 = (): boolean => {
    if (!regName.trim()) {
      setErrorMessage('Please enter your manager full name.');
      return false;
    }
    if (!regEmail.trim() || !regEmail.includes('@') || !regEmail.includes('.')) {
      setErrorMessage('Please provide a valid official manager email address.');
      return false;
    }
    if (regPassword.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return false;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password confirmation.');
      return false;
    }
    return true;
  };

  // Step 2 validation
  const validateStep2 = (): boolean => {
    if (!regClub) {
      setErrorMessage('Please select your managed Premier League club.');
      return false;
    }
    if (!regRole.trim()) {
      setErrorMessage('Please specify your managerial role.');
      return false;
    }
    return true;
  };

  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (validateStep1()) {
      setRegStep(2);
    }
  };

  const handleProceedToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (validateStep2()) {
      setRegStep(3);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateStep1() || !validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = registerManager({
        name: regName,
        email: regEmail,
        password: regPassword,
        club: regClub,
        role: regRole,
        tacticalPhilosophy: regTacticalPhilosophy,
        preferredShape: regPreferredShape,
        seasonObjective: regObjective,
      });

      if (!res.success || !res.user) {
        setErrorMessage(res.error || 'Registration failed.');
        setIsSubmitting(false);
        return;
      }

      // Synchronize backend focus team
      try {
        await setFocusTeam(regClub);
      } catch {
        // graceful offline fallback
      }

      setSuccessMessage(`Welcome, Manager ${res.user.name}. Tactical portal initialized.`);
      setTimeout(() => {
        onLoginSuccess(res.user!);
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-viewport">
      {/* Interactive MicroSlats Wave Background */}
      <div className="auth-microslats-bg" aria-hidden="true">
        <MicroSlats
          preset="swell"
          color="#c8963e"
          glintColor="#ffffff"
          backgroundColor="#080b11"
          slatWidth={10}
          slatHeight={25}
          gap={3}
          roundness={0.75}
          interactive={true}
          cursorStrength={1.2}
          cursorSize={45}
          swirl={0.2}
          trail={1.4}
          lean={0.15}
          intro={true}
        />
      </div>

      <div className="auth-card" style={{ maxWidth: activeTab === 'register' ? '540px' : '490px' }}>
        {/* Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <Shield size={14} color="var(--accent-gold)" />
            <span>Tactical Analyst</span>
          </div>
          <h1 className="auth-title">
            {activeTab === 'login' ? 'Manager Command Portal' : 'First-Time Manager Setup'}
          </h1>
          <p className="auth-subtitle">
            {activeTab === 'login'
              ? 'Sign in with managerial credentials to access tactical telemetry and squad telemetry.'
              : 'Complete your step-by-step manager setup to allocate your club, role, and tactical blueprint.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <JellyRadio
            size="md"
            items={[
              { value: 'login', label: 'Manager Sign In' },
              { value: 'register', label: 'Register Account' },
            ]}
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val as 'login' | 'register');
              setErrorMessage(null);
            }}
          />
        </div>

        {/* Status Messages */}
        {errorMessage && (
          <div className="auth-alert auth-alert-error" role="alert">
            <div className="auth-alert-icon">!</div>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert auth-alert-success" role="status">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── MODE 1: LOGIN FORM ────────────────────────────────────────── */}
        {activeTab === 'login' && (
          <>
            {/* Test Manager Account Helper Card */}
            <div className="auth-test-banner">
              <div className="auth-test-banner-header">
                <span className="auth-test-title">Preconfigured Test Account</span>
                <button
                  type="button"
                  className="auth-quick-fill-btn"
                  onClick={handleFillTestCredentials}
                >
                  Fill Test Credentials
                </button>
              </div>
              <div className="auth-test-details">
                <span>
                  Email: <code>{DEFAULT_TEST_ACCOUNT.email}</code>
                </span>
                <span>
                  Password: <code>{DEFAULT_TEST_ACCOUNT.passwordHash}</code>
                </span>
              </div>
            </div>

            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-email">
                  Manager Email
                </label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    className="auth-input"
                    placeholder="manager@tactical.fc"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">
                  Workstation Password
                </label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="auth-checkbox-row">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    className="auth-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me on this workstation</span>
                </label>
              </div>

              <button type="submit" className="auth-submit-btn">
                <span>Sign In as Manager</span>
                <ChevronRight size={16} />
              </button>
            </form>

            {/* Switch to Setup */}
            <div className="auth-switch-link-card">
              <span>First time on this workstation?</span>
              <button
                type="button"
                className="auth-switch-link-btn"
                onClick={() => {
                  setActiveTab('register');
                  setRegStep(1);
                  setErrorMessage(null);
                }}
              >
                Start Step-by-Step Manager Setup &rarr;
              </button>
            </div>
          </>
        )}

        {/* ── MODE 2: STEP-BY-STEP FIRST-TIME REGISTRATION WIZARD ───────── */}
        {activeTab === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Visual Stepper Track */}
            <div className="auth-stepper-track">
              <button
                type="button"
                className={`auth-step-node ${regStep === 1 ? 'active' : regStep > 1 ? 'completed' : ''}`}
                onClick={() => setRegStep(1)}
              >
                <div className="auth-step-bubble">
                  {regStep > 1 ? <Check size={14} /> : 1}
                </div>
                <span className="auth-step-label">Identity</span>
              </button>

              <div className={`auth-step-line ${regStep >= 2 ? 'active' : ''}`} />

              <button
                type="button"
                className={`auth-step-node ${regStep === 2 ? 'active' : regStep > 2 ? 'completed' : ''}`}
                onClick={() => {
                  if (validateStep1()) setRegStep(2);
                }}
              >
                <div className="auth-step-bubble">
                  {regStep > 2 ? <Check size={14} /> : 2}
                </div>
                <span className="auth-step-label">Club &amp; Role</span>
              </button>

              <div className={`auth-step-line ${regStep >= 3 ? 'active' : ''}`} />

              <button
                type="button"
                className={`auth-step-node ${regStep === 3 ? 'active' : ''}`}
                onClick={() => {
                  if (validateStep1() && validateStep2()) setRegStep(3);
                }}
              >
                <div className="auth-step-bubble">3</div>
                <span className="auth-step-label">Blueprint</span>
              </button>
            </div>

            {/* Guidance Header Banner */}
            <div className="auth-step-guidance">
              <div className="auth-step-guidance-title">
                {regStep === 1 && <User size={15} color="var(--accent-gold)" />}
                {regStep === 2 && <Shield size={15} color="var(--accent-gold)" />}
                {regStep === 3 && <Compass size={15} color="var(--accent-gold)" />}
                <span>
                  {regStep === 1 && 'Step 1: Manager Identity & Credentials'}
                  {regStep === 2 && 'Step 2: Club Allocation & Authority'}
                  {regStep === 3 && 'Step 3: Tactical Philosophy & Blueprint'}
                </span>
              </div>
              <span className="auth-step-guidance-counter">Step {regStep} of 3</span>
            </div>

            {/* ── STEP 1: IDENTITY & CREDENTIALS ────────────────────────── */}
            {regStep === 1 && (
              <form className="auth-form" onSubmit={handleProceedToStep2}>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-name">
                    Manager Full Name
                  </label>
                  <div className="auth-input-wrapper">
                    <User size={16} className="auth-input-icon" />
                    <input
                      id="reg-name"
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Pep Guardiola, Mikel Arteta, The Manager"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-email">
                    Official Manager Email
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      id="reg-email"
                      type="email"
                      className="auth-input"
                      placeholder="manager@tactical.fc"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-password">
                    Create Password (min 6 characters)
                  </label>
                  <div className="auth-input-wrapper">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      className="auth-input"
                      placeholder="Create workstation password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="auth-label" htmlFor="reg-confirm-password">
                      Confirm Password
                    </label>
                    {regConfirmPassword && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: regPassword === regConfirmPassword ? '#4ade80' : '#ef4444',
                        }}
                      >
                        {regPassword === regConfirmPassword ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    )}
                  </div>
                  <div className="auth-input-wrapper">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="auth-input"
                      placeholder="Confirm workstation password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="auth-stepper-actions">
                  <button type="submit" className="auth-next-btn">
                    <span>Continue to Club Allocation &amp; Role</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: CLUB ALLOCATION & AUTHORITY ───────────────────── */}
            {regStep === 2 && (
              <form className="auth-form" onSubmit={handleProceedToStep3}>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-club">
                    Managed Premier League Club
                  </label>
                  <div className="auth-input-wrapper">
                    <Shield size={16} className="auth-input-icon" />
                    <select
                      id="reg-club"
                      className="auth-select"
                      value={regClub}
                      onChange={(e) => setRegClub(e.target.value)}
                    >
                      {PREMIER_LEAGUE_CLUBS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 12px',
                      background: 'rgba(200, 150, 62, 0.08)',
                      border: '1px solid rgba(200, 150, 62, 0.22)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--accent-gold)',
                      marginTop: '4px',
                    }}
                  >
                    <Shield size={13} />
                    <span>
                      Allocating focus telemetry and calendar schedule for <strong>{regClub}</strong>
                    </span>
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg-role">
                    Managerial Title / Role
                  </label>
                  <div className="auth-input-wrapper">
                    <Briefcase size={16} className="auth-input-icon" />
                    <input
                      id="reg-role"
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Head Coach & Tactical Analyst"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      required
                    />
                  </div>
                  {/* Quick role suggestions */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {ROLE_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setRegRole(sug)}
                        style={{
                          background: regRole === sug ? 'rgba(200, 150, 62, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${regRole === sug ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.08)'}`,
                          color: regRole === sug ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: '11.5px',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          cursor: 'pointer',
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label">Primary Season Objective</label>
                  <JellyRadio
                    size="sm"
                    items={OBJECTIVE_OPTIONS}
                    value={regObjective}
                    onChange={(val) => setRegObjective(val)}
                  />
                </div>

                <div className="auth-stepper-actions">
                  <button
                    type="button"
                    className="auth-back-btn"
                    onClick={() => setRegStep(1)}
                  >
                    <ChevronLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button type="submit" className="auth-next-btn">
                    <span>Continue to Tactical Blueprint</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 3: TACTICAL PHILOSOPHY & BLUEPRINT ───────────────── */}
            {regStep === 3 && (
              <form className="auth-form" onSubmit={handleRegisterSubmit}>
                <div className="auth-field">
                  <label className="auth-label">Preferred Tactical System</label>
                  <JellyRadio
                    size="sm"
                    items={SHAPE_OPTIONS}
                    value={regPreferredShape}
                    onChange={(val) => setRegPreferredShape(val)}
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label">Core Tactical Identity</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {PHILOSOPHY_SUGGESTIONS.map((phil) => {
                      const isSel = regTacticalPhilosophy === phil;
                      return (
                        <button
                          key={phil}
                          type="button"
                          onClick={() => setRegTacticalPhilosophy(phil)}
                          className={`auth-chip-option ${isSel ? 'active' : ''}`}
                        >
                          <Compass size={13} color={isSel ? 'var(--accent-gold)' : 'var(--text-muted)'} />
                          <span>{phil}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tactical Blueprint Summary Card */}
                <div className="auth-blueprint-card">
                  <div className="auth-blueprint-header">
                    <div className="auth-blueprint-title">
                      <Sparkles size={14} />
                      <span>Managerial Blueprint Summary</span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#4ade80',
                        background: 'rgba(74, 222, 128, 0.15)',
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontWeight: 600,
                      }}
                    >
                      Ready to Initialize
                    </span>
                  </div>

                  <div className="auth-blueprint-grid">
                    <div className="auth-blueprint-item">
                      <span className="auth-blueprint-label">Manager</span>
                      <span className="auth-blueprint-val">{regName || 'The Manager'}</span>
                    </div>
                    <div className="auth-blueprint-item">
                      <span className="auth-blueprint-label">Club</span>
                      <span className="auth-blueprint-val" style={{ color: 'var(--accent-gold)' }}>
                        {regClub}
                      </span>
                    </div>
                    <div className="auth-blueprint-item">
                      <span className="auth-blueprint-label">Role</span>
                      <span className="auth-blueprint-val">{regRole}</span>
                    </div>
                    <div className="auth-blueprint-item">
                      <span className="auth-blueprint-label">Formation</span>
                      <span className="auth-blueprint-val">{regPreferredShape}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                    }}
                  >
                    <span className="auth-blueprint-label">Philosophy &amp; Directive</span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {regTacticalPhilosophy} &bull; {regObjective}
                    </span>
                  </div>
                </div>

                <div className="auth-stepper-actions">
                  <button
                    type="button"
                    className="auth-back-btn"
                    onClick={() => setRegStep(2)}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    className="auth-next-btn"
                    disabled={isSubmitting}
                  >
                    <Shield size={16} />
                    <span>{isSubmitting ? 'Initializing Portal...' : 'Complete Setup & Enter Dashboard'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Switch to Sign In */}
            <div className="auth-switch-link-card">
              <span>Already have manager credentials?</span>
              <button
                type="button"
                className="auth-switch-link-btn"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage(null);
                }}
              >
                Sign In Instead
              </button>
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="auth-footer-note">
          Desktop local authentication session. Encrypted credentials stored securely in workstation application storage.
        </div>
      </div>
    </div>
  );
};
