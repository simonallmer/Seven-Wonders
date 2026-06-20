import os

dir_path = '.'

global_keys_code = """
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
"""

with open(os.path.join(dir_path, 'global-keys.js'), 'w') as f:
    f.write(global_keys_code)

for filename in os.listdir(dir_path):
    if filename.endswith('.html') and filename not in ['index.html', 'citadel.html']:
        path = os.path.join(dir_path, filename)
        with open(path, 'r') as f:
            content = f.read()
        if 'global-keys.js' not in content:
            content = content.replace('</body>', '    <script src="global-keys.js"></script>\n</body>')
            with open(path, 'w') as f:
                f.write(content)
            print(f'Injected global-keys.js into {filename}')
            
    if filename.endswith('-3d.js') and filename not in ['library-3d.js', 'citadel-3d.js']:
        path = os.path.join(dir_path, filename)
        with open(path, 'r') as f:
            content = f.read()
            
        target_listener = None
        if "renderer.domElement.addEventListener('pointerdown', onPointerDown);" in content:
            target_listener = "renderer.domElement.addEventListener('pointerdown', onPointerDown);"
        elif "window.addEventListener('pointerdown', onPointerDown);" in content:
            target_listener = "window.addEventListener('pointerdown', onPointerDown);"
        elif "canvas.addEventListener('pointerdown', onMouseDown);" in content:
            target_listener = "canvas.addEventListener('pointerdown', onMouseDown);"
            
        if target_listener:
            is_mouse_down = 'onMouseDown' in target_listener
            handler_name = 'onMouseDown' if is_mouse_down else 'onPointerDown'
            element = 'renderer.domElement' if 'renderer' in target_listener else ('canvas' if 'canvas' in target_listener else 'window')
            
            clean_name = "".join([c for c in filename if c.isalpha()])
            replacement = f"""
    let __pointerDownPos_{clean_name} = {{ x: 0, y: 0 }};
    {element}.addEventListener('pointerdown', (e) => {{
        __pointerDownPos_{clean_name}.x = e.clientX;
        __pointerDownPos_{clean_name}.y = e.clientY;
    }});

    {element}.addEventListener('pointerup', (e) => {{
        const dx = e.clientX - __pointerDownPos_{clean_name}.x;
        const dy = e.clientY - __pointerDownPos_{clean_name}.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {{
            {handler_name}(e);
        }}
    }});
"""
            if target_listener in content:
                content = content.replace(target_listener, replacement)
                with open(path, 'w') as f:
                    f.write(content)
                print(f'Fixed pointerdown in {filename}')
