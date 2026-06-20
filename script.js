// Seven Wonders Main Menu Script

// Game data structure for future expansion
const games = {
    pyramid: {
        name: 'Pyramid',
        description: 'The Great Pyramid of Giza',
        status: 'available',
        url: 'pyramid.html'
    },
    gardens: {
        name: 'Gardens',
        description: 'The Hanging Gardens of Babylon',
        status: 'available',
        url: 'gardens.html'
    },
    temple: {
        name: 'Temple',
        description: 'The Temple of Artemis at Ephesus',
        status: 'available',
        url: 'temple.html'
    },
    statue: {
        name: 'Statue',
        description: 'The Statue of Zeus at Olympia',
        status: 'available',
        url: 'statue.html'
    },
    mausoleum: {
        name: 'Mausoleum',
        description: 'The Mausoleum at Halicarnassus',
        status: 'available',
        url: 'mausoleum.html'
    },
    colossus: {
        name: 'Colossus',
        description: 'The Colossus of Rhodes',
        status: 'available',
        url: 'colossus.html'
    },
    pharos: {
        name: 'Pharos',
        description: 'The Lighthouse of Alexandria',
        status: 'available',
        url: 'pharos.html'
    },
    colosseum: {
        name: 'Colosseum',
        description: 'The Flavian Amphitheatre',
        status: 'available',
        url: 'colosseum.html'
    },
    great_wall: {
        name: 'Great Wall',
        description: 'The Great Wall of China',
        status: 'available',
        url: 'great_wall.html'
    },
    tower: {
        name: 'Tower',
        description: 'The Porcelain Tower of Nanjing',
        status: 'available',
        url: 'tower.html'
    },
    pagoda: {
        name: 'Pagoda',
        description: 'The Tower of Babel',
        status: 'playtest',
        url: 'pagoda.html'
    },
    basilica: {
        name: 'Basilica',
        description: 'St. Peter\'s Basilica',
        status: 'playtest',
        url: 'basilica.html'
    },
    library: {
        name: 'Library',
        description: 'The Library of Alexandria',
        status: 'playtest',
        url: 'library.html'
    },
    cathedral: {
        name: 'Cathedral',
        description: 'The Gothic Cathedral',
        status: 'playtest',
        url: 'cathedral.html'
    },
    palace: {
        name: 'Palace',
        description: 'The Crystal Palace',
        status: 'playtest',
        url: 'palace.html'
    },
    skyscraper: {
        name: 'Skyscraper',
        description: 'Empire State Building',
        status: 'available',
        url: 'skyscraper.html'
    }
};

// Handle game selection
document.addEventListener('DOMContentLoaded', () => {
    const gameLinks = document.querySelectorAll('.game-link');

    gameLinks.forEach(link => {
        // Use data-id if available, otherwise fallback (for safety)
        const gameId = link.dataset.id || link.getAttribute('href').substring(1);
        const game = games[gameId];

        link.addEventListener('click', (e) => {
            // Prevent default for all links handled by JS to check status
            if (game) {
                e.preventDefault();
                handleGameSelection(gameId);
            }
        });
    });
});

function handleGameSelection(gameId) {
    const game = games[gameId];

    if (game) {
        console.log(`Selected game: ${game.name}`);

        if (game.status === 'available' && game.url) {
            // Navigate to the game page
            window.location.href = game.url;
        } else if (game.status === 'playtest' && game.url) {
            // Check password for playtest games
            const password = prompt(`${game.name} is currently only open to playtesters.\n\nPlease enter the access password:`);
            if (password === '2020') {
                window.location.href = game.url;
            } else if (password !== null) { // If user cancelled, do nothing. If wrong password, alert.
                alert('Incorrect password.');
            }
        } else {
            // Show coming soon message
            alert(`${game.name}\n\n${game.description}\n\nComing Soon...`);
        }
    }
}

// Add subtle entrance animation
window.addEventListener('load', () => {
    const container = document.querySelector('.container');
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';

    setTimeout(() => {
        container.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
});

// Menu Flip Functionality
document.addEventListener('DOMContentLoaded', () => {
    const flipper = document.querySelector('.menu-flipper');
    const showNewBtn = document.getElementById('show-new-wonders');
    const showOldBtn = document.getElementById('show-old-wonders');

    if (flipper && showNewBtn && showOldBtn) {
        showNewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.add('flipped');
        });

        showOldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.remove('flipped');
        });

        // Check for URL parameter to auto-flip
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('menu') === 'new') {
            flipper.classList.add('flipped');
        }
    }
});
