import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { soundFx } from '../utils/audio';
import { Shield, Crosshair, AlertTriangle, Radio, Eye, Zap, Volume2, VolumeX, Moon, Sun, RotateCcw, ArrowRight, Play, FastForward, Navigation } from 'lucide-react';
import { TargetClass } from '../types';

interface DroneEntity {
  id: string;
  type: TargetClass;
  modelName: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  health: number;
  status: 'flying' | 'jammed' | 'falling' | 'destroyed';
  mesh: THREE.Group;
  trailPoints: THREE.Vector3[];
  trailLine?: THREE.Line;
  rotors: THREE.Mesh[];
  strobeLight?: THREE.PointLight;
  strobeMesh?: THREE.Mesh;
}

interface Battlefield3DSimulatorProps {
  terrainType?: string;
  timeOfDay?: 'day' | 'dusk' | 'night';
  difficulty?: number;
  threatType?: string;
  seed?: number;
  activeResponseAction?: string | null;
  onClearResponseAction?: () => void;
  onLiveScoreUpdate?: (scoreData: {
    detectionLatency: number;
    detectionScore: number;
    classificationScore: number;
    decisionScore: number;
    totalScore: number;
    decisionOutcome: string;
    dronesNeutralized: number;
    dronesTotal: number;
  }) => void;
  onFinishDrill: (results: {
    duration: number;
    score: number;
    events: any[];
    dronesNeutralized: number;
    dronesTotal: number;
    baseIntegrity: number;
  }) => void;
}

export const Battlefield3DSimulator: React.FC<Battlefield3DSimulatorProps> = ({
  terrainType = 'border',
  timeOfDay = 'day',
  difficulty = 1,
  threatType = 'single',
  seed = 777,
  activeResponseAction = null,
  onClearResponseAction,
  onLiveScoreUpdate,
  onFinishDrill,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation Game State
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [nvgActive, setNvgActive] = useState<boolean>(timeOfDay === 'night');
  const [flashlightActive, setFlashlightActive] = useState<boolean>(timeOfDay === 'night');
  const [aimingActive, setAimingActive] = useState<boolean>(false);
  const [isFiringJammer, setIsFiringJammer] = useState<boolean>(false);
  const [jammerBattery, setJammerBattery] = useState<number>(100);
  const [baseIntegrity, setBaseIntegrity] = useState<number>(100);
  const [inCover, setInCover] = useState<boolean>(false);
  const [thirdPerson, setThirdPerson] = useState<boolean>(false);
  const [currentWave, setCurrentWave] = useState<number>(1);

  // Combat Outcome Banner
  const [outcomeBanner, setOutcomeBanner] = useState<{
    title: string;
    subtitle: string;
    type: 'success' | 'evaded' | 'failure' | 'neutral';
  } | null>(null);

  // Combat Intelligence HUD state
  const [activeDronesList, setActiveDronesList] = useState<{
    id: string;
    type: TargetClass;
    dist: number;
    status: string;
    screenX?: number;
    screenY?: number;
    onScreen?: boolean;
    health: number;
  }[]>([]);
  const [lockedDrone, setLockedDrone] = useState<DroneEntity | null>(null);
  const [headingDegrees, setHeadingDegrees] = useState<number>(0);
  const [combatAlertText, setCombatAlertText] = useState<string>('INCOMING DRONE DETECTED DIRECTLY AHEAD!');
  const [alertLevel, setAlertLevel] = useState<'low' | 'med' | 'high'>('high');
  const [nearestDist, setNearestDist] = useState<number>(95);
  const [impactTimeEst, setImpactTimeEst] = useState<number>(6.5);

  // Scoring
  const eventsLogRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const neutralizedCountRef = useRef<number>(0);
  const totalDronesCountRef = useRef<number>(0);

  // References to 3D simulation objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const soldierRef = useRef<{
    position: THREE.Vector3;
    rotation: { pitch: number; yaw: number };
    weaponGroup: THREE.Group;
    flashlight: THREE.SpotLight;
    laserLine: THREE.Line;
  } | null>(null);

  const dronesRef = useRef<DroneEntity[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const beamMeshRef = useRef<THREE.Mesh | null>(null);
  const isMouseDownRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Function to spawn threats based on wave
  const spawnThreatWave = useCallback((waveNum: number, currentScene: THREE.Scene) => {
    // Clean up existing drones
    dronesRef.current.forEach((d) => {
      currentScene.remove(d.mesh);
    });
    dronesRef.current = [];

    const newDrones: DroneEntity[] = [];

    // Create high-detail military combat drone (Large 2.8m wingspan)
    const createDroneMesh = (type: TargetClass) => {
      const droneGrp = new THREE.Group();

      const isKamikaze = type === 'hostile';
      const bodyColor = isKamikaze ? 0x0f172a : 0x064e3b;

      // Delta Wing Body with aerodynamic profile
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 1.6); // Nose
      wingShape.lineTo(1.5, -1.1); // Right wingtip
      wingShape.lineTo(0.35, -0.75); // Right inboard
      wingShape.lineTo(0, -0.65); // Center tail
      wingShape.lineTo(-0.35, -0.75); // Left inboard
      wingShape.lineTo(-1.5, -1.1); // Left wingtip
      wingShape.closePath();

      const extrudeSettings = { depth: 0.26, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 };
      const wingGeom = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      const wingMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.35,
        metalness: 0.85,
      });
      const wingMesh = new THREE.Mesh(wingGeom, wingMat);
      wingMesh.rotation.x = Math.PI / 2;
      wingMesh.rotation.z = Math.PI;
      wingMesh.castShadow = true;
      droneGrp.add(wingMesh);

      // High-Visibility Hazard Chevrons (Bright Orange on wingtips)
      const chevronMat = new THREE.MeshBasicMaterial({ color: isKamikaze ? 0xf97316 : 0x10b981 });
      const chevronL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.2), chevronMat);
      chevronL.position.set(-1.2, 0, -0.9);
      droneGrp.add(chevronL);
      const chevronR = chevronL.clone();
      chevronR.position.set(1.2, 0, -0.9);
      droneGrp.add(chevronR);

      // Optical Gimbal Seeker Turret with red laser diode
      const seekerGeom = new THREE.SphereGeometry(0.24, 16, 16);
      const seekerMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.2,
      });
      const seeker = new THREE.Mesh(seekerGeom, seekerMat);
      seeker.position.set(0, -0.05, 1.5);
      droneGrp.add(seeker);

      const lensGeom = new THREE.CircleGeometry(0.12, 16);
      const lensMat = new THREE.MeshBasicMaterial({ color: isKamikaze ? 0xef4444 : 0x06b6d4, side: THREE.DoubleSide });
      const lens = new THREE.Mesh(lensGeom, lensMat);
      lens.position.set(0, -0.05, 1.74);
      droneGrp.add(lens);

      // 4 High-Speed Rotor Disks on carbon outriggers
      const rotorList: THREE.Mesh[] = [];
      const rotorDiskMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });

      const rotorPositions = [
        [-0.95, 0.14, 0.6],
        [0.95, 0.14, 0.6],
        [-1.05, 0.14, -0.7],
        [1.05, 0.14, -0.7],
      ];

      rotorPositions.forEach(([rx, ry, rz]) => {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.25),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 })
        );
        pylon.position.set(rx, ry - 0.12, rz);
        droneGrp.add(pylon);

        const rDisk = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), rotorDiskMat);
        rDisk.rotation.x = Math.PI / 2;
        rDisk.position.set(rx, ry, rz);
        droneGrp.add(rDisk);
        rotorList.push(rDisk);
      });

      // Ultra-bright flashing red strobe beacon
      const strobeLight = new THREE.PointLight(isKamikaze ? 0xff0000 : 0x00ff00, 8, 50);
      strobeLight.position.set(0, 0.35, 0);
      droneGrp.add(strobeLight);

      const strobeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: isKamikaze ? 0xff0000 : 0x00ff00 })
      );
      strobeMesh.position.set(0, 0.35, 0);
      droneGrp.add(strobeMesh);

      // Fiery rocket motor exhaust nozzle
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(0, 0, -1.2);
      droneGrp.add(exhaust);

      return { grp: droneGrp, rotors: rotorList, strobeLight, strobeMesh };
    };

    if (waveNum === 1) {
      // WAVE 1: Direct Straight-In Kamikaze Dive Attack (Directly in front at z = -95m for INSTANT visibility)
      const { grp, rotors, strobeLight, strobeMesh } = createDroneMesh('hostile');
      grp.position.set(0, 22, -95);
      currentScene.add(grp);

      newDrones.push({
        id: 'KAMIKAZE-ALPHA-01',
        type: 'hostile',
        modelName: 'Shahed-136 Loitering Munition (Direct Dive)',
        position: grp.position,
        velocity: new THREE.Vector3(0, -0.22, 0.98).normalize(),
        targetPos: new THREE.Vector3(0, 1.0, 0), // Soldier outpost
        speed: 13.5,
        health: 100,
        status: 'flying',
        mesh: grp,
        trailPoints: [],
        rotors,
        strobeLight,
        strobeMesh,
      });
    } else if (waveNum === 2) {
      // WAVE 2: Fast FPV Attack Drone (Swooping and slightly evasive)
      const { grp, rotors, strobeLight, strobeMesh } = createDroneMesh('hostile');
      grp.position.set(18, 18, -100);
      currentScene.add(grp);

      newDrones.push({
        id: 'FPV-RACER-02',
        type: 'hostile',
        modelName: 'High-Speed FPV Kamikaze (Shaped Charge)',
        position: grp.position,
        velocity: new THREE.Vector3(-0.2, -0.18, 0.96).normalize(),
        targetPos: new THREE.Vector3(0, 1.0, 0),
        speed: 17.5,
        health: 100,
        status: 'flying',
        mesh: grp,
        trailPoints: [],
        rotors,
        strobeLight,
        strobeMesh,
      });
    } else {
      // WAVE 3: Dual Swarm Pincer Attack (Left & Right simultaneous approach)
      [-22, 22].forEach((startX, idx) => {
        const { grp, rotors, strobeLight, strobeMesh } = createDroneMesh('hostile');
        grp.position.set(startX, 24, -105 - idx * 10);
        currentScene.add(grp);

        newDrones.push({
          id: `SWARM-PINCER-0${idx + 1}`,
          type: 'hostile',
          modelName: `Swarm Drone Delta-${idx + 1}`,
          position: grp.position,
          velocity: new THREE.Vector3(-startX * 0.018, -0.2, 0.96).normalize(),
          targetPos: new THREE.Vector3(0, 1.0, 0),
          speed: 14.5,
          health: 100,
          status: 'flying',
          mesh: grp,
          trailPoints: [],
          rotors,
          strobeLight,
          strobeMesh,
        });
      });
    }

    dronesRef.current = newDrones;
    totalDronesCountRef.current += newDrones.length;
    soundFx.playThreatSiren();
    setOutcomeBanner(null);
  }, []);

  // 1. Initialize 3D Battlefield World
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 660;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lighting & Atmosphere
    let skyColor = 0x0284c7; // Deep military sky blue
    let groundColor = 0x334155; // Tactical slate khaki
    let ambientIntensity = 1.3;
    let sunIntensity = 2.0;

    if (timeOfDay === 'night') {
      skyColor = 0x020617;
      groundColor = 0x0f172a;
      ambientIntensity = 0.35;
      sunIntensity = 0.3;
    } else if (timeOfDay === 'dusk') {
      skyColor = 0xd97706;
      groundColor = 0x3f2e21;
      ambientIntensity = 0.8;
      sunIntensity = 1.5;
    }

    scene.background = new THREE.Color(skyColor);
    // Light distance fog far away (250m to 600m) so foreground is 100% crystal clear
    scene.fog = new THREE.Fog(skyColor, 250, 600);

    // CAMERA - Looking along -Z (Straight ahead onto the battlefield)
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 1000);
    camera.position.set(0, 1.7, 0); // Soldier eye level: 1.7m
    cameraRef.current = camera;

    // RENDERER with ACES Filmic Tone Mapping for crisp, vibrant realism
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // LIGHTS: Ambient + Sunlight + Hemisphere sky fill
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(timeOfDay === 'dusk' ? 0xffaa44 : 0xffffff, sunIntensity);
    sunLight.position.set(80, 180, -60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // Sun disc in the sky
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(14, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb })
    );
    sunDisc.position.set(80, 180, -250);
    scene.add(sunDisc);

    // Dynamic 3D Clouds in Sky
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, opacity: 0.9, transparent: true });
    for (let i = 0; i < 18; i++) {
      const cloud = new THREE.Mesh(new THREE.DodecahedronGeometry(8 + (i % 4) * 4, 1), cloudMat);
      cloud.position.set(
        (i - 9) * 35 + (Math.random() - 0.5) * 20,
        55 + Math.random() * 20,
        -120 - Math.random() * 200
      );
      cloud.scale.set(2.2, 0.8, 1.5);
      scene.add(cloud);
    }

    // 2. BATTLEFIELD TERRAIN & OUTPOST
    // Ground Terrain
    const terrainSize = 650;
    const groundGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.85,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Dirt & Gravel Runway Path passing through outpost
    const roadGeom = new THREE.PlaneGeometry(14, terrainSize);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(16, 0.04, 0);
    road.receiveShadow = true;
    scene.add(road);

    // Command Bunker BEHIND Soldier (at z = +14)
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(0, 0, 15);

    const bunkerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 5, 12),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.2 })
    );
    bunkerMesh.position.set(0, 2.5, 0);
    bunkerMesh.castShadow = true;
    bunkerMesh.receiveShadow = true;
    bunkerGroup.add(bunkerMesh);

    // Blast Door
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85 })
    );
    doorMesh.position.set(0, 1.7, -6.1);
    bunkerGroup.add(doorMesh);

    // Spinning Search Radar Mast on Bunker Roof
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    dishMast.position.set(0, 6.2, 0);
    bunkerGroup.add(dishMast);

    const radarDish = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 16, 16, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, side: THREE.DoubleSide })
    );
    radarDish.position.set(0, 7.5, 0);
    radarDish.rotation.x = -Math.PI / 4;
    bunkerGroup.add(radarDish);
    scene.add(bunkerGroup);

    // Watchtower on flank (x = -18, z = -10)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-18, 0, -10);
    const towerLegMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    for (const [tx, tz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12), towerLegMat);
      leg.position.set(tx, 6, tz);
      towerGroup.add(leg);
    }
    const towerCabin = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 4.5), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    towerCabin.position.set(0, 12, 0);
    towerGroup.add(towerCabin);
    scene.add(towerGroup);

    // FORWARD DEFENSIVE SANDBAG FORTIFICATION (Directly in front of soldier at z = -3.8)
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });
    const sandbagGeom = new THREE.BoxGeometry(1.2, 0.42, 0.6);

    const createSandbagWall = (startX: number, startZ: number, count: number, angleDeg: number) => {
      const rad = THREE.MathUtils.degToRad(angleDeg);
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < count; i++) {
          const bag = new THREE.Mesh(sandbagGeom, sandbagMat);
          const offset = (i - count / 2) * 1.1;
          bag.position.set(
            startX + Math.cos(rad) * offset,
            0.21 + layer * 0.4,
            startZ + Math.sin(rad) * offset
          );
          bag.rotation.y = rad;
          bag.castShadow = true;
          bag.receiveShadow = true;
          scene.add(bag);
        }
      }
    };

    // Forward sandbag firing trench (soldier stands at z = 0 looking right over these!)
    createSandbagWall(0, -3.8, 8, 0);
    createSandbagWall(-4.8, -2.8, 5, -35);
    createSandbagWall(4.8, -2.8, 5, 35);

    // Heavy Wooden Timber Firing Ledge resting on sandbags
    const timber = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.15, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    timber.position.set(0, 1.25, -3.8);
    scene.add(timber);

    // Camouflage Netting Overhead on Timber Posts
    const camoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x14532d,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      })
    );
    camoMesh.rotation.x = -Math.PI / 2 + 0.1;
    camoMesh.position.set(0, 3.2, -1.0);
    scene.add(camoMesh);

    // Military Pine Trees & Terrain Details
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const dist = 65 + (i % 5) * 25;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;
      if (Math.abs(tx) < 18 && tz < 0 && tz > -160) continue; // Keep flight corridor clear

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4), trunkMat);
      trunk.position.y = 2;
      tree.add(trunk);

      const foliage = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 7), treeMat);
      foliage.position.y = 7;
      tree.add(foliage);

      tree.position.set(tx, 0, tz);
      scene.add(tree);
    }

    // 3. SOLDIER WEAPON: Tactical Anti-Drone Directed Energy / RF Jammer Gun
    const weaponGroup = new THREE.Group();
    // Weapon body
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.18, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.85 })
    );
    weaponGroup.add(bodyMesh);

    // Front Directed Conical RF Antenna (Muzzle Horn)
    const hornGeom = new THREE.ConeGeometry(0.15, 0.38, 12, 1, true);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.9 });
    const horn = new THREE.Mesh(hornGeom, hornMat);
    horn.rotation.x = -Math.PI / 2;
    horn.position.set(0, 0, -0.52);
    weaponGroup.add(horn);

    // Emitter Coils with glowing cyan rings
    for (let c = 0; c < 3; c++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.018, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      ring.position.set(0, 0, -0.22 - c * 0.11);
      weaponGroup.add(ring);
    }

    // Holographic Reflex Sight with glowing reticle
    const sightBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x020617 })
    );
    sightBox.position.set(0, 0.13, -0.05);
    weaponGroup.add(sightBox);

    const reticleGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    reticleGlass.position.set(0, 0.13, -0.13);
    weaponGroup.add(reticleGlass);

    // Camo Soldier Hand / Gloves gripping weapon
    const handMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x3f4f34, roughness: 0.9 })
    );
    handMesh.rotation.x = Math.PI / 3;
    handMesh.position.set(0.08, -0.18, 0.05);
    weaponGroup.add(handMesh);

    // Tactical Flashlight attached to weapon
    const flashlight = new THREE.SpotLight(0xffffff, flashlightActive ? 5 : 0, 90, Math.PI / 6, 0.3);
    flashlight.position.set(0.12, 0, -0.4);
    flashlight.target.position.set(0, 0, -10);
    weaponGroup.add(flashlight);
    weaponGroup.add(flashlight.target);

    // Laser sight targeting line
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 });
    const laserGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.05, -0.4),
      new THREE.Vector3(0, 0.05, -180),
    ]);
    const laserLine = new THREE.Line(laserGeom, laserMat);
    weaponGroup.add(laserLine);

    // Position weapon in lower right screen (classic FPS posture)
    weaponGroup.position.set(0.24, -0.22, -0.5);
    camera.add(weaponGroup);
    scene.add(camera);

    // Jammer Energy Beam mesh (hidden until firing)
    const beamGeom = new THREE.CylinderGeometry(0.12, 3.2, 160, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const beamMesh = new THREE.Mesh(beamGeom, beamMat);
    beamMesh.rotation.x = -Math.PI / 2;
    beamMesh.position.set(0, 0, -80);
    camera.add(beamMesh);
    beamMeshRef.current = beamMesh;

    soldierRef.current = {
      position: new THREE.Vector3(0, 1.7, 0),
      rotation: { pitch: -0.05, yaw: 0 }, // Looking straight ahead toward -Z
      weaponGroup,
      flashlight,
      laserLine,
    };

    // 4. SPAWN INITIAL THREAT WAVE
    spawnThreatWave(1, scene);

    // 5. EVENT LISTENERS: Mouse Look, WASD movement, Firing
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      if (e.code === 'KeyN') {
        setNvgActive((prev) => {
          soundFx.playNightVisionToggle();
          return !prev;
        });
      }
      if (e.code === 'KeyF') {
        setFlashlightActive((prev) => {
          const next = !prev;
          if (soldierRef.current) soldierRef.current.flashlight.intensity = next ? 5 : 0;
          return next;
        });
      }
      if (e.code === 'KeyC') {
        setInCover((prev) => !prev);
      }
      if (e.code === 'KeyV') {
        setThirdPerson((prev) => !prev);
      }
      if (e.code === 'KeyR') {
        handleRadioHQ();
      }
      if (e.code === 'Space') {
        handleFireKinetic();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (!isPointerLocked) {
        container.requestPointerLock?.();
      }

      if (e.button === 0) {
        setIsFiringJammer(true);
        soundFx.setJammerBeam(true);
      } else if (e.button === 2) {
        setAimingActive(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      isMouseDownRef.current = false;
      if (e.button === 0) {
        setIsFiringJammer(false);
        soundFx.setJammerBeam(false);
      } else if (e.button === 2) {
        setAimingActive(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!soldierRef.current) return;
      const soldier = soldierRef.current;
      const sensitivity = 0.0024;

      if (isPointerLocked) {
        soldier.rotation.yaw -= e.movementX * sensitivity;
        soldier.rotation.pitch -= e.movementY * sensitivity;
      } else if (isMouseDownRef.current) {
        // Drag-to-look when pointer is not locked
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        soldier.rotation.yaw -= dx * sensitivity;
        soldier.rotation.pitch -= dy * sensitivity;
      }

      soldier.rotation.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, soldier.rotation.pitch));
      const deg = Math.round((THREE.MathUtils.radToDeg(-soldier.rotation.yaw) + 360) % 360);
      setHeadingDegrees(deg);
    };

    const handleLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === container);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handleLockChange);

    const preventContext = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('contextmenu', preventContext);

    // 6. MAIN SIMULATION / RENDER ANIMATION LOOP (60 FPS)
    let animId: number;
    let lastTime = performance.now();
    let footstepCounter = 0;
    let strobeTimer = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const soldier = soldierRef.current;
      if (!soldier) return;

      // A. Soldier Movement
      const keys = keysRef.current;
      const isShift = keys['ShiftLeft'] || keys['ShiftRight'];
      const moveSpeed = (isShift ? 7.2 : 3.8) * delta;

      const forward = new THREE.Vector3(-Math.sin(soldier.rotation.yaw), 0, -Math.cos(soldier.rotation.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const moveDir = new THREE.Vector3();

      if (keys['KeyW']) moveDir.add(forward);
      if (keys['KeyS']) moveDir.sub(forward); // Backwards towards bunker
      if (keys['KeyD']) moveDir.add(right);
      if (keys['KeyA']) moveDir.sub(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        soldier.position.addScaledVector(moveDir, moveSpeed);

        // Bounds: z: -3.4 (sandbags) to +12.0 (bunker), x: -8.0 to +8.0
        soldier.position.x = Math.max(-8, Math.min(8, soldier.position.x));
        soldier.position.z = Math.max(-3.4, Math.min(12, soldier.position.z));

        footstepCounter += delta;
        if (footstepCounter > (isShift ? 0.28 : 0.45)) {
          soundFx.playFootstep();
          footstepCounter = 0;
        }
      }

      // Height: Crouch / Cover adjusts camera altitude
      const targetHeight = inCover ? 0.95 : 1.7;
      soldier.position.y += (targetHeight - soldier.position.y) * 0.25;

      // Update Camera Position & Rotation
      camera.rotation.set(0, 0, 0);
      camera.rotation.y = soldier.rotation.yaw;
      camera.rotation.x = soldier.rotation.pitch;

      if (thirdPerson) {
        const camOffset = new THREE.Vector3(0, 1.2, 3.2);
        camOffset.applyEuler(new THREE.Euler(soldier.rotation.pitch, soldier.rotation.yaw, 0, 'YXZ'));
        camera.position.copy(soldier.position).add(camOffset);
      } else {
        camera.position.copy(soldier.position);
      }

      // Weapon ADS Animation
      const targetWeaponPos = aimingActive
        ? new THREE.Vector3(0, -0.12, -0.32)
        : new THREE.Vector3(0.24, -0.22, -0.5);
      soldier.weaponGroup.position.lerp(targetWeaponPos, 0.2);

      const targetFov = aimingActive ? 32 : 62;
      camera.fov += (targetFov - camera.fov) * 0.2;
      camera.updateProjectionMatrix();

      // Spinning Radar Dish on bunker
      radarDish.rotation.z += 0.02;

      // Strobe Light pulsation
      strobeTimer += delta * 8;
      const strobeOn = Math.sin(strobeTimer) > 0;

      // D. DRONE KINEMATICS, AI & INTERACTION
      let closestLocked: DroneEntity | null = null;
      let minCrosshairDist = 0.92;
      let closestDist = 999;
      const activeHudList: any[] = [];

      dronesRef.current.forEach((drone) => {
        if (drone.status === 'destroyed') return;

        // Spin rotors
        drone.rotors.forEach((r) => (r.rotation.z += 0.9));

        // Toggle strobe
        if (drone.strobeLight && drone.strobeMesh) {
          drone.strobeLight.intensity = strobeOn ? 8 : 1;
          (drone.strobeMesh.material as THREE.MeshBasicMaterial).color.setHex(strobeOn ? 0xff2222 : 0x440000);
        }

        const distToSoldier = camera.position.distanceTo(drone.position);
        if (distToSoldier < closestDist && drone.status === 'flying') {
          closestDist = distToSoldier;
        }

        // Screen-space projection for tactical HUD brackets
        const screenPos = drone.position.clone();
        screenPos.project(camera);

        const onScreen = screenPos.z > 0 && Math.abs(screenPos.x) <= 1.1 && Math.abs(screenPos.y) <= 1.1;
        const screenX = ((screenPos.x + 1) * width) / 2;
        const screenY = ((-screenPos.y + 1) * height) / 2;

        activeHudList.push({
          id: drone.id,
          type: drone.type,
          dist: Math.round(distToSoldier),
          status: drone.status,
          screenX,
          screenY,
          onScreen,
          health: Math.max(0, Math.round(drone.health)),
        });

        // Targeting raycast check
        const toDrone = drone.position.clone().sub(camera.position).normalize();
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        const dot = lookDir.dot(toDrone);

        if (dot > minCrosshairDist && distToSoldier < 250) {
          minCrosshairDist = dot;
          closestLocked = drone;
        }

        // RF Jammer Firing & Damage
        if (isFiringJammer && closestLocked?.id === drone.id && drone.status === 'flying') {
          setJammerBattery((prev) => Math.max(0, prev - delta * 24));
          drone.health -= delta * 70;

          // Erratic interference wobble
          drone.mesh.position.x += (Math.random() - 0.5) * 0.5;
          drone.mesh.position.y += (Math.random() - 0.5) * 0.3;

          if (drone.health <= 0) {
            drone.status = 'falling';
            soundFx.playExplosion();
            neutralizedCountRef.current += 1;

            setOutcomeBanner({
              title: '🎯 TARGET NEUTRALIZED!',
              subtitle: `${drone.modelName} disrupted by RF Jammer and crashed! (+100 PTS)`,
              type: 'success',
            });

            eventsLogRef.current.push({
              target_id: drone.id,
              action: 'rf_jammer_neutralized',
              time: (Date.now() - startTimeRef.current) / 1000,
              type: drone.type,
            });
          }
        }

        // Drone Flight Path (Diving straight toward outpost at z = 0)
        if (drone.status === 'flying') {
          const targetImpactPoint = new THREE.Vector3(0, 1.0, 0);
          const dir = targetImpactPoint.clone().sub(drone.position).normalize();
          drone.velocity.lerp(dir, 0.04);
          drone.position.addScaledVector(drone.velocity, drone.speed * delta);
          drone.mesh.lookAt(drone.position.clone().add(drone.velocity));

          // CHECK IMPACT AT OUTPOST
          if (drone.position.z >= -3.5 && drone.position.y <= 3.5) {
            drone.status = 'destroyed';
            scene.remove(drone.mesh);
            soundFx.playExplosion();

            const hasRunAway = soldier.position.z >= 4.0;
            const isSafe = inCover || hasRunAway;

            if (isSafe) {
              soundFx.playNearMissWhoosh();
              setOutcomeBanner({
                title: '💥 IMPACT SURVIVED!',
                subtitle: hasRunAway
                  ? '🏃 Tactical Evasion: You sprinted to the bunker and escaped the blast! (+80 PTS)'
                  : '🛡️ Cover Effective: You ducked behind sandbags and survived detonation! (+80 PTS)',
                type: 'evaded',
              });
              setBaseIntegrity((b) => Math.max(0, b - 10));

              eventsLogRef.current.push({
                action: hasRunAway ? 'sprinted_to_safety' : 'took_cover_behind_sandbags',
                time: (Date.now() - startTimeRef.current) / 1000,
                success: true,
              });
            } else {
              setOutcomeBanner({
                title: '💀 DIRECT HIT TAKEN!',
                subtitle: 'Soldier was caught in the open! You failed to shoot down or evade the drone! (-50 PTS)',
                type: 'failure',
              });
              setBaseIntegrity((b) => Math.max(0, b - 50));

              eventsLogRef.current.push({
                action: 'direct_hit_unprotected',
                time: (Date.now() - startTimeRef.current) / 1000,
                success: false,
              });
            }
          }
        } else if (drone.status === 'falling') {
          drone.position.y -= 22 * delta;
          drone.position.z += 8 * delta;
          drone.mesh.rotation.x += 0.2;
          drone.mesh.rotation.z += 0.3;

          if (drone.position.y <= 0.3) {
            drone.status = 'destroyed';
            scene.remove(drone.mesh);
          }
        }
      });

      setActiveDronesList(activeHudList);
      setLockedDrone(closestLocked);
      setNearestDist(Math.round(closestDist));
      const estTime = closestDist / 14.5;
      setImpactTimeEst(Math.max(0, Math.round(estTime * 10) / 10));

      // Jammer visual energy beam
      if (beamMeshRef.current) {
        (beamMeshRef.current.material as THREE.MeshBasicMaterial).opacity = isFiringJammer ? 0.8 : 0;
      }

      // Re-charge battery when not firing
      if (!isFiringJammer) {
        setJammerBattery((prev) => Math.min(100, prev + delta * 15));
      }

      // Alert level
      if (closestDist < 45) {
        setCombatAlertText(`⚠️ CRITICAL: DRONE ${Math.round(closestDist)}M! SHOOT OR EVADE NOW!`);
        setAlertLevel('high');
      } else if (closestDist < 90) {
        setCombatAlertText(`🚨 THREAT INCOMING: ${Math.round(closestDist)}M DIRECTLY AHEAD`);
        setAlertLevel('med');
      } else {
        setCombatAlertText('SCANNING AIRSPACE // INCOMING KAMIKAZE DRONE');
        setAlertLevel('low');
      }

      // Dispatch live 3-pillar scoring to parent
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      const dScore = Math.max(10, Math.round(30 - Math.min(20, elapsedSec * 1.5)));
      const cScore = 30;
      const decScore = neutralizedCountRef.current > 0 ? 40 : inCover ? 35 : 20;
      const tScore = dScore + cScore + decScore;

      if (Math.random() < 0.1) {
        onLiveScoreUpdate?.({
          detectionLatency: Math.round(elapsedSec * 10) / 10,
          detectionScore: dScore,
          classificationScore: cScore,
          decisionScore: decScore,
          totalScore: tScore,
          decisionOutcome: neutralizedCountRef.current > 0 ? 'Optimal' : inCover ? 'Acceptable' : 'Under-reaction',
          dronesNeutralized: neutralizedCountRef.current,
          dronesTotal: totalDronesCountRef.current || 1,
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handleLockChange);
      container.removeEventListener('contextmenu', preventContext);
      renderer.dispose();
      soundFx.setJammerBeam(false);
    };
  }, [terrainType, timeOfDay, difficulty, threatType, inCover, thirdPerson, spawnThreatWave]);

  // Handle Kinetic Interceptor Shot (SPACE or Button)
  const handleFireKinetic = () => {
    soundFx.playKineticFire();
    const locked = lockedDrone || dronesRef.current.find((d) => d.status === 'flying');
    if (locked && locked.status === 'flying') {
      locked.status = 'falling';
      soundFx.playExplosion();
      neutralizedCountRef.current += 1;

      setOutcomeBanner({
        title: '💥 KINETIC AIRBURST KILL!',
        subtitle: `${locked.modelName} intercepted and destroyed mid-air! (+100 PTS)`,
        type: 'success',
      });

      eventsLogRef.current.push({
        target_id: locked.id,
        action: 'kinetic_airburst_kill',
        time: (Date.now() - startTimeRef.current) / 1000,
        type: locked.type,
      });
    }
  };

  // Handle Radio Alert
  const handleRadioHQ = () => {
    soundFx.playRadioSquelch();
    soundFx.playEngagementAlert();
    eventsLogRef.current.push({
      action: 'radio_hq_alert',
      time: (Date.now() - startTimeRef.current) / 1000,
    });
  };

  // Handle Net Deployment
  const handleDeployNet = () => {
    soundFx.playTargetLock();
    const locked = lockedDrone || dronesRef.current.find((d) => d.status === 'flying');
    if (locked && locked.status === 'flying') {
      locked.status = 'falling';
      soundFx.playExplosion();
      neutralizedCountRef.current += 1;
      setOutcomeBanner({
        title: '🕸️ NET CAPTURE SUCCESSFUL!',
        subtitle: `${locked.modelName} captured intact via counter-drone net canopy! (+100 PTS)`,
        type: 'success',
      });
      eventsLogRef.current.push({
        target_id: locked.id,
        action: 'net_capture',
        time: (Date.now() - startTimeRef.current) / 1000,
        type: locked.type,
      });
    }
  };

  // Watch for external tactical response selections from parent Decision Deck
  useEffect(() => {
    if (!activeResponseAction) return;
    if (activeResponseAction === 'authorise_protective_response' || activeResponseAction === 'rf_jammer') {
      setIsFiringJammer(true);
      soundFx.setJammerBeam(true);
      const target = lockedDrone || dronesRef.current.find((d) => d.status === 'flying');
      if (target) {
        target.health = 0;
        target.status = 'falling';
        soundFx.playExplosion();
        neutralizedCountRef.current += 1;
        setOutcomeBanner({
          title: '🎯 OPTIMAL DECISION: RF JAMMER ENGAGED!',
          subtitle: `${target.modelName} neutralized via Directed Energy EW! (+40 PTS DECISION QUALITY)`,
          type: 'success',
        });
        eventsLogRef.current.push({
          target_id: target.id,
          action: 'authorise_protective_response',
          time: (Date.now() - startTimeRef.current) / 1000,
          type: target.type,
        });
      }
    } else if (activeResponseAction === 'kinetic_intercept') {
      handleFireKinetic();
    } else if (activeResponseAction === 'deploy_net') {
      handleDeployNet();
    } else if (activeResponseAction === 'take_cover') {
      setInCover(true);
      soundFx.playButtonClick();
    } else if (activeResponseAction === 'run_bunker') {
      if (soldierRef.current) {
        soldierRef.current.position.z = 8.0;
        soundFx.playFootstep();
      }
    } else if (activeResponseAction === 'raise_alert') {
      handleRadioHQ();
    } else if (activeResponseAction === 'continue_monitoring') {
      soundFx.playRadioSquelch();
      const target = lockedDrone || dronesRef.current.find((d) => d.status === 'flying');
      if (target?.type === 'friendly') {
        setOutcomeBanner({
          title: '✅ OPTIMAL: ROE DISCIPLINE VERIFIED!',
          subtitle: 'Friendly Patrol UAS cleared to transit without hostile engagement! (+40 PTS)',
          type: 'success',
        });
      } else {
        setOutcomeBanner({
          title: '⚠️ UNDER-REACTION DETECTED!',
          subtitle: 'Hostile threat allowed to advance toward outpost without engagement! (10 PTS)',
          type: 'failure',
        });
      }
    }
    onClearResponseAction?.();
  }, [activeResponseAction]);

  // Trigger Next Threat Wave
  const handleNextWave = () => {
    soundFx.playButtonClick();
    const nextW = (currentWave % 3) + 1;
    setCurrentWave(nextW);
    if (sceneRef.current) {
      spawnThreatWave(nextW, sceneRef.current);
    }
  };

  // Complete Drill and generate score
  const handleCompleteMission = () => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const neut = neutralizedCountRef.current;
    const total = totalDronesCountRef.current || 1;

    let calcScore = 80;
    if (neut >= total) calcScore = 95;
    else if (neut > 0) calcScore = 75;
    else calcScore = 40;

    onFinishDrill({
      duration: elapsed,
      score: calcScore,
      events: eventsLogRef.current,
      dronesNeutralized: neut,
      dronesTotal: total,
      baseIntegrity,
    });
  };

  return (
    <div className="relative w-full h-[660px] bg-black rounded-2xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl select-none font-mono">
      {/* 3D WebGL Canvas Container - 100% VISIBLE AND UNBLURRED */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Night Vision Goggles (NVG) Green Phosphor Overlay */}
      {nvgActive && (
        <div
          className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-80"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.45) 40%, rgba(5, 46, 22, 0.95) 100%)',
          }}
        >
          <div
            className="w-full h-full opacity-30"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5) 1px, transparent 1px, transparent 3px)',
            }}
          />
        </div>
      )}

      {/* 3D SCREEN-SPACE HUD TARGET BRACKETS FLOATING OVER INCOMING DRONES */}
      {activeDronesList.map((d) => {
        if (!d.onScreen || d.status === 'destroyed' || d.screenX === undefined || d.screenY === undefined) return null;
        return (
          <div
            key={d.id}
            className="absolute pointer-events-none z-20 transition-all duration-75"
            style={{
              left: `${d.screenX}px`,
              top: `${d.screenY}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Pulsing Tactical Diamond */}
            <div className="relative flex flex-col items-center">
              <div className="w-12 h-12 border-2 border-red-500 rotate-45 animate-pulse bg-red-500/25 flex items-center justify-center shadow-[0_0_20px_#ef4444]" />
              <div className="mt-2.5 px-3 py-1 bg-black/95 border border-red-500 rounded text-[11px] text-red-300 font-bold flex flex-col items-center whitespace-nowrap shadow-2xl">
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> HOSTILE KAMIKAZE DRONE
                </span>
                <span>RANGE: {d.dist}M | HP: {d.health}%</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* COMBAT OUTCOME BANNER (Success, Evaded, Direct Hit) */}
      {outcomeBanner && (
        <div className="absolute top-20 inset-x-0 flex justify-center z-30 pointer-events-none animate-bounce">
          <div
            className={`px-6 py-3 rounded-2xl border-2 backdrop-blur-md shadow-2xl text-center max-w-lg ${
              outcomeBanner.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-300'
                : outcomeBanner.type === 'evaded'
                ? 'bg-cyan-950/95 border-cyan-500 text-cyan-300'
                : 'bg-red-950/95 border-red-500 text-red-300'
            }`}
          >
            <div className="text-base font-tactical font-black tracking-wider">{outcomeBanner.title}</div>
            <div className="text-xs mt-0.5 font-bold">{outcomeBanner.subtitle}</div>
          </div>
        </div>
      )}

      {/* TOP TACTICAL HUD: Alert Ribbon, Distance Countdown & Wave Controls */}
      <div className="absolute top-3 inset-x-4 flex items-center justify-between pointer-events-none z-20 text-xs">
        {/* Threat Alert Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold ${
            alertLevel === 'high'
              ? 'bg-red-950/95 border-red-500 text-red-300 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]'
              : alertLevel === 'med'
              ? 'bg-amber-950/90 border-amber-500 text-amber-300'
              : 'bg-slate-900/90 border-slate-700 text-cyan-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{combatAlertText}</span>
        </div>

        {/* Big Countdown / Range Display */}
        {nearestDist < 200 && (
          <div className="bg-slate-950/95 border-2 border-red-500 rounded-xl px-4 py-1.5 flex items-center gap-3 text-red-400 font-black shadow-2xl">
            <span>TARGET RANGE: <span className="text-white text-sm">{nearestDist}M</span></span>
            <span className="text-slate-600">|</span>
            <span>IMPACT IN: <span className="text-amber-400 text-sm">{impactTimeEst}s</span></span>
          </div>
        )}

        {/* Wave Selector & Finish Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleNextWave}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition flex items-center gap-1 shadow-lg"
          >
            <FastForward className="w-3.5 h-3.5" /> WAVE {currentWave} (NEXT)
          </button>

          <button
            onClick={handleCompleteMission}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition shadow-lg"
          >
            FINISH DRILL
          </button>
        </div>
      </div>

      {/* PROMINENT TACTICAL DIRECTIVE BANNER (The 2 Choices: SHOOT vs EVADE) */}
      <div className="absolute top-16 left-4 z-20 pointer-events-none max-w-sm">
        <div className="bg-slate-950/95 border border-cyan-500/60 rounded-xl p-3 shadow-2xl backdrop-blur space-y-1.5 text-[11px]">
          <div className="text-cyan-400 font-bold uppercase tracking-wide flex items-center gap-1.5 pb-1 border-b border-slate-800">
            <Shield className="w-3.5 h-3.5" /> SOLDIER TACTICAL MISSION:
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="px-1.5 py-0.5 rounded bg-cyan-900 border border-cyan-500 text-cyan-300 font-bold">1. SHOOT</span>
            <span>Hold <span className="text-cyan-300 font-bold">Left Click</span> (RF Beam) or press <span className="text-cyan-300 font-bold">SPACE</span></span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="px-1.5 py-0.5 rounded bg-amber-900 border border-amber-500 text-amber-300 font-bold">2. EVADE</span>
            <span>Press <span className="text-amber-300 font-bold">C</span> (Sandbag Cover) or <span className="text-amber-300 font-bold">Shift+S</span> (Run to Bunker)</span>
          </div>
        </div>
      </div>

      {/* SMART SCOPE / ADS OVERLAY WHEN AIMING */}
      {aimingActive && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="w-80 h-80 rounded-full border-2 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.4)] relative flex items-center justify-center">
            <div className="absolute -top-6 text-[11px] font-mono font-bold text-cyan-300">
              SMART SCOPE // 3.2X OPTICAL ZOOM
            </div>
            <div className="w-full h-[1px] bg-cyan-400/50" />
            <div className="h-full w-[1px] bg-cyan-400/50" />
            <div className="w-4 h-4 border border-red-500 rounded-full bg-red-500/20" />

            {lockedDrone && (
              <div className="absolute bottom-6 px-3 py-1 bg-black/90 border border-red-500 rounded text-[10px] text-red-300 font-bold">
                RANGE: {Math.round(lockedDrone.position.distanceTo(soldierRef.current?.position || new THREE.Vector3()))}M | {lockedDrone.modelName}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOLDIER HUD BOTTOM BAR: Battery, Stance, and Direct Click Buttons */}
      <div className="absolute bottom-3 inset-x-4 flex flex-col md:flex-row items-end justify-between gap-3 z-20 pointer-events-none">
        {/* Left: Weapon State & Battery */}
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-3 space-y-2 text-xs w-64 pointer-events-auto shadow-2xl">
          <div className="flex justify-between items-center pb-1 border-b border-slate-800">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" /> ANTI-DRONE RF JAMMER
            </span>
            <span className="text-[10px] text-cyan-400 font-bold">DIRECTED EW</span>
          </div>

          {/* Battery Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">JAMMER BATTERY:</span>
              <span className={`font-bold ${jammerBattery < 25 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                {Math.round(jammerBattery)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  jammerBattery < 25 ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${jammerBattery}%` }}
              />
            </div>
          </div>

          {/* Soldier Stance Status */}
          <div className="flex justify-between items-center pt-1 text-[10px]">
            <span className="text-slate-400">CURRENT STANCE:</span>
            <span className={`font-bold uppercase ${inCover ? 'text-emerald-400' : 'text-amber-400'}`}>
              {inCover ? '🛡️ IN COVER BEHIND SANDBAGS (C)' : '🧍 STANDING EXPOSED'}
            </span>
          </div>
        </div>

        {/* Center: Soldier Tactical Action Buttons (Clickable + Keybinds) */}
        <div className="flex items-center gap-2 bg-slate-950/95 border border-cyan-500/50 rounded-xl p-2.5 pointer-events-auto shadow-2xl text-xs">
          {/* Action 1: Shoot RF Jammer */}
          <button
            onMouseDown={() => {
              setIsFiringJammer(true);
              soundFx.setJammerBeam(true);
            }}
            onMouseUp={() => {
              setIsFiringJammer(false);
              soundFx.setJammerBeam(false);
            }}
            className="px-3.5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95"
          >
            <Zap className="w-4 h-4" /> HOLD: RF JAMMER (LMB)
          </button>

          {/* Action 2: Kinetic Airburst Shot */}
          <button
            onClick={handleFireKinetic}
            className="px-3.5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-red-500/20 active:scale-95"
          >
            <Crosshair className="w-4 h-4" /> KINETIC SHOT (SPACE)
          </button>

          {/* Action 3: Take Cover behind Sandbags */}
          <button
            onClick={() => setInCover(!inCover)}
            className={`px-3.5 py-2.5 rounded-lg border font-bold transition flex items-center gap-1.5 active:scale-95 ${
              inCover
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_12px_#10b981]'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" /> {inCover ? 'STAND UP (C)' : 'TAKE COVER (C)'}
          </button>

          {/* Action 4: Run to Bunker */}
          <button
            onClick={() => {
              if (soldierRef.current) {
                soldierRef.current.position.z = 8.0;
                soundFx.playFootstep();
              }
            }}
            className="px-3.5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
            title="Retreat into reinforced command bunker"
          >
            <ArrowRight className="w-4 h-4" /> RUN TO BUNKER (S)
          </button>

          {/* Action 5: Night Vision Toggle */}
          <button
            onClick={() => setNvgActive(!nvgActive)}
            className={`p-2.5 rounded-lg border transition ${
              nvgActive ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Toggle Night Vision (N)"
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Key Controls Reference */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-[10px] text-slate-400 space-y-1">
          <div><span className="text-cyan-400 font-bold">W / S</span> : Walk / Run to bunker</div>
          <div><span className="text-cyan-400 font-bold">LMB / SPACE</span> : Jammer / Kinetic Shot</div>
          <div><span className="text-cyan-400 font-bold">C</span> : Take Cover | <span className="text-cyan-400 font-bold">RMB</span> : Zoom Scope</div>
        </div>
      </div>
    </div>
  );
};
