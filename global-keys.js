
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
