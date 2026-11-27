"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  AquabikeCabin,
  DumbbellRack,
  MedicineBall,
  PALETTE,
  PilatesBall,
  PunchingBag,
  Reformer,
  Room,
} from "./equipment";
import { HOTSPOTS, type HotspotId } from "./hotspots";

export type SceneHandle = { zoom: (factor: number) => void; reset: () => void };

type Props = {
  selected: HotspotId | null;
  onSelect: (id: HotspotId | null) => void;
  /** Rotation / zoom de la caméra autorisés (sur mobile : seulement après « Explorer »). */
  interactive: boolean;
  /** Zoom à la molette / au pincement. */
  allowZoom: boolean;
  /** Met le rendu en pause quand la scène n'est pas à l'écran. */
  running: boolean;
  reducedMotion: boolean;
};

/* ------------------------------------------------------------ Caméra */

const DEFAULT_TARGET = new THREE.Vector3(-0.2, 0.4, 0.3);
const POLAR = 0.98; // inclinaison (radians depuis la verticale)
const AZIMUTH = 0.62; // rotation autour de la pièce
const LIMITS = { minPolar: 0.5, maxPolar: 1.3, minAzimuth: -0.2, maxAzimuth: 1.5, minDistance: 5, maxDistance: 22 };

/** Cadrage selon la forme de l'écran : en portrait (téléphone), on élargit le champ et on recule. */
function framing(aspect: number) {
  if (aspect < 0.7) return { fov: 52, distance: 20 };
  if (aspect < 1.1) return { fov: 46, distance: 17 };
  return { fov: 38, distance: 15 };
}
const defaultDistance = (aspect: number) => framing(aspect).distance;

function directionFrom(polar: number, azimuth: number) {
  return new THREE.Vector3(
    Math.sin(polar) * Math.sin(azimuth),
    Math.cos(polar),
    Math.sin(polar) * Math.cos(azimuth),
  );
}

const CameraRig = forwardRef<SceneHandle, { selected: HotspotId | null }>(function CameraRig({ selected }, ref) {
  // On lit la caméra et les contrôles au moment voulu (get) plutôt qu'au rendu.
  const get = useThree((s) => s.get);
  const hasControls = useThree((s) => Boolean(s.controls));
  const aspect = useThree((s) => s.size.width / s.size.height);
  const goal = useRef<{ target: THREE.Vector3; position?: THREE.Vector3 } | null>(null);
  const touched = useRef(false);

  const rig = () => {
    const { camera, controls } = get();
    return { camera: camera as THREE.PerspectiveCamera, controls: controls as unknown as OrbitControlsImpl | null };
  };

  // Cadrage de départ adapté à la forme de l'écran (tant que la visiteuse n'a pas bougé la caméra).
  useEffect(() => {
    const { camera, controls } = rig();
    if (!controls) return;
    camera.fov = framing(aspect).fov;
    camera.updateProjectionMatrix();
    if (touched.current) return;
    controls.target.copy(DEFAULT_TARGET);
    camera.position.copy(DEFAULT_TARGET).addScaledVector(directionFrom(POLAR, AZIMUTH), defaultDistance(aspect));
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, hasControls]);

  // Dès que la visiteuse fait tourner la caméra, on arrête les mouvements automatiques.
  useEffect(() => {
    const { controls } = rig();
    if (!controls) return;
    const stop = () => {
      touched.current = true;
      goal.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasControls]);

  // Quand un équipement est choisi, la caméra glisse doucement vers lui et se rapproche.
  // En portrait, on vise un peu plus bas pour que l'équipement reste visible au-dessus de la bulle d'info.
  useEffect(() => {
    const spot = HOTSPOTS.find((h) => h.id === selected);
    const { camera, controls } = rig();
    if (!spot || !controls) return;
    const target = new THREE.Vector3(...spot.focus);
    if (aspect < 1.1) target.y -= 1.6;
    const dir = camera.position.clone().sub(controls.target).normalize();
    goal.current = { target, position: target.clone().addScaledVector(dir, defaultDistance(aspect) * 0.72) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on ne réagit qu'au changement de sélection
  }, [selected]);

  useImperativeHandle(ref, () => ({
    zoom(factor) {
      const { camera, controls } = rig();
      if (!controls) return;
      const offset = camera.position.clone().sub(controls.target);
      const d = THREE.MathUtils.clamp(offset.length() * factor, LIMITS.minDistance, LIMITS.maxDistance);
      goal.current = { target: controls.target.clone(), position: controls.target.clone().add(offset.setLength(d)) };
    },
    reset() {
      touched.current = false;
      goal.current = {
        target: DEFAULT_TARGET.clone(),
        position: DEFAULT_TARGET.clone().addScaledVector(directionFrom(POLAR, AZIMUTH), defaultDistance(aspect)),
      };
    },
  }));

  useFrame((state, delta) => {
    const controls = state.controls as unknown as OrbitControlsImpl | null;
    const g = goal.current;
    if (!controls || !g) return;
    const k = 1 - Math.exp(-delta * 4);
    controls.target.lerp(g.target, k);
    if (g.position) state.camera.position.lerp(g.position, k);
    controls.update();
    const done =
      controls.target.distanceTo(g.target) < 0.01 && (!g.position || state.camera.position.distanceTo(g.position) < 0.01);
    if (done) goal.current = null;
  });

  return null;
});

/* ------------------------------------------------------ Repère au sol */

function FloorRing({ position, radius, active }: { position: [number, number]; radius: number; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    const target = active ? 0.55 + Math.sin(clock.elapsedTime * 4) * 0.2 : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.15);
    ref.current.visible = mat.opacity > 0.01;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.03, position[1]]} visible={false}>
      <ringGeometry args={[radius, radius + 0.08, 48]} />
      <meshBasicMaterial color={PALETTE.rose} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------- Points cliquables */

type PinRefs = React.RefObject<(HTMLButtonElement | null)[]>;

/** Calcule à chaque image la position à l'écran des étiquettes (gardées dans le cadre). */
function PinProjector({ pins }: { pins: PinRefs }) {
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    HOTSPOTS.forEach((h, i) => {
      const el = pins.current?.[i];
      if (!el) return;
      v.current.set(...h.pin).project(camera);
      const half = el.offsetWidth / 2 + 8;
      const x = THREE.MathUtils.clamp((v.current.x * 0.5 + 0.5) * size.width, half, size.width - half);
      const y = THREE.MathUtils.clamp((-v.current.y * 0.5 + 0.5) * size.height, 24, size.height - 24);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      el.style.opacity = v.current.z < 1 ? "1" : "0";
    });
  });
  return null;
}

function PinsOverlay({ pins, selected, onSelect }: {
  pins: PinRefs;
  selected: HotspotId | null;
  onSelect: (id: HotspotId) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {HOTSPOTS.map((h, i) => {
        const active = selected === h.id;
        const dimmed = selected !== null && !active; // un autre équipement est choisi : on n'affiche que le point
        return (
          <button
            key={h.id}
            ref={(el) => {
              pins.current[i] = el;
            }}
            type="button"
            onClick={() => onSelect(h.id)}
            aria-label={`Voir ${h.label}`}
            aria-pressed={active}
            style={{ opacity: 0 }}
            className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-2 rounded-full py-1.5 pl-1.5 ${dimmed ? "pr-1.5" : "pr-3"} text-xs font-semibold whitespace-nowrap shadow-lg backdrop-blur transition-[background-color,color,opacity] select-none will-change-transform ${
              active ? "bg-rose text-white" : "bg-cream/90 text-charcoal hover:bg-white"
            }`}
          >
            <span className="relative grid size-5 place-items-center">
              {!active && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-rose/60" />}
              <span className={`relative size-2.5 rounded-full ${active ? "bg-white" : "bg-rose"}`} />
            </span>
            {!dimmed && h.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- Scène */

function Zone({ id, onSelect, onHover, children }: {
  id: HotspotId;
  onSelect: (id: HotspotId) => void;
  onHover: (id: HotspotId | null) => void;
  children: React.ReactNode;
}) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      {children}
    </group>
  );
}

const ClubScene = forwardRef<SceneHandle, Props>(function ClubScene(
  { selected, onSelect, interactive, allowZoom, running, reducedMotion },
  ref,
) {
  const [hovered, setHovered] = useState<HotspotId | null>(null);
  const pins = useRef<(HTMLButtonElement | null)[]>([]);
  const animate = !reducedMotion;

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <div className="absolute inset-0">
    <Canvas
      dpr={[1, 1.75]}
      frameloop={running ? "always" : "never"}
      camera={{ fov: 38, near: 0.1, far: 60, position: [8, 7, 10] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
      aria-label="Visite 3D du club"
    >
      <ambientLight intensity={0.55} color="#fff4ea" />
      <hemisphereLight args={["#fff6ee", "#c9b29a", 1.0]} />
      <directionalLight position={[4, 8, 5]} intensity={1.6} color="#fff1e4" />
      <directionalLight position={[-6, 4, -2]} intensity={0.35} color="#ffd9c9" />

      <Room />

      <Zone id="reformer" onSelect={onSelect} onHover={setHovered}>
        <Reformer position={[-2.4, 0, -2.6]} />
        <Reformer position={[-2.4, 0, -1.0]} />
        <PilatesBall position={[-0.9, 0.12, -1.8]} />
        <PilatesBall position={[-0.75, 0.12, -1.55]} />
      </Zone>

      <Zone id="boxe" onSelect={onSelect} onHover={setHovered}>
        <PunchingBag position={[0.1, 0, -2.3]} swing={animate} />
        <PunchingBag position={[1.9, 0, -2.3]} swing={animate} phase={1.7} />
      </Zone>

      <Zone id="cross" onSelect={onSelect} onHover={setHovered}>
        <DumbbellRack position={[3.1, 0, -3.5]} />
        <MedicineBall position={[2.5, 0, -1.1]} />
        <MedicineBall position={[3.4, 0, 1.9]} />
      </Zone>

      <Zone id="aquabike" onSelect={onSelect} onHover={setHovered}>
        <AquabikeCabin position={[-3.2, 0, 2.3]} animate={animate} />
        <AquabikeCabin position={[-1.2, 0, 2.6]} animate={animate} />
      </Zone>

      {HOTSPOTS.map((h) => (
        <FloorRing key={h.id} position={h.ring} radius={h.ringRadius} active={selected === h.id || hovered === h.id} />
      ))}

      <PinProjector pins={pins} />

      <ContactShadows position={[0, 0.02, 0]} scale={[9, 8]} far={3.2} blur={2.4} opacity={0.45} frames={1} resolution={512} />

      <OrbitControls
        makeDefault
        enabled={interactive}
        enablePan={false}
        enableZoom={allowZoom}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minPolarAngle={LIMITS.minPolar}
        maxPolarAngle={LIMITS.maxPolar}
        minAzimuthAngle={LIMITS.minAzimuth}
        maxAzimuthAngle={LIMITS.maxAzimuth}
        minDistance={LIMITS.minDistance}
        maxDistance={LIMITS.maxDistance}
      />
      <CameraRig ref={ref} selected={selected} />
    </Canvas>
    <PinsOverlay pins={pins} selected={selected} onSelect={onSelect} />
    </div>
  );
});

export default ClubScene;
