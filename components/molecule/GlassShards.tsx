"use client";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExpState } from "./types";
import type { Network } from "./network";
import { SPHERE_R, ss } from "./network";
import { buildShards } from "./shards";
import type { Shared } from "./MolecularScene";

const vert = /* glsl */ `
attribute vec3 aCenter; attribute vec4 aRand; attribute vec3 aBary; attribute float aSide;
uniform float uShatter, uCrack, uPh, uRotY, uFrag, uGather; uniform vec3 uImpact;
varying vec3 vN, vV, vBary; varying float vSide, vReveal, vFade, vShell; varying vec4 vR;
vec3 rotAxis(vec3 v, vec3 k, float a){ return v*cos(a)+cross(k,v)*sin(a)+k*dot(k,v)*(1.-cos(a)); }
void main(){
  vec3 dir=normalize(aCenter);
  float c=cos(uRotY), s=sin(uRotY);
  // pre-shatter stress: seams open, shards tremble
  float lift=uCrack*(.012+.03*aRand.y);
  float trem=.5*sin(uPh*140.+aRand.x*40.)+.5*sin(uPh*93.+aRand.z*30.);
  vec3 pre=dir*(lift+trem*uCrack*uCrack*.012);
  // burst: world-space velocity (radial + some thrown toward the lens), rotated back into the group's frame
  vec3 rdir=vec3(dir.x*c+dir.z*s, dir.y, -dir.x*s+dir.z*c);
  float speed=mix(.4,2.3,aRand.x*aRand.x);
  vec3 wv=rdir*speed+vec3((aRand.y-.5)*1.2,(aRand.z-.5)*1.2,(aRand.w-.4)*2.4);
  vec3 lv=vec3(wv.x*c-wv.z*s, wv.y, wv.x*s+wv.z*c);
  float fade=smoothstep(aRand.z*.6, aRand.z*.6+.4, uFrag);
  vec3 axis=normalize(aRand.zwx-.5+vec3(.001));
  float ang=uShatter*(aRand.x-.5)*11.*(.5+aRand.y);
  vec3 local=(position-aCenter)*(1.-fade*.5);
  vec3 p=aCenter+rotAxis(local,axis,ang)+pre+lv*uShatter*2.7;
  vec3 nrm=rotAxis(normal,axis,ang);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  vN=normalize(normalMatrix*nrm); vV=-mv.xyz; vBary=aBary; vSide=aSide; vR=aRand; vFade=fade;
  // fracture front travels outward from the impact point
  float d=distance(aCenter,uImpact)/${(SPHERE_R * 2.1).toFixed(2)};
  vReveal=1.-smoothstep(uCrack*1.35-.32, uCrack*1.35, d+(aRand.w-.5)*.22);
  // the glass skin materialises shard by shard as the network closes into a sphere
  vShell=smoothstep(.55+aRand.w*.3, .85+aRand.w*.3, uGather);
}`;
const frag = /* glsl */ `
precision highp float;
uniform vec3 uGold, uIvory, uEnvLow, uEnvHigh, uChamp; uniform float uDark;
varying vec3 vN, vV, vBary; varying float vSide, vReveal, vFade, vShell; varying vec4 vR;
void main(){
  vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N;
  vec3 V=normalize(vV);
  float ndv=abs(dot(N,V));
  float fres=pow(1.-ndv,2.4);
  vec3 R=reflect(-V,N);
  float up=R.y*.5+.5;
  vec3 env=mix(uEnvLow,uEnvHigh,smoothstep(.15,.95,up));
  float spec=pow(max(dot(R,normalize(vec3(-.4,.7,.6))),0.),42.);
  float spec2=pow(max(dot(R,normalize(vec3(.75,-.15,.45))),0.),24.)*.55;
  vec3 col=env*(.3+.9*fres);
  float a=.085+fres*.5;
  // bevelled glass edge catches light
  a=mix(a,.42+fres*.35,vSide); col=mix(col,uChamp*1.3,vSide*.65);
  float eb=min(vBary.x,min(vBary.y,vBary.z));
  float edge=(1.-smoothstep(0.,.04,eb))*(1.-vSide);
  col+=uGold*edge*.1; a+=edge*.05;
  // fracture light: the seams ignite as the crack front passes
  float crack=edge*vReveal*(1.-smoothstep(.55,1.,vFade));
  col+=uGold*crack*3.4; a+=crack*.65;
  col+=vec3(1.,.95,.88)*(spec+spec2)*1.3; a+=(spec+spec2)*.8;
  a=clamp(a,0.,1.)*vShell*(1.-vFade);
  gl_FragColor=vec4(col,a);
  #include <colorspace_fragment>
}`;

type Props = { net: Network; S: ExpState; shared: Shared };

export default function GlassShards({ net, S, shared }: Props) {
  const geo = useMemo(() => buildShards(net), [net]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        depthTest: false, // the glass skin is drawn over the tiles, never hidden by them
        side: THREE.DoubleSide,
        uniforms: {
          uShatter: { value: 0 },
          uCrack: { value: 0 },
          uPh: { value: 0 },
          uRotY: { value: 0 },
          uFrag: { value: 0 },
          uGather: { value: 0 },
          uImpact: { value: new THREE.Vector3() },
          uDark: shared.uDark,
          uGold: { value: new THREE.Color("#D4AC68") },
          uIvory: { value: new THREE.Color("#F5F0E9") },
          uEnvLow: { value: new THREE.Color("#3A2A22") },
          uEnvHigh: { value: new THREE.Color("#F2DFC8") },
          uChamp: { value: new THREE.Color("#F0DDB8") },
        },
      }),
    [shared],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  const imp = useMemo(
    () => new THREE.Vector3(0.42, 0.28, 1).normalize().multiplyScalar(SPHERE_R),
    [],
  );
  useFrame(() => {
    const u = mat.uniforms;
    u.uShatter.value = S.shatter;
    u.uCrack.value = S.crack;
    u.uPh.value = S.p;
    u.uRotY.value = S.rot;
    u.uFrag.value = S.frag;
    u.uGather.value = S.gather;
    // impact point is fixed in the world (front-right of the sphere); express it in the rotating group's local space
    const c = Math.cos(S.rot),
      s = Math.sin(S.rot);
    u.uImpact.value.set(imp.x * c - imp.z * s, imp.y, imp.x * s + imp.z * c);
  });
  return (
    <mesh
      geometry={geo}
      material={mat}
      frustumCulled={false}
      renderOrder={2.5}
    />
  );
}
export { ss };
