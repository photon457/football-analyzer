import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpatialEvent } from '../../services/api';

interface ThreeDPitchSurfaceProps {
  events: SpatialEvent[];
  height?: number;
}

export const ThreeDPitchSurface: React.FC<ThreeDPitchSurfaceProps> = ({
  events,
  height = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [actionFilter, setActionFilter] = useState<'all' | 'possession' | 'defensive'>('all');
  const [elevationScale, setElevationScale] = useState<number>(1.8);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);

  // Filter events based on action type
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (actionFilter === 'possession') {
        return ev.event_type === 'pass' || ev.event_type === 'shot' || ev.event_type === 'touch';
      }
      if (actionFilter === 'defensive') {
        return ev.event_type === 'tackle' || ev.event_type === 'interception' || ev.event_type === 'clearance' || ev.event_type === 'save';
      }
      return true;
    });
  }, [events, actionFilter]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const rect = container.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || container.clientWidth || 800));
    const curHeight = height;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    const camera = new THREE.PerspectiveCamera(45, width / curHeight, 0.5, 500);
    camera.position.set(0, 55, 65);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, curHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.maxWidth = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 4, 0);
    controls.update();

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 60, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const goldPoint = new THREE.PointLight(0xd2ae5e, 1.5, 90);
    goldPoint.position.set(0, 20, 0);
    scene.add(goldPoint);

    // 3. Flat Pitch Ground with Tactical Markings
    const pitchWidth = 84;
    const pitchLength = 54;

    const basePitchGeo = new THREE.PlaneGeometry(pitchWidth, pitchLength);
    const basePitchMat = new THREE.MeshStandardMaterial({
      color: 0x0c111a,
      roughness: 0.9,
    });
    const basePitch = new THREE.Mesh(basePitchGeo, basePitchMat);
    basePitch.rotation.x = -Math.PI / 2;
    basePitch.position.y = 0;
    scene.add(basePitch);

    // Pitch Line Helper
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const addPitchLine = (pts: [number, number, number][]) => {
      const geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      );
      scene.add(new THREE.Line(geo, lineMat));
    };

    const halfW = pitchWidth / 2;
    const halfL = pitchLength / 2;
    // Outer boundary
    addPitchLine([[-halfW, 0.02, -halfL], [halfW, 0.02, -halfL]]);
    addPitchLine([[halfW, 0.02, -halfL], [halfW, 0.02, halfL]]);
    addPitchLine([[halfW, 0.02, halfL], [-halfW, 0.02, halfL]]);
    addPitchLine([[-halfW, 0.02, halfL], [-halfW, 0.02, -halfL]]);
    // Halfway line
    addPitchLine([[0, 0.02, -halfL], [0, 0.02, halfL]]);

    // Penalty boxes
    const boxW = 16.5 * (pitchWidth / 105);
    const boxL = 40.3 * (pitchLength / 68);
    // Left penalty box
    addPitchLine([[-halfW, 0.02, -boxL / 2], [-halfW + boxW, 0.02, -boxL / 2]]);
    addPitchLine([[-halfW + boxW, 0.02, -boxL / 2], [-halfW + boxW, 0.02, boxL / 2]]);
    addPitchLine([[-halfW + boxW, 0.02, boxL / 2], [-halfW, 0.02, boxL / 2]]);
    // Right penalty box
    addPitchLine([[halfW, 0.02, -boxL / 2], [halfW - boxW, 0.02, -boxL / 2]]);
    addPitchLine([[halfW - boxW, 0.02, -boxL / 2], [halfW - boxW, 0.02, boxL / 2]]);
    addPitchLine([[halfW - boxW, 0.02, boxL / 2], [halfW, 0.02, boxL / 2]]);

    // Center circle
    const circlePts: [number, number, number][] = [];
    const radius = 9.15 * (pitchWidth / 105);
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 16) {
      circlePts.push([Math.cos(a) * radius, 0.02, Math.sin(a) * radius]);
    }
    addPitchLine(circlePts);

    // 4. Compute 3D Topographic Elevation Surface
    const segX = 46;
    const segY = 30;
    const surfaceGeo = new THREE.PlaneGeometry(pitchWidth, pitchLength, segX, segY);
    surfaceGeo.rotateX(-Math.PI / 2);

    const posAttr = surfaceGeo.attributes.position;
    const vertexCount = posAttr.count;

    // Density calculation: 2D Gaussian Kernel Density Estimation (KDE)
    const bandwidth = 10.0;
    const twoSig2 = 2 * bandwidth * bandwidth;

    // Extract event coordinates scaled to pitchWidth and pitchLength
    const pts = filteredEvents.map((ev) => ({
      x: ((ev.x - 50) / 100) * pitchWidth,
      z: ((ev.y - 50) / 100) * pitchLength,
    }));

    const colors = new Float32Array(vertexCount * 3);
    let maxDensity = 0.0001;
    const densities = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      let d = 0;
      for (let j = 0; j < pts.length; j++) {
        const dx = vx - pts[j].x;
        const dz = vz - pts[j].z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < 450) {
          d += Math.exp(-dist2 / twoSig2);
        }
      }
      densities[i] = d;
      if (d > maxDensity) maxDensity = d;
    }

    // Apply Elevation and Color Gradient
    for (let i = 0; i < vertexCount; i++) {
      const normD = densities[i] / maxDensity;
      const elev = normD * 10.0 * elevationScale;
      posAttr.setY(i, Math.max(0.04, elev));

      // Color mapping:
      // normD 0 -> Dark navy (#0b1424: 0.04, 0.08, 0.14)
      // normD 0.5 -> Amber Gold (#d2ae5e: 0.82, 0.68, 0.37)
      // normD 1.0 -> Emerald Green (#10b981: 0.06, 0.72, 0.50)
      let r = 0.06 + normD * 0.76;
      let g = 0.10 + normD * 0.62;
      let b = 0.18 + (1 - normD) * 0.22;

      if (normD > 0.6) {
        r = 0.82 - (normD - 0.6) * 1.5;
        g = 0.68 + (normD - 0.6) * 0.2;
        b = 0.37 - (normD - 0.6) * 0.5;
      }

      colors[i * 3] = Math.min(1, Math.max(0, r));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, g));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, b));
    }

    surfaceGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    surfaceGeo.computeVertexNormals();

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.2,
      wireframe: wireframeMode,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });

    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    scene.add(surfaceMesh);

    // 5. Animation loop
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
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [filteredEvents, elevationScale, wireframeMode, height]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Top Header */}
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
            <span>3D Tactical Pitch Control &amp; Pressing Intensity Topography</span>
            <span
              style={{
                fontSize: '12.5px',
                background: 'rgba(210, 174, 94, 0.2)',
                color: 'var(--accent-gold)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              Surface KDE
            </span>
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            2D Gaussian Kernel Density Estimation $Z = f(X,Y)$ elevated into a 3D topographic relief terrain showing territorial dominance hubs.
          </div>
        </div>

        {/* Action Type Filter Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'possession', 'defensive'] as const).map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              style={{
                background: actionFilter === act ? 'rgba(210, 174, 94, 0.2)' : 'transparent',
                border: `1px solid ${actionFilter === act ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.12)'}`,
                color: actionFilter === act ? '#FFFFFF' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {act === 'all' ? 'All Activity' : act === 'possession' ? 'In Possession' : 'Defensive Pressing'}
            </button>
          ))}
        </div>
      </div>

      {/* Control Sliders & Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: '#121722',
          padding: '10px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Elevation Scale */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Surface Elevation:</span>
          <input
            type="range"
            min="0.5"
            max="3.5"
            step="0.1"
            value={elevationScale}
            onChange={(e) => setElevationScale(parseFloat(e.target.value))}
            style={{ width: '130px', accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13.5px', color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
            {elevationScale.toFixed(1)}x
          </span>
        </div>

        {/* Wireframe Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={wireframeMode}
              onChange={(e) => setWireframeMode(e.target.checked)}
              style={{ accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
            />
            <span>Wireframe Mesh Mode</span>
          </label>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px`, borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Active 3D Pitch Coordinate Axes HUD Indicator */}
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
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Pitch Length (0m Defending &rarr; 105m Attacking Goal)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10B981', fontWeight: 700, width: '48px' }}>Y-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Topographic Elevation Z (KDE Dominance Intensity)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38BDF8', fontWeight: 700, width: '48px' }}>Z-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Pitch Width (0m Left Touchline &rarr; 68m Right Touchline)</span>
          </div>
        </div>

        {/* Topographic Legend */}
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
            alignItems: 'center',
            gap: '12px',
            fontSize: '12.5px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Topographic Activity Relief:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '8px', background: '#0c111a', borderRadius: '2px', border: '1px solid #334155' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Low (Valleys)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '8px', background: '#d2ae5e', borderRadius: '2px' }} />
            <span style={{ color: 'var(--accent-gold)' }}>Mid Dominance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '8px', background: '#10b981', borderRadius: '2px' }} />
            <span style={{ color: '#4ade80' }}>Peak Tactical Hub</span>
          </div>
        </div>
      </div>
    </div>
  );
};
