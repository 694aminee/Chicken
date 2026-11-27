"use client";

/**
 * Équipements du club en « low-poly » (formes simples Three.js).
 * Chaque modèle pourra plus tard être remplacé par un vrai fichier 3D (.glb) chargé avec useGLTF.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export const PALETTE = {
  wood: "#c99b6d",
  woodDark: "#a87a4f",
  upholstery: "#2a2522",
  cream: "#f4ede6",
  wall: "#f6eee6",
  sand: "#e6d6c5",
  terracotta: "#c87d55",
  rose: "#fe2c55",
  pinkBall: "#f2b5c2",
  metal: "#b9b4ae",
  black: "#1b1a19",
  rubber: "#2e2b29",
  water: "#7fc4dd",
  medBall: "#d4612f",
};

type GroupProps = React.ComponentProps<"group">;

/* ---------------------------------------------------------------- Reformer */

export function Reformer(props: GroupProps) {
  const L = 2.3; // longueur
  const W = 0.68; // largeur
  return (
    <group {...props}>
      {/* Pieds */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * L) / 2.15, 0.12, (sz * W) / 2.3]} castShadow>
            <boxGeometry args={[0.09, 0.24, 0.09]} />
            <meshStandardMaterial color={PALETTE.woodDark} />
          </mesh>
        )),
      )}
      {/* Cadre bois */}
      {[-1, 1].map((sz) => (
        <RoundedBox key={sz} args={[L, 0.13, 0.09]} radius={0.03} position={[0, 0.3, (sz * W) / 2]} castShadow>
          <meshStandardMaterial color={PALETTE.wood} roughness={0.6} />
        </RoundedBox>
      ))}
      {[-1, 1].map((sx) => (
        <RoundedBox key={sx} args={[0.12, 0.15, W + 0.09]} radius={0.03} position={[(sx * L) / 2, 0.3, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.wood} roughness={0.6} />
        </RoundedBox>
      ))}
      {/* Rails */}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, 0.35, (sz * W) / 3.2]}>
          <boxGeometry args={[L - 0.1, 0.02, 0.05]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Chariot rembourré */}
      <RoundedBox args={[0.95, 0.1, W - 0.08]} radius={0.04} position={[-0.35, 0.43, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.upholstery} roughness={0.8} />
      </RoundedBox>
      {/* Appui-tête */}
      <RoundedBox args={[0.26, 0.06, 0.34]} radius={0.025} position={[-0.92, 0.49, 0]} rotation={[0, 0, 0.18]} castShadow>
        <meshStandardMaterial color={PALETTE.upholstery} roughness={0.8} />
      </RoundedBox>
      {/* Cales d'épaules */}
      {[-1, 1].map((sz) => (
        <RoundedBox key={sz} args={[0.09, 0.16, 0.09]} radius={0.03} position={[-0.72, 0.55, sz * 0.17]} castShadow>
          <meshStandardMaterial color={PALETTE.cream} roughness={0.7} />
        </RoundedBox>
      ))}
      {/* Ressorts */}
      {[-0.18, -0.06, 0.06, 0.18].map((z, i) => (
        <mesh key={z} position={[0.45, 0.36, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 1.2, 6]} />
          <meshStandardMaterial
            color={[PALETTE.rose, PALETTE.terracotta, PALETTE.metal, PALETTE.pinkBall][i]}
            metalness={0.4}
            roughness={0.35}
          />
        </mesh>
      ))}
      {/* Barre de pieds */}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[1.0, 0.55, (sz * W) / 2.1]} rotation={[0, 0, -0.35]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.5, 8]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[1.08, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, W - 0.02, 10]} />
        <meshStandardMaterial color={PALETTE.upholstery} roughness={0.7} />
      </mesh>
      {/* Montants avec poulies (côté tête) */}
      {[-1, 1].map((sz) => (
        <group key={sz} position={[-L / 2 + 0.02, 0, (sz * W) / 2]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.55, 8]} />
            <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.84, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={PALETTE.black} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------- Sac de frappe */

export function PunchingBag({ swing = true, phase = 0, ...props }: GroupProps & { swing?: boolean; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !swing) return;
    const t = clock.elapsedTime + phase;
    ref.current.rotation.x = Math.sin(t * 1.3) * 0.035;
    ref.current.rotation.z = Math.cos(t * 0.9) * 0.025;
  });
  return (
    <group {...props}>
      {/* Point d'accroche au plafond (y = 3) : le sac pivote autour de ce point */}
      <group ref={ref} position={[0, 3, 0]}>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.9, 5]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Bandeau rouge */}
        <mesh position={[0, -1.0, 0]} castShadow>
          <cylinderGeometry args={[0.23, 0.23, 0.22, 20]} />
          <meshStandardMaterial color={PALETTE.rose} roughness={0.55} />
        </mesh>
        {/* Corps du sac */}
        <mesh position={[0, -1.66, 0]} castShadow>
          <cylinderGeometry args={[0.23, 0.22, 1.1, 20]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
        </mesh>
        {/* Bande blanche (logo) */}
        <mesh position={[0, -1.66, 0]}>
          <cylinderGeometry args={[0.232, 0.232, 0.5, 20, 1, true, -0.35, 0.7]} />
          <meshStandardMaterial color={PALETTE.cream} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -2.22, 0]}>
          <sphereGeometry args={[0.22, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* --------------------------------------------------------- Cabine aquabike */

export function AquabikeCabin({ animate = true, ...props }: GroupProps & { animate?: boolean }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!water.current || !animate) return;
    water.current.position.y = 0.55 + Math.sin(clock.elapsedTime * 1.6) * 0.012;
  });
  return (
    <group {...props}>
      {/* Socle */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.92, 0.95, 0.12, 32]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.4} />
      </mesh>
      {/* Bassin */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.8, 32, 1, true]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={water} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.76, 0.76, 0.02, 32]} />
        <meshStandardMaterial color={PALETTE.water} roughness={0.08} metalness={0.1} transparent opacity={0.85} />
      </mesh>
      {/* Vélo */}
      <group position={[0, 0.3, 0]}>
        <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.03, 0.03, 0.75, 8]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.25} />
        </mesh>
        <RoundedBox args={[0.28, 0.06, 0.18]} radius={0.03} position={[-0.06, 0.66, 0]}>
          <meshStandardMaterial color={PALETTE.black} />
        </RoundedBox>
        <mesh position={[0.32, 0.45, 0]} rotation={[0, 0, -0.35]}>
          <cylinderGeometry args={[0.025, 0.025, 0.55, 8]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0.42, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.42, 8]} />
          <meshStandardMaterial color={PALETTE.black} />
        </mesh>
      </group>
      {/* Paroi vitrée de la cabine privée */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.1, 32, 1, true, 0.6, Math.PI * 2 - 1.2]} />
        <meshStandardMaterial
          color="#dfeff5"
          transparent
          opacity={0.22}
          roughness={0.05}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Anneau de toit terracotta */}
      <mesh position={[0, 2.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.04, 8, 40]} />
        <meshStandardMaterial color={PALETTE.terracotta} roughness={0.5} />
      </mesh>
      {/* Montants de porte */}
      {[0.6, -0.6].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.9, 1.15, Math.sin(a) * 0.9]}>
          <cylinderGeometry args={[0.03, 0.03, 2.1, 8]} />
          <meshStandardMaterial color={PALETTE.terracotta} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------- Haltères + médecine-ball */

function HexDumbbell({ size = 1, color = PALETTE.black, ...props }: GroupProps & { size?: number; color?: string }) {
  return (
    <group {...props} scale={size}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.8} roughness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.09, 6]} />
          <meshStandardMaterial color={color} roughness={0.6} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function DumbbellRack(props: GroupProps) {
  const sizes = [0.8, 0.9, 1, 1.1, 1.2];
  return (
    <group {...props}>
      {/* Structure du rack */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.85, 0.42, 0]} castShadow>
          <boxGeometry args={[0.06, 0.84, 0.4]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
        </mesh>
      ))}
      {[0.32, 0.72].map((y, row) => (
        <group key={y}>
          <mesh position={[0, y, 0]} rotation={[-0.25, 0, 0]} castShadow>
            <boxGeometry args={[1.76, 0.04, 0.42]} />
            <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
          </mesh>
          {sizes.map((sz, i) => (
            <HexDumbbell
              key={i}
              size={sz * (row === 0 ? 1.1 : 0.9)}
              color={row === 1 && i === 2 ? PALETTE.rose : PALETTE.black}
              position={[-0.68 + i * 0.34, y + 0.09, 0]}
              rotation={[-0.25, Math.PI / 2, 0]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

export function MedicineBall(props: GroupProps) {
  return (
    <group {...props}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <icosahedronGeometry args={[0.2, 2]} />
        <meshStandardMaterial color={PALETTE.medBall} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.2, 0.012, 6, 32]} />
        <meshStandardMaterial color={PALETTE.black} />
      </mesh>
    </group>
  );
}

export function PilatesBall(props: GroupProps) {
  return (
    <mesh {...props} castShadow>
      <sphereGeometry args={[0.12, 16, 12]} />
      <meshStandardMaterial color={PALETTE.pinkBall} roughness={0.5} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ Pièce */

export function Room() {
  return (
    <group>
      {/* Sol béton clair */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 8]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={0.9} />
      </mesh>
      {/* Parquet espace Pilates */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.35, 0.005, -1.4]} receiveShadow>
        <planeGeometry args={[4.1, 4.9]} />
        <meshStandardMaterial color="#d8b994" roughness={0.75} />
      </mesh>
      {/* Tapis noir espace boxe / cross training */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.2, 0.005, -0.6]} receiveShadow>
        <planeGeometry args={[4.4, 6.6]} />
        <meshStandardMaterial color={PALETTE.rubber} roughness={0.95} />
      </mesh>
      {/* Piste de sprint rouge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.4, 0.01, 0.2]} receiveShadow>
        <planeGeometry args={[0.8, 4.8]} />
        <meshStandardMaterial color="#b23a2c" roughness={0.9} />
      </mesh>
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[3.4, 0.012, 0.2 + i * 0.9]}>
          <planeGeometry args={[0.8, 0.03]} />
          <meshStandardMaterial color={PALETTE.cream} />
        </mesh>
      ))}
      {/* Murs (fond et gauche) */}
      <mesh position={[0, 1.6, -4]} receiveShadow>
        <boxGeometry args={[9, 3.2, 0.12]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.95} />
      </mesh>
      <mesh position={[-4.5, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.12, 3.2, 8]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.95} />
      </mesh>
      {/* Plinthe terracotta */}
      <mesh position={[0, 0.06, -3.93]}>
        <boxGeometry args={[9, 0.12, 0.03]} />
        <meshStandardMaterial color={PALETTE.terracotta} />
      </mesh>
      <mesh position={[-4.43, 0.06, 0]}>
        <boxGeometry args={[0.03, 0.12, 8]} />
        <meshStandardMaterial color={PALETTE.terracotta} />
      </mesh>
      {/* Miroir sur le mur du fond (espace Pilates) */}
      <mesh position={[-2.35, 1.4, -3.93]}>
        <boxGeometry args={[3.6, 2, 0.02]} />
        <meshStandardMaterial color="#eef3f4" metalness={0.15} roughness={0.2} />
      </mesh>
      {/* Logo mural : disque noir */}
      <group position={[-4.42, 1.9, 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.03, 40]} />
          <meshStandardMaterial color={PALETTE.black} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <torusGeometry args={[0.4, 0.014, 6, 40]} />
          <meshStandardMaterial color={PALETTE.terracotta} />
        </mesh>
      </group>
      {/* Poutre pour les sacs */}
      <mesh position={[1.0, 3.0, -2.3]} castShadow>
        <boxGeometry args={[3.2, 0.1, 0.1]} />
        <meshStandardMaterial color={PALETTE.black} />
      </mesh>
      {[-0.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 3.0, -3.15]}>
          <boxGeometry args={[0.08, 0.08, 1.7]} />
          <meshStandardMaterial color={PALETTE.black} />
        </mesh>
      ))}
    </group>
  );
}
