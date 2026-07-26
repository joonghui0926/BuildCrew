"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Candidate } from "@/features/cases/types";

type ViewerMode = "model" | "change" | "clearance";

interface BimDeltaViewerProps {
  candidate?: Candidate;
  compact?: boolean;
}

const MODEL_URL = "/demo/m601-dajoong-bim.glb";

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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setLoadingState("loading");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdde4e0);
    scene.fog = new THREE.Fog(0xdde4e0, 42, 82);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);
    camera.position.set(compact ? 14 : 16, compact ? 8 : 10, compact ? 15 : 16);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.target.set(5, 1, 2.8);
    controls.minDistance = 5;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.495;

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
      MODEL_URL,
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
            if (object.name.includes("removed-existing")) {
              next.transparent = true;
              next.opacity = 0.24;
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
        controls.target.set(5, 1.05, 2.8);
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
      controls.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(disposeMaterial);
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [compact, mode]);

  const status = candidate?.status === "rejected" ? "REVIEWED" : "INSTALLABLE";
  return (
    <section className={compact ? "bim-viewer bim-viewer--compact" : "bim-viewer"} aria-label="Actual Dajoong-generated BIM viewer">
      <div ref={hostRef} className="bim-viewer__canvas" />
      {loadingState === "loading" && (
        <div className="bim-viewer__loading"><span />Loading generated GLB</div>
      )}
      {loadingState === "error" && (
        <div className="bim-viewer__loading bim-viewer__loading--error">WebGL model could not be loaded.</div>
      )}
      <div className="bim-viewer__topline">
        <div>
          <span className="eyebrow">DAJOONG SCENEGRAPH · REV 37</span>
          <strong>{candidate ? `${candidate.manufacturer} ${candidate.model}` : "M-601 Mechanical Room"}</strong>
        </div>
        <span className={`verdict ${status === "INSTALLABLE" ? "verdict--recommended" : "verdict--rejected"}`}>
          {status}
        </span>
      </div>
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
            <span><i className="legend-dot legend-dot--new" />Replacement</span>
            <span><i className="legend-dot legend-dot--impact" />Modified spool</span>
            <span><i className="legend-dot legend-dot--old" />Existing envelope</span>
          </div>
          <div className="bim-viewer__provenance">
            <strong>618</strong> generated components
            <span />
            <strong>15</strong> semantic entities
            <span />
            <strong>IFC4 + GLB</strong>
          </div>
          <div className="bim-viewer__hint">Drag to orbit · Scroll to zoom</div>
        </>
      )}
    </section>
  );
}
