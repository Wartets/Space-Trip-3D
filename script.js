const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x100000, 0.0015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === Constantes de configuration === (les constantes inutilisées sont commentées)
const ASTEROID_SPAWN_DISTANCE = 800;			// Demi-largeur de la zone d'apparition
const ASTEROID_REMOVE_DISTANCE = 900;			// Distance au-delà de laquelle l'astéroïde est supprimé
const ASTEROID_RESPAWN_DISTANCE = 300;			// Distance de la zone de réapparition
// const ASTEROID_FOG_DISTANCE = 400;			// Distance au-delà de laquelle les astéroïdes sont assombris
// const ASTEROID_COLLISION_DISTANCE = 350;		// Distance minimale pour le calcul de collisions d'astéroïdes
const ASTEROID_MIN_SIZE = 10;					// Taille minimale des astéroïdes
const ASTEROID_MAX_SIZE = 60;					// Taille maximale des astéroïdes
const ASTEROID_COUNT = 1100;					// Nombre d'astéroïdes en même temps
const ASTEROID_VELOCITY_MIN = 0.1;				// Vitesse minimale des astéroïdes
const ASTEROID_VELOCITY_MAX = 5;				// Vitesse maximale des astéroïdes
const ASTEROID_COLOR_VARIATION = 0x404040;		// Plage de couleurs des astéroïdes
const SHIP_SPEED = 5;							// Vitesse du vaisseau
const SHIP_HITBOX_SCALE = 0.7; 					// 1 = plein volume, 0.1 = boîte plus petite
const SHIP_ROTATION_SENSITIVITY = 0.002;		// Sensibilité de la rotation du vaisseau
const CAMERA_OFFSET_Z = 5;						// Distance de la caméra par rapport au vaisseau
const CAMERA_LOOK_AT_OFFSET = 0.8;				// Distance de décalage pour l'orientation de la caméra
const SHIP_TILT_MAX = 0.26;						// inclinaison maximale (en radians)
const SHIP_TILT_SPEED = 0.15;					// vitesse de transition vers l’inclinaison cible
const ACCELERATION = 0.4;						// Force d'accélération
const FRICTION = 0.9;							// Taux de "freinage" par frame (0.95 = ralentit doucement)
const starCount = 4000;							// Nombre d'étoiles
const STAR_FIELD_SIZE = 2000;					// Taille du cube dans lequel les étoiles sont générées
const STAR_REMOVE_DISTANCE = 1000;				// Distance au-delà de laquelle une étoile est supprimée
const MISSILE_REMOVE_DISTANCE = 800;			// Distance au-delà de laquelle le missile est supprimé
const MISSILE_SPEED = 13;						// Vitesse du missile
const MISSILE_RADIUS = 0.5;						// Rayon des missiles
let missileCooldown = 250; 						// Temps entre les tirs en ms
let MISSILE_NUMBER = 20;						// Nombre de missile avant rechargement
let reloadTime = missileCooldown * 5; 			// Temps de rechargement après MISSILE_NUMBER tirs en ms
let lives = 5;									// Nombre de vies
const invulnerabilityDuration = 2000;			// Temps d'invincibilité après un choc en ms

// === Gestion des points & Temps de jeu ===
let score = 0;
let movementTimer = 0;
let gameTime = 0; // en secondes
let lastTimeUpdate = performance.now();

const scoreElement = document.createElement('div');
scoreElement.style.position = 'absolute';
scoreElement.style.top = '10px';
scoreElement.style.left = '10px';
scoreElement.style.color = 'green';
scoreElement.style.fontSize = '20px';
scoreElement.style.userSelect = 'none';
scoreElement.innerText = `Score: ${score}`;
document.body.appendChild(scoreElement);

const timeElement = document.createElement('div');
timeElement.style.position = 'absolute';
timeElement.style.top = '35px';
timeElement.style.left = '10px';
timeElement.style.color = 'green';
timeElement.style.fontSize = '20px';
timeElement.style.userSelect = 'none';
timeElement.innerText = `0s`;
document.body.appendChild(timeElement);

function updateScore(points) {
    score += points;
    scoreElement.innerText = `Score: ${score}`;
}

// === Création du vaisseau ===
const shipVelocity = new THREE.Vector3();

const shipGroup = new THREE.Group();

const shipParts = [
	new THREE.BoxGeometry(0.2, 0.6, 0.2),   // Corps vertical (fuselage)
	new THREE.BoxGeometry(0.2, 0.2, 1),     // Corps horizontal (nez allongé)
	new THREE.BoxGeometry(1.2, 0.05, 0.4),  // Ailes principales
	new THREE.BoxGeometry(0.4, 0.05, 0.2),  // Ailes arrière
	new THREE.BoxGeometry(0.05, 0.3, 0.1),  // Stabilisateur vertical (queue)
];

const shipMaterialPart = new THREE.MeshStandardMaterial({
	color: 0xe81730,
	roughness: 0.5,
	metalness: 0.3,
});

const parts = shipParts.map(geometry => {
	const mesh = new THREE.Mesh(geometry, shipMaterialPart);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
});

parts[0].position.set(0, 0, 0);              // Fuselage central
parts[1].position.set(0, 0.2, 0.6);          // Nez allongé à l'avant
parts[2].position.set(0, 0, 0);              // Ailes principales (symétriques)
parts[3].position.set(0, 0, -0.4);           // Ailes arrière plus petites
parts[4].position.set(0, 0.25, -0.5);        // Queue verticale (stabilisateur)

parts.forEach(part => shipGroup.add(part));

scene.add(shipGroup);

let lastShipPosition = new THREE.Vector3();
lastShipPosition.copy(shipGroup.position);

// === Lumière du vaisseau ===
const shipLight = new THREE.PointLight(0xf38b97, 100, 1000);
shipLight.castShadow = true; 
shipLight.receiveShadow = true;
shipGroup.add(shipLight); 

// === Initialisation de la caméra ===
camera.position.z = 0;
camera.position.y = 0;

const asteroids = [];
	
// === Créer les astéroïdes ===
function isPositionFree(x, y, z, size) {
	for (let asteroid of asteroids) {
		const dx = asteroid.position.x - x;
		const dy = asteroid.position.y - y;
		const dz = asteroid.position.z - z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		const minDistance = (asteroid.geometry.boundingSphere?.radius || ASTEROID_MIN_SIZE) + size;

		if (distance < minDistance * 1.2) {
			return false;
		}
	}
	return true;
}

function createAsteroid() {
	let geo;
	const size = Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE) + ASTEROID_MIN_SIZE;
	const minDistance = ASTEROID_RESPAWN_DISTANCE;

	const type = Math.floor(Math.random() * 3);

	if (type === 0) geo = new THREE.IcosahedronGeometry(size, 0);
	else if (type === 1) geo = new THREE.BoxGeometry(size, size, size);
	else geo = new THREE.SphereGeometry(size, 6, 6);

	const mat = new THREE.MeshStandardMaterial({
		color: (Math.random() * 1.5 - 1) * ASTEROID_COLOR_VARIATION,
		wireframe: Math.random() < 0.05,
		transparent: Math.random() > 0.5,
		opacity: Math.random() > 0.5,
		roughness: Math.random() > 0.2,
		metalness: Math.random() > 0.5
	});

	const asteroid = new THREE.Mesh(geo, mat);
	asteroid.receiveShadow = true;
	asteroid.castShadow = false;

	let x, y, z;
	let distanceToShip;
	let tries = 0;
	do {
		x = shipGroup.position.x + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		y = shipGroup.position.y + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		z = shipGroup.position.z + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		distanceToShip = Math.sqrt(Math.pow(x - shipGroup.position.x, 2) + Math.pow(y - shipGroup.position.y, 2) + Math.pow(z - shipGroup.position.z, 2));
		tries++;
		// On évite de bloquer si la place est trop encombrée
		if (tries > 50) break; 
	} while (distanceToShip < minDistance || !isPositionFree(x, y, z, size));

	asteroid.position.set(x, y, z);
	

	asteroid.userData.velocity = new THREE.Vector3(
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN,
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN,
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN
	);
	
	asteroid.userData.radius = size;
	scene.add(asteroid);
	asteroids.push(asteroid);
}

// Création initiale d'astéroïdes
for (let i = 0; i < ASTEROID_COUNT; i++) createAsteroid();

// === Gestion des entrées clavier ===
const keys = {};
window.addEventListener('keydown', (e) => {
	keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
	keys[e.key.toLowerCase()] = false;
});

// === Mouvement du vaisseau ===
let pitch = 0;
let yaw = 0;
let mouseYaw = 0;
let mousePitch = 0;
let targetRoll = 0;
let targetPitch = 0;
let visualPitch = 0;
let visualRoll = 0;

let isPointerLocked = false;
document.body.addEventListener('click', () => {
	document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
	isPointerLocked = document.pointerLockElement === document.body;
	const overlay = document.getElementById('overlay');
	if (isPointerLocked) {
		overlay.classList.add('hidden');
	} else {
		overlay.classList.remove('hidden');
	}
});

document.addEventListener('mousemove', (e) => {
	if (isPointerLocked) {
		const movementX = e.movementX;
		const movementY = e.movementY;

		yaw -= movementX * SHIP_ROTATION_SENSITIVITY;
		pitch -= movementY * SHIP_ROTATION_SENSITIVITY;
		mouseYaw -= movementX * SHIP_ROTATION_SENSITIVITY;
		mousePitch -= movementY * SHIP_ROTATION_SENSITIVITY;

		visualPitch = movementY * SHIP_ROTATION_SENSITIVITY;
		visualRoll = -movementX * SHIP_ROTATION_SENSITIVITY;

		visualPitch = THREE.MathUtils.clamp(visualPitch, -SHIP_TILT_MAX, SHIP_TILT_MAX);
		visualRoll = THREE.MathUtils.clamp(visualRoll, -SHIP_TILT_MAX, SHIP_TILT_MAX);

		// pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
	}
});

function moveShip() {
	shipGroup.rotation.order = "YXZ";

	shipGroup.rotation.y += (yaw - shipGroup.rotation.y) * 0.1;
	shipGroup.rotation.x += (pitch - shipGroup.rotation.x) * 0.1;

	// Mouvements clavier
	const inputDirection = new THREE.Vector3();
	if (keys['z']) inputDirection.z -= 1;
	if (keys['s']) inputDirection.z += 1;
	if (keys['q']) inputDirection.x -= 1;
	if (keys['d']) inputDirection.x += 1;
	if (keys[' ']) inputDirection.y += 1;
	if (keys['shift']) inputDirection.y -= 1;

	inputDirection.normalize();
	inputDirection.applyEuler(shipGroup.rotation);

	shipVelocity.add(inputDirection.multiplyScalar(ACCELERATION));
	shipVelocity.multiplyScalar(FRICTION);
	shipGroup.position.add(shipVelocity.clone().multiplyScalar(SHIP_SPEED));

	if (keys['q']) targetRoll = SHIP_TILT_MAX;
	else if (keys['d']) targetRoll = -SHIP_TILT_MAX;
	else targetRoll = 0;

	if (keys['z']) targetPitch = SHIP_TILT_MAX * 0.25;
	else if (keys['s']) targetPitch = -SHIP_TILT_MAX * 0.25;
	else targetPitch = 0;

	const finalRoll = targetRoll + visualRoll;
	const finalPitch = targetPitch + visualPitch;

	shipGroup.rotation.z += (finalRoll - shipGroup.rotation.z) * SHIP_TILT_SPEED;
	shipGroup.rotation.x += (finalPitch - shipGroup.rotation.x) * SHIP_TILT_SPEED;

	visualRoll *= FRICTION;
	visualPitch *= FRICTION;
}

// === Déplacement des astéroïdes ===
function moveAsteroids() {
	for (let asteroid of asteroids) {
		asteroid.position.add(asteroid.userData.velocity);
	}
}

// === Gestion des vies ===
let isInvulnerable = false;
let invulnerabilityStartTime = 0;

function loseLife() {
	lives--;
	updateLivesDisplay();
	if (lives <= 0) {
		gameOver();
	} else {
		startInvulnerability();
	}
}

function startInvulnerability(duration = invulnerabilityDuration) {
	isInvulnerable = true;
	shipGroup.traverse((child) => {
		if (child.isMesh) {
			child.material.transparent = true;
			child.material.opacity = 0.5;
		}
	});
	setTimeout(() => {
		isInvulnerable = false;
		shipGroup.traverse((child) => {
			if (child.isMesh) {
				child.material.opacity = 1;
				child.material.transparent = false;
			}
		});
	}, duration);
}

function updateLivesDisplay() {
	const hearts = document.querySelectorAll('#lives .heart');
	const totalHearts = hearts.length;
	for (let i = 0; i < totalHearts; i++) {
		if (i < lives) {
			hearts[totalHearts - 1 - i].style.visibility = 'visible';
		} else {
			hearts[totalHearts - 1 - i].style.visibility = 'hidden';
		}
	}
}

function pulse() {
	if (isInvulnerable) {
		const elapsed = (performance.now() - invulnerabilityStartTime) / 1000;
		const pulse = 0.5 + 0.5 * Math.sin(elapsed * 10);

		shipGroup.traverse((child) => {
			if (child.isMesh) {
				child.material.transparent = true;
				child.material.opacity = pulse;
			}
		});

		const hearts = document.querySelectorAll('#lives .heart');
		hearts.forEach(heart => {
			heart.style.opacity = pulse;
		});
	} else {
		shipGroup.traverse((child) => {
			if (child.isMesh) {
				child.material.opacity = 1;
				child.material.transparent = false;
			}
		});

		const hearts = document.querySelectorAll('#lives .heart');
		hearts.forEach(heart => {
			heart.style.opacity = 1;
		});
	}
}

// === Détection de collisions ===
function detectCollisions() {
	if (isInvulnerable) return;

	const shipParts = shipGroup.children;

	const shipHitboxes = shipParts.map(part => {
		const box = new THREE.Box3().setFromObject(part);
		box.expandByScalar(-(1 - SHIP_HITBOX_SCALE));
		return box;
	});

	for (let asteroid of asteroids) {
		const asteroidBox = new THREE.Box3().setFromObject(asteroid);

		for (let shipBox of shipHitboxes) {
			if (shipBox.intersectsBox(asteroidBox)) {
				loseLife();
				return;
			}
		}
	}
	
	const enemyMissiles = [];
	
	if (Array.isArray(enemyMissiles) && enemyMissiles.length > 0) {
		for (let i = 0; i < enemyMissiles.length; i++) {
			const missile = enemyMissiles[i];
			const missileBox = new THREE.Box3().setFromObject(missile);
			if (shipBox.intersectsBox(missileBox)) {
				loseLife();
				scene.remove(missile);
				enemyMissiles.splice(i, 1);
				break;
			}
		}
	}
}

function detectAsteroidCollisions() {
	for (let i = 0; i < asteroids.length; i++) {
		const asteroidA = asteroids[i];
		for (let j = i + 1; j < asteroids.length; j++) {
			const asteroidB = asteroids[j];

			const dx = asteroidA.position.x - asteroidB.position.x;
			const dy = asteroidA.position.y - asteroidB.position.y;
			const dz = asteroidA.position.z - asteroidB.position.z;

			const distanceSq = dx * dx + dy * dy + dz * dz;
			const radiiSum = asteroidA.userData.radius + asteroidB.userData.radius;

			if (distanceSq < radiiSum * radiiSum) {
				const tempVelocity = asteroidA.userData.velocity.clone();
				asteroidA.userData.velocity.copy(asteroidB.userData.velocity);
				asteroidB.userData.velocity.copy(tempVelocity);

				const distance = Math.sqrt(distanceSq) || 0.0001;
				const overlap = 0.5 * (radiiSum - distance + 0.0001);

				const displacement = new THREE.Vector3(dx / distance * overlap, dy / distance * overlap, dz / distance * overlap);
				asteroidA.position.add(displacement);
				asteroidB.position.sub(displacement);
			}
		}
	}
}

// === Gestion des astéroïdes ===
function manageAsteroids() {
	for (let i = asteroids.length - 1; i >= 0; i--) {
		const asteroid = asteroids[i];
		const distance = shipGroup.position.distanceTo(asteroid.position);
		if (distance > ASTEROID_REMOVE_DISTANCE) {
			scene.remove(asteroid);
			asteroids.splice(i, 1);
		}
	}
	while (asteroids.length < ASTEROID_COUNT) {
		createAsteroid();
	}
}

// === Gestion des missiles ===
const missiles = [];
let isFiring = false;
let lastMissileTime = 0;
let missilesFiredInBurst = 0;

function fireMissile() {
	const missileGeometry = new THREE.SphereGeometry(MISSILE_RADIUS, 8, 8);
	const missileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
	const missile = new THREE.Mesh(missileGeometry, missileMaterial);

	const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion).normalize();

	const missileStartOffset = 2;
	const startPosition = shipGroup.position.clone().add(forwardDirection.clone().multiplyScalar(missileStartOffset));

	missile.position.copy(startPosition);
	missile.quaternion.copy(shipGroup.quaternion);

	const shipVelocityAtFireTime = shipVelocity.clone();

	const initialMissileVelocity = forwardDirection.multiplyScalar(MISSILE_SPEED).add(shipVelocityAtFireTime);

	missile.userData = {
		velocity: initialMissileVelocity
	};

	scene.add(missile);
	missiles.push(missile);
}

function moveMissiles() {
	for (let i = missiles.length - 1; i >= 0; i--) {
		const missile = missiles[i];
		missile.position.add(missile.userData.velocity.clone());

		if (missile.position.distanceTo(shipGroup.position) > MISSILE_REMOVE_DISTANCE) {
			scene.remove(missile);
			missiles.splice(i, 1);
		}
	}
}

function handleFiring() {
	const now = Date.now();

	if (isFiring) {
		const currentCooldown = (missilesFiredInBurst > 0 && missilesFiredInBurst % MISSILE_NUMBER === 0) ? reloadTime : missileCooldown;

		if (now - lastMissileTime >= currentCooldown) {
			fireMissile();
			lastMissileTime = now;
			missilesFiredInBurst++;

			if (now - lastMissileTime >= currentCooldown) {
				if (missilesFiredInBurst > 0 && missilesFiredInBurst % MISSILE_NUMBER === 0) {
					updateScore(-50);
				}

				fireMissile();
				lastMissileTime = now;
				missilesFiredInBurst++;

				if (missilesFiredInBurst > MISSILE_NUMBER) {
					missilesFiredInBurst = 1;
				}
			}
		}
	}
}

window.addEventListener('mousedown', (e) => {
	if (isPointerLocked && e.button === 0) {
		isFiring = true;
	}
});

window.addEventListener('mouseup', (e) => {
	if (e.button === 0) {
		isFiring = false;
	}
});

function detectMissileAsteroidCollisions() {
	for (let i = missiles.length - 1; i >= 0; i--) {
		const missile = missiles[i];

		for (let j = asteroids.length - 1; j >= 0; j--) {
			const asteroid = asteroids[j];

			const distance = missile.position.distanceTo(asteroid.position);
			const collisionDistance = (asteroid.userData.radius || ASTEROID_MIN_SIZE) + MISSILE_RADIUS;

			if (distance < collisionDistance) {
				scene.remove(missile);
				missiles.splice(i, 1);

				scene.remove(asteroid);
				asteroids.splice(j, 1);
				
				let pointsEarned = Math.floor(100 / asteroid.userData.radius);
				updateScore(pointsEarned);

				if (asteroid.userData.radius > ASTEROID_MIN_SIZE / 16) {
					const newRadius = asteroid.userData.radius * 0.5;

					for (let k = 0; k < 2; k++) {
						const newGeo = new THREE.SphereGeometry(newRadius, 6, 6);
						const newMat = new THREE.MeshStandardMaterial({
							color: (Math.random() < 0.5) * ASTEROID_COLOR_VARIATION,
							transparent: Math.random() > 0.5,
							opacity: Math.random() > 0.5,
							roughness: Math.random() > 0.2,
							metalness: Math.random() > 0.5
						});
						const newAsteroid = new THREE.Mesh(newGeo, newMat);
						newAsteroid.castShadow = true;
						newAsteroid.receiveShadow = true;

						newAsteroid.position.copy(asteroid.position);

						const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
						const splitSpeed = asteroid.userData.velocity.length() * 1.4;

						if (k === 0) {
							newAsteroid.userData.velocity = direction.clone().multiplyScalar(splitSpeed);
						} else {
							newAsteroid.userData.velocity = direction.clone().negate().multiplyScalar(splitSpeed);
						}

						newAsteroid.userData.radius = newRadius;
						scene.add(newAsteroid);
						asteroids.push(newAsteroid);
					}
				}

				break;
			}
		}
	}
}

// === Etoile de fond animée ===
const starGeometry = new THREE.BufferGeometry();
const starsArray = [];

function createStar() {
	const star = new THREE.Vector3(
		shipGroup.position.x + (Math.random() - 0.5) * STAR_FIELD_SIZE,
		shipGroup.position.y + (Math.random() - 0.5) * STAR_FIELD_SIZE,
		shipGroup.position.z + (Math.random() - 0.5) * STAR_FIELD_SIZE
	);
	starsArray.push(star);
}

// Création initiale des étoiles
for (let i = 0; i < starCount; i++) createStar();

const starPositions = new Float32Array(starsArray.length * 3);
for (let i = 0; i < starsArray.length; i++) {
	starPositions[i * 3] = starsArray[i].x;
	starPositions[i * 3 + 1] = starsArray[i].y;
	starPositions[i * 3 + 2] = starsArray[i].z;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ 
	color: 0x888888, 
	size: 0.8, 
	sizeAttenuation: true,
	transparent: true,
	opacity: 0.8
});
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

function moveStars() {
	for (let i = 0; i < starsArray.length; i++) {
		starsArray[i].x += (Math.random() - 0.5) * 0.05;
		starsArray[i].y += (Math.random() - 0.5) * 0.05;
		starsArray[i].z += (Math.random() - 0.5) * 0.05;
	}

	for (let i = starsArray.length - 1; i >= 0; i--) {
		if (starsArray[i].distanceTo(shipGroup.position) > STAR_REMOVE_DISTANCE) {
			starsArray.splice(i, 1);
		}
	}

	while (starsArray.length < starCount) {
		createStar();
	}

	const newPositions = new Float32Array(starsArray.length * 3);
	for (let i = 0; i < starsArray.length; i++) {
		newPositions[i * 3] = starsArray[i].x;
		newPositions[i * 3 + 1] = starsArray[i].y;
		newPositions[i * 3 + 2] = starsArray[i].z;
	}

	starGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
	starGeometry.attributes.position.needsUpdate = true;
}

// === Lumières ===
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040); 
scene.add(ambientLight);

// === Soleil fixe dans le ciel ===
const sunGeometry = new THREE.CircleGeometry(144, 64);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

function updateSunPosition() {
	const sunDirection = new THREE.Vector3(5, 10, 7.5).normalize();
	const sunDistance = 2000;
	const sunPosition = shipGroup.position.clone().add(sunDirection.multiplyScalar(sunDistance));
	sun.position.copy(sunPosition);
	sun.lookAt(camera.position);
}

// === Mise à jour de la caméra ===
function updateCamera() {
	const offset = new THREE.Vector3(0, 0, CAMERA_OFFSET_Z);
	offset.applyEuler(shipGroup.rotation);
	camera.position.copy(shipGroup.position.clone().add(offset));
	camera.lookAt(shipGroup.position.clone().add(new THREE.Vector3(0, 0, CAMERA_LOOK_AT_OFFSET)));
}

// === Game Over & Restart ===
let isGameOver = false;

function gameOver() {
	isGameOver = true;
	const gameOverScreen = document.getElementById('gameOverScreen');
	gameOverScreen.classList.remove('hidden');

	// Sortir du mode pointer lock
	if (document.pointerLockElement) {
		document.exitPointerLock();
	}
}

const restartButton = document.getElementById('restartButton');
restartButton.addEventListener('click', () => {
	window.location.reload();
});

// === Boucle d'animation ===
function animate() {
	const loader = document.getElementById('loader');
	if (loader) {
		loader.style.display = 'none';
	}
	moveStars();
	requestAnimationFrame(animate);
	manageAsteroids();
	updateSunPosition();
	if (isPointerLocked && !isGameOver) {
		moveShip();
		moveAsteroids();
		moveMissiles();
		detectMissileAsteroidCollisions();
		handleFiring();
		detectCollisions();
		detectAsteroidCollisions();
		pulse();
		
		const now = performance.now();
		if (isPointerLocked && !isGameOver) {
			const delta = (now - lastTimeUpdate) / 1000; // en secondes
			gameTime += delta;
			timeElement.innerText = `${Math.floor(gameTime)}s`;
		}
		lastTimeUpdate = now;
	}
	updateCamera();
	
	if (!shipGroup.position.equals(lastShipPosition)) {
		movementTimer++;

		if (movementTimer >= 30) {
			updateScore(1);
			movementTimer = 0;
		}
	} else {
		movementTimer = 0;
	}
	lastShipPosition.copy(shipGroup.position);
	
	renderer.render(scene, camera);
}

// === Start ===
startInvulnerability(5000); // 5 secondes
animate();

// === Adaptation de la taille du rendu lors du redimensionnement de la fenêtre ===
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
	