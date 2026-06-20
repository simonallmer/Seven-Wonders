const __newWonders = ['colosseum.html', 'great_wall.html', 'tower.html', 'library.html', 'cathedral.html', 'palace.html', 'skyscraper.html'];

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const page = window.location.pathname.split('/').pop() || '';
        const suffix = __newWonders.includes(page) ? '?menu=new' : '';
        window.location.href = 'index.html' + suffix;
    } else if (e.code === 'Space') {
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            e.preventDefault();
            menuToggle.click();
        }
    }
}, { capture: true });
