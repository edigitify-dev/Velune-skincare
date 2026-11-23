"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import PerfGuard from "./PerfGuard";
import { aniso, dprFor, useTier } from "@/lib/quality";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COLLECTION } from "@/lib/collection";
import {
  IMPACT,
  buildShardGeometry,
  flashFrag,
  flashVert,
  shardFrag,
  shardVert,
} from "./heroShatter";

export type LiquidState = {
  ph: number;
  def: number;
  break: number;
  shake: number; // 0→1 ramp: the whole ball trembles harder and harder until it bursts
  gone: number;
  spread: number;
  conv: number;
  lift: number;
  fall: number;
  splat: number;
  fade: number;
  bottle: number;
};
export type Cheek = { x: number; y: number }; // landing spot, as fractions of the viewport (0..1). Mutated in place on resize.

// the rest of the range shown inside the glass after the serum (ids from lib/collection)
const ROTATION = ["cleanse", "oil", "mist", "veil"];

const N = 4; // uniform array size: 1 sphere + 2 cursor blobs + 1 primary serum drop

/* ───────────────────────── shader ───────────────────────── */

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uPh, uAspect, uK, uVel, uBH, uBAsp, uBA, uBRot, uFade, uDef, uRip, uThin, uFilm, uGlass, uBFree;
uniform int uN;
uniform vec2 uRes, uTip, uBPos;
uniform vec4 uB[${N}];   // xy = centre, z = radius, w = vertical stretch
uniform vec4 uC[${N}];   // x = rotation, y = depth-of-field blur, z = seed (-1..1), w = teardrop taper
uniform sampler2D uBottle, uBottle2; uniform float uBMix;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }

// radial displacement of the sphere surface: fine travelling ripples + a few liquid lumps that push outwards
float disp(float th){
  float a=uPh*38.; float t=uTime*.22;
  float rp = sin(th*3.+a*1.1+t)*.45 + sin(th*5.-a*1.7-t*1.3)*.33 + sin(th*9.+a*2.6+1.7)*.22;
  float lumps = pow(max(sin(th*4.+1.3+a*.55),0.),4.)*.05
              + pow(max(sin(th*6.-.9-a*.8+t),0.),5.)*.032
              + pow(max(sin(th*3.+4.-a*.4),0.),4.)*.04;
  return uDef*(.009*rp + lumps*uDef);
}

// metaball field: negative inside the liquid.
// rl = local blob radius (dome normal), d0 = distance to the main sphere only, att = (blur, -, seed) weighted by proximity
float field(vec2 p, out float rl, out float d0, out vec3 att){
  float res=1e3, ws=1e-4, rs=0., wb=0., wz=0.; d0=1e3;
  for(int i=0;i<${N};i++){
    if(i>=uN) break;
    vec4 b=uB[i];
    if(b.z<=.0005) continue;
    vec2 q=p-b.xy; float d;
    if(i==0){
      q.y/=b.w;
      d=length(q)-b.z*(1.+disp(atan(q.y,q.x)));
      d0=d;
    } else {
      vec4 c=uC[i];
      float cs=cos(c.x), sn=sin(c.x);
      q=vec2(cs*q.x+sn*q.y, -sn*q.x+cs*q.y);   // rotate into the droplet's frame
      q.y/=b.w;
      q.x/=(1.+c.w*clamp(q.y/b.z,-1.,1.));      // teardrop taper
      d=length(q)-b.z;
    }
    res=smin(res,d,uK);
    float w=exp(-clamp(d,-.4,.4)*30.);
    ws+=w; rs+=w*b.z; wb+=w*uC[i].y; wz+=w*uC[i].z;
  }
  rl=rs/ws; att=vec3(wb/ws,0.,wz/ws);
  return res;
}

void main(){
  vec2 p=(vUv-.5)*vec2(uAspect,1.);
  float rl,d0; vec3 att;
  float f=field(p,rl,d0,att);
  float px=1./uRes.y;
  float blur=att.x; float sd=att.z;
  float soft=px*(1.3+blur*22.+uFilm*9.);
  float mask=1.-smoothstep(-soft,soft,f);
  if(mask<.003){
    // glass is gone but the bottle may still hang in the air: only continue inside the bottle's quad
    if(uBFree<.5 || uBA<.003){ gl_FragColor=vec4(0.); return; }
    float c0=cos(uBRot), s0=sin(uBRot);
    vec2 q0=mat2(c0,-s0,s0,c0)*(p-uBPos);
    vec2 b0=vec2(q0.x/(uBH*uBAsp)+.5, q0.y/uBH+.5);
    if(b0.x<0.||b0.x>1.||b0.y<0.||b0.y>1.){ gl_FragColor=vec4(0.); return; }
  }

  // dome normal rebuilt from the field
  float e=1.-clamp(-f/max(rl,.01),0.,1.);
  float eps=.003; float r2,d2; vec3 a2;
  vec2 g=vec2(field(p+vec2(eps,0.),r2,d2,a2)-f, field(p+vec2(0.,eps),r2,d2,a2)-f);
  float gl=length(g); g=gl>1e-5? g/gl : vec2(0.);

  // ripples from the cursor tip + scroll-driven ripples across the surface + tiny living noise
  vec2 toT=p-uTip; float td=length(toT);
  vec2 rd=td>1e-4? toT/td : vec2(0.);
  float rip=sin(td*46.-uTime*4.5)*exp(-td*4.)*(.3+uVel*1.8);
  float ph=uPh*38.;
  vec2 rpl=vec2(sin(p.x*34.+p.y*13.+ph*1.3+uTime*.5), cos(p.y*31.-p.x*11.-ph*1.1-uTime*.45))*(.01+.04*uRip)*(.4+.6*e);
  vec2 nxy=g*e + rd*rip*.11 + rpl + (vec2(noise(p*8.+uTime*.2), noise(p*8.+19.-uTime*.18))-.5)*.04;
  float nz=sqrt(max(0.,1.-dot(nxy,nxy)));
  vec3 n=normalize(vec3(nxy,max(nz,.05)));

  // lighting: warm key upper-left (angle varies a little per droplet), soft bounce lower-right
  vec3 V=vec3(0.,0.,1.);
  vec3 L1=normalize(vec3(-.55+sd*.28,.62-sd*.16,.56));
  vec3 L2=normalize(vec3(.65,-.45,.45));
  float s1 =pow(max(dot(reflect(-L1,n),V),0.),80.+sd*30.);
  float s1b=pow(max(dot(reflect(-L1,n),V),0.),10.)*.2;
  float s2 =pow(max(dot(reflect(-L2,n),V),0.),40.)*.45;
  float fres=pow(1.-n.z,2.2);
  vec2 nd=normalize(nxy+1e-4);
  float arc=smoothstep(.80,.95,dot(nd,normalize(vec2(-.62+sd*.2,.78))))*smoothstep(.35,.7,e)*(1.-smoothstep(.94,1.,e));
  float caus=pow(max(dot(nd,normalize(vec2(.6,-.7))),0.),3.)*smoothstep(.2,.8,e)*.3;
  float edgeLine=1.-smoothstep(0.,.0045+blur*.01,-f);
  // soft window reflection (environment) + light focused through the lower body of the drop
  vec3 R=vec3(2.*n.z*n.xy, 2.*n.z*n.z-1.);
  float win=smoothstep(.17,.09,abs(R.x+.38+sd*.1))*smoothstep(.27,.15,abs(R.y-.42))*smoothstep(.15,.5,e);
  float inner=smoothstep(-.1,.9,-nxy.y)*e*.22;

  // main-sphere weight (1 inside the original membrane, 0 for free droplets)
  float m0=1.-smoothstep(0.,.03,d0);
  float G=mix(1.,uGlass,m0);   // glass body of the ORIGINAL ball fades out the instant it shatters (shards take over)

  // glass body: cream-gold tint (per-droplet warmth), amber toward the rim
  vec3 tint=vec3(.97,.86,.72)+vec3(.02,.0,-.03)*sd, rimC=vec3(.70,.47,.29);
  vec3 col=mix(tint,rimC,clamp(fres*1.1,0.,1.))+vec3(1.,.82,.55)*(caus+inner);
  float a=(.14*(1.-.8*uThin*m0)*(1.+.25*inner*4.)+fres*.55+caus*.4+edgeLine*.3)*G;

  // product bottle seen THROUGH the lens, clipped to the original sphere and dissolved by a noise threshold
  vec2 q=p-uBPos-nxy*rl*.30*e*(1.-uBFree);   // no lens refraction once the glass is gone
  float cr=cos(uBRot), sr=sin(uBRot);
  q=mat2(cr,-sr,sr,cr)*q;
  vec2 bu=vec2(q.x/(uBH*uBAsp)+.5, q.y/uBH+.5);
  float inside=step(0.,bu.x)*step(bu.x,1.)*step(0.,bu.y)*step(bu.y,1.);
  // two product pictures cross-fade inside the glass (alpha-weighted so the edges don't halo)
  vec4 bt1=texture2D(uBottle,clamp(bu,0.,1.)), bt2=texture2D(uBottle2,clamp(bu,0.,1.));
  float bta=mix(bt1.a,bt2.a,uBMix);
  vec4 bt=vec4((bt1.rgb*bt1.a*(1.-uBMix)+bt2.rgb*bt2.a*uBMix)/max(bta,.001), bta);
  float bm=mix(smoothstep(0.,-.035,d0),1.,uBFree);   // un-clipped once the ball is broken
  float n1=noise(bu*16.+3.)*.65+noise(bu*44.+9.)*.35;
  float vis=smoothstep(n1-.1,n1,uBA*1.25-.15);
  float ba=bt.a*inside*bm*vis*step(.001,uBA);
  col=mix(col,bt.rgb*(1.-fres*.22),ba);
  col+=vec3(1.,.86,.62)*vis*(1.-vis)*4.*.22*bt.a*inside*bm;
  a=mix(a,1.,ba*.97);

  // glints on top of everything (softer for out-of-focus drops and for the thin film on skin)
  float soften=(1.-blur*.55)*(1.-.55*uFilm)*G;
  vec3 hi=vec3(1.,.97,.92)*(s1*1.4+s1b+s2+arc*.85+edgeLine*.22+win*.5)*soften;
  col+=hi;
  a=clamp(a+(s1+arc*.8+s2*.6+s1b+win*.3)*.9*soften,0.,1.);
  a*=(1.-blur*.35)*(1.-.62*uFilm);
  col=mix(col,vec3(1.,.96,.9),uFilm*.25);

  float mk=max(mask,uBFree*ba);
  gl_FragColor=vec4(col,a*mk*uFade);
}`;

/* ───────────────────────── helpers ───────────────────────── */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
const easeOut3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 2);
const softClamp = (v: number, lim: number) => lim * Math.tanh(v / lim);

// where the sphere sits, in aspect-corrected units (viewport height = 1, origin = centre, y up)
function layout(aspect: number) {
  if (aspect < 0.95)
    return { R: Math.min(0.3, aspect * 0.4), cx: 0, cy: -0.09 }; // portrait / phones
  if (aspect < 1.25)
    return { R: Math.min(0.3, aspect * 0.22), cx: aspect * 0.14, cy: 0 }; // tablet
  return { R: Math.min(0.37, aspect * 0.2), cx: aspect * 0.13, cy: -0.01 }; // desktop
}

/** Procedural placeholder bottle (cream dropper bottle with label). Replaced automatically by /public/hero/bottle.png. */
function drawBottle(): HTMLCanvasElement {
  const W = 520,
    H = 1200;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const serif = '"Cormorant Garamond", Georgia, serif';
  const rr = (X: number, Y: number, w: number, h: number, r: number) => {
    x.beginPath();
    x.roundRect(X, Y, w, h, r);
  };
  const hg = (x0: number, x1: number, stops: [number, string][]) => {
    const g = x.createLinearGradient(x0, 0, x1, 0);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  };
  // bulb
  rr(176, 24, 168, 240, 78);
  x.fillStyle = hg(176, 344, [
    [0, "#FFFBF4"],
    [0.55, "#F3E4D2"],
    [1, "#D8BFA6"],
  ]);
  x.fill();
  // gold collar
  rr(132, 252, 256, 62, 14);
  x.fillStyle = hg(132, 388, [
    [0, "#B98F4E"],
    [0.3, "#F4E3B6"],
    [0.6, "#D9B777"],
    [1, "#A9803F"],
  ]);
  x.fill();
  // neck ring
  rr(150, 312, 220, 36, 8);
  x.fillStyle = hg(150, 370, [
    [0, "#FFFBF4"],
    [0.6, "#EDDCC8"],
    [1, "#CDB197"],
  ]);
  x.fill();
  // body
  rr(64, 344, 392, 820, 74);
  x.fillStyle = hg(64, 456, [
    [0, "#FFFBF3"],
    [0.45, "#F6E9D9"],
    [1, "#D9BFA5"],
  ]);
  x.fill();
  // sheen + shade
  rr(100, 376, 24, 740, 12);
  x.fillStyle = "rgba(255,255,255,.65)";
  x.fill();
  rr(404, 380, 28, 730, 14);
  x.fillStyle = "rgba(140,100,70,.16)";
  x.fill();
  // label
  x.textAlign = "center";
  x.fillStyle = "#3B2A1D";
  const ls = (px: number) => {
    (x as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
  };
  x.font = `500 58px ${serif}`;
  ls(14);
  x.fillText("VELUNE", 260 + 7, 560);
  x.font = `500 15px ${serif}`;
  ls(7);
  x.fillText("SKIN RITUALS", 260 + 3, 598);
  x.textAlign = "left";
  ls(0);
  x.font = `500 62px ${serif}`;
  x.fillText("Dewdrop", 112, 716);
  x.fillText("Hydrating", 112, 784);
  x.fillText("Serum", 112, 852);
  // little botanical mark
  x.strokeStyle = "#C79A56";
  x.lineWidth = 3;
  x.lineCap = "round";
  x.beginPath();
  x.moveTo(372, 880);
  x.bezierCurveTo(360, 800, 372, 730, 404, 690);
  x.stroke();
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.moveTo(372 - i * 4, 840 - i * 46);
    x.bezierCurveTo(430, 820 - i * 46, 430, 770 - i * 46, 396, 760 - i * 46);
    x.stroke();
  }
  x.fillStyle = "#5B4333";
  x.font = `600 15px ${serif}`;
  ls(2.4);
  x.fillText("HYDRATION + PLUMPING", 112, 930);
  x.fillText("FACE SERUM", 112, 954);
  x.fillStyle = "#C79A56";
  x.fillRect(112, 976, 26, 2);
  x.fillStyle = "#7A6252";
  x.font = `500 12px ${serif}`;
  ls(1.2);
  x.fillText("WITH HYALURONIC ACID,", 112, 1012);
  x.fillText("NIACINAMIDE & ROSE WATER", 112, 1030);
  x.fillStyle = "#3B2A1D";
  x.font = `500 20px ${serif}`;
  ls(0.5);
  x.fillText("30 ml  ⊖  1.0 fl oz", 112, 1110);
  return c;
}

/* ───────────────────────── the ball ───────────────────────── */

type Props = {
  state: LiquidState;
  active: boolean;
  mobile: boolean;
  cheek: Cheek;
  bottleSrc?: string;
};

function Membrane({
  state,
  cheek,
  mobile,
  bottleSrc = "/hero/bottle.webp",
}: Omit<Props, "active">) {
  const size = useThree((s) => s.size);
  const cheekRef = useRef(cheek);
  cheekRef.current = cheek;

  const blank = useMemo(
    () => new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1),
    [],
  );
  useEffect(() => {
    blank.needsUpdate = true;
    return () => blank.dispose();
  }, [blank]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPh: { value: 0 },
      uAspect: { value: 1 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uN: { value: 3 },
      uB: {
        value: Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 1)),
      },
      uC: {
        value: Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 0)),
      },
      uK: { value: 0.07 },
      uTip: { value: new THREE.Vector2() },
      uVel: { value: 0 },
      uBottle: { value: blank as THREE.Texture },
      uBottle2: { value: blank as THREE.Texture },
      uBMix: { value: 0 },
      uBPos: { value: new THREE.Vector2() },
      uBH: { value: 0.5 },
      uBAsp: { value: 0.433 },
      uBA: { value: 1 },
      uBRot: { value: 0 },
      uFade: { value: 1 },
      uDef: { value: 0 },
      uRip: { value: 0 },
      uThin: { value: 0 },
      uFilm: { value: 0 },
      uGlass: { value: 1 },
      uBFree: { value: 0 },
    }),
    [blank],
  );

  /* shards + impact flash (drawn above the liquid shader, same canvas) */
  const shardGeo = useMemo(() => buildShardGeometry(mobile), [mobile]);
  useEffect(() => () => shardGeo.dispose(), [shardGeo]);
  const shardU = useMemo(
    () => ({
      uC: { value: new THREE.Vector2() },
      uImp: { value: new THREE.Vector2(IMPACT[0], IMPACT[1]) },
      uR: { value: 0.3 },
      uAspect: { value: 1 },
      uBurst: { value: 0 },
      uCrack: { value: 0 },
      uGone: { value: 0 },
      uPh: { value: 0 },
      uFace: { value: 0 },
    }),
    [],
  );
  const flashU = useMemo(
    () => ({
      uP: { value: new THREE.Vector2() },
      uAspect: { value: 1 },
      uR: { value: 0.3 },
      uFlash: { value: 0 },
      uRing: { value: 0 },
    }),
    [],
  );
  const shardMesh = useRef<THREE.Mesh>(null);
  const flashMesh = useRef<THREE.Mesh>(null);

  // product rotation inside the glass: slot 0 = hero serum bottle, then the rest of the range
  const texs = useRef<(THREE.Texture | undefined)[]>([]);
  const cyc = useRef({ cur: 0, nxt: 0, f: 0, fading: false, timer: 0 });

  // bottle texture: procedural first, real PNG if present
  useEffect(() => {
    let dead = false;
    const textures: THREE.Texture[] = [];
    const slots = texs.current;
    slots.length = 0;
    const apply = (tex: THREE.Texture, aspect: number) => {
      tex.anisotropy = aniso();
      tex.needsUpdate = true;
      textures.push(tex);
      slots[0] = tex; // slot 0 = the hero serum bottle; the frame loop binds whichever slot is showing
      uniforms.uBAsp.value = aspect;
    };
    // the rest of the range, loaded after the hero bottle: each product cut-out is re-drawn onto a 3:4 canvas
    // scaled so it fills the glass like the serum does (the studio shots fill their frame a little more)
    const loadRange = () => {
      ROTATION.forEach((id, k) => {
        const item = COLLECTION.find((c) => c.id === id);
        if (!item) return;
        const im = new Image();
        im.onload = () => {
          if (dead) return;
          const W = im.naturalWidth,
            H = im.naturalHeight,
            f = 0.94;
          const cv = document.createElement("canvas");
          cv.width = W;
          cv.height = H;
          cv.getContext("2d")!.drawImage(
            im,
            (W * (1 - f)) / 2,
            (H * (1 - f)) / 2,
            W * f,
            H * f,
          );
          const tex = new THREE.CanvasTexture(cv);
          tex.anisotropy = aniso();
          textures.push(tex);
          slots[k + 1] = tex;
        };
        im.src = item.image;
      });
    };
    (async () => {
      try {
        await document.fonts.load('500 58px "Cormorant Garamond"');
      } catch {}
      if (dead) return;
      const cv = drawBottle();
      apply(new THREE.CanvasTexture(cv), cv.width / cv.height);
      const img = new Image();
      img.onload = () => {
        if (!dead)
          apply(new THREE.Texture(img), img.naturalWidth / img.naturalHeight);
        loadRange();
      };
      img.onerror = loadRange;
      img.src = bottleSrc;
    })();
    return () => {
      dead = true;
      textures.forEach((t) => t.dispose());
    };
  }, [bottleSrc, uniforms]);

  // pointer + physics
  const m = useRef({
    tx: 0,
    ty: 0,
    x: 0,
    y: 0,
    vel: 0,
    last: 0,
    bx: 0,
    by: 0,
    bvx: 0,
    bvy: 0,
    tipx: 0,
    tipy: 0,
    tvx: 0,
    tvy: 0,
  });
  useEffect(() => {
    m.current.last = performance.now();
    const onMove = (e: PointerEvent) => {
      const k = m.current;
      k.tx =
        (e.clientX / window.innerWidth - 0.5) *
        (window.innerWidth / window.innerHeight);
      k.ty = -(e.clientY / window.innerHeight - 0.5);
      k.last = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((s, dt0) => {
    const dt = Math.min(Math.max(dt0, 1 / 240), 1 / 30);
    const t = s.clock.elapsedTime;
    const aspect = size.width / size.height;
    const L = layout(aspect);
    const k = m.current;
    const st = state;
    const B = uniforms.uB.value;
    const C = uniforms.uC.value;
    const ph = st.ph;

    // pointer (a virtual cursor drifts around the ball when nobody is moving – keeps it alive on touch screens)
    const idle = performance.now() - k.last > 2500;
    if (idle) {
      k.tx = L.cx + L.R * 1.9 * Math.cos(t * 0.42);
      k.ty = L.cy + L.R * 1.3 * Math.sin(t * 0.55);
    }
    const ox = k.x,
      oy = k.y;
    k.x += (k.tx - k.x) * Math.min(1, dt * 8);
    k.y += (k.ty - k.y) * Math.min(1, dt * 8);
    const speed = Math.hypot(k.x - ox, k.y - oy) / dt;
    k.vel += (Math.min(speed * 0.18, 1) - k.vel) * Math.min(1, dt * 3);
    uniforms.uVel.value = k.vel;

    /* ── choreography (all scroll-driven):
         def   0→1  cracks run out from the impact point (the ball still looks whole)
         break 0→1  the ball bursts: glass body hands over to the shards, shards fly
         gone  0→1  shards melt away
         bottle 1→0 the product dissolves into a single serum drop (also what falls on the face later) ── */
    const br = st.break,
      cv = st.conv;
    const crack = clamp01((st.def - 0.2) / 0.8);
    const burst = sm(clamp01(br / 0.035)); // 0 intact → 1 the instant after the hit
    const R = L.R;
    const scale = R / 0.37;
    uniforms.uK.value = (0.055 + 0.02 * sm(cv)) * Math.max(scale, 0.6);

    /* ── 1. the ball (glass body of the liquid shader). Radius must equal the shards' radius. ── */
    const bob = 1 - burst;
    const mr0 = R * (1 + 0.008 * Math.sin(t * 1.3) * bob);
    // pre-shatter tremor: starts right after the hero copy is gone and builds until the glass bursts.
    // Driven by the scroll-scrubbed `shake` envelope (so it rewinds), with time-based jitter so it keeps
    // vibrating even if the user pauses mid-scroll.
    const sh = clamp01(st.shake) * (1 - burst);
    // a clearly visible tremor from the very first bit of scroll, then it ramps up to violent
    const amp = 0.18 * Math.min(1, sh * 8) + 0.82 * sh * sh;
    const jx =
      Math.sin(t * 91) +
      0.6 * Math.sin(t * 137 + 1.3) +
      0.4 * Math.sin(t * 211 + 2.1);
    const jy =
      Math.sin(t * 83 + 0.7) +
      0.6 * Math.sin(t * 149 + 2.6) +
      0.4 * Math.sin(t * 193 + 0.4);
    const shX = jx * 0.012 * R * amp * 2.2;
    const shY = jy * 0.012 * R * amp * 2.2;
    const sx = L.cx + shX;
    const sy = L.cy + Math.sin(t * 0.9) * 0.006 * bob * (1 - sh) + shY;
    // once the shards have taken over, drop the ball from the metaball field entirely (frees the serum drop)
    B[0].set(sx, sy, br > 0.03 ? 0 : mr0, 1);
    C[0].set(0, 0, 0, 0);

    /* ── 2. cursor bulge + trailing bead: retract as soon as the cracks start ── */
    const a = 1 - sm(st.def / 0.25);
    let dx = k.x - L.cx,
      dy = k.y - L.cy;
    const dist = Math.hypot(dx, dy) || 1e-4;
    dx /= dist;
    dy /= dist;
    let reach = Math.pow(clamp01(1 - (dist - L.R) / (L.R * 2.4)), 1.2);
    if (idle) reach *= 0.7;
    const spring = (
      pos: number,
      vel: number,
      target: number,
      kk: number,
      cc: number,
    ): [number, number] => {
      const v = vel + ((target - pos) * kk - vel * cc) * dt;
      return [pos + v * dt, v];
    };
    [k.bx, k.bvx] = spring(
      k.bx,
      k.bvx,
      L.cx + dx * (L.R * 0.86 + L.R * 0.5 * reach),
      70,
      11,
    );
    [k.by, k.bvy] = spring(
      k.by,
      k.bvy,
      L.cy + dy * (L.R * 0.86 + L.R * 0.5 * reach),
      70,
      11,
    );
    [k.tipx, k.tvx] = spring(
      k.tipx,
      k.tvx,
      L.cx + dx * L.R * (1.18 + 0.55 * reach),
      38,
      7,
    );
    [k.tipy, k.tvy] = spring(
      k.tipy,
      k.tvy,
      L.cy + dy * L.R * (1.18 + 0.55 * reach),
      38,
      7,
    );
    B[1].set(k.bx, k.by, L.R * (0.16 + 0.14 * reach) * a, 1);
    B[2].set(
      k.tipx,
      k.tipy,
      L.R * (0.04 + 0.05 * reach) * a * sm((reach - 0.25) / 0.45),
      1,
    );
    C[1].set(0, 0, 0, 0);
    C[2].set(0, 0, 0, 0);
    uniforms.uTip.value.set(k.tipx, k.tipy);

    /* ── 3. the serum drop: condenses where the bottle was as the bottle dissolves, then
          travels to the middle, lifts, falls onto the cheek and is absorbed (unchanged) ── */
    const g = sm(clamp01(1 - st.bottle));
    const ci = sm(clamp01((cv - 0.15) / 0.85));
    const px = sx,
      py = sy - R * 0.02;
    const ex = 0 - px,
      ey = 0.02 - py;
    const len = Math.hypot(ex, ey) || 1e-4;
    const bend = Math.sin(Math.PI * ci) * 0.3 * len * 0.28;
    let x = lerp(px, 0, ci) - (ey / len) * bend;
    let y = lerp(py, 0.02, ci) + (ex / len) * bend;
    let r = Math.min(0.22 * R * Math.pow(g, 0.85), R * 0.3);
    // slight teardrop while it condenses
    let stt = 1 + 0.25 * Math.sin(Math.PI * g) * (1 - ci);
    let ta = 0.3 * Math.sin(Math.PI * g) * (1 - ci);
    let ro = 0;

    const c = cheekRef.current;
    const cheekX = (c.x - 0.5) * aspect,
      cheekY = -(c.y - 0.5);
    y +=
      st.lift * 0.15 * Math.min(1, scale + 0.2) +
      Math.sin(ph * 60) * 0.004 * st.lift;
    const f = st.fall;
    x = lerp(x, cheekX, sm(clamp01(f / 0.9)));
    y = lerp(y, cheekY, sm(clamp01(f)));
    const wf = sm(f / 0.25);
    stt = lerp(stt, 1, wf);
    ta *= 1 - wf;
    ro = lerp(ro, 0, wf);
    r *= lerp(1, 0.8, f);
    r *= 1 - 0.25 * sm(st.fade); // sinks into the skin as it dissolves
    B[3].set(x, y, r, Math.max(stt, 0.2));
    C[3].set(ro, 0, 0, ta);
    uniforms.uN.value = 4;

    /* ── 4. bottle: floats inside the glass, leans away from the cursor, hangs in the air after the
          glass breaks, then dissolves into the drop ── */
    uniforms.uBPos.value.set(
      sx - (k.x - L.cx) * 0.02,
      sy - (k.y - L.cy) * 0.02 - L.R * 0.02 + Math.sin(t * 0.9) * 0.004,
    );
    uniforms.uBRot.value =
      Math.max(-0.12, Math.min(0.12, (k.x - L.cx) * 0.08)) +
      Math.sin(t * 107 + 0.9) * 0.07 * amp; // the bottle rattles inside the glass
    uniforms.uBH.value = L.R * 1.58;
    // cycle through the range while the ball is intact (a fade that has started always finishes; no new one
    // starts once the ball begins to shake, so the bottle that shatters is steady)
    {
      const cy = cyc.current,
        T = texs.current;
      const loaded = (i: number) => !!T[i];
      if (cy.fading) {
        cy.f = Math.min(1, cy.f + dt / 1.0);
        if (cy.f >= 1) {
          cy.cur = cy.nxt;
          cy.fading = false;
          cy.f = 0;
          cy.timer = 0;
        }
      } else if (st.shake < 0.01 && st.break <= 0) {
        cy.timer += dt;
        if (cy.timer > 3.2) {
          const n = ROTATION.length + 1;
          for (let o = 1; o < n; o++) {
            const c = (cy.cur + o) % n;
            if (loaded(c)) {
              cy.nxt = c;
              cy.fading = true;
              cy.f = 0;
              break;
            }
          }
          cy.timer = 0;
        }
      }
      uniforms.uBottle.value = T[cy.cur] ?? T[0] ?? uniforms.uBottle.value;
      uniforms.uBottle2.value = cy.fading ? (T[cy.nxt] ?? blank) : blank;
      uniforms.uBMix.value = cy.fading ? cy.f * cy.f * (3 - 2 * cy.f) : 0;
    }
    uniforms.uBA.value = st.bottle;
    uniforms.uGlass.value = 1 - burst;
    uniforms.uBFree.value = burst;

    uniforms.uDef.value = 0; // glass does not ripple
    uniforms.uRip.value = 0;
    uniforms.uThin.value = 0;
    uniforms.uFilm.value = sm(st.fade); // dissolve: edges soften, glints calm down
    uniforms.uPh.value = ph;
    uniforms.uFade.value = 1 - st.fade;
    uniforms.uTime.value = t;
    uniforms.uAspect.value = aspect;
    uniforms.uRes.value.set(s.gl.domElement.width, s.gl.domElement.height);

    /* ── 5. shards: cracks → burst → fade ── */
    const su = shardU;
    su.uC.value.set(sx, sy);
    su.uR.value = mr0;
    su.uAspect.value = aspect;
    su.uBurst.value = br;
    su.uCrack.value = crack;
    su.uGone.value = st.gone;
    su.uPh.value = ph;
    su.uFace.value = burst;
    if (shardMesh.current)
      shardMesh.current.visible = crack > 0.001 && st.gone < 0.999;

    /* ── 6. impact flash + shock ring at the moment of the break ── */
    const fu = flashU;
    fu.uP.value.set(sx + IMPACT[0] * mr0, sy + IMPACT[1] * mr0);
    fu.uAspect.value = aspect;
    fu.uR.value = mr0;
    fu.uFlash.value = sm(br / 0.012) * (1 - sm((br - 0.012) / 0.12));
    fu.uRing.value = br > 0.001 ? Math.min(3, br * 14) : 0;
    if (flashMesh.current) flashMesh.current.visible = br > 0.001 && br < 0.3;
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={0}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          transparent
          depthTest={false}
        />
      </mesh>
      <mesh
        ref={shardMesh}
        geometry={shardGeo}
        frustumCulled={false}
        renderOrder={1}
        visible={false}
      >
        <shaderMaterial
          vertexShader={shardVert}
          fragmentShader={shardFrag}
          uniforms={shardU}
          transparent
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={flashMesh}
        frustumCulled={false}
        renderOrder={2}
        visible={false}
      >
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={flashVert}
          fragmentShader={flashFrag}
          uniforms={flashU}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export default function HeroLiquid({
  state,
  active,
  mobile,
  cheek,
  bottleSrc,
}: Props) {
  // live tier: the FPS guard can lower it while the page is running
  const tier = useTier() ?? (mobile ? "medium" : "high");
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={mobile ? 1 : dprFor(tier, [1, 1.5])}
      gl={{
        alpha: true,
        antialias: !mobile,
        powerPreference: mobile ? "default" : "high-performance",
      }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      frameloop={active ? "always" : "never"}
      aria-hidden
    >
      <PerfGuard />
      <Membrane
        state={state}
        cheek={cheek}
        mobile={mobile}
        bottleSrc={bottleSrc}
      />
    </Canvas>
  );
}
