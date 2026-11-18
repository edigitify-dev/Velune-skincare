'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export type RitualState = { p: number };

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime,uAspect,uProg;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
void main(){
  vec2 p=(vUv-.5)*vec2(uAspect,1.);
  float t=uProg;
  float g=smoothstep(.04,.62,t); g=g*g*(3.-2.*g);
  float cover=length(vec2(uAspect*.5,.5))*1.3;
  float R=mix(.04,cover,g);
  float r=length(p), a=atan(p.y,p.x);
  float edge=R*(1.+.07*sin(a*5.+uTime*.9+t*12.)*(1.-g*.6));
  float mask=1.-smoothstep(-.004,.004,r-edge);

  // whirl: inner area twists more than the rim, driven by scroll
  float tw=(1.-clamp(r/max(R,.001),0.,1.))*(2.5+t*9.);
  vec2 q=rot(tw+uTime*.08+t*3.)*p;
  float n=fbm(q*3.2+vec2(0.,uTime*.04));
  float n2=fbm(q*7.+n*2.);
  vec3 cream=vec3(.984,.965,.933);
  vec3 shade=vec3(.90,.82,.73);
  vec3 col=mix(cream,shade,smoothstep(.35,.75,n));
  col+=smoothstep(.035,0.,abs(n2-.5))*.28;   // glossy ridges in the lotion

  // droplet shading while still small
  float rr=min(r/max(edge,.001),1.);
  vec3 N=normalize(vec3(p/max(edge,.001),sqrt(max(0.,1.-rr*rr))));
  float spec=pow(max(dot(reflect(-normalize(vec3(-.5,.6,.65)),N),vec3(0,0,1)),0.),40.);
  float rim=pow(1.-N.z,2.2);
  col=mix(col,vec3(.655,.486,.376),rim*(1.-g)*.55)+spec*(1.-g)*.8;

  // settle into flat warm ivory
  col=mix(col,vec3(.961,.941,.914),smoothstep(.7,.95,t));
  gl_FragColor=vec4(col,mask);
}`;

function Plane({ state }: { state: RitualState }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1 }, uProg: { value: 0 } }), []);
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime;
    uniforms.uAspect.value = s.size.width / s.size.height;
    uniforms.uProg.value = state.p;
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthTest={false} />
    </mesh>
  );
}

export default function RitualCanvas({ state, active, mobile }: { state: RitualState; active: boolean; mobile: boolean }) {
  return (
    <Canvas className="!absolute inset-0" dpr={mobile ? 1 : [1, 1.5]} gl={{ alpha: true, antialias: true }}
            frameloop={active ? 'always' : 'never'} aria-hidden>
      <Plane state={state} />
    </Canvas>
  );
}
