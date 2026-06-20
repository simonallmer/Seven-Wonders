const fs = require('fs');
const path = require('path');

const dir = '/Users/simonthomasallmer/Gemini/Antigravity/Simon Allmer App/Allmer Games/Seven Wonders';

// Create global-keys.js
const globalKeysCode = `
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.location.href = 'index.html';
    } else if (e.code === 'Space') {
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            e.preventDefault();
            menuToggle.click();
        }
    }
}, { capture: true });
`;
fs.writeFileSync(path.join(dir, 'global-keys.js'), globalKeysCode);

// Inject global-keys.js into all HTML files (except index.html)
const files = fs.readdirSync(dir);
files.forEach(file => {
    if (file.endsWith('.html') && file !== 'index.html' && file !== 'citadel.html') {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        if (!content.includes('global-keys.js')) {
            content = content.replace('</body>', '    <script src="global-keys.js"></script>\n</body>');
            fs.writeFileSync(path.join(dir, file), content);
            console.log('Injected global-keys.js into ' + file);
        }
    }
});

// Replace pointerdown with pointerup + drag threshold in all *-3d.js
files.forEach(file => {
    if (file.endsWith('-3d.js') && file !== 'library-3d.js' && file !== 'citadel-3d.js') {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        
        let targetListener = null;
        if (content.includes("renderer.domElement.addEventListener('pointerdown', onPointerDown);")) {
            targetListener = "renderer.domElement.addEventListener('pointerdown', onPointerDown);";
        } else if (content.includes("window.addEventListener('pointerdown', onPointerDown);")) {
            targetListener = "window.addEventListener('pointerdown', onPointerDown);";
        } else if (content.includes("canvas.addEventListener('pointerdown', onMouseDown);")) {
            targetListener = "canvas.addEventListener('pointerdown', onMouseDown);";
        }
        
        if (targetListener) {
            const isMouseDown = targetListener.includes('onMouseDown');
            const handlerName = isMouseDown ? 'onMouseDown' : 'onPointerDown';
            const element = targetListener.split('.')[0] === 'renderer' ? 'renderer.domElement' : 
                            (targetListener.includes('canvas') ? 'canvas' : 'window');
            
            const replacement = `
    let __pointerDownPos_${file.replace(/[^a-zA-Z]/g, '')} = { x: 0, y: 0 };
    ${element}.addEventListener('pointerdown', (e) => {
        __pointerDownPos_${file.replace(/[^a-zA-Z]/g, '')}.x = e.clientX;
        __pointerDownPos_${file.replace(/[^a-zA-Z]/g, '')}.y = e.clientY;
    });

    ${element}.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __pointerDownPos_${file.replace(/[^a-zA-Z]/g, '')}.x;
        const dy = e.clientY - __pointerDownPos_${file.replace(/[^a-zA-Z]/g, '')}.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            ${handlerName}(e);
        }
    });
`;
            if (content.includes(targetListener)) {
                content = content.replace(targetListener, replacement);
                fs.writeFileSync(path.join(dir, file), content);
                console.log('Fixed pointerdown in ' + file);
            }
        }
    }
});
