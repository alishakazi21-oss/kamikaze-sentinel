import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { SyntheticTrack } from '../types';

interface Tactical3DViewProps {
  tracks: SyntheticTrack[];
  selectedTrackId: string | null;
  terrain: string;
}

export const Tactical3DView: React.FC<Tactical3DViewProps> = ({
  tracks,
  selectedTrackId,
  terrain,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const droneMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const dropLinesRef = useRef<Map<string, THREE.Line>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 560;
    const height = 560;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060a12);
    scene.fog = new THREE.FogExp2(0x060a12, 0.00035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 15000);
    camera.position.set(0, 1800, 3200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Tactical Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(1000, 2000, 1000);
    scene.add(dirLight);

    // 3. Tactical Ground Grid & Terrain
    const gridColor = terrain === 'urban' ? 0x0ea5e9 : terrain === 'coastal' ? 0x06b6d4 : 0x10b981;
    const gridHelper = new THREE.GridHelper(5000, 50, gridColor, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Defense Perimeter Hemispherical Dome (wireframe)
    const domeGeom = new THREE.SphereGeometry(2500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const dome = new THREE.Mesh(domeGeom, domeMat);
    scene.add(dome);

    // Base Outpost Building (0,0,0)
    const baseGroup = new THREE.Group();
    const bunkerGeom = new THREE.CylinderGeometry(80, 120, 40, 8);
    const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const bunker = new THREE.Mesh(bunkerGeom, bunkerMat);
    bunker.position.y = 20;
    baseGroup.add(bunker);

    // Radar Dome at Base
    const radDomeGeom = new THREE.SphereGeometry(35, 16, 16);
    const radDomeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });
    const radDome = new THREE.Mesh(radDomeGeom, radDomeMat);
    radDome.position.y = 50;
    baseGroup.add(radDome);
    scene.add(baseGroup);

    // 4. Interactive Mouse Orbit Controls (low-overhead custom implementation)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let theta = Math.PI / 4;
    let phi = Math.PI / 3;
    let radius = 3500;

    const updateCamera = () => {
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = Math.max(150, radius * Math.cos(phi));
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 100, 0);
    };
    updateCamera();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      theta -= deltaX * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI / 2.1, phi - deltaY * 0.005));
      updateCamera();
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(800, Math.min(6000, radius + e.deltaY * 2));
      updateCamera();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // 5. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Subtle rotation of base radar
      radDome.rotation.y += 0.03;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [terrain]);

  // Update Drone Meshes & Drop Lines whenever tracks update
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const droneMeshes = droneMeshesRef.current;
    const dropLines = dropLinesRef.current;
    const activeTrackIds = new Set(tracks.map((t) => t.track_id));

    // Remove meshes no longer active
    droneMeshes.forEach((mesh, id) => {
      if (!activeTrackIds.has(id)) {
        scene.remove(mesh);
        droneMeshes.delete(id);
      }
    });
    dropLines.forEach((line, id) => {
      if (!activeTrackIds.has(id)) {
        scene.remove(line);
        dropLines.delete(id);
      }
    });

    // Update or create meshes for tracks
    tracks.forEach((track) => {
      let droneGroup = droneMeshes.get(track.track_id);

      if (!droneGroup) {
        droneGroup = new THREE.Group();

        // Low-poly drone airframe
        const isClutter = track.is_clutter;
        const color = isClutter ? 0x64748b : track.status === 'degraded' ? 0xf59e0b : 0xef4444;

        if (isClutter) {
          // Small sphere for clutter/birds
          const birdGeom = new THREE.SphereGeometry(15, 8, 8);
          const birdMat = new THREE.MeshBasicMaterial({ color });
          droneGroup.add(new THREE.Mesh(birdGeom, birdMat));
        } else {
          // Central fuselage
          const bodyGeom = new THREE.BoxGeometry(40, 12, 40);
          const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
          droneGroup.add(new THREE.Mesh(bodyGeom, bodyMat));

          // 4 Quadcopter Arms
          const armMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
          const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 80), armMat);
          arm1.rotation.z = Math.PI / 2;
          droneGroup.add(arm1);

          const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 80), armMat);
          arm2.rotation.x = Math.PI / 2;
          droneGroup.add(arm2);

          // Rotor Disks
          const rotorGeom = new THREE.RingGeometry(5, 20, 8);
          const rotorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
          [
            [-40, 10, -40],
            [40, 10, -40],
            [-40, 10, 40],
            [40, 10, 40],
          ].forEach(([rx, ry, rz]) => {
            const rMesh = new THREE.Mesh(rotorGeom, rotorMat);
            rMesh.position.set(rx, ry, rz);
            rMesh.rotation.x = Math.PI / 2;
            droneGroup!.add(rMesh);
          });
        }

        scene.add(droneGroup);
        droneMeshes.set(track.track_id, droneGroup);

        // Vertical drop line to ground
        const lineMat = new THREE.LineDashedMaterial({
          color: 0x0ea5e9,
          dashSize: 20,
          gapSize: 10,
          transparent: true,
          opacity: 0.5,
        });
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0),
        ]);
        const dropLine = new THREE.Line(lineGeom, lineMat);
        dropLine.computeLineDistances();
        scene.add(dropLine);
        dropLines.set(track.track_id, dropLine);
      }

      // Update position: x = East (+X), y = North (+Z in 3D), altitude = (+Y in 3D)
      const posX = track.x;
      const posY = Math.max(10, track.altitude_m);
      const posZ = -track.y; // 3D negative Z is North

      droneGroup.position.set(posX, posY, posZ);
      droneGroup.rotation.y = -THREE.MathUtils.degToRad(track.heading_deg);

      // Selected drone highlight pulse
      const isSelected = track.track_id === selectedTrackId;
      droneGroup.scale.setScalar(isSelected ? 1.4 : 1.0);

      // Update drop-line
      const dropLine = dropLines.get(track.track_id);
      if (dropLine) {
        const positions = new Float32Array([
          posX, posY, posZ,
          posX, 0, posZ,
        ]);
        dropLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        dropLine.computeLineDistances();
      }
    });
  }, [tracks, selectedTrackId]);

  return (
    <div className="relative select-none rounded-xl border border-cyan-500/30 overflow-hidden shadow-2xl bg-slate-950">
      <div className="absolute top-3 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded px-2.5 py-1 text-xs font-mono text-cyan-400">
        3D TACTICAL AIRSPACE (CLICK & DRAG TO ORBIT)
      </div>
      <div ref={containerRef} className="w-[560px] h-[560px] cursor-grab active:cursor-grabbing" />
    </div>
  );
};
