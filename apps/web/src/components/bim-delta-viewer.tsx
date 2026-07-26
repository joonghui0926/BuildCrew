"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Candidate } from "@/features/cases/types";

THREE.Cache.enabled = true;

type ViewerMode = "model" | "change" | "clearance";

interface BimDeltaViewerProps {
  candidate?: Candidate;
  compact?: boolean;
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
  material.dispose();
}

export function BimDeltaViewer({ candidate, compact = false }: BimDeltaViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewerMode>("change");
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">("loading");
  const modelUrl = candidate
    ? `/demo/m601-${candidate.id}.glb`
    : "/demo/m601-dajoong-bim.glb";
  const fitsProject = candidate?.status !== "rejected";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setLoadingState("loading");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdde4e0);
    scene.fog = new THREE.Fog(0xdde4e0, 42, 82);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);
    camera.up.set(0, 0, 1);
    camera.position.set(compact ? 14 : 12, compact ? 8 : -10, compact ? 15 : 8.5);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setLoadingState("error"));
      host.dataset.rendererState = "webgl-unavailable";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    host.replaceChildren(renderer.domElement);
    const keepNavigationInsideViewer = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const keepWheelInsideViewer = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    renderer.domElement.addEventListener("mousedown", keepNavigationInsideViewer, { passive: false });
    renderer.domElement.addEventListener("auxclick", keepNavigationInsideViewer, { passive: false });
    renderer.domElement.addEventListener("wheel", keepWheelInsideViewer, { passive: false });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.panSpeed = 0.9;
    controls.rotateSpeed = 0.72;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 1.1;
    controls.zoomToCursor = true;
    controls.target.set(compact ? 5 : 2.5, compact ? 1 : -2.15, compact ? 2.8 : 1.15);
    controls.minDistance = 5;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.495;
    const syncCameraState = () => {
      host.setAttribute(
        "data-camera-position",
        camera.position.toArray().map((value) => value.toFixed(3)).join(","),
      );
      host.setAttribute(
        "data-camera-target",
        controls.target.toArray().map((value) => value.toFixed(3)).join(","),
      );
    };
    controls.addEventListener("change", syncCameraState);
    syncCameraState();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x56625c, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(-8, 18, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe0ca, 1.15);
    fill.position.set(13, 7, -10);
    scene.add(fill);

    let model: THREE.Group | null = null;
    let cancelled = false;
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        model = gltf.scene;
        model.traverse((object) => {
          if (
            object.name.includes("east-wall")
            || object.name.includes("south-wall")
          ) {
            object.visible = false;
          }
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
          const materials = sourceMaterials.map((material) => {
            if (object.name.includes("replacement")) {
              return new THREE.MeshBasicMaterial({
                color: fitsProject ? 0x50c878 : 0xd65f58,
                toneMapped: false,
              });
            }
            if (object.name.includes("impact-")) {
              return new THREE.MeshBasicMaterial({
                color: fitsProject ? 0xe7a537 : 0xd65f58,
                toneMapped: false,
              });
            }
            if (object.name.includes("removed-existing")) {
              return new THREE.MeshBasicMaterial({
                color: 0x78807b,
                depthWrite: false,
                opacity: 0.32,
                transparent: true,
                wireframe: true,
              });
            }
            if (!compact && object.name.includes("existing-duty")) {
              return new THREE.MeshBasicMaterial({
                color: 0xaeb8b2,
                depthWrite: false,
                opacity: 0.2,
                transparent: true,
                toneMapped: false,
              });
            }
            const next = material.clone();
            if (next instanceof THREE.MeshStandardMaterial) {
              next.roughness = Math.min(next.roughness || 0.76, 0.86);
              next.metalness = object.name.includes("pipe") || object.name.includes("flange") ? 0.34 : 0.08;
            }
            if (object.name.includes("maintenance-clearance")) {
              next.transparent = true;
              next.opacity = 0.13;
              next.depthWrite = false;
              next.side = THREE.DoubleSide;
            }
            if (
              object.name.includes("critical-clash")
              || object.name.includes("critical-clearance")
            ) {
              if (next instanceof THREE.MeshStandardMaterial) {
                next.vertexColors = false;
                next.color.set(0xd65f58);
                next.emissive.set(0x5a1713);
                next.emissiveIntensity = 0.2;
              }
              next.transparent = true;
              next.opacity = 0.82;
              next.depthWrite = false;
            }
            return next;
          });
          object.material = materials.length === 1 ? materials[0] : materials;
        });

        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += 1.45;
        scene.add(model);
        model.updateMatrixWorld(true);
        if (compact) {
          controls.target.set(5, 1.05, 2.8);
        } else {
          const focusBounds = new THREE.Box3();
          model.traverse((object) => {
            if (
              object.name.includes("replacement")
              || object.name.includes("critical-clash")
              || object.name.includes("critical-clearance")
            ) {
              focusBounds.expandByObject(object);
            }
          });
          const focusCenter = focusBounds.getCenter(new THREE.Vector3());
          const focusSize = focusBounds.getSize(new THREE.Vector3());
          const distance = Math.max(7.5, Math.max(focusSize.x, focusSize.y, focusSize.z) * 2.85);
          const viewTarget = focusCenter.clone();
          viewTarget.z -= Math.max(2, focusSize.z * 1.2);
          controls.target.copy(viewTarget);
          camera.position.set(
            viewTarget.x + distance * 0.48,
            viewTarget.y - distance * 1.35,
            viewTarget.z + distance * 0.72,
          );
        }
        controls.update();
        setLoadingState("ready");
        host.dataset.rendererState = "ready";
      },
      undefined,
      () => {
        if (cancelled) return;
        setLoadingState("error");
        host.dataset.rendererState = "asset-error";
      },
    );

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

    let frame = 0;
    const render = () => {
      controls.update();
      if (model) {
        model.traverse((object) => {
          if (!object.name) return;
          if (object.name.includes("removed-existing")) object.visible = mode === "change";
          if (object.name.includes("maintenance-clearance")) object.visible = mode !== "model";
          if (object.name.includes("impact-")) object.visible = mode !== "model";
        });
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener("change", syncCameraState);
      controls.dispose();
      renderer.domElement.removeEventListener("mousedown", keepNavigationInsideViewer);
      renderer.domElement.removeEventListener("auxclick", keepNavigationInsideViewer);
      renderer.domElement.removeEventListener("wheel", keepWheelInsideViewer);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(disposeMaterial);
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [compact, fitsProject, mode, modelUrl]);

  const status = candidate?.status === "rejected" ? "REJECTED" : "INSTALLABLE";
  return (
    <section className={compact ? "bim-viewer bim-viewer--compact" : "bim-viewer"} aria-label="Actual Dajoong-generated BIM viewer">
      <div
        ref={hostRef}
        className="bim-viewer__canvas"
        data-camera-position={compact ? "14.000,8.000,15.000" : "12.000,-10.000,8.500"}
        data-camera-target={compact ? "5.000,1.000,2.800" : "2.500,-2.150,1.150"}
      />
      {loadingState === "loading" && (
        <div className="bim-viewer__loading"><span />Loading generated GLB</div>
      )}
      {loadingState === "error" && (
        <div className="bim-viewer__loading bim-viewer__loading--error">WebGL model could not be loaded.</div>
      )}
      <div className="bim-viewer__topline">
        <div>
          <span className="eyebrow">COORDINATED MODEL · REV 37</span>
          <strong>{candidate ? `${candidate.manufacturer} ${candidate.model}` : "M-601 Mechanical Room"}</strong>
        </div>
        <span className={`verdict ${status === "INSTALLABLE" ? "verdict--recommended" : "verdict--rejected"}`}>
          {status}
        </span>
      </div>
      {candidate && !compact && (
        <div className={fitsProject ? "bim-fit-state bim-fit-state--fit" : "bim-fit-state bim-fit-state--reject"}>
          <span>{fitsProject ? <CheckIcon /> : <RejectIcon />}</span>
          <span>
            <strong>{fitsProject ? "FITS PROJECT" : "DOES NOT FIT"}</strong>
            <small>
              {fitsProject
                ? "No critical coordination conflict"
                : `${candidate.criticalClashes} critical conflict · highlighted red`}
            </small>
          </span>
        </div>
      )}
      {!compact && (
        <>
          <div className="bim-viewer__modes" aria-label="Viewer layers">
            {(["model", "change", "clearance"] as ViewerMode[]).map((item) => (
              <button
                className={mode === item ? "viewer-chip viewer-chip--active" : "viewer-chip"}
                key={item}
                onClick={() => setMode(item)}
                type="button"
              >
                {item === "model" ? "Generated BIM" : item === "change" ? "Change impact" : "Clearance"}
              </button>
            ))}
          </div>
          <div className="bim-viewer__legend">
            <span>
              <i className={fitsProject ? "legend-dot legend-dot--new" : "legend-dot legend-dot--critical"} />
              Selected candidate
            </span>
            {candidate?.criticalClashes ? (
              <span><i className="legend-dot legend-dot--critical" />Critical conflict</span>
            ) : (
              <span><i className="legend-dot legend-dot--impact" />Modified spool</span>
            )}
            <span><i className="legend-dot legend-dot--old" />Existing envelope</span>
          </div>
          <div className="bim-viewer__provenance">
            <strong>618</strong> generated components
            <span />
            <strong>15</strong> semantic entities
            <span />
            <strong>IFC4 + GLB</strong>
          </div>
          <div className="bim-viewer__hint">Left drag: rotate · Middle drag: pan · Wheel: zoom</div>
        </>
      )}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path d="m3.2 8.2 3 3L12.9 4.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function RejectIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
