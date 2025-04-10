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
let gameOver = false; // Added game over state
let score = 0; // Added score

// UI Elements
const instructionsElement = document.getElementById('instructions');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');

// Pipe Constants
const pipeWidth = 0.5;
const pipeHeight = 5; // Base height, will be adjusted per pipe
const pipeGap = 2.5; // Increased from 1.5 to 2.5 for a larger gap between pipes
const pipeSpeed = 0.05;
const pipeSpawnDistance = 10; // How far off-screen pipes spawn
const pipeSpacing = 4; // Horizontal distance between pipe pairs

// Pipe Geometry and Material (reusable)
const pipeGeometry = new THREE.BoxGeometry( pipeWidth, pipeHeight, pipeWidth );
const pipeMaterial = new THREE.MeshStandardMaterial( { color: 0x00ff00 } ); // Green pipes

// Pipe Management
const pipes = [];
// let nextPipeX = 5; // Position where the next pipe pair should spawn - Replaced logic

camera.position.z = 5;

// --- Functions ---

function createPipePair(xPosition) {
    const totalHeight = 8; // Approximate vertical world space view height
    const gapCenterY = THREE.MathUtils.randFloat(-1.5, 1.5); // Randomize vertical position of the gap

    // Top Pipe
    const topPipe = new THREE.Mesh( pipeGeometry, pipeMaterial );
    // Calculate height needed based on gap position and total height
    const topPipeHeight = (totalHeight / 2) + gapCenterY - (pipeGap / 2);
    topPipe.scale.y = topPipeHeight / pipeHeight; // Scale based on calculated height (using original pipeHeight)
    topPipe.position.set(xPosition, (totalHeight / 2) - (topPipeHeight / 2) , 0); // Position from top edge
    scene.add(topPipe);

    // Bottom Pipe
    const bottomPipe = new THREE.Mesh( pipeGeometry, pipeMaterial );
    const bottomPipeHeight = totalHeight - topPipeHeight - pipeGap;
    bottomPipe.scale.y = bottomPipeHeight / pipeHeight; // Scale based on calculated height
    bottomPipe.position.set(xPosition, -(totalHeight / 2) + (bottomPipeHeight / 2) , 0); // Position from bottom edge
    scene.add(bottomPipe);


    const pipePair = { top: topPipe, bottom: bottomPipe, scored: false };
    pipes.push(pipePair);
    return pipePair;
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
    bird.position.set(0, 0, 0); // Reset bird position
    birdVelocity = 0;
    score = 0;
    scoreElement.innerText = `Score: ${score}`;
    gameOver = false;
    gameStarted = false;
    gameOverElement.style.display = 'none';
    instructionsElement.style.display = 'block';
    resetPipes(); // Reset pipes to initial state
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
        pair.top.position.x -= pipeSpeed;
        pair.bottom.position.x -= pipeSpeed;

        lastPipeX = Math.max(lastPipeX, pair.top.position.x); // Update rightmost position

        // Check for collision
        if (checkCollision(pair)) {
            gameOver = true;
        }

        // Check for scoring
        if (!pair.scored && pair.top.position.x < bird.position.x - pipeWidth / 2) { // Check when bird fully passes pipe's front edge
            score++;
            scoreElement.innerText = `Score: ${score}`;
            pair.scored = true;
            // passedPipe = true; // Not strictly needed for spawning logic below
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