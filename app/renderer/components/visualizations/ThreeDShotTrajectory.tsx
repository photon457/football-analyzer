import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpatialEvent, PlayerStats } from '../../services/api';

interface ThreeDShotTrajectoryProps {
  events: SpatialEvent[];
  players: PlayerStats[];
  height?: number;
}

interface Shot3DData {
  id: string;
  player_id: string;
  playerName: string;
  minute: number;
  x: number;
  y: number;
  xg: number;
  result: 'goal' | 'saved' | 'miss' | 'blocked';
  bodyPart: string;
  distance: number;
  apexHeight: number;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  controlPoint: THREE.Vector3;
  color: string;
}

export const ThreeDShotTrajectory: React.FC<ThreeDShotTrajectoryProps> = ({
  events,
  players,
  height = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterPlayer, setFilterPlayer] = useState<string>('all');
  const [cameraPreset, setCameraPreset] = useState<'manager' | 'behind_goal' | 'overhead'>('manager');
  const [selectedShot, setSelectedShot] = useState<Shot3DData | null>(null);

  // Player lookup map
  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    players.forEach((p) => map.set(p.player_id, p));
    return map;
  }, [players]);

  // Extract and compute 3D shot coordinates
  // Pitch is 105m long x 68m wide.
  // We model attacking half: X from 0 (halfway line) to 52.5m (goal line).
  // Y from -34m to +34m (width, centered at 0).
  // Goal is at X = 52.5m, centered Y = 0, Width = 7.32m, Height = 2.44m.
  const shotDataList: Shot3DData[] = useMemo(() => {
    const shotEvents = events.filter((e) => e.event_type === 'shot');
    if (shotEvents.length === 0) return [];

    return shotEvents.map((ev, idx) => {
      const pid = ev.player_id;
      const p = playerMap.get(pid);
      const pName = p ? p.player_name : `Player ${pid}`;
      const meta = ev.metadata || {};
      const res = (meta.shot_result || (ev.outcome === 'successful' ? 'goal' : 'miss')) as 'goal' | 'saved' | 'miss' | 'blocked';
      const xg = typeof meta.xg === 'number' ? meta.xg : (res === 'goal' ? 0.35 : 0.12);
      const bodyPart = meta.body_part || 'right_foot';

      // Map pitch coords 0-100 to 3D world meters:
      // X: [50, 100] -> [0, 52.5]
      // Y: [0, 100] -> [-34, 34]
      const originX = ((ev.x - 50) / 50) * 52.5;
      const originY = ((ev.y - 50) / 50) * 34.0;
      const originZ = 0.1; // on pitch turf

      // Destination at goal mouth (X = 52.5)
      let targetX = 52.5;
      let targetY = 0;
      let targetZ = 1.0;

      const seed = idx * 17;
      const rng1 = Math.sin(seed) * 0.5 + 0.5;
      const rng2 = Math.cos(seed) * 0.5 + 0.5;

      if (res === 'goal') {
        // Inside 7.32m width (-3.4 to 3.4), height (0.2 to 2.3m)
        targetY = (rng1 - 0.5) * 6.8;
        targetZ = 0.3 + rng2 * 1.9;
      } else if (res === 'saved') {
        // Saved by keeper near frame
        targetY = (rng1 - 0.5) * 5.5;
        targetZ = 0.4 + rng2 * 1.6;
      } else if (res === 'blocked') {
        // Blocked midway by defender
        targetX = originX + (52.5 - originX) * 0.35;
        targetY = originY + (0 - originY) * 0.35;
        targetZ = 0.6;
      } else {
        // Miss: wide or high
        if (rng1 > 0.5) {
          targetY = rng2 > 0.5 ? 4.2 + rng1 * 3.0 : -4.2 - rng1 * 3.0; // wide
          targetZ = 0.5 + rng2 * 2.0;
        } else {
          targetY = (rng2 - 0.5) * 6.0;
          targetZ = 2.6 + rng1 * 2.2; // over crossbar
        }
      }

      // Parabolic apex height
      const dx = targetX - originX;
      const dy = targetY - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const apexZ = Math.max(targetZ + 0.5, 1.2 + (dist / 30) * 2.2);

      const controlX = originX + dx * 0.5;
      const controlY = originY + dy * 0.5;
      const controlZ = apexZ;

      // Color coding by outcome
      let color = '#D9232D'; // Red miss
      if (res === 'goal') color = '#D2AE5E'; // Gold goal
      else if (res === 'saved') color = '#38BDF8'; // Blue saved
      else if (res === 'blocked') color = '#A855F7'; // Purple blocked

      return {
        id: ev.id || ev.event_id || `shot_${idx}`,
        player_id: pid,
        playerName: pName,
        minute: ev.minute,
        x: ev.x,
        y: ev.y,
        xg,
        result: res,
        bodyPart,
        distance: Math.round(dist * 10) / 10,
        apexHeight: Math.round(apexZ * 10) / 10,
        origin: new THREE.Vector3(originX, originZ, originY),
        target: new THREE.Vector3(targetX, targetZ, targetY),
        controlPoint: new THREE.Vector3(controlX, controlZ, controlY),
        color,
      };
    });
  }, [events, playerMap]);

  // Filtered shots
  const filteredShots = useMemo(() => {
    return shotDataList.filter((s) => {
      if (filterResult !== 'all' && s.result !== filterResult) return false;
      if (filterPlayer !== 'all' && s.player_id !== filterPlayer) return false;
      return true;
    });
  }, [shotDataList, filterResult, filterPlayer]);

  // Aggregate stats
  const totalShots = filteredShots.length;
  const totalGoals = filteredShots.filter((s) => s.result === 'goal').length;
  const totalXG = filteredShots.reduce((acc, s) => acc + s.xg, 0);
  const avgDist = totalShots > 0 ? (filteredShots.reduce((acc, s) => acc + s.distance, 0) / totalShots).toFixed(1) : '0';

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, curHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.maxWidth = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't go below ground
    controls.minDistance = 10;
    controls.maxDistance = 180;

    // Apply Camera Presets
    if (cameraPreset === 'manager') {
      camera.position.set(-15, 24, 38);
      controls.target.set(30, 2, 0);
    } else if (cameraPreset === 'behind_goal') {
      camera.position.set(68, 8, 0);
      controls.target.set(20, 2, 0);
    } else {
      camera.position.set(26, 65, 0);
      controls.target.set(26, 0, 0);
    }
    controls.update();

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(25, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pitchLight = new THREE.PointLight(0xd2ae5e, 0.8, 80);
    pitchLight.position.set(52.5, 12, 0);
    scene.add(pitchLight);

    // 3. Build 3D Pitch
    // Attacking half: X in [0, 52.5], Z in [-34, 34]
    const pitchMat = new THREE.MeshStandardMaterial({
      color: 0x0f141f,
      roughness: 0.85,
      metalness: 0.1,
    });
    const pitchGeo = new THREE.PlaneGeometry(56, 72);
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.position.set(26.25, 0, 0);
    pitchMesh.receiveShadow = true;
    scene.add(pitchMesh);

    // Grass Mowing Pattern Strips
    for (let i = 0; i < 9; i++) {
      const stripGeo = new THREE.PlaneGeometry(5.8, 68);
      const stripMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x131926 : 0x101521,
        transparent: true,
        opacity: 0.6,
      });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(i * 5.8 + 2.9, 0.01, 0);
      scene.add(strip);
    }

    // Line helper
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const createLine = (points: [number, number, number][]) => {
      const geo = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
      );
      return new THREE.Line(geo, lineMat);
    };

    // Pitch markings
    // Halfway line (X = 0, Z in [-34, 34])
    scene.add(createLine([[0, 0.03, -34], [0, 0.03, 34]]));
    // Goal line (X = 52.5, Z in [-34, 34])
    scene.add(createLine([[52.5, 0.03, -34], [52.5, 0.03, 34]]));
    // Touchlines
    scene.add(createLine([[0, 0.03, -34], [52.5, 0.03, -34]]));
    scene.add(createLine([[0, 0.03, 34], [52.5, 0.03, 34]]));

    // Penalty Area: 16.5m from goal line (X = 36 to 52.5), width 40.32m (Z = -20.16 to 20.16)
    scene.add(createLine([[36, 0.03, -20.16], [52.5, 0.03, -20.16]]));
    scene.add(createLine([[36, 0.03, 20.16], [52.5, 0.03, 20.16]]));
    scene.add(createLine([[36, 0.03, -20.16], [36, 0.03, 20.16]]));

    // 6-Yard Box: 5.5m from goal line (X = 47 to 52.5), width 18.32m (Z = -9.16 to 9.16)
    scene.add(createLine([[47, 0.03, -9.16], [52.5, 0.03, -9.16]]));
    scene.add(createLine([[47, 0.03, 9.16], [52.5, 0.03, 9.16]]));
    scene.add(createLine([[47, 0.03, -9.16], [47, 0.03, 9.16]]));

    // Penalty spot at X = 41.5m, Z = 0
    const penSpotGeo = new THREE.CircleGeometry(0.3, 16);
    const penSpotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const penSpot = new THREE.Mesh(penSpotGeo, penSpotMat);
    penSpot.rotation.x = -Math.PI / 2;
    penSpot.position.set(41.5, 0.04, 0);
    scene.add(penSpot);

    // 4. 3D Goal Frame with Posts & Net
    // Width 7.32m (Z from -3.66 to 3.66), Height 2.44m, Depth 2.0m behind line (X = 52.5 to 54.5)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.3 });
    const postRadius = 0.08;

    // Left post
    const leftPostGeo = new THREE.CylinderGeometry(postRadius, postRadius, 2.44, 16);
    const leftPost = new THREE.Mesh(leftPostGeo, postMat);
    leftPost.position.set(52.5, 1.22, -3.66);
    scene.add(leftPost);

    // Right post
    const rightPost = new THREE.Mesh(leftPostGeo, postMat);
    rightPost.position.set(52.5, 1.22, 3.66);
    scene.add(rightPost);

    // Crossbar
    const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, 7.32, 16);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(52.5, 2.44, 0);
    scene.add(crossbar);

    // Net wireframe
    const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 });
    const netGeo = new THREE.BoxGeometry(2.0, 2.44, 7.32);
    const netMesh = new THREE.Mesh(netGeo, netMat);
    netMesh.position.set(53.5, 1.22, 0);
    scene.add(netMesh);

    // 5. Render 3D Shot Trajectory Tubes & Markers
    const clickableMeshes: THREE.Object3D[] = [];

    filteredShots.forEach((shot) => {
      // Bézier curve in 3D
      const curve = new THREE.QuadraticBezierCurve3(
        shot.origin,
        shot.controlPoint,
        shot.target
      );

      const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.12, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shot.color),
        emissive: new THREE.Color(shot.color),
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      (tubeMesh as any).userData = { shotData: shot };
      scene.add(tubeMesh);
      clickableMeshes.push(tubeMesh);

      // Origin Sphere Marker (size scaled by xG)
      const originRadius = 0.35 + Math.min(1.2, shot.xg * 1.6);
      const originGeo = new THREE.SphereGeometry(originRadius, 16, 16);
      const originMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shot.color),
        emissive: new THREE.Color(shot.color),
        emissiveIntensity: 0.3,
      });
      const originMesh = new THREE.Mesh(originGeo, originMat);
      originMesh.position.copy(shot.origin);
      scene.add(originMesh);

      // Target Impact Marker
      const targetRadius = shot.result === 'goal' ? 0.35 : 0.22;
      const targetGeo = new THREE.SphereGeometry(targetRadius, 12, 12);
      const targetMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(shot.color) });
      const targetMesh = new THREE.Mesh(targetGeo, targetMat);
      targetMesh.position.copy(shot.target);
      scene.add(targetMesh);
    });

    // 6. Raycaster for clicking shots
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableMeshes);

      if (intersects.length > 0) {
        const found = intersects[0].object as any;
        if (found.userData && found.userData.shotData) {
          setSelectedShot(found.userData.shotData);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // 7. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [filteredShots, cameraPreset, height]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* 3D Visualizer Header & DS Metric Strip */}
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
            <span>3D Interactive Pitch Shot Trajectory &amp; Goal Mouth Elevation</span>
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
              WebGL 3D
            </span>
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Parabolic 3D ball altitude arcs $Z(t)$, goalpost intersection, xG bubble volume, and 360&deg; tactical camera view.
          </div>
        </div>

        {/* Aggregate KPI Badges */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ background: '#0a0d14', border: '1px solid var(--border-hairline)', borderRadius: '4px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Shots Tracked</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{totalShots}</div>
          </div>
          <div style={{ background: '#0a0d14', border: '1px solid var(--border-hairline)', borderRadius: '4px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Total xG</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{totalXG.toFixed(2)}</div>
          </div>
          <div style={{ background: '#0a0d14', border: '1px solid var(--border-hairline)', borderRadius: '4px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Goals</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{totalGoals}</div>
          </div>
          <div style={{ background: '#0a0d14', border: '1px solid var(--border-hairline)', borderRadius: '4px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Avg Distance</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{avgDist}m</div>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          background: '#121722',
          padding: '10px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Camera Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Camera View:</span>
          {(['manager', 'behind_goal', 'overhead'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              style={{
                background: cameraPreset === preset ? 'rgba(210, 174, 94, 0.2)' : 'transparent',
                border: `1px solid ${cameraPreset === preset ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.12)'}`,
                color: cameraPreset === preset ? '#FFFFFF' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {preset === 'manager' ? 'Side Dugout' : preset === 'behind_goal' ? 'Behind Goal' : 'Overhead 3D'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Outcome Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Outcome:</span>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              style={{
                background: '#1a2230',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '13px',
              }}
            >
              <option value="all">All Shots ({shotDataList.length})</option>
              <option value="goal">Goals Only</option>
              <option value="saved">Saved on Target</option>
              <option value="miss">Off Target / Miss</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Player Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Player:</span>
            <select
              value={filterPlayer}
              onChange={(e) => setFilterPlayer(e.target.value)}
              style={{
                background: '#1a2230',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '13px',
                maxWidth: '170px',
              }}
            >
              <option value="all">All Shooters</option>
              {Array.from(new Set(shotDataList.map((s) => s.player_id))).map((pid) => (
                <option key={pid} value={pid}>
                  {playerMap.get(pid)?.player_name || `Player ${pid}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px`, borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Active 3D Trajectory Axes HUD Indicator */}
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
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Attacking Pitch Length (0m Halfway &rarr; 52.5m Goal Line)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10B981', fontWeight: 700, width: '48px' }}>Y-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Ball Altitude Apex Z (0m Turf &rarr; 2.44m+ Crossbar Height)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#38BDF8', fontWeight: 700, width: '48px' }}>Z-Axis:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Pitch Width (-34m Left &rarr; +34m Right Touchline)</span>
          </div>
        </div>

        {/* Legend Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '14px',
            background: 'rgba(10, 13, 20, 0.85)',
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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D2AE5E' }} />
            <span style={{ color: '#FFFFFF' }}>Goal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
            <span style={{ color: '#FFFFFF' }}>Saved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D9232D' }} />
            <span style={{ color: '#FFFFFF' }}>Miss / Off-Target</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#A855F7' }} />
            <span style={{ color: '#FFFFFF' }}>Blocked</span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
            Click trajectory or rotate with left mouse
          </div>
        </div>

        {/* Selected Shot Detail Modal Overlay */}
        {selectedShot && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'rgba(14, 20, 30, 0.94)',
              border: `1px solid ${selectedShot.color}`,
              borderRadius: '6px',
              padding: '14px 18px',
              minWidth: '240px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#FFFFFF' }}>{selectedShot.playerName}</span>
              <button
                onClick={() => setSelectedShot(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Minute:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{selectedShot.minute}'</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shot Outcome:</span>
                <span style={{ color: selectedShot.color, fontWeight: 700, textTransform: 'uppercase' }}>{selectedShot.result}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Expected Goal (xG):</span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedShot.xg.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Distance to Goal:</span>
                <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{selectedShot.distance} meters</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trajectory Apex ($Z$):</span>
                <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{selectedShot.apexHeight}m high</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Body Part:</span>
                <span style={{ color: '#FFFFFF', textTransform: 'capitalize' }}>{selectedShot.bodyPart.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
