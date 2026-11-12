// Renderer and post-processing: two worlds cross-faded into one HDR image, then bloom, grade and tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const QUAD_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Renders world A, world B, or a blend of the two with a veil of blown sand between them.
class WorldsPass extends Pass {
    constructor() {
        super();
        this.needsSwap = false;
        this.a = null; this.b = null; this.mix = 0;
        this.veil = new THREE.Color(0xe2c79a);
        const opts = { type: THREE.HalfFloatType, samples: 4 };
        this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
        this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
        this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uVeil: { value: this.veil }, uTime: { value: 0 } },
            vertexShader: QUAD_VERT,
            fragmentShader: /* glsl */`
                uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform vec3 uVeil; uniform float uTime; varying vec2 vUv;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
                void main() {
                    // the new world arrives from the edges of the frame inward, in drifting wisps
                    float n = noise(vUv * 3.0 + uTime * 0.2) * 0.6 + noise(vUv * 9.0 - uTime * 0.3) * 0.4;
                    float edge = length(vUv - 0.5) * 1.25;
                    float m = smoothstep(0.0, 1.0, uMix * 2.2 - 1.2 + edge * 0.7 + n * 0.5);
                    m = mix(m, uMix, smoothstep(0.85, 1.0, uMix) + smoothstep(0.15, 0.0, uMix));
                    vec3 c = mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, m);
                    float veil = sin(3.14159 * m) * (0.35 + n * 0.3) * sin(3.14159 * uMix);
                    gl_FragColor = vec4(mix(c, uVeil, veil * 0.55), 1.0);
                }`,
        }));
    }
    setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); }
    render(renderer, writeBuffer, readBuffer) {
        const target = this.renderToScreen ? null : readBuffer;
        const draw = (world, rt) => { renderer.setRenderTarget(rt); renderer.clear(); renderer.render(world.scene, world.camera); };
        if (this.mix <= 0.001) draw(this.a, target);
        else if (this.mix >= 0.999) draw(this.b, target);
        else {
            draw(this.a, this.rtA); draw(this.b, this.rtB);
            const u = this.quad.material.uniforms;
            u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture; u.uMix.value = this.mix; u.uTime.value = performance.now() / 1000;
            renderer.setRenderTarget(target); this.quad.render(renderer);
        }
    }
}

const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 1 } },
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            // adventure-film grade: cool shadows, warm highlights, a touch more contrast
            c = mix(c, c * vec3(0.9, 0.98, 1.1), (1.0 - smoothstep(0.0, 0.35, l)) * 0.5);
            c = mix(c, c * vec3(1.08, 1.02, 0.9), smoothstep(0.3, 1.2, l) * 0.6);
            c = mix(vec3(l), c, 1.1);
            vec2 q = vUv - 0.5;
            c *= 1.0 - dot(q, q) * 0.85 * uVignette;
            c *= 1.0 + (hash(vUv * 900.0 + fract(uTime) * 60.0) - 0.5) * 0.045;
            gl_FragColor = vec4(max(c, 0.0), 1.0);
        }`,
};

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt);
    const worlds = new WorldsPass();
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.7, 0.92);
    const grade = new ShaderPass(GradeShader);
    composer.addPass(worlds); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass());

    const resize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
    };
    return { renderer, composer, worlds, bloom, grade, resize };
}
