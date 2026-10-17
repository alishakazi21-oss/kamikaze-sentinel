import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { soundFx } from '../utils/audio';
import { Shield, Crosshair, AlertTriangle, Radio, Eye, Zap, Volume2, VolumeX, Moon, Sun, RotateCcw } from 'lucide-react';
import { TargetClass, ResponseOption } from '../types';

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
  smokeEmitter?: boolean;
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
  threatType = 'swarm_wedge',
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

  // Combat Intelligence HUD state
  const [activeDronesList, setActiveDronesList] = useState<{ id: string; type: TargetClass; dist: number; status: string }[]>([]);
  const [lockedDrone, setLockedDrone] = useState<DroneEntity | null>(null);
  const [headingDegrees, setHeadingDegrees] = useState<number>(0);
  const [combatAlertText, setCombatAlertText] = useState<string>('AIRSPACE MONITORED // DEFCON 3');
  const [alertLevel, setAlertLevel] = useState<'low' | 'med' | 'high'>('low');

  // Logs of actions taken for scoring
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
  const particlesRef = useRef<THREE.Points | null>(null);
  const beamMeshRef = useRef<THREE.Mesh | null>(null);

  // 1. Initialize 3D Battlefield World
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 650;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lighting & Atmosphere based on time of day
    let skyColor = 0x87ceeb;
    let groundColor = 0x5a6351;
    let fogColor = 0xb0c4de;
    let ambientIntensity = 0.8;

    if (timeOfDay === 'night') {
      skyColor = 0x030712;
      groundColor = 0x0f172a;
      fogColor = 0x030712;
      ambientIntensity = 0.15;
    } else if (timeOfDay === 'dusk') {
      skyColor = 0xfd7e14;
      groundColor = 0x47392b;
      fogColor = 0xd97706;
      ambientIntensity = 0.5;
    }

    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.0035);

    // CAMERA
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
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

    const sunLight = new THREE.DirectionalLight(timeOfDay === 'dusk' ? 0xffaa44 : 0xffffff, timeOfDay === 'night' ? 0.2 : 1.2);
    sunLight.position.set(150, 250, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 2. BATTLEFIELD ENVIRONMENT (Ground, FOB, Sandbags, Watchtower, Bunkers)
    // Ground Terrain
    const terrainSize = 800;
    const groundGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, 64, 64);
    // Subtle height displacement for natural hills
    const posAttr = groundGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      if (Math.abs(vx) > 30 || Math.abs(vy) > 30) {
        posAttr.setZ(i, Math.sin(vx * 0.02) * Math.cos(vy * 0.02) * 5.0 + Math.sin(vx * 0.05) * 2.0);
      }
    }
    groundGeom.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Road strip passing by the base
    const roadGeom = new THREE.PlaneGeometry(16, terrainSize);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(25, 0.05, 0);
    road.receiveShadow = true;
    scene.add(road);

    // Concrete Command Bunker (behind soldier)
    const bunkerGroup = new THREE.Group();
    const bunkerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
    );
    bunkerMesh.position.set(0, 2.25, -10);
    bunkerMesh.castShadow = true;
    bunkerMesh.receiveShadow = true;
    bunkerGroup.add(bunkerMesh);

    // Radar dish on bunker roof (spinning)
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    dishMast.position.set(0, 5.5, -10);
    bunkerGroup.add(dishMast);

    const radarDish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0284c7, side: THREE.DoubleSide }));
    radarDish.position.set(0, 6.8, -10);
    radarDish.rotation.x = Math.PI / 4;
    bunkerGroup.add(radarDish);
    scene.add(bunkerGroup);

    // Watchtower
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-20, 0, -20);
    const towerLegMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    for (const [tx, tz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12), towerLegMat);
      leg.position.set(tx, 6, tz);
      towerGroup.add(leg);
    }
    const towerCabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 5), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    towerCabin.position.set(0, 12, 0);
    towerGroup.add(towerCabin);
    scene.add(towerGroup);

    // Sandbag Walls around Soldier's forward firing trench
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.95 });
    const sandbagGeom = new THREE.BoxGeometry(1.2, 0.4, 0.6);

    const createSandbagWall = (startX: number, startZ: number, count: number, angleDeg: number) => {
      const rad = THREE.MathUtils.degToRad(angleDeg);
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < count; i++) {
          const bag = new THREE.Mesh(sandbagGeom, sandbagMat);
          const dist = (i - count / 2) * 1.15;
          bag.position.set(
            startX + Math.cos(rad) * dist,
            0.2 + layer * 0.38,
            startZ + Math.sin(rad) * dist
          );
          bag.rotation.y = rad;
          bag.castShadow = true;
          bag.receiveShadow = true;
          scene.add(bag);
        }
      }
    };

    // Front defensive semicircle of sandbags (soldier stands behind these)
    createSandbagWall(0, 3.5, 8, 0);
    createSandbagWall(-4.5, 2.0, 5, 45);
    createSandbagWall(4.5, 2.0, 5, -45);

    // Military Pine Trees & Barricades in distance
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 60 + Math.random() * 120;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4), trunkMat);
      trunk.position.y = 2;
      tree.add(trunk);

      const foliage = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 7), treeMat);
      foliage.position.y = 7;
      foliage.castShadow = true;
      tree.add(foliage);

      tree.position.set(tx, 0, tz);
      scene.add(tree);
    }

    // 3. SOLDIER FPS WEAPON: Tactical Anti-Drone Directed Energy / RF Jammer Gun
    const weaponGroup = new THREE.Group();
    // Weapon housing body
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
    );
    weaponGroup.add(bodyMesh);

    // Front Directed Conical RF Antenna (Muzzle Horn)
    const hornGeom = new THREE.ConeGeometry(0.12, 0.3, 12, 1, true);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2, metalness: 0.9 });
    const horn = new THREE.Mesh(hornGeom, hornMat);
    horn.rotation.x = -Math.PI / 2;
    horn.position.set(0, 0, -0.45);
    weaponGroup.add(horn);

    // Emitter Coils with glowing cyan rings
    for (let c = 0; c < 3; c++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.015, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      ring.position.set(0, 0, -0.2 - c * 0.1);
      weaponGroup.add(ring);
    }

    // Holographic Reflex Sight with glowing reticle
    const sightBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    sightBox.position.set(0, 0.12, -0.05);
    weaponGroup.add(sightBox);

    const reticleGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    reticleGlass.position.set(0, 0.12, -0.12);
    weaponGroup.add(reticleGlass);

    // Tactical Flashlight attached to weapon
    const flashlight = new THREE.SpotLight(0xffffff, flashlightActive ? 5 : 0, 80, Math.PI / 6, 0.3);
    flashlight.position.set(0.1, 0, -0.4);
    flashlight.target.position.set(0, 0, -10);
    weaponGroup.add(flashlight);
    weaponGroup.add(flashlight.target);

    // Laser sight targeting line
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 });
    const laserGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.05, -0.4),
      new THREE.Vector3(0, 0.05, -150),
    ]);
    const laserLine = new THREE.Line(laserGeom, laserMat);
    weaponGroup.add(laserLine);

    // Position weapon in lower right screen (classic FPS posture)
    weaponGroup.position.set(0.24, -0.22, -0.5);
    camera.add(weaponGroup);
    scene.add(camera);

    // Jammer Energy Beam mesh (hidden until firing)
    const beamGeom = new THREE.CylinderGeometry(0.08, 2.5, 120, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const beamMesh = new THREE.Mesh(beamGeom, beamMat);
    beamMesh.rotation.x = -Math.PI / 2;
    beamMesh.position.set(0, 0, -60);
    camera.add(beamMesh);
    beamMeshRef.current = beamMesh;

    soldierRef.current = {
      position: new THREE.Vector3(0, 1.7, 0),
      rotation: { pitch: 0, yaw: 0 },
      weaponGroup,
      flashlight,
      laserLine,
    };

    // 4. SPAWN 3D DRONE THREAT SCENARIOS (Kamikaze loiter, Swarm wedge, Friendlies, Birds)
    const createDroneMesh = (type: TargetClass) => {
      const droneGrp = new THREE.Group();
      const color = type === 'hostile' ? 0xef4444 : type === 'friendly' ? 0x10b981 : type === 'civil' ? 0xf59e0b : 0x94a3b8;

      if (type === 'false_alarm') {
        // Avian bird model with wings
        const birdBody = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x64748b }));
        birdBody.rotation.x = Math.PI / 2;
        droneGrp.add(birdBody);
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x475569 }));
        wingL.position.set(-0.8, 0, 0);
        droneGrp.add(wingL);
        const wingR = wingL.clone();
        wingR.position.set(0.8, 0, 0);
        droneGrp.add(wingR);
        return { grp: droneGrp, rotors: [] };
      }

      // Fuselage
      const fuselage = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.25, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      droneGrp.add(fuselage);

      // Arm booms
      const armMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6), armMat);
      arm1.rotation.z = Math.PI / 4;
      droneGrp.add(arm1);

      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6), armMat);
      arm2.rotation.z = -Math.PI / 4;
      droneGrp.add(arm2);

      // 4 Motor pods & spinning rotor disks
      const rotorList: THREE.Mesh[] = [];
      const rotorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
      const offsets = [
        [-0.6, 0.15, -0.6],
        [0.6, 0.15, -0.6],
        [-0.6, 0.15, 0.6],
        [0.6, 0.15, 0.6],
      ];
      offsets.forEach(([ox, oy, oz]) => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        pod.position.set(ox, oy, oz);
        droneGrp.add(pod);

        const rDisk = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), rotorMat);
        rDisk.rotation.x = Math.PI / 2;
        rDisk.position.set(ox, oy + 0.12, oz);
        droneGrp.add(rDisk);
        rotorList.push(rDisk);
      });

      // Beacon Strobe light (Red for hostile, Green for friendly)
      const strobe = new THREE.PointLight(color, 2, 10);
      strobe.position.set(0, -0.2, 0);
      droneGrp.add(strobe);

      return { grp: droneGrp, rotors: rotorList };
    };

    // Instantiate Threat Drones according to scenario
    const spawnedDrones: DroneEntity[] = [];

    if (threatType === 'single') {
      // Single diving loitering munition
      const { grp, rotors } = createDroneMesh('hostile');
      grp.position.set(40, 60, 180);
      scene.add(grp);
      spawnedDrones.push({
        id: 'UAV-HOSTILE-01',
        type: 'hostile',
        modelName: 'Loitering Kamikaze Munition (Shahed-136)',
        position: grp.position,
        velocity: new THREE.Vector3(-0.2, -0.25, -0.9).normalize(),
        targetPos: new THREE.Vector3(0, 1.5, 0),
        speed: 16.0,
        health: 100,
        status: 'flying',
        mesh: grp,
        trailPoints: [],
        rotors,
      });
    } else {
      // Tactical Swarm Formation (4-6 drones swooping in formation)
      const count = Math.min(6, 3 + difficulty * 2);
      for (let i = 0; i < count; i++) {
        let tCls: TargetClass = 'hostile';
        let mName = `Swarm Drone Delta-${i + 1} (Kamikaze)`;

        if (i === count - 1 && difficulty === 1) {
          tCls = 'friendly';
          mName = 'Patrol UAS Netra (Friendly Blue-Force)';
        } else if (i === count - 2 && difficulty >= 2) {
          tCls = 'false_alarm';
          mName = 'Avian Bird Cluster (Radar Clutter)';
        }

        const { grp, rotors } = createDroneMesh(tCls);
        // Wedge formation positioning
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 1 ? -1 : 1;
        const startX = i === 0 ? 0 : side * row * 18;
        const startY = 45 + row * 6;
        const startZ = 220 + row * 25;

        grp.position.set(startX, startY, startZ);
        scene.add(grp);

        spawnedDrones.push({
          id: `SWM-DRONE-0${i + 1}`,
          type: tCls,
          modelName: mName,
          position: grp.position,
          velocity: new THREE.Vector3(-startX * 0.005, -0.15, -0.8).normalize(),
          targetPos: new THREE.Vector3(0, 1.5, 0),
          speed: 12.0 + difficulty * 2.5,
          health: 100,
          status: 'flying',
          mesh: grp,
          trailPoints: [],
          rotors,
        });
      }
    }

    dronesRef.current = spawnedDrones;
    totalDronesCountRef.current = spawnedDrones.length;

    // 5. EVENT LISTENERS: Mouse Look, WASD movement, Firing
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // Quick Decision shortcuts
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
        // Toggle Crouch / Take Cover
        setInCover((prev) => !prev);
      }
      if (e.code === 'KeyV') {
        // Toggle 1st / 3rd person
        setThirdPerson((prev) => !prev);
      }
      if (e.code === 'KeyR') {
        // Radio base alert
        handleRadioHQ();
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
        // LMB: Fire Directed RF Jammer
        setIsFiringJammer(true);
        soundFx.setJammerBeam(true);
      } else if (e.button === 2) {
        // RMB: Aim Down Sights (ADS) / Binoculars
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
      // Clamp pitch to avoid neck break
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

    // Prevent right click context menu on canvas
    const preventContext = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('contextmenu', preventContext);

    // 6. MAIN SIMULATION / RENDER ANIMATION LOOP (60 FPS)
    let animId: number;
    let lastTime = performance.now();
    let footstepCounter = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const soldier = soldierRef.current;
      if (!soldier) return;

      // A. Soldier Movement & Physics
      const keys = keysRef.current;
      const isShift = keys['ShiftLeft'] || keys['ShiftRight'];
      const moveSpeed = (isShift ? 6.5 : 3.5) * delta;

      const forward = new THREE.Vector3(Math.sin(soldier.rotation.yaw), 0, Math.cos(soldier.rotation.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const moveDir = new THREE.Vector3();

      if (keys['KeyW']) moveDir.add(forward);
      if (keys['KeyS']) moveDir.sub(forward);
      if (keys['KeyD']) moveDir.add(right);
      if (keys['KeyA']) moveDir.sub(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        soldier.position.addScaledVector(moveDir, moveSpeed);

        // Clamp inside defensive sandbag perimeter (-8 to +8, -8 to +3)
        soldier.position.x = Math.max(-7, Math.min(7, soldier.position.x));
        soldier.position.z = Math.max(-6, Math.min(3, soldier.position.z));

        // Footstep sound cadence
        footstepCounter += delta;
        if (footstepCounter > (isShift ? 0.28 : 0.45)) {
          soundFx.playFootstep();
          footstepCounter = 0;
        }
      }

      // Height: Crouch / Cover adjusts camera altitude
      const targetHeight = inCover ? 0.9 : 1.7;
      soldier.position.y += (targetHeight - soldier.position.y) * 0.2;

      // Update Camera Position & Rotation
      camera.rotation.set(0, 0, 0);
      camera.rotation.y = soldier.rotation.yaw;
      camera.rotation.x = soldier.rotation.pitch;

      if (thirdPerson) {
        // Offset camera behind soldier
        const camOffset = new THREE.Vector3(0, 1.2, 3.5);
        camOffset.applyEuler(new THREE.Euler(soldier.rotation.pitch, soldier.rotation.yaw, 0, 'YXZ'));
        camera.position.copy(soldier.position).add(camOffset);
      } else {
        camera.position.copy(soldier.position);
      }

      // B. Weapon Aim Down Sight (ADS) Animation & Sway
      const targetWeaponPos = aimingActive
        ? new THREE.Vector3(0, -0.12, -0.32) // Centered for smart scope
        : new THREE.Vector3(0.24, -0.22, -0.5); // Hip fire position
      soldier.weaponGroup.position.lerp(targetWeaponPos, 0.2);

      // Camera FOV Zoom for Smart Scope
      const targetFov = aimingActive ? 32 : 70;
      camera.fov += (targetFov - camera.fov) * 0.2;
      camera.updateProjectionMatrix();

      // C. Update Radar Dish on Bunker
      radarDish.rotation.z += 0.02;

      // D. DRONE KINEMATICS, AI & INTERACTION
      const camRay = new THREE.Raycaster();
      camRay.setFromCamera(new THREE.Vector2(0, 0), camera);

      let closestLocked: DroneEntity | null = null;
      let minCrosshairDist = 0.96; // Dot product threshold
      const activeHudList: any[] = [];

      dronesRef.current.forEach((drone) => {
        if (drone.status === 'destroyed') return;

        // Spin rotors
        drone.rotors.forEach((r) => (r.rotation.z += 0.8));

        // Check if targeted by camera center
        const toDrone = drone.position.clone().sub(camera.position).normalize();
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        const dot = lookDir.dot(toDrone);

        const distToSoldier = camera.position.distanceTo(drone.position);
        activeHudList.push({
          id: drone.id,
          type: drone.type,
          dist: Math.round(distToSoldier),
          status: drone.status,
        });

        if (dot > minCrosshairDist && distToSoldier < 300) {
          minCrosshairDist = dot;
          closestLocked = drone;
        }

        // Firing Directed RF Jammer effect
        if (isFiringJammer && closestLocked?.id === drone.id && drone.status === 'flying') {
          // Drain jammer battery
          setJammerBattery((prev) => Math.max(0, prev - delta * 18));

          // Damage drone radio link
          drone.health -= delta * 55;
          drone.mesh.position.x += (Math.random() - 0.5) * 0.4; // Wobble

          if (drone.health <= 0) {
            drone.status = 'falling';
            soundFx.playExplosion();
            neutralizedCountRef.current += 1;

            // Log event for scoring
            eventsLogRef.current.push({
              target_id: drone.id,
              action: 'jammed_and_neutralized',
              time: (Date.now() - startTimeRef.current) / 1000,
              type: drone.type,
            });
          }
        }

        // Drone Movement Dynamics
        if (drone.status === 'flying') {
          // Fly towards soldier or orbit perimeter
          const dirToSoldier = soldier.position.clone().sub(drone.position).normalize();
          drone.velocity.lerp(dirToSoldier, 0.02);
          drone.position.addScaledVector(drone.velocity, drone.speed * delta);

          // Bank drone mesh into movement direction
          drone.mesh.lookAt(drone.position.clone().add(drone.velocity));

          // If suicide drone gets within 3m of soldier
          if (distToSoldier < 3.8) {
            drone.status = 'destroyed';
            scene.remove(drone.mesh);
            soundFx.playExplosion();

            if (!inCover && drone.type === 'hostile') {
              // Direct hit on soldier!
              setBaseIntegrity((b) => Math.max(0, b - 45));
            } else if (inCover) {
              // Protected by sandbags
              setBaseIntegrity((b) => Math.max(0, b - 10));
            }
          }
        } else if (drone.status === 'falling') {
          // Spiraling down into ground with gravity
          drone.position.y -= 18 * delta;
          drone.mesh.rotation.x += 0.1;
          drone.mesh.rotation.z += 0.15;

          if (drone.position.y <= 0.2) {
            drone.status = 'destroyed';
            scene.remove(drone.mesh);
          }
        }
      });

      setActiveDronesList(activeHudList);
      setLockedDrone(closestLocked);

      // E. Update Jammer Visual Energy Beam
      if (beamMeshRef.current) {
        (beamMeshRef.current.material as THREE.MeshBasicMaterial).opacity = isFiringJammer ? 0.75 : 0;
      }

      // Re-charge jammer battery when not firing
      if (!isFiringJammer) {
        setJammerBattery((prev) => Math.min(100, prev + delta * 12));
      }

      // Check if all hostile drones are eliminated
      const remainingHostiles = dronesRef.current.filter((d) => d.type === 'hostile' && d.status !== 'destroyed');
      if (remainingHostiles.length === 0 && dronesRef.current.length > 0) {
        setCombatAlertText('PERIMETER SECURED // ALL THREATS NEUTRALIZED');
        setAlertLevel('low');
      } else if (remainingHostiles.some((d) => d.position.distanceTo(soldier.position) < 80)) {
        setCombatAlertText('CRITICAL: SUICIDE DRONE IN BOUND DIVE!');
        setAlertLevel('high');
      } else {
        setCombatAlertText('THREAT DETECTED: INCOMING DRONE FORMATION');
        setAlertLevel('med');
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
  }, [terrainType, timeOfDay, difficulty, threatType, inCover, thirdPerson]);

  // Handle Radio Alert
  const handleRadioHQ = () => {
    soundFx.playRadioSquelch();
    soundFx.playEngagementAlert();
    eventsLogRef.current.push({
      action: 'radio_hq_alert',
      time: (Date.now() - startTimeRef.current) / 1000,
    });
  };

  // Handle Manual Action Button: Shoot Net
  const handleDeployNet = () => {
    if (!lockedDrone) return;
    soundFx.playTargetLock();
    lockedDrone.status = 'falling';
    soundFx.playExplosion();
    neutralizedCountRef.current += 1;
    eventsLogRef.current.push({
      target_id: lockedDrone.id,
      action: 'net_capture',
      time: (Date.now() - startTimeRef.current) / 1000,
      type: lockedDrone.type,
    });
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
    <div className="relative w-full h-[660px] bg-black rounded-2xl overflow-hidden border border-cyan-500/40 shadow-2xl select-none font-mono">
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
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-4 z-40">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400 tactical-glow-cyan">
            <Crosshair className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-tactical font-black text-slate-100">
            CLICK TO TAKE COMMAND OF VIRTUAL SOLDIER
          </h2>
          <p className="text-xs text-slate-300 max-w-md leading-relaxed">
            Move mouse to look 360° across battlefield. Use <span className="text-cyan-400 font-bold">W/A/S/D</span> to walk,
            <span className="text-cyan-400 font-bold"> HOLD LEFT CLICK</span> to fire Anti-Drone RF Jammer gun,
            and <span className="text-cyan-400 font-bold">RIGHT CLICK</span> for Tactical Smart-Scope.
          </p>
          <button className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg">
            ENGAGE BATTLEFIELD SIMULATION
          </button>
        </div>
      )}

      {/* TOP TACTICAL HUD: Compass Heading Ribbon & Alert Banner */}
      <div className="absolute top-3 inset-x-4 flex items-center justify-between pointer-events-none z-20 text-xs">
        {/* Threat Alert Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold ${
            alertLevel === 'high'
              ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse'
              : alertLevel === 'med'
              ? 'bg-amber-950/90 border-amber-500 text-amber-300'
              : 'bg-slate-900/90 border-slate-700 text-cyan-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{combatAlertText}</span>
        </div>

        {/* 360 Degree Compass Heading Ribbon */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-1.5 flex items-center gap-3 text-cyan-400 font-bold">
          <span>{headingDegrees}°</span>
          <span className="text-slate-500">|</span>
          <span>
            {headingDegrees >= 338 || headingDegrees < 23
              ? 'N'
              : headingDegrees >= 23 && headingDegrees < 68
              ? 'NE'
              : headingDegrees >= 68 && headingDegrees < 113
              ? 'E'
              : headingDegrees >= 113 && headingDegrees < 158
              ? 'SE'
              : headingDegrees >= 158 && headingDegrees < 203
              ? 'S'
              : headingDegrees >= 203 && headingDegrees < 248
              ? 'SW'
              : headingDegrees >= 248 && headingDegrees < 293
              ? 'W'
              : 'NW'}
          </span>
        </div>

        {/* Tactical Finish Button */}
        <button
          onClick={handleCompleteMission}
          className="pointer-events-auto px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition shadow-lg"
        >
          FINISH COMBAT DRILL
        </button>
      </div>

      {/* MINIMAP RADAR & THREAT TRACKER (Top-Left) */}
      <div className="absolute top-14 left-4 z-20 pointer-events-none flex flex-col gap-2">
        <div className="w-36 h-36 rounded-full border border-cyan-500/50 bg-slate-950/80 backdrop-blur p-2 relative flex items-center justify-center">
          {/* Radar Circles */}
          <div className="w-24 h-24 rounded-full border border-cyan-500/30" />
          <div className="w-12 h-12 rounded-full border border-cyan-500/30" />
          <div className="absolute w-full h-[1px] bg-cyan-500/30" />
          <div className="absolute h-full w-[1px] bg-cyan-500/30" />

          {/* Soldier Center Blip */}
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />

          {/* Drones on Mini-radar */}
          {activeDronesList.map((d) => {
            const radRatio = Math.min(60, d.dist * 0.22);
            return (
              <div
                key={d.id}
                className={`absolute w-2 h-2 rounded-full animate-ping ${
                  d.type === 'hostile' ? 'bg-red-500' : d.type === 'friendly' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{
                  transform: `translate(${Math.sin(d.dist * 0.05) * radRatio}px, ${-Math.cos(d.dist * 0.05) * radRatio}px)`,
                }}
              />
            );
          })}
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-300">
          CONTACTS IN SECTOR: <span className="text-cyan-400 font-bold">{activeDronesList.length}</span>
        </div>
      </div>

      {/* SMART SCOPE / ADS OVERLAY WHEN AIMING */}
      {aimingActive && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="w-80 h-80 rounded-full border-2 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.3)] relative flex items-center justify-center">
            {/* Rangefinder & Azimuth Readout */}
            <div className="absolute -top-6 text-[11px] font-mono font-bold text-cyan-300">
              SMART SCOPE // 3.2X OPTICAL ZOOM
            </div>
            <div className="w-full h-[1px] bg-cyan-400/50" />
            <div className="h-full w-[1px] bg-cyan-400/50" />
            <div className="w-3 h-3 border border-red-500 rounded-full bg-red-500/20" />

            {lockedDrone && (
              <div className="absolute bottom-6 px-3 py-1 bg-black/80 border border-red-500/80 rounded text-[10px] text-red-300 font-bold">
                RANGE: {Math.round(lockedDrone.position.distanceTo(soldierRef.current?.position || new THREE.Vector3()))}M | {lockedDrone.modelName}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOLDIER HUD BOTTOM BAR: Equipment, Battery, Cover Status & Decision Deck */}
      <div className="absolute bottom-3 inset-x-4 flex flex-col md:flex-row items-end justify-between gap-3 z-20 pointer-events-none">
        {/* Left: Weapon State & Battery */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs w-64 pointer-events-auto shadow-2xl">
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

          {/* Base & Cover Status */}
          <div className="flex justify-between items-center pt-1 text-[10px]">
            <span className="text-slate-400">SOLDIER STANCE:</span>
            <span className={`font-bold uppercase ${inCover ? 'text-emerald-400' : 'text-amber-400'}`}>
              {inCover ? 'DUCKED IN COVER (C)' : 'STANDING FIRE'}
            </span>
          </div>
        </div>

        {/* Center: Soldier Tactical Action Decision Deck */}
        <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl p-2 pointer-events-auto shadow-2xl text-xs">
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
            <Zap className="w-4 h-4" /> HOLD: FIRE JAMMER
          </button>

          <button
            onClick={handleDeployNet}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition flex items-center gap-1.5"
          >
            <Crosshair className="w-4 h-4 text-emerald-400" /> DEPLOY NET
          </button>

          <button
            onClick={() => setInCover(!inCover)}
            className={`px-3 py-2 rounded-lg border font-bold transition flex items-center gap-1.5 ${
              inCover ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Shield className="w-4 h-4" /> {inCover ? 'STAND UP (C)' : 'TAKE COVER (C)'}
          </button>

          <button
            onClick={handleRadioHQ}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 font-bold transition flex items-center gap-1.5"
          >
            <Radio className="w-4 h-4" /> RADIO BASE (R)
          </button>

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
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-[10px] text-slate-400 space-y-1">
          <div><span className="text-cyan-400 font-bold">WASD</span> : Move Soldier</div>
          <div><span className="text-cyan-400 font-bold">LMB (Hold)</span> : Fire Jammer</div>
          <div><span className="text-cyan-400 font-bold">RMB (Hold)</span> : Smart-Scope</div>
          <div><span className="text-cyan-400 font-bold">C</span> : Take Cover | <span className="text-cyan-400 font-bold">N</span> : NVG</div>
        </div>
      </div>
    </div>
  );
};
