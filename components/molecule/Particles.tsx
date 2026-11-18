'use client';
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExpState } from './types';
import { mulberry, SPHERE_R } from './network';
import type { Shared } from './MolecularScene';

const vert = /* glsl */ `
attribute vec3 aScatter; attribute vec3 aInner; attribute vec4 aRand;
uniform float uTime, uEmerge, uGather, uShatter, uFrag, uRotY, uPx;
varying float vA;
void main(){
  float g=smoothstep(aRand.x*.5,aRand.x*.5+.5,uGather);
  vec3 sc=aScatter+vec3(sin(uTime*.3+aRand.y*6.),cos(uTime*.27+aRand.z*6.),sin(uTime*.22+aRand.w*6.))*.35*(1.-g);
  vec3 p=mix(sc,aInner,g);
  float c=cos(uRotY), s=sin(uRotY);
  vec3 wv=normalize(aInner+.001)*(.8+aRand.z*2.)+vec3(0.,0.,(aRand.w-.3)*3.);
  p+=vec3(wv.x*c-wv.z*s,wv.y,wv.x*s+wv.z*c)*uShatter*2.4;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  float fade=smoothstep(aRand.z*.6,aRand.z*.6+.4,uFrag);
  gl_PointSize=(aRand.w*2.6+1.2)*uPx/max(.1,-mv.z)*8.;
  float tw=.65+.35*sin(uTime*1.7+aRand.x*40.);
  vA=uEmerge*(.25+.75*aRand.y)*tw*(1.-fade);
}`;
const frag = /* glsl */ `
precision highp float; varying float vA; uniform vec3 uCol;
void main(){ vec2 q=gl_PointCoord-.5; float d=length(q); if(d>.5) discard;
  float a=smoothstep(.5,0.,d); gl_FragColor=vec4(uCol*1.7,a*a*vA);
  #include <colorspace_fragment> }`;

export default function Particles({ S, shared, lite }: { S: ExpState; shared: Shared; lite: boolean }) {
  const n = lite ? 160 : 420;
  const geo = useMemo(() => {
    const r = mulberry(5), g = new THREE.BufferGeometry();
    const sc = new Float32Array(n * 3), inn = new Float32Array(n * 3), rd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      sc.set([(r() * 2 - 1) * 8, (r() * 2 - 1) * 4.6, -7 + r() * 11], i * 3);
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * SPHERE_R * 0.82);
      inn.set([v.x, v.y, v.z], i * 3);
      rd.set([r(), r(), r(), r()], i * 4);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(sc, 3));
    g.setAttribute('aInner', new THREE.BufferAttribute(inn, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rd, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    return g;
  }, [n]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    uniforms: { uTime: shared.uTime, uEmerge: { value: 0 }, uGather: { value: 0 }, uShatter: { value: 0 }, uFrag: { value: 0 }, uRotY: { value: 0 }, uPx: { value: 1 }, uCol: { value: new THREE.Color('#D9B26E') } },
  }), [shared]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ size }) => {
    const u = mat.uniforms;
    u.uEmerge.value = Math.min(1, S.emerge * 1.2); u.uGather.value = S.gather; u.uShatter.value = S.shatter; u.uFrag.value = S.frag; u.uRotY.value = S.rot;
    u.uPx.value = size.height / 800;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
