/* eslint-disable react/no-unknown-property */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import "./R3FDither.css";

type Props = {
  /** 2..16, more = smoother */
  colorNum?: number;
  /** 0.8..3, smaller = finer */
  pixelSize?: number;
  /** 0..0.5, smaller = calmer */
  waveAmplitude?: number;
  /** 0.01..0.08 */
  waveSpeed?: number;
  /** ~2..4 */
  waveFrequency?: number;
  /** 0..1 canvas alpha for subtlety */
  opacity?: number;
  /** rgb in 0..1 space */
  waveColor?: [number, number, number];
};

const VERT = `
precision highp float;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform vec2  resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3  waveColor;
uniform float colorNum;
uniform float pixelSize;
uniform float opacityU;

vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec2 fade(vec2 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec2 P){
  vec4 Pi=floor(P.xyxy)+vec4(0.0,0.0,1.0,1.0);
  vec4 Pf=fract(P.xyxy)-vec4(0.0,0.0,1.0,1.0);
  Pi=mod289(Pi);
  vec4 ix=Pi.xzxz; vec4 iy=Pi.yyww;
  vec4 fx=Pf.xzxz; vec4 fy=Pf.yyww;
  vec4 i=permute(permute(ix)+iy);
  vec4 gx=fract(i*(1.0/41.0))*2.0-1.0;
  vec4 gy=abs(gx)-0.5;
  vec4 tx=floor(gx+0.5);
  gx=gx-tx;
  vec2 g00=vec2(gx.x,gy.x);
  vec2 g10=vec2(gx.y,gy.y);
  vec2 g01=vec2(gx.z,gy.z);
  vec2 g11=vec2(gx.w,gy.w);
  vec4 norm=taylorInvSqrt(vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11)));
  g00*=norm.x; g01*=norm.y; g10*=norm.z; g11*=norm.w;
  float n00=dot(g00,vec2(fx.x,fy.x));
  float n10=dot(g10,vec2(fx.y,fy.y));
  float n01=dot(g01,vec2(fx.z,fy.z));
  float n11=dot(g11,vec2(fx.w,fy.w));
  vec2 fade_xy=fade(Pf.xy);
  vec2 n_x=mix(vec2(n00,n01),vec2(n10,n11),fade_xy.x);
  return 2.3*mix(n_x.x,n_x.y,fade_xy.y);
}

float fbm(vec2 p){
  float v=0.0, a=1.0;
  float f=waveFrequency;
  for(int i=0;i<4;i++){
    v+=a*abs(cnoise(p));
    p*=f;
    a*=waveAmplitude;
  }
  return v;
}

// lightweight 8x8 Bayer threshold
float bayer8(vec2 g){
  float x = mod(g.x, 8.0);
  float y = mod(g.y, 8.0);
  float b1 = mod(x,2.0) + 2.0*mod(y,2.0);
  float b2 = mod(floor(x/2.0),2.0) + 2.0*mod(floor(y/2.0),2.0);
  float b3 = mod(floor(x/4.0),2.0) + 2.0*mod(floor(y/4.0),2.0);
  float idx = b1 + 4.0*b2 + 16.0*b3;
  return idx / 64.0;
}

vec3 dither(vec2 fragCoord, vec3 color){
  vec2 grid = floor(fragCoord / pixelSize);
  float threshold = bayer8(grid) - 0.22;
  float levels = max(2.0, colorNum);
  float step = 1.0 / (levels - 1.0);
  color = clamp(color - 0.14, 0.0, 1.0);
  color += threshold * step;
  color = floor(color * (levels - 1.0) + 0.5) / (levels - 1.0);
  return color;
}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  float t = time * waveSpeed;
  float f = fbm(uv + fbm(uv + vec2(t)));

  vec3 base = vec3(0.05, 0.045, 0.04);
  vec3 col  = mix(base, waveColor, clamp(f, 0.0, 1.0));
  col = dither(gl_FragCoord.xy, col);

  gl_FragColor = vec4(col, opacityU);
}
`;

function Scene({
  waveColor,
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  colorNum,
  pixelSize,
  opacityU,
}: Required<Omit<Props, "opacity">> & { opacityU: number }) {
  const { viewport, size, gl } = useThree();

  const uniforms = useMemo(
    () => ({
      time:        { value: 0 },
      resolution:  { value: new THREE.Vector2(1, 1) },
      waveSpeed:   { value: waveSpeed },
      waveFrequency:{ value: waveFrequency },
      waveAmplitude:{ value: waveAmplitude },
      waveColor:   { value: new THREE.Color(...waveColor) },
      colorNum:    { value: colorNum },
      pixelSize:   { value: pixelSize },
      opacityU:    { value: opacityU },
    }),
    [waveAmplitude, waveColor, waveFrequency, waveSpeed, colorNum, pixelSize, opacityU]
  );

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    uniforms.resolution.value.set(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr)
    );
  }, [size, gl, uniforms]);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial args={[{ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true }]} />
    </mesh>
  );
}

export default function R3FDither({
  colorNum = 8,
  pixelSize = 1.25,
  waveAmplitude = 0.18,
  waveSpeed = 0.03,
  waveFrequency = 2.2,
  opacity = 0.55,
  waveColor = [230/255, 193/255, 123/255],
}: Props) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <div className="gg-dither" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          try { (gl.getContext && gl.getContext()); } catch { setOk(false); }
        }}
      >
        <Scene
          colorNum={colorNum}
          pixelSize={pixelSize}
          waveAmplitude={waveAmplitude}
          waveSpeed={waveSpeed}
          waveFrequency={waveFrequency}
          waveColor={waveColor}
          opacityU={opacity}
        />
      </Canvas>
    </div>
  ) : (
    // CSS fallback if WebGL fails
    <div
      className="gg-dither"
      aria-hidden
      style={{
        background:
          `repeating-linear-gradient(45deg, rgba(0,0,0,.18) 0 4px, transparent 4px 8px),
           repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 4px, transparent 4px 8px),
           radial-gradient(60% 60% at 50% 50%, transparent 40%, rgba(0,0,0,.7) 100%)`,
      }}
    />
  );
}