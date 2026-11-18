"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { ExpState, Mouse } from "./types";
import { SPHERE_R, ss, stepNetwork } from "./network";
import type { Network } from "./network";
import { makeAtlas } from "./atlas";
import type { Shared } from "./MolecularScene";

const gold = new THREE.Color("#C9A15E"),
  ivory = new THREE.Color("#F5F0E9");

/* ───────── hexagon panel: ingredient picture from the atlas ───────── */
const hexVert = /* glsl */ `
attribute float aCell; attribute float aSeed; attribute float aHover; attribute float aAlpha; attribute float aDepth;
varying vec2 vP; varying float vCell, vSeed, vHover, vAlpha, vDepth;
void main(){ vP=position.xy; vCell=aCell; vSeed=aSeed; vHover=aHover; vAlpha=aAlpha; vDepth=aDepth;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`;
const hexFrag = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas; uniform float uDark, uTime;
varying vec2 vP; varying float vCell, vSeed, vHover, vAlpha, vDepth;
void main(){
  // the hexagon mesh has circumradius 1.1, so the picture spans -1.1..1.1
  vec2 q=vP/2.2+.5;
  float c=floor(vCell+.5);
  vec2 uv=(vec2(mod(c,4.),3.-floor(c/4.))+q)/4.;
  vec4 t=texture2D(uAtlas,uv);
  if(t.a<.003) discard;
  // always glowing, breathing gently; hover turns it up
  float glow=.55+.2*(.5+.5*sin(uTime*1.3+vSeed*6.283))+vHover*.9;
  vec3 col=t.rgb*(1.-.12*uDark)*(1.+.06*glow);
  col+=vec3(1.,.86,.6)*glow*.025*t.a;
  col=min(col,vec3(.98));
  float a=t.a*mix(.6,1.,vDepth)*vAlpha;
  // tiles write depth (the sphere is solid), so faint pixels must not
  if(a<.04) discard;
  gl_FragColor=vec4(col,a);
  #include <colorspace_fragment>
}`;

/* ───────── bond: thin tube that grows from one node to the other, with a luminous bead travelling along it
   (only the loose web of the opening field; the sphere itself is made of the hexagon tiles) ───────── */
const bondVert = /* glsl */ `
attribute float aSeed; attribute float aGrow; attribute float aLen; attribute float aKind;
varying float vY, vSeed, vGrow, vLen, vKind; varying vec3 vN;
void main(){ vY=position.y+.5; vSeed=aSeed; vGrow=aGrow; vLen=aLen; vKind=aKind;
  vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`;
const bondFrag = /* glsl */ `
precision highp float;
uniform float uTime; uniform vec3 uGold, uIvory;
varying float vY, vSeed, vGrow, vLen, vKind; varying vec3 vN;
void main(){
  float x=vY*vLen*vGrow*.9 - uTime*(.35+vSeed*.5) + vSeed*13.;
  float p=fract(x/1.6);
  float bead=exp(-pow((p-.5)*9.,2.))*smoothstep(.85,1.,vGrow);
  float tip=smoothstep(.8,1.,vY)*(1.-smoothstep(.9,1.,vGrow));
  float rim=1.-abs(vN.z)*.6;
  vec3 c=uGold*(1.15+rim*.6+tip*2.)+uIvory*bead*1.6+uGold*bead*2.4;
  float a=(vKind>.5?.78:.6)+bead*.4+tip*.3;
  gl_FragColor=vec4(c,clamp(a,0.,1.));
  #include <colorspace_fragment>
}`;

type Props = {
  net: Network;
  S: ExpState;
  shared: Shared;
  mouse: Mouse;
  onHover: (i: number) => void;
  hoverRef: { current: number };
};

export default function NetworkLayer({
  net,
  S,
  shared,
  mouse,
  onHover,
  hoverRef,
}: Props) {
  const { H, N } = net;
  const hexMesh = useRef<THREE.InstancedMesh>(null);
  const bondMesh = useRef<THREE.InstancedMesh>(null);
  const nodeMesh = useRef<THREE.InstancedMesh>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const lastHover = useRef(-1);

  const atlas = useMemo(() => makeAtlas(net.lite), [net.lite]);
  useEffect(() => () => atlas.dispose(), [atlas]);

  const hexGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(1.1, 6);
    g.rotateZ(Math.PI / 6); // pointy-top, like the artwork
    const cell = new Float32Array(H),
      seed = new Float32Array(H),
      depth = new Float32Array(H);
    for (let i = 0; i < H; i++) {
      cell[i] = net.cell[i];
      seed[i] = net.hexSeed[i];
      depth[i] = net.depth[i];
    }
    g.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    // far tiles are a little dimmer while floating; the closed sphere is fully solid (updated every frame)
    g.setAttribute(
      "aDepth",
      new THREE.InstancedBufferAttribute(depth, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    g.setAttribute(
      "aHover",
      new THREE.InstancedBufferAttribute(new Float32Array(H), 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    g.setAttribute(
      "aAlpha",
      new THREE.InstancedBufferAttribute(new Float32Array(H), 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    return g;
  }, [H, net]);
  const hexMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: hexVert,
        fragmentShader: hexFrag,
        transparent: true,
        depthWrite: true, // the sphere is solid: front tiles hide the ones behind them
        depthTest: true,
        side: THREE.DoubleSide,
        uniforms: {
          uAtlas: { value: atlas },
          uDark: shared.uDark,
          uTime: shared.uTime,
        },
      }),
    [atlas, shared],
  );

  // bonds: the proximity web of the opening field, one instanced draw call
  const nE = net.edgesA.length / 2;
  const bondGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    const seed = new Float32Array(nE),
      kind = new Float32Array(nE);
    for (let i = 0; i < nE; i++) {
      seed[i] = (i * 0.7548776 + 0.13) % 1;
      kind[i] = 0;
    }
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute("aKind", new THREE.InstancedBufferAttribute(kind, 1));
    g.setAttribute(
      "aGrow",
      new THREE.InstancedBufferAttribute(new Float32Array(nE), 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    g.setAttribute(
      "aLen",
      new THREE.InstancedBufferAttribute(new Float32Array(nE), 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    return g;
  }, [nE]);
  const bondMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bondVert,
        fragmentShader: bondFrag,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uTime: shared.uTime,
          uGold: { value: gold },
          uIvory: { value: ivory },
        },
      }),
    [shared],
  );
  const nodeGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const nodeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#D9B26E").multiplyScalar(1.5),
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  // dark core just under the tiles: closes the hairline seams so the ball reads as one solid object
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#2A2017",
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }),
    [],
  );
  const coreGeo = useMemo(
    () => new THREE.SphereGeometry(SPHERE_R * 0.965, 48, 32),
    [],
  );

  useEffect(
    () => () => {
      hexGeo.dispose();
      hexMat.dispose();
      bondGeo.dispose();
      bondMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
    },
    [hexGeo, hexMat, bondGeo, bondMat, nodeGeo, nodeMat, coreGeo, coreMat],
  );

  // these meshes are driven every frame; raycasting is only wanted on the hexagons
  useEffect(() => {
    if (bondMesh.current) bondMesh.current.raycast = () => {};
    if (nodeMesh.current) nodeMesh.current.raycast = () => {};
    if (coreMesh.current) coreMesh.current.raycast = () => {};
  }, []);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      y: new THREE.Vector3(0, 1, 0),
      d: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 1 / 30);
    shared.uTime.value += dt;
    stepNetwork(net, S, shared.uTime.value, mouse, hoverRef.current, dt);
    const { pos, g, hexPos, hexQuat, hexS, hexA, hover } = net;
    const { m, p, q, s, y, d } = tmp;

    const hm = hexMesh.current!;
    const aH = hexGeo.getAttribute("aHover") as THREE.InstancedBufferAttribute;
    const aA = hexGeo.getAttribute("aAlpha") as THREE.InstancedBufferAttribute;
    const aD = hexGeo.getAttribute("aDepth") as THREE.InstancedBufferAttribute;
    for (let i = 0; i < H; i++) {
      p.set(hexPos[i * 3], hexPos[i * 3 + 1], hexPos[i * 3 + 2]);
      q.set(
        hexQuat[i * 4],
        hexQuat[i * 4 + 1],
        hexQuat[i * 4 + 2],
        hexQuat[i * 4 + 3],
      );
      s.setScalar(Math.max(hexS[i], 1e-4));
      m.compose(p, q, s);
      hm.setMatrixAt(i, m);
      aH.setX(i, hover[i]);
      aA.setX(i, hexA[i]);
      aD.setX(i, net.depth[i] + (1 - net.depth[i]) * g[i]);
    }
    hm.instanceMatrix.needsUpdate = true;
    aH.needsUpdate = true;
    aA.needsUpdate = true;
    aD.needsUpdate = true;
    hm.computeBoundingSphere();

    // bonds
    const bm = bondMesh.current!;
    const aG = bondGeo.getAttribute("aGrow") as THREE.InstancedBufferAttribute;
    const aL = bondGeo.getAttribute("aLen") as THREE.InstancedBufferAttribute;
    const eA = net.edgesA;
    for (let e = 0; e < nE; e++) {
      const ia = eA[e * 2],
        ib = eA[e * 2 + 1];
      const th = net.thrA[e];
      // the web grows in with the scroll and lets go as its points fly into the sphere
      const grow =
        ss(th, th + 0.3, S.bonds) * (1 - ss(0, 0.6, Math.max(g[ia], g[ib])));
      if (grow < 0.003) {
        s.set(0, 0, 0);
        p.set(0, 0, 0);
        q.identity();
        m.compose(p, q, s);
        bm.setMatrixAt(e, m);
        aG.setX(e, 0);
        continue;
      }
      d.set(
        pos[ib * 3] - pos[ia * 3],
        pos[ib * 3 + 1] - pos[ia * 3 + 1],
        pos[ib * 3 + 2] - pos[ia * 3 + 2],
      );
      const len = d.length();
      d.divideScalar(len || 1);
      q.setFromUnitVectors(y, d);
      p.set(
        pos[ia * 3] + d.x * len * grow * 0.5,
        pos[ia * 3 + 1] + d.y * len * grow * 0.5,
        pos[ia * 3 + 2] + d.z * len * grow * 0.5,
      );
      const r = 0.01;
      s.set(r, len * grow, r);
      m.compose(p, q, s);
      bm.setMatrixAt(e, m);
      aG.setX(e, grow);
      aL.setX(e, len);
    }
    bm.instanceMatrix.needsUpdate = true;
    aG.needsUpdate = true;
    aL.needsUpdate = true;

    // nodes
    const nm = nodeMesh.current!;
    q.identity();
    for (let i = H; i < N; i++) {
      p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      s.setScalar(net.nodeScale[i] * net.nodeR[i] * (1 + 0.3 * g[i]));
      m.compose(p, q, s);
      nm.setMatrixAt(i - H, m);
    }
    nm.instanceMatrix.needsUpdate = true;

    // core: appears as the tiles close the ball, goes when they lift off
    const core = coreMesh.current;
    if (core) {
      const o = ss(0.6, 1, S.gather) * (1 - ss(0.25, 0.9, S.detach));
      coreMat.opacity = o;
      core.visible = o > 0.01; // an invisible mesh must not write depth
    }
  });

  const enabled = () => S.gather < 0.12 && S.emerge > 0.5;
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled()) return;
    e.stopPropagation();
    const id = e.instanceId ?? -1;
    if (id < 0 || id >= 15) {
      out();
      return;
    }
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      if (lastHover.current !== id) {
        lastHover.current = id;
        onHover(id);
      }
    }
  };
  const out = () => {
    hoverRef.current = -1;
    if (lastHover.current !== -1) {
      lastHover.current = -1;
      onHover(-1);
    }
  };

  return (
    <group>
      <mesh
        ref={coreMesh}
        geometry={coreGeo}
        material={coreMat}
        frustumCulled={false}
        renderOrder={1}
        visible={false}
      />
      <instancedMesh
        ref={bondMesh}
        args={[bondGeo, bondMat, nE]}
        frustumCulled={false}
        renderOrder={1.5} // drawn before the hexagons, so the tiles always sit on top of the bond lines
      />
      <instancedMesh
        ref={nodeMesh}
        args={[nodeGeo, nodeMat, Math.max(1, N - H)]}
        frustumCulled={false}
        renderOrder={1.6} // junction beads go with the bonds, under the hexagons
      />
      <instancedMesh
        ref={hexMesh}
        args={[hexGeo, hexMat, H]}
        frustumCulled={false}
        renderOrder={2}
        onPointerMove={move}
        onPointerOut={out}
      />
    </group>
  );
}
export { SPHERE_R };
