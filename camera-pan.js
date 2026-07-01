// camera-pan.js — shared OrbitControls enhancement for all Seven Wonders 3D games.
// Re-enables right-click / two-finger panning (with a soft limit so you can't lose the
// board) and adds a subtle "Recenter" button (bottom-left) that appears once you've panned.
//
// Works by wrapping THREE.OrbitControls, so every game gets the behaviour just by loading
// this script after OrbitControls.js — no per-game code changes needed. Each game's own
// `controls.enablePan = false` line is overridden.
(function () {
    if (!window.THREE || !THREE.OrbitControls || THREE.OrbitControls.__allmerPatched) return;

    const Orig = THREE.OrbitControls;
    function Patched(object, domElement) {
        const controls = new Orig(object, domElement);
        try { setupPan(controls, object); } catch (e) { /* never break the game */ }
        return controls;
    }
    Patched.prototype = Orig.prototype;
    Patched.__allmerPatched = true;
    THREE.OrbitControls = Patched;

    // One shared recenter button for whichever game is on the page.
    let recenterBtn = null;
    function ensureButton() {
        if (recenterBtn) return recenterBtn;
        const btn = document.createElement('button');
        btn.id = 'cam-recenter-btn';
        btn.type = 'button';
        btn.textContent = '⌖ Recenter';
        Object.assign(btn.style, {
            position: 'fixed', left: '16px', bottom: '16px', zIndex: '6000',
            display: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
            font: "600 0.8rem 'Cinzel', serif", letterSpacing: '0.04em',
            color: '#f5f0e8', background: 'rgba(20,18,14,0.55)',
            border: '1px solid rgba(197,160,89,0.6)', backdropFilter: 'blur(6px)',
            webkitBackdropFilter: 'blur(6px)', opacity: '0', transition: 'opacity 0.25s'
        });
        (document.body || document.documentElement).appendChild(btn);
        recenterBtn = btn;
        return btn;
    }

    function setupPan(controls, camera) {
        controls.screenSpacePanning = false; // pan across the ground plane (board-friendly)

        // Force pan on + right-button/two-finger pan, ignoring any later per-game overrides
        // (some games reassign mouseButtons or set enablePan = false after construction).
        const mb = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        const tch = THREE.TOUCH ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } : null;
        let _pan = true;
        controls.enablePan = true;
        try {
            Object.defineProperty(controls, 'enablePan', { get() { return _pan; }, set() { _pan = true; }, configurable: true });
            Object.defineProperty(controls, 'mouseButtons', { get() { return mb; }, set() {}, configurable: true });
            if (tch) Object.defineProperty(controls, 'touches', { get() { return tch; }, set() {}, configurable: true });
        } catch (e) {
            controls.mouseButtons = mb;
            if (tch) controls.touches = tch;
        }

        const home = { target: null, pos: null };
        let limit = 0, captured = false;

        // Capture the game's default framing the first time the user interacts (by then the
        // game has positioned its camera). Used as the pan origin + recenter destination.
        function capture() {
            if (captured) return;
            home.target = controls.target.clone();
            home.pos = camera.position.clone();
            limit = Math.max(90, camera.position.distanceTo(controls.target) * 0.7);
            captured = true;
        }
        controls.addEventListener('start', capture);

        const btn = ensureButton();
        let recentering = false;

        controls.addEventListener('change', function () {
            if (!captured || recentering) return;
            const t = controls.target;
            const dx = t.x - home.target.x, dz = t.z - home.target.z;
            const dist = Math.hypot(dx, dz);
            if (dist > limit) {
                const s = limit / dist;
                const nx = home.target.x + dx * s, nz = home.target.z + dz * s;
                camera.position.x += nx - t.x;
                camera.position.z += nz - t.z;
                t.x = nx; t.z = nz;
            }
            const dev = Math.hypot(t.x - home.target.x, t.z - home.target.z) + Math.abs(t.y - home.target.y);
            const show = dev > 8;
            btn.style.display = show ? 'inline-flex' : 'none';
            btn.style.opacity = show ? '1' : '0';
        });

        // Recenter undoes the pan (target back home) while preserving the current angle/zoom:
        // both target and camera shift by the same delta.
        btn.addEventListener('click', function () {
            if (!captured) return;
            const t = controls.target;
            const ddx = home.target.x - t.x, ddy = home.target.y - t.y, ddz = home.target.z - t.z;
            btn.style.opacity = '0';
            setTimeout(() => { btn.style.display = 'none'; }, 250);

            if (window.TWEEN) {
                recentering = true;
                const step = { f: 0 };
                let prev = 0;
                new TWEEN.Tween(step).to({ f: 1 }, 450).easing(TWEEN.Easing.Quadratic.Out)
                    .onUpdate(function (o) {
                        const d = o.f - prev; prev = o.f;
                        t.x += ddx * d; t.y += ddy * d; t.z += ddz * d;
                        camera.position.x += ddx * d; camera.position.y += ddy * d; camera.position.z += ddz * d;
                        if (controls.update) controls.update();
                    })
                    .onComplete(function () { recentering = false; })
                    .start();
            } else {
                t.x += ddx; t.y += ddy; t.z += ddz;
                camera.position.x += ddx; camera.position.y += ddy; camera.position.z += ddz;
                if (controls.update) controls.update();
            }
        });
    }
})();
