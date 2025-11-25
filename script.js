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
    }
};

// Handle game selection
document.addEventListener('DOMContentLoaded', () => {
    const gameLinks = document.querySelectorAll('.game-link');

    gameLinks.forEach(link => {
        const gameId = link.getAttribute('href').substring(1);
        const game = games[gameId];

        // Add coming-soon class to unavailable games
        if (game && game.status === 'coming-soon') {
            link.classList.add('coming-soon');
        }

        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleGameSelection(gameId);
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
