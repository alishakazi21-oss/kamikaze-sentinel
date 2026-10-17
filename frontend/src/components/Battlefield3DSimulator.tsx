import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { soundFx } from '../utils/audio';
import { Shield, Crosshair, AlertTriangle, Radio, Eye, Zap, Volume2, VolumeX, Moon, Sun, RotateCcw, ArrowRight, Play, FastForward } from 'lucide-react';
import { TargetClass } from '../types';

interface DroneEntity {
  id: string;
  type: TargetClass;
  modelName: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  health: number; // 100 to 0
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
  const [combatAlertText, setCombatAlertText] = useState<string>('AIRSPACE CLEAR // SCANNING HORIZON');
  const [alertLevel, setAlertLevel] = useState<'low' | 'med' | 'high'>('low');
  const [nearestDist, setNearestDist] = useState<number>(140);
  const [impactTimeEst, setImpactTimeEst] = useState<number>(8.5);

  // Logs of actions taken for scoring
  const eventsLogRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const neutralizedCountRef = useRef<number>(0);
  const totalDronesCountRef = useRef<number>(0);
  const waveRef = useRef<number>(1);

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
  const tracerParticlesRef = useRef<THREE.Points | null>(null);
  const explosionsRef = useRef<{ group: THREE.Group; life: number }[]>([]);

  // Function to spawn threats based on wave
  const spawnThreatWave = useCallback((waveNum: number, currentScene: THREE.Scene) => {
    // Clean up existing drones
    dronesRef.current.forEach((d) => {
      currentScene.remove(d.mesh);
    });
    dronesRef.current = [];

    const newDrones: DroneEntity[] = [];

    const createDroneMesh = (type: TargetClass) => {
      const droneGrp = new THREE.Group();

      // Main fuselage - Large delta loitering munition (2.4m wingspan)
      const isKamikaze = type === 'hostile';
      const bodyColor = isKamikaze ? 0x1e293b : 0x065f46;

      // Delta Wing Body
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 1.4); // Nose
      wingShape.lineTo(1.3, -1.0); // Right wingtip
      wingShape.lineTo(0.3, -0.7); // Right inboard
      wingShape.lineTo(0, -0.6); // Center tail
      wingShape.lineTo(-0.3, -0.7); // Left inboard
      wingShape.lineTo(-1.3, -1.0); // Left wingtip
      wingShape.closePath();

      const extrudeSettings = { depth: 0.22, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };
      const wingGeom = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      const wingMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.35,
        metalness: 0.8,
      });
      const wingMesh = new THREE.Mesh(wingGeom, wingMat);
      wingMesh.rotation.x = Math.PI / 2;
      wingMesh.rotation.z = Math.PI;
      wingMesh.castShadow = true;
      droneGrp.add(wingMesh);

      // Military Hazard Orange/Yellow Chevrons on wingtips for high visibility
      const stripeMat = new THREE.MeshBasicMaterial({ color: isKamikaze ? 0xf97316 : 0x10b981 });
      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.15), stripeMat);
      stripeL.position.set(-1.1, 0, -0.8);
      droneGrp.add(stripeL);
      const stripeR = stripeL.clone();
      stripeR.position.set(1.1, 0, -0.8);
      droneGrp.add(stripeR);

      // Fuselage central spine / seeker head
      const seekerGeom = new THREE.SphereGeometry(0.2, 12, 12);
      const seekerMat = new THREE.MeshStandardMaterial({
        color: isKamikaze ? 0xef4444 : 0x38bdf8,
        emissive: isKamikaze ? 0x991b1b : 0x0369a1,
        roughness: 0.2,
      });
      const seeker = new THREE.Mesh(seekerGeom, seekerMat);
      seeker.position.set(0, 0, 1.4);
      droneGrp.add(seeker);

      // 4 High-Speed Rotor Disks on outriggers
      const rotorList: THREE.Mesh[] = [];
      const rotorDiskMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });

      const rotorPositions = [
        [-0.8, 0.12, 0.5],
        [0.8, 0.12, 0.5],
        [-0.9, 0.12, -0.6],
        [0.9, 0.12, -0.6],
      ];

      rotorPositions.forEach(([rx, ry, rz]) => {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x0f172a })
        );
        pylon.position.set(rx, ry - 0.1, rz);
        droneGrp.add(pylon);

        const rDisk = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), rotorDiskMat);
        rDisk.rotation.x = Math.PI / 2;
        rDisk.position.set(rx, ry, rz);
        droneGrp.add(rDisk);
        rotorList.push(rDisk);
      });

      // Ultra-bright flashing red strobe light
      const strobeLight = new THREE.PointLight(isKamikaze ? 0xff2222 : 0x22ff22, 6, 40);
      strobeLight.position.set(0, 0.3, 0);
      droneGrp.add(strobeLight);

      const strobeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: isKamikaze ? 0xff0000 : 0x00ff00 })
      );
      strobeMesh.position.set(0, 0.3, 0);
      droneGrp.add(strobeMesh);

      // Engine exhaust glow
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(0, 0, -1.0);
      droneGrp.add(exhaust);

      return { grp: droneGrp, rotors: rotorList, strobeLight, strobeMesh };
    };

    if (waveNum === 1) {
      // WAVE 1: Direct Straight-In Kamikaze Dive Attack (Directly in front at z = -140)
      const { grp, rotors, strobeLight, strobeMesh } = createDroneMesh('hostile');
      grp.position.set(0, 28, -145);
      currentScene.add(grp);

      newDrones.push({
        id: 'KAMIKAZE-ALPHA-01',
        type: 'hostile',
        modelName: 'Shahed-136 Loitering Munition (Direct Dive)',
        position: grp.position,
        velocity: new THREE.Vector3(0, -0.18, 0.98).normalize(),
        targetPos: new THREE.Vector3(0, 1.2, 0), // Soldier outpost
        speed: 15.5,
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
      grp.position.set(25, 24, -135);
      currentScene.add(grp);

      newDrones.push({
        id: 'FPV-RACER-02',
        type: 'hostile',
        modelName: 'High-Speed FPV Kamikaze (Shaped Charge)',
        position: grp.position,
        velocity: new THREE.Vector3(-0.25, -0.16, 0.95).normalize(),
        targetPos: new THREE.Vector3(0, 1.2, 0),
        speed: 19.0,
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
      [-28, 28].forEach((startX, idx) => {
        const { grp, rotors, strobeLight, strobeMesh } = createDroneMesh('hostile');
        grp.position.set(startX, 32, -150 - idx * 10);
        currentScene.add(grp);

        newDrones.push({
          id: `SWARM-PINCER-0${idx + 1}`,
          type: 'hostile',
          modelName: `Swarm Drone Delta-${idx + 1}`,
          position: grp.position,
          velocity: new THREE.Vector3(-startX * 0.015, -0.2, 0.96).normalize(),
          targetPos: new THREE.Vector3(0, 1.2, 0),
          speed: 16.0,
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
    const height = container.clientHeight || 650;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Crisp, High-Contrast Atmospheric Sky & Lighting
    let skyColor = 0x0284c7; // Deep military sky blue
    let groundColor = 0x475569; // Tactical slate khaki
    let ambientIntensity = 1.1;
    let sunIntensity = 1.8;

    if (timeOfDay === 'night') {
      skyColor = 0x020617;
      groundColor = 0x0f172a;
      ambientIntensity = 0.3;
      sunIntensity = 0.2;
    } else if (timeOfDay === 'dusk') {
      skyColor = 0xd97706;
      groundColor = 0x3f2e21;
      ambientIntensity = 0.7;
      sunIntensity = 1.4;
    }

    scene.background = new THREE.Color(skyColor);
    // Light distance haze starting at 180m so everything ahead is 100% visible
    scene.fog = new THREE.Fog(skyColor, 180, 500);

    // CAMERA - Looking along -Z (Straight ahead onto the battlefield)
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 1.7, 0); // Soldier eye level: 1.7m
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(timeOfDay === 'dusk' ? 0xffaa44 : 0xffffff, sunIntensity);
    sunLight.position.set(100, 200, -80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // 2. BATTLEFIELD TERRAIN & OUTPOST
    // Ground Terrain
    const terrainSize = 700;
    const groundGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, 48, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Perimeter Access Road
    const roadGeom = new THREE.PlaneGeometry(12, terrainSize);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(18, 0.04, 0);
    road.receiveShadow = true;
    scene.add(road);

    // Command Bunker BEHIND Soldier (at z = +14)
    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(0, 0, 15);

    const bunkerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 5, 12),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    bunkerMesh.position.set(0, 2.5, 0);
    bunkerMesh.castShadow = true;
    bunkerMesh.receiveShadow = true;
    bunkerGroup.add(bunkerMesh);

    // Reinforced Bunker Blast Door
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 })
    );
    doorMesh.position.set(0, 1.6, -6.1);
    bunkerGroup.add(doorMesh);

    // Spinning Radar Mast on Bunker Roof
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

    // Watchtower on flank (x = -20, z = -10)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-20, 0, -10);
    const towerLegMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
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
    const sandbagGeom = new THREE.BoxGeometry(1.2, 0.4, 0.55);

    const createSandbagWall = (startX: number, startZ: number, count: number, angleDeg: number) => {
      const rad = THREE.MathUtils.degToRad(angleDeg);
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < count; i++) {
          const bag = new THREE.Mesh(sandbagGeom, sandbagMat);
          const offset = (i - count / 2) * 1.1;
          bag.position.set(
            startX + Math.cos(rad) * offset,
            0.2 + layer * 0.38,
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

    // Decorative distance pine trees on horizon
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const dist = 70 + (i % 5) * 25;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;
      if (Math.abs(tx) < 15 && tz < 0 && tz > -180) continue; // Keep flight corridor clear

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
    // Weapon housing body
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.18, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.85 })
    );
    weaponGroup.add(bodyMesh);

    // Front Directed Conical RF Antenna (Muzzle Horn)
    const hornGeom = new THREE.ConeGeometry(0.14, 0.35, 12, 1, true);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.9 });
    const horn = new THREE.Mesh(hornGeom, hornMat);
    horn.rotation.x = -Math.PI / 2;
    horn.position.set(0, 0, -0.5);
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
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    reticleGlass.position.set(0, 0.13, -0.13);
    weaponGroup.add(reticleGlass);

    // Tactical Flashlight attached to weapon
    const flashlight = new THREE.SpotLight(0xffffff, flashlightActive ? 5 : 0, 90, Math.PI / 6, 0.3);
    flashlight.position.set(0.12, 0, -0.4);
    flashlight.target.position.set(0, 0, -10);
    weaponGroup.add(flashlight);
    weaponGroup.add(flashlight.target);

    // Laser sight targeting line
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75 });
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
    const beamGeom = new THREE.CylinderGeometry(0.1, 3.0, 160, 8, 1, true);
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

    // 5. EVENT LISTENERS
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
        // Toggle Crouch / Take Cover behind sandbags
        setInCover((prev) => !prev);
      }
      if (e.code === 'KeyV') {
        setThirdPerson((prev) => !prev);
      }
      if (e.code === 'KeyR') {
        handleRadioHQ();
      }
      if (e.code === 'Space') {
        // SPACE: Kinetic Interceptor Shot
        handleFireKinetic();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isPointerLocked) {
        container.requestPointerLock?.();
        return;
      }
      if (e.button === 0) {
        // LMB: Fire RF Jammer
        setIsFiringJammer(true);
        soundFx.setJammerBeam(true);
      } else if (e.button === 2) {
        // RMB: Aim Down Sights (ADS)
        setAimingActive(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setIsFiringJammer(false);
        soundFx.setJammerBeam(false);
      } else if (e.button === 2) {
        setAimingActive(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked || !soldierRef.current) return;
      const sensitivity = 0.0022;
      const soldier = soldierRef.current;

      soldier.rotation.yaw -= e.movementX * sensitivity;
      soldier.rotation.pitch -= e.movementY * sensitivity;
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

      // A. Soldier Movement & Physics
      // Forward is along -Z, Right is along +X
      const keys = keysRef.current;
      const isShift = keys['ShiftLeft'] || keys['ShiftRight'];
      const moveSpeed = (isShift ? 7.0 : 3.8) * delta;

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

        // Position bounds:
        // z: -3.4 (sandbag wall) to +12.0 (inside bunker)
        // x: -8.0 to +8.0
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
        // Offset camera behind soldier (along +Z)
        const camOffset = new THREE.Vector3(0, 1.2, 3.2);
        camOffset.applyEuler(new THREE.Euler(soldier.rotation.pitch, soldier.rotation.yaw, 0, 'YXZ'));
        camera.position.copy(soldier.position).add(camOffset);
      } else {
        camera.position.copy(soldier.position);
      }

      // Weapon Aim Down Sight (ADS) Animation
      const targetWeaponPos = aimingActive
        ? new THREE.Vector3(0, -0.12, -0.32)
        : new THREE.Vector3(0.24, -0.22, -0.5);
      soldier.weaponGroup.position.lerp(targetWeaponPos, 0.2);

      const targetFov = aimingActive ? 32 : 65;
      camera.fov += (targetFov - camera.fov) * 0.2;
      camera.updateProjectionMatrix();

      // Spinning Radar Dish on bunker
      radarDish.rotation.z += 0.02;

      // Strobe Light pulsation
      strobeTimer += delta * 8;
      const strobeOn = Math.sin(strobeTimer) > 0;

      // D. DRONE KINEMATICS, AI & IMPACT DETECTION
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

        // Calculate Screen-space projection for tactical HUD brackets
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
          setJammerBattery((prev) => Math.max(0, prev - delta * 22));
          drone.health -= delta * 65;

          // Erratic electronic interference wobble
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
          const targetImpactPoint = new THREE.Vector3(0, 1.0, 0); // Outpost sandbag line
          const dir = targetImpactPoint.clone().sub(drone.position).normalize();
          drone.velocity.lerp(dir, 0.035);
          drone.position.addScaledVector(drone.velocity, drone.speed * delta);
          drone.mesh.lookAt(drone.position.clone().add(drone.velocity));

          // CHECK IMPACT AT OUTPOST
          // If drone reaches within 4.5m of outpost forward trench (z > -4.0 and z < 3.0)
          if (drone.position.z >= -3.5 && drone.position.y <= 3.5) {
            drone.status = 'destroyed';
            scene.remove(drone.mesh);
            soundFx.playExplosion();

            // Evaluate Soldier Tactical Choice: Did soldier take cover or run away?
            const soldierDistFromImpact = soldier.position.distanceTo(new THREE.Vector3(0, 1.0, -3.5));
            const hasRunAway = soldier.position.z >= 4.0; // Ran back towards bunker
            const isSafe = inCover || hasRunAway;

            if (isSafe) {
              // SUCCESSFUL EVASION / COVER!
              soundFx.playNearMissWhoosh();
              setOutcomeBanner({
                title: '💥 IMPACT SURVIVED!',
                subtitle: hasRunAway
                  ? '🏃 Tactical Evasion: You sprinted to the bunker and escaped the blast! (+80 PTS)'
                  : '🛡️ Cover Effective: You ducked behind sandbags and survived the detonation! (+80 PTS)',
                type: 'evaded',
              });
              setBaseIntegrity((b) => Math.max(0, b - 10));

              eventsLogRef.current.push({
                action: hasRunAway ? 'sprinted_to_safety' : 'took_cover_behind_sandbags',
                time: (Date.now() - startTimeRef.current) / 1000,
                success: true,
              });
            } else {
              // SOLDIER WAS STANDING IN THE OPEN AT THE BLAST ZONE!
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
          // Spiraling crash
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
      const estTime = closestDist / 16.0;
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
      if (closestDist < 50) {
        setCombatAlertText(`⚠️ CRITICAL: KAMIKAZE DRONE ${Math.round(closestDist)}M! SHOOT OR EVADE NOW!`);
        setAlertLevel('high');
      } else if (closestDist < 120) {
        setCombatAlertText(`🚨 THREAT INCOMING: ${Math.round(closestDist)}M DIRECTLY AHEAD`);
        setAlertLevel('med');
      } else {
        setCombatAlertText('AIRSPACE SCANNING // INCOMING DRONE DETECTED');
        setAlertLevel('low');
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

  // Trigger Next Threat Wave
  const handleNextWave = () => {
    soundFx.playButtonClick();
    const nextW = (currentWave % 3) + 1;
    setCurrentWave(nextW);
    waveRef.current = nextW;
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
    <div className="relative w-full h-[680px] bg-black rounded-2xl overflow-hidden border border-cyan-500/40 shadow-2xl select-none font-mono">
      {/* 3D WebGL Canvas Container */}
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

      {/* Pointer Lock Instruction Banner when unlocked */}
      {!isPointerLocked && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-4 z-40">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400 tactical-glow-cyan">
            <Crosshair className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-tactical font-black text-slate-100">
            CLICK TO TAKE COMMAND OF VIRTUAL SOLDIER
          </h2>
          <div className="max-w-md bg-slate-900/90 border border-cyan-500/40 rounded-xl p-4 text-xs text-left text-slate-300 space-y-2">
            <p className="text-cyan-400 font-bold uppercase tracking-wider">🎯 SOLDIER MISSION DIRECTIVE:</p>
            <p>1. <span className="text-white font-bold">Drone samne se seedha aapki taraf aa raha hai!</span></p>
            <p>2. <span className="text-emerald-400 font-bold">SHOOT KAREIN</span>: Hold <span className="text-cyan-300 font-bold">Left Click</span> (RF Jammer Beam) ya press <span className="text-cyan-300 font-bold">SPACE</span> (Kinetic Shot).</p>
            <p>3. <span className="text-amber-400 font-bold">RUN / COVER LEIN</span>: Press <span className="text-amber-300 font-bold">C</span> to duck behind sandbags OR hold <span className="text-amber-300 font-bold">Shift+S</span> to sprint into the bunker!</p>
          </div>
          <button className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg">
            ENGAGE 3D COMBAT SIMULATION
          </button>
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
              <div className="w-10 h-10 border-2 border-red-500 rotate-45 animate-pulse bg-red-500/20 flex items-center justify-center shadow-[0_0_15px_#ef4444]" />
              <div className="mt-2 px-2.5 py-1 bg-black/90 border border-red-500 rounded text-[10px] text-red-300 font-bold flex flex-col items-center whitespace-nowrap shadow-xl">
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> HOSTILE KAMIKAZE
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
          <div className="bg-slate-950/90 border-2 border-red-500/80 rounded-xl px-4 py-1.5 flex items-center gap-3 text-red-400 font-black shadow-lg">
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
        <div className="bg-slate-950/90 border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur space-y-1.5 text-[11px]">
          <div className="text-cyan-400 font-bold uppercase tracking-wide flex items-center gap-1.5 pb-1 border-b border-slate-800">
            <Shield className="w-3.5 h-3.5" /> TACTICAL RESPONSE OPTIONS:
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
        <div className="flex items-center gap-2 bg-slate-950/95 border border-cyan-500/40 rounded-xl p-2.5 pointer-events-auto shadow-2xl text-xs">
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
            className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <Zap className="w-4 h-4" /> HOLD: RF JAMMER (LMB)
          </button>

          {/* Action 2: Kinetic Airburst Shot */}
          <button
            onClick={handleFireKinetic}
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-red-500/20"
          >
            <Crosshair className="w-4 h-4" /> KINETIC SHOT (SPACE)
          </button>

          {/* Action 3: Take Cover behind Sandbags */}
          <button
            onClick={() => setInCover(!inCover)}
            className={`px-3 py-2 rounded-lg border font-bold transition flex items-center gap-1.5 ${
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
                soldierRef.current.position.z = 8.0; // Instantly retreat to bunker
                soundFx.playFootstep();
              }
            }}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-md"
            title="Retreat into reinforced command bunker"
          >
            <ArrowRight className="w-4 h-4" /> RUN TO BUNKER (S)
          </button>

          {/* Action 5: Night Vision Toggle */}
          <button
            onClick={() => setNvgActive(!nvgActive)}
            className={`p-2 rounded-lg border transition ${
              nvgActive ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="Toggle Night Vision (N)"
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Key Controls Reference */}
        <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-2.5 text-[10px] text-slate-400 space-y-1">
          <div><span className="text-cyan-400 font-bold">W / S</span> : Walk forward / Run to bunker</div>
          <div><span className="text-cyan-400 font-bold">LMB / SPACE</span> : Shoot Jammer / Kinetic</div>
          <div><span className="text-cyan-400 font-bold">C</span> : Take Cover | <span className="text-cyan-400 font-bold">RMB</span> : Zoom Scope</div>
        </div>
      </div>
    </div>
  );
};
