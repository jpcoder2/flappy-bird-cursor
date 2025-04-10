import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor(0x87CEEB); // Sky blue background
document.body.appendChild( renderer.domElement );

// Lighting
const ambientLight = new THREE.AmbientLight( 0xffffff, 0.6 );
scene.add( ambientLight );
const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.8 );
directionalLight.position.set( 5, 10, 7.5 );
scene.add( directionalLight );

// Game elements (placeholders for now)
const birdGeometry = new THREE.SphereGeometry( 0.2, 16, 8 );
const birdMaterial = new THREE.MeshStandardMaterial( { color: 0xffff00 } ); // Yellow bird
const bird = new THREE.Mesh( birdGeometry, birdMaterial );
scene.add( bird );

// Game state and physics
let birdVelocity = 0;
const gravity = -0.005;
const flapStrength = 0.08;
let gameStarted = false;
let gameOver = false;
let score = 0;
let level = 1; // Track game level
let baseSpeed = 0.05; // Base speed for pipes
let currentPipeGap = 2.5; // Current gap size that will decrease with levels

// UI Elements
const instructionsElement = document.getElementById('instructions');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');

// Create level indicator
const levelElement = document.createElement('div');
levelElement.id = 'level';
levelElement.style.position = 'absolute';
levelElement.style.top = '40px';
levelElement.style.left = '10px';
levelElement.style.fontSize = '24px';
levelElement.style.color = 'white';
levelElement.innerText = 'Level: 1';
document.body.appendChild(levelElement);

// Pipe Constants
const pipeWidth = 0.5;
const pipeHeight = 5;
const minPipeGap = 1.5; // Minimum gap size
const pipeSpawnDistance = 10;
const pipeSpacing = 4;

// Pipe Geometry and Material (reusable)
const pipeGeometry = new THREE.BoxGeometry( pipeWidth, pipeHeight, pipeWidth );
const pipeMaterial = new THREE.MeshStandardMaterial( { color: 0x00ff00 } ); // Green pipes

// Pipe Management
const pipes = [];
// let nextPipeX = 5; // Position where the next pipe pair should spawn - Replaced logic

camera.position.z = 5;

// --- Functions ---

function createPipePair(xPosition) {
    const totalHeight = 8;
    const gapCenterY = THREE.MathUtils.randFloat(-1.5, 1.5);

    // Top Pipe
    const topPipe = new THREE.Mesh( pipeGeometry, pipeMaterial );
    const topPipeHeight = (totalHeight / 2) + gapCenterY - (currentPipeGap / 2);
    topPipe.scale.y = topPipeHeight / pipeHeight;
    topPipe.position.set(xPosition, (totalHeight / 2) - (topPipeHeight / 2) , 0);
    scene.add(topPipe);

    // Bottom Pipe
    const bottomPipe = new THREE.Mesh( pipeGeometry, pipeMaterial );
    const bottomPipeHeight = totalHeight - topPipeHeight - currentPipeGap;
    bottomPipe.scale.y = bottomPipeHeight / pipeHeight;
    bottomPipe.position.set(xPosition, -(totalHeight / 2) + (bottomPipeHeight / 2) , 0);
    scene.add(bottomPipe);

    const pipePair = { top: topPipe, bottom: bottomPipe, scored: false };
    pipes.push(pipePair);
    return pipePair;
}

function updateDifficulty() {
    // Update level every 10 pipes
    const newLevel = Math.floor(score / 10) + 1;
    if (newLevel !== level) {
        level = newLevel;
        levelElement.innerText = `Level: ${level}`;
        
        // Increase speed every level (every 10 pipes)
        baseSpeed = 0.05 + (level - 1) * 0.01;
        
        // Decrease gap every 2 levels (every 20 pipes), but don't go below minimum
        if (level % 2 === 0) {
            currentPipeGap = Math.max(minPipeGap, 2.5 - (Math.floor(level / 2) * 0.1));
        }
    }
}

function resetPipes() {
    pipes.forEach(pair => {
        scene.remove(pair.top);
        scene.remove(pair.bottom);
        // Don't dispose geometry/material here as they are reused globally
    });
    pipes.length = 0; // Clear the array
    // Spawn initial pipes off-screen to the right
    for (let i = 0; i < 3; i++) {
       createPipePair(pipeSpawnDistance / 2 + i * pipeSpacing);
    }
}

function checkCollision(pipePair) {
    const birdBox = new THREE.Box3().setFromObject(bird);
    const topPipeBox = new THREE.Box3().setFromObject(pipePair.top);
    const bottomPipeBox = new THREE.Box3().setFromObject(pipePair.bottom);

    // Inflate bird box slightly for better feel (optional)
    // birdBox.expandByScalar(-0.05);

    return birdBox.intersectsBox(topPipeBox) || birdBox.intersectsBox(bottomPipeBox);
}

function restartGame() {
    bird.position.set(0, 0, 0);
    birdVelocity = 0;
    score = 0;
    level = 1;
    baseSpeed = 0.05;
    currentPipeGap = 2.5;
    scoreElement.innerText = `Score: ${score}`;
    levelElement.innerText = `Level: ${level}`;
    gameOver = false;
    gameStarted = false;
    gameOverElement.style.display = 'none';
    instructionsElement.style.display = 'block';
    resetPipes();
}

// Animation loop
function animate() {
	requestAnimationFrame( animate );

    // Render even if game over to show the final state
	renderer.render( scene, camera );

    if (!gameStarted) {
        // Don't run game logic if not started
        return;
    }
    if (gameOver) {
        // If game is over, stop processing game logic
        return;
    }


    // --- Bird Physics ---
    birdVelocity += gravity;
    bird.position.y += birdVelocity;

    // Boundary Checks (Top and Bottom) - Using a generous range for now
    const worldBoundaryY = 4; // Half of the visual height approx
    if (bird.position.y > worldBoundaryY || bird.position.y < -worldBoundaryY) {
        gameOver = true;
    }

    // --- Pipe Logic ---
    let passedPipe = false; // Use this to trigger spawning later?
    let lastPipeX = -Infinity; // Keep track of the rightmost pipe

    for (let i = pipes.length - 1; i >= 0; i--) {
        const pair = pipes[i];
        pair.top.position.x -= baseSpeed;
        pair.bottom.position.x -= baseSpeed;

        lastPipeX = Math.max(lastPipeX, pair.top.position.x);

        // Check for collision
        if (checkCollision(pair)) {
            gameOver = true;
        }

        // Check for scoring
        if (!pair.scored && pair.top.position.x < bird.position.x - pipeWidth / 2) {
            score++;
            scoreElement.innerText = `Score: ${score}`;
            pair.scored = true;
            updateDifficulty(); // Update difficulty when score changes
        }

        // Remove pipes that are off-screen to the left
        if (pair.top.position.x < -pipeSpawnDistance / 2 - pipeWidth) { // Ensure fully off screen
            scene.remove(pair.top);
            scene.remove(pair.bottom);
            pipes.splice(i, 1);
             // console.log("Removed pipe, count:", pipes.length);
        }
    }

    // Spawn new pipes when the rightmost pipe has moved enough to the left
    if (pipes.length === 0 || (pipes.length < 5 && lastPipeX < pipeSpawnDistance / 2 - pipeSpacing)) { // Keep ~3-4 pipes on screen
         createPipePair(lastPipeX + pipeSpacing);
         // console.log("Spawned pipe at:", lastPipeX + pipeSpacing, "count:", pipes.length);
    }


    // --- Handle Game Over ---
    if (gameOver) {
        gameOverElement.style.display = 'block';
        // Stop bird physics only visually if needed, state handles logic stop
        // birdVelocity = 0; // Optional: stop the bird visually
    }

}

// --- Initial Setup ---
resetPipes(); // Create initial set of pipes
animate();

// Handle player input
document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        if (gameOver) return; // Don't flap if game over

        if (!gameStarted) {
            gameStarted = true;
            instructionsElement.style.display = 'none';
        }
        birdVelocity = flapStrength; // Apply flap impulse
    } else if (event.code === 'KeyR') { // Use 'KeyR' for 'R' key
        // Allow restart anytime the game is over
        if (gameOver) {
            restartGame();
        }
    }
});

// Handle window resize
window.addEventListener( 'resize', onWindowResize, false );

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
} 