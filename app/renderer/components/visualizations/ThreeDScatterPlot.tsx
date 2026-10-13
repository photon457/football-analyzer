import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlayerStats } from '../../services/api';

interface ThreeDScatterPlotProps {
  players: PlayerStats[];
  height?: number;
}

type MetricKey =
  | 'goals'
  | 'assists'
  | 'shots_total'
  | 'passes_completed'
  | 'pass_accuracy_pct'
  | 'tackles_won'
  | 'interceptions'
  | 'minutes_played'
  | 'xg'
  | 'contribution_score';

interface MetricOption {
  key: MetricKey;
  label: string;
  category: 'Attacking' | 'Passing' | 'Defending' | 'General';
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'xg', label: 'Expected Goals (xG)', category: 'Attacking' },
  { key: 'goals', label: 'Goals Scored', category: 'Attacking' },
  { key: 'shots_total', label: 'Shots Total', category: 'Attacking' },
  { key: 'passes_completed', label: 'Passes Completed', category: 'Passing' },
  { key: 'pass_accuracy_pct', label: 'Pass Accuracy (%)', category: 'Passing' },
  { key: 'assists', label: 'Assists', category: 'Passing' },
  { key: 'tackles_won', label: 'Tackles Won', category: 'Defending' },
  { key: 'interceptions', label: 'Interceptions', category: 'Defending' },
  { key: 'minutes_played', label: 'Minutes Played', category: 'General' },
  { key: 'contribution_score', label: 'Contribution Score', category: 'General' },
];

const POSITION_COLORS: Record<string, string> = {
  FW: '#EF4444', // Red
  MF: '#D2AE5E', // Gold
  DF: '#38BDF8', // Cyan Blue
  GK: '#10B981', // Green
};

export const ThreeDScatterPlot: React.FC<ThreeDScatterPlotProps> = ({
  players,
  height = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [xMetric, setXMetric] = useState<MetricKey>('xg');
  const [yMetric, setYMetric] = useState<MetricKey>('passes_completed');
  const [zMetric, setZMetric] = useState<MetricKey>('tackles_won');
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerStats | null>(null);

  // Extract metric value for a player
  const getVal = (p: PlayerStats, m: MetricKey): number => {
    if (m === 'xg') {
      return typeof p.metrics?.xg === 'number' ? p.metrics.xg : (p.goals * 0.45 + p.shots_total * 0.08);
    }
    if (m === 'pass_accuracy_pct') {
      return p.rates?.pass_accuracy_pct ?? (p.passes_attempted > 0 ? (p.passes_completed / p.passes_attempted) * 100 : 80);
    }
    if (m === 'contribution_score') {
      return p.goals * 3 + p.assists * 2 + p.shots_total * 0.5 + p.tackles_won * 1.2 + p.interceptions * 1;
    }
    return (p as any)[m] ?? 0;
  };

  // Min and Max for each axis
  const bounds = useMemo(() => {
    if (players.length === 0) {
      return { x: { min: 0, max: 1 }, y: { min: 0, max: 1 }, z: { min: 0, max: 1 } };
    }
    const xVals = players.map((p) => getVal(p, xMetric));
    const yVals = players.map((p) => getVal(p, yMetric));
    const zVals = players.map((p) => getVal(p, zMetric));

    return {
      x: { min: 0, max: Math.max(1, Math.max(...xVals)) },
      y: { min: 0, max: Math.max(1, Math.max(...yVals)) },
      z: { min: 0, max: Math.max(1, Math.max(...zVals)) },
    };
  }, [players, xMetric, yMetric, zMetric]);

  // Apply Presets
  const applyPreset = (preset: 'attack_create_defend' | 'accuracy_volume_defense' | 'goals_creation_minutes') => {
    if (preset === 'attack_create_defend') {
      setXMetric('xg');
      setYMetric('passes_completed');
      setZMetric('tackles_won');
    } else if (preset === 'accuracy_volume_defense') {
      setXMetric('pass_accuracy_pct');
      setYMetric('passes_completed');
      setZMetric('interceptions');
    } else {
      setXMetric('goals');
      setYMetric('assists');
      setZMetric('minutes_played');
    }
  };

  useEffect(() => {
    if (!containerRef.current || players.length === 0) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const rect = container.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || container.clientWidth || 800));
    const curHeight = height;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    const camera = new THREE.PerspectiveCamera(45, width / curHeight, 0.5, 500);
    camera.position.set(48, 38, 48);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, curHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.maxWidth = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.maxDistance = 150;
    controls.minDistance = 15;
    controls.update();

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 40, 20);
    scene.add(dirLight);

    // 3. 3D Bounding Box Cage & Grid Planes (box size: 30 x 30 x 30 centered)
    const boxSize = 30;
    const half = boxSize / 2;

    // Floor grid (X-Z plane at Y = -half)
    const floorGrid = new THREE.GridHelper(boxSize, 10, 0xd2ae5e, 0x222a38);
    floorGrid.position.set(0, -half, 0);
    scene.add(floorGrid);

    // Back wall grid (X-Y plane at Z = -half)
    const backGrid = new THREE.GridHelper(boxSize, 10, 0x38bdf8, 0x222a38);
    backGrid.rotation.x = Math.PI / 2;
    backGrid.position.set(0, 0, -half);
    scene.add(backGrid);

    // Side wall grid (Y-Z plane at X = -half)
    const sideGrid = new THREE.GridHelper(boxSize, 10, 0xef4444, 0x222a38);
    sideGrid.rotation.z = Math.PI / 2;
    sideGrid.position.set(-half, 0, 0);
    scene.add(sideGrid);

    // Bounding Box Frame
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const boxFrame = new THREE.LineSegments(boxEdges, boxLineMat);
    scene.add(boxFrame);

    // 4. Map Players to 3D Coordinates [-half, half]
    const clickableSpheres: THREE.Object3D[] = [];

    players.forEach((p) => {
      const rawX = getVal(p, xMetric);
      const rawY = getVal(p, yMetric);
      const rawZ = getVal(p, zMetric);

      // Normalize to [-half + 1, half - 1]
      const nx = bounds.x.max > bounds.x.min ? (rawX - bounds.x.min) / (bounds.x.max - bounds.x.min) : 0.5;
      const ny = bounds.y.max > bounds.y.min ? (rawY - bounds.y.min) / (bounds.y.max - bounds.y.min) : 0.5;
      const nz = bounds.z.max > bounds.z.min ? (rawZ - bounds.z.min) / (bounds.z.max - bounds.z.min) : 0.5;

      const posX = -half + nx * (boxSize - 2) + 1;
      const posY = -half + ny * (boxSize - 2) + 1;
      const posZ = -half + nz * (boxSize - 2) + 1;

      const colorHex = POSITION_COLORS[p.primary_position] || '#D2AE5E';
      const radius = 0.6 + Math.min(0.8, (p.minutes_played / 90) * 0.7);

      // 3D Sphere
      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        metalness: 0.2,
        roughness: 0.3,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: 0.25,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(posX, posY, posZ);
      (sphere as any).userData = { player: p, rawX, rawY, rawZ };
      scene.add(sphere);
      clickableSpheres.push(sphere);

      // 3D Vertical Stem Drop-Line down to floor (Y = -half)
      const stemGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(posX, posY, posZ),
        new THREE.Vector3(posX, -half, posZ),
      ]);
      const stemMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.35,
      });
      const stemLine = new THREE.Line(stemGeo, stemMat);
      scene.add(stemLine);

      // Shadow projection disc on ground
      const shadowDiscGeo = new THREE.CircleGeometry(radius * 0.8, 16);
      const shadowDiscMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.set(posX, -half + 0.02, posZ);
      scene.add(shadowDisc);
    });

    // 5. Raycasting for hover & interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableSpheres);

      if (intersects.length > 0) {
        const found = intersects[0].object as any;
        if (found.userData && found.userData.player) {
          setHoveredPlayer(found.userData.player);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredPlayer(null);
        renderer.domElement.style.cursor = 'default';
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // 6. Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const newW = containerRef.current.clientWidth;
      camera.aspect = newW / curHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, curHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [players, xMetric, yMetric, zMetric, bounds, height]);

  const xLabel = METRIC_OPTIONS.find((m) => m.key === xMetric)?.label || xMetric;
  const yLabel = METRIC_OPTIONS.find((m) => m.key === yMetric)?.label || yMetric;
  const zLabel = METRIC_OPTIONS.find((m) => m.key === zMetric)?.label || zMetric;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Header & Description */}
      <div
        style={{
          background: 'linear-gradient(180deg, #161c26 0%, #10151d 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '16.5px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>3D Multivariate Squad Feature Space (Cluster Scatter Plot)</span>
            <span
              style={{
                fontSize: '12.5px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              Data Science 3D
            </span>
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Interactive 3-axis orthogonal statistical feature space with vertical ground stems and position clustering.
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => applyPreset('attack_create_defend')}
            style={{
              background: 'rgba(210, 174, 94, 0.15)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12.5px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            xG vs Passes vs Tackles
          </button>
          <button
            onClick={() => applyPreset('accuracy_volume_defense')}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12.5px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Accuracy % vs Volume vs Interceptions
          </button>
          <button
            onClick={() => applyPreset('goals_creation_minutes')}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12.5px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Goals vs Assists vs Minutes
          </button>
        </div>
      </div>

      {/* Axis Configuration Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          background: '#121722',
          padding: '12px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div>
          <label style={{ fontSize: '13px', color: '#EF4444', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            X-Axis (Width / Base):
          </label>
          <select
            value={xMetric}
            onChange={(e) => setXMetric(e.target.value as MetricKey)}
            style={{ width: '100%', background: '#1a2230', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', borderRadius: '4px', padding: '6px 10px', fontSize: '13px' }}
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '13px', color: '#10B981', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Y-Axis (Height / Elevation):
          </label>
          <select
            value={yMetric}
            onChange={(e) => setYMetric(e.target.value as MetricKey)}
            style={{ width: '100%', background: '#1a2230', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', borderRadius: '4px', padding: '6px 10px', fontSize: '13px' }}
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '13px', color: '#38BDF8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Z-Axis (Depth):
          </label>
          <select
            value={zMetric}
            onChange={(e) => setZMetric(e.target.value as MetricKey)}
            style={{ width: '100%', background: '#1a2230', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF', borderRadius: '4px', padding: '6px 10px', fontSize: '13px' }}
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px`, borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Active 3D Orthogonal Axes HUD Indicator */}
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            background: 'rgba(10, 13, 20, 0.90)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '6px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            fontSize: '13px',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#EF4444', fontWeight: 700, width: '48px' }}>X-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{xLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10B981', fontWeight: 700, width: '48px' }}>Y-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{yLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38BDF8', fontWeight: 700, width: '48px' }}>Z-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{zLabel}</span>
          </div>
        </div>

        {/* Legend Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '14px',
            background: 'rgba(10, 13, 20, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            padding: '8px 14px',
            display: 'flex',
            gap: '14px',
            fontSize: '12.5px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: POSITION_COLORS.FW }} />
            <span style={{ color: '#FFFFFF' }}>Forwards (FW)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: POSITION_COLORS.MF }} />
            <span style={{ color: '#FFFFFF' }}>Midfielders (MF)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: POSITION_COLORS.DF }} />
            <span style={{ color: '#FFFFFF' }}>Defenders (DF)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: POSITION_COLORS.GK }} />
            <span style={{ color: '#FFFFFF' }}>Goalkeepers (GK)</span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
            Drag left click to rotate &bull; Scroll to zoom
          </div>
        </div>

        {/* Hovered Player Tooltip Card */}
        {hoveredPlayer && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'rgba(14, 20, 30, 0.94)',
              border: `1px solid ${POSITION_COLORS[hoveredPlayer.primary_position] || '#d2ae5e'}`,
              borderRadius: '6px',
              padding: '12px 16px',
              minWidth: '220px',
              pointerEvents: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#FFFFFF' }}>{hoveredPlayer.player_name}</span>
              <span
                style={{
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  color: POSITION_COLORS[hoveredPlayer.primary_position] || '#ffffff',
                  fontWeight: 600,
                }}
              >
                {hoveredPlayer.primary_position}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#EF4444' }}>{xLabel}:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {typeof getVal(hoveredPlayer, xMetric) === 'number' && getVal(hoveredPlayer, xMetric) % 1 !== 0
                    ? getVal(hoveredPlayer, xMetric).toFixed(2)
                    : getVal(hoveredPlayer, xMetric)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#10B981' }}>{yLabel}:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {typeof getVal(hoveredPlayer, yMetric) === 'number' && getVal(hoveredPlayer, yMetric) % 1 !== 0
                    ? getVal(hoveredPlayer, yMetric).toFixed(2)
                    : getVal(hoveredPlayer, yMetric)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#38BDF8' }}>{zLabel}:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {typeof getVal(hoveredPlayer, zMetric) === 'number' && getVal(hoveredPlayer, zMetric) % 1 !== 0
                    ? getVal(hoveredPlayer, zMetric).toFixed(2)
                    : getVal(hoveredPlayer, zMetric)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Minutes:</span>
                <span style={{ color: '#FFFFFF' }}>{hoveredPlayer.minutes_played}'</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
