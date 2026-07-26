"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Candidate } from "@/features/cases/types";

type ViewerMode = "proposed" | "delta" | "clearance";

interface BimDeltaViewerProps {
  candidate: Candidate;
}

const COLORS = {
  concrete: 0xdde2de,
  wall: 0xf4f5f2,
  pipe: 0x66736d,
  equipment: 0x9aa7a0,
  proposed: 0x50c878,
  proposedDeep: 0x248d50,
  impact: 0xf5a742,
  removed: 0xd96d65,
  structure: 0x324139,
};

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPipe(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 18, false), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createPump(
  material: THREE.MeshStandardMaterial,
  accentMaterial: THREE.MeshStandardMaterial,
  scale = 1,
) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  addBox(group, [3.5, 0.25, 1.45], [0, 0.16, 0], accentMaterial);
  addBox(group, [1.75, 1.25, 1.18], [0.78, 1, 0], material);

  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 1.72, 40),
    material,
  );
  motorBody.rotation.z = Math.PI / 2;
  motorBody.position.set(-0.88, 1.06, 0);
  motorBody.castShadow = true;
  group.add(motorBody);

  for (let index = -6; index <= 6; index += 1) {
    addBox(group, [0.04, 0.76, 1.22], [-0.88 + index * 0.1, 1.06, 0], accentMaterial);
  }

  const casing = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 36, 24),
    accentMaterial,
  );
  casing.scale.set(0.76, 1, 0.9);
  casing.position.set(0.88, 1.05, 0);
  casing.castShadow = true;
  group.add(casing);

  const connectorGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.52, 32);
  const sideConnector = new THREE.Mesh(connectorGeometry, accentMaterial);
  sideConnector.rotation.z = Math.PI / 2;
  sideConnector.position.set(1.55, 1.04, 0);
  group.add(sideConnector);

  const topConnector = new THREE.Mesh(connectorGeometry, accentMaterial);
  topConnector.position.set(0.9, 1.72, 0);
  group.add(topConnector);

  return group;
}

export function BimDeltaViewer({ candidate }: BimDeltaViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewerMode>("delta");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.dataset.rendererState = "initializing";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2ef);
    scene.fog = new THREE.Fog(0xeef2ef, 17, 36);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(9, 12, 11);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      host.dataset.rendererState = "webgl-unavailable";
      host.innerHTML = `
        <div class="bim-viewer__fallback" role="img" aria-label="BIM equipment change preview">
          <div class="fallback-room">
            <span class="fallback-pipe fallback-pipe--horizontal"></span>
            <span class="fallback-pipe fallback-pipe--vertical"></span>
            <span class="fallback-pad"></span>
            <span class="fallback-motor"></span>
            <span class="fallback-pump"></span>
            <span class="fallback-clearance"></span>
          </div>
        </div>`;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.replaceChildren(renderer.domElement);
    host.dataset.rendererState = "ready";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(4.1, -0.05, 0);
    controls.enableDamping = true;
    controls.minDistance = 7;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.48;

    scene.add(new THREE.HemisphereLight(0xf8fbf8, 0x66736d, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3.1);
    sun.position.set(5, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);

    const rough = (color: number, roughness = 0.72) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
    const floorMaterial = rough(COLORS.concrete, 0.92);
    const wallMaterial = rough(COLORS.wall, 0.94);
    const pipeMaterial = rough(COLORS.pipe, 0.43);
    const structureMaterial = rough(COLORS.structure, 0.4);
    const proposedMaterial = rough(COLORS.proposed, 0.32);
    proposedMaterial.emissive.setHex(0x103f24);
    proposedMaterial.emissiveIntensity = 0.18;
    const proposedDeepMaterial = rough(COLORS.proposedDeep, 0.36);
    const impactMaterial = rough(COLORS.impact, 0.36);
    impactMaterial.emissive.setHex(0x8a4300);
    impactMaterial.emissiveIntensity = 0.12;
    const oldMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.removed,
      transparent: true,
      opacity: mode === "delta" ? 0.24 : 0,
      roughness: 0.5,
      depthWrite: false,
    });

    const building = new THREE.Group();
    scene.add(building);
    addBox(building, [14, 0.25, 10], [0, -0.12, 0], floorMaterial);
    addBox(building, [14, 5, 0.18], [0, 2.5, -5], wallMaterial);
    addBox(building, [0.18, 5, 10], [-7, 2.5, 0], wallMaterial);
    addBox(building, [5.3, 0.28, 3.2], [0.25, 0.12, 0], rough(0xc8cfca, 0.88));

    for (let index = -2; index <= 2; index += 1) {
      addBox(building, [0.14, 5.8, 0.14], [-5.5 + index * 2.65, 2.85, -4.78], structureMaterial);
    }
    addBox(building, [12.2, 0.18, 0.18], [-0.4, 4.55, -4.7], structureMaterial);

    const environmentPipes = new THREE.Group();
    scene.add(environmentPipes);
    addPipe(
      environmentPipes,
      [
        new THREE.Vector3(-5.8, 3.6, -3.7),
        new THREE.Vector3(-2.5, 3.6, -3.7),
        new THREE.Vector3(1.7, 3.6, -3.7),
        new THREE.Vector3(4.8, 3.6, -2.4),
      ],
      0.19,
      pipeMaterial,
    );
    addPipe(
      environmentPipes,
      [
        new THREE.Vector3(-5.8, 3.05, -3.15),
        new THREE.Vector3(-1.8, 3.05, -3.15),
        new THREE.Vector3(4.8, 3.05, -1.8),
      ],
      0.15,
      pipeMaterial,
    );

    const proposed = createPump(proposedMaterial, proposedDeepMaterial, candidate.id === "candidate-b" ? 1.08 : 1);
    proposed.position.set(0.15, 0.3, 0);
    scene.add(proposed);

    const current = createPump(oldMaterial, oldMaterial, 0.94);
    current.position.set(-0.18, 0.3, 0.16);
    current.visible = mode === "delta";
    scene.add(current);

    const impactPipe = addPipe(
      scene,
      [
        new THREE.Vector3(0.98, 2.05, 0),
        new THREE.Vector3(1.1, 2.48, 0),
        new THREE.Vector3(1.55, 2.72, -0.3),
        new THREE.Vector3(2.45, 3.1, -1.25),
        new THREE.Vector3(4.75, 3.1, -1.8),
      ],
      0.15,
      impactMaterial,
    );
    impactPipe.visible = mode !== "proposed";

    const clearanceMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.proposed,
      transparent: true,
      opacity: mode === "clearance" ? 0.2 : 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const clearance = addBox(scene, [3.1, 2.25, 2.35], [-2.45, 1.42, 0], clearanceMaterial);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(clearance.geometry),
      new THREE.LineBasicMaterial({
        color: COLORS.proposedDeep,
        transparent: true,
        opacity: mode === "clearance" ? 0.85 : 0.28,
      }),
    );
    clearance.add(edges);

    const rejectedWallImpact = addBox(
      scene,
      [0.1, 2.4, 2.9],
      [-4.2, 1.3, 0],
      new THREE.MeshBasicMaterial({
        color: candidate.criticalClashes > 0 ? COLORS.removed : COLORS.proposed,
        transparent: true,
        opacity: candidate.criticalClashes > 0 ? 0.3 : 0.04,
      }),
    );
    rejectedWallImpact.visible = candidate.criticalClashes > 0;

    const grid = new THREE.GridHelper(14, 28, 0xb6c1bb, 0xd7ddd9);
    grid.position.y = 0.02;
    scene.add(grid);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      host.replaceChildren();
    };
  }, [candidate, mode]);

  return (
    <section className="bim-viewer" aria-label="BIM change viewer">
      <div ref={hostRef} className="bim-viewer__canvas" />
      <div className="bim-viewer__topline">
        <div>
          <span className="eyebrow">COORDINATED MODEL · REV 37</span>
          <strong>{candidate.manufacturer} {candidate.model}</strong>
        </div>
        <span className={`verdict verdict--${candidate.status}`}>
          {candidate.status === "recommended" ? "INSTALLABLE" : "REJECTED"}
        </span>
      </div>
      <div className="bim-viewer__modes" aria-label="Viewer layers">
        {(["proposed", "delta", "clearance"] as ViewerMode[]).map((item) => (
          <button
            className={mode === item ? "viewer-chip viewer-chip--active" : "viewer-chip"}
            key={item}
            onClick={() => setMode(item)}
            type="button"
          >
            {item === "proposed" ? "Proposed" : item === "delta" ? "Change impact" : "Clearance"}
          </button>
        ))}
      </div>
      <div className="bim-viewer__legend">
        <span><i className="legend-dot legend-dot--new" />Replacement</span>
        <span><i className="legend-dot legend-dot--impact" />Modified route</span>
        <span><i className="legend-dot legend-dot--old" />Existing</span>
      </div>
      <div className="bim-viewer__hint">Drag to orbit · Scroll to zoom</div>
    </section>
  );
}
