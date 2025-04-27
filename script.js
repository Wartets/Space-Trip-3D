const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === Constantes de configuration ===
const ASTEROID_SPAWN_DISTANCE = 800;			// Demi-largeur de la zone d'apparition
const ASTEROID_REMOVE_DISTANCE = 900;			// Distance au-delà de laquelle l'astéroïde est supprimé
const ASTEROID_RESPAWN_DISTANCE = 300;			// Distance de la zone de réapparition
const ASTEROID_FOG_DISTANCE = 400;				// Distance au-delà de laquelle les astéroïdes sont assombris
const ASTEROID_MIN_SIZE = 10;					// Taille minimale des astéroïdes
const ASTEROID_MAX_SIZE = 60;					// Taille maximale des astéroïdes
const ASTEROID_COUNT = 800;						// Nombre d'astéroïdes en même temps
const ASTEROID_VELOCITY_MIN = 0.05;				// Vitesse minimale des astéroïdes
const ASTEROID_VELOCITY_MAX = 0.5;				// Vitesse maximale des astéroïdes
const ASTEROID_COLOR_VARIATION = 0xffffff;		// Plage de couleurs des astéroïdes
const SHIP_SPEED = .5;							// Vitesse du vaisseau
const SHIP_ROTATION_SENSITIVITY = 0.002;		// Sensibilité de la rotation du vaisseau
const CAMERA_OFFSET_Z = 5;						// Distance de la caméra par rapport au vaisseau
const CAMERA_LOOK_AT_OFFSET = 0.5;				// Distance de décalage pour l'orientation de la caméra
const SHIP_SIZE = new THREE.Vector3(.7, .7, .01);	// Dimensions du vaisseau
const starCount = 10000;						// Nombre d'étoiles
const STAR_FIELD_SIZE = 2000;					// Taille du cube dans lequel les étoiles sont générées
const STAR_REMOVE_DISTANCE = 1000;				// Distance au-delà de laquelle une étoile est supprimée

// === Création du vaisseau (cube) ===
const shipGeometry = new THREE.BoxGeometry(SHIP_SIZE.x, SHIP_SIZE.y, SHIP_SIZE.z);
const shipMaterial = new THREE.MeshStandardMaterial({ color: 0x14b814, roughness: 0.5, metalness: 0.1 });
const ship = new THREE.Mesh(shipGeometry, shipMaterial);
scene.add(ship);
ship.castShadow = true;
ship.receiveShadow = true;

// === Initialisation de la caméra ===
camera.position.z = 0;
camera.position.y = 0;

const asteroids = [];
	
// === Fonction pour créer un astéroïde ===
function createAsteroid() {
	let geo;
	const size = Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE) + ASTEROID_MIN_SIZE;
	const minDistance = ASTEROID_RESPAWN_DISTANCE;

	const type = Math.floor(Math.random() * 3);

	if (type === 0) geo = new THREE.IcosahedronGeometry(size, 0);
	else if (type === 1) geo = new THREE.BoxGeometry(size, size, size);
	else geo = new THREE.SphereGeometry(size, 6, 6);

	const mat = new THREE.MeshBasicMaterial({
		color: Math.random() * ASTEROID_COLOR_VARIATION,
		wireframe: Math.random() < 0.5,
		transparent: Math.random() < 0.5,
		opacity: Math.random() * 0.5 + 0.5,
		/* emissive: new THREE.Color(Math.random(), Math.random(), Math.random()),
		emissiveIntensity: Math.random() * 0.5 + 0.5,
		roughness: 0.8,
		metalness: 0.2 */
	});

	const asteroid = new THREE.Mesh(geo, mat);
	asteroid.castShadow = true;
	asteroid.receiveShadow = true;

	let x, y, z;
	let distanceToShip;
	do {
		x = ship.position.x + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		y = ship.position.y + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		z = ship.position.z + (Math.random() - 0.5) * ASTEROID_SPAWN_DISTANCE * 2;
		distanceToShip = Math.sqrt(Math.pow(x - ship.position.x, 2) + Math.pow(y - ship.position.y, 2) + Math.pow(z - ship.position.z, 2));
	} while (distanceToShip < minDistance);

	asteroid.position.set(x, y, z);

	asteroid.userData.velocity = new THREE.Vector3(
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN,
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN,
		(Math.random() - 0.5) * (ASTEROID_VELOCITY_MAX - ASTEROID_VELOCITY_MIN) + ASTEROID_VELOCITY_MIN
	);

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
let isPointerLocked = false;
document.body.addEventListener('click', () => {
	document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
	isPointerLocked = document.pointerLockElement === document.body;
});

document.addEventListener('mousemove', (e) => {
	if (isPointerLocked) {
		yaw -= e.movementX * SHIP_ROTATION_SENSITIVITY;
		pitch -= e.movementY * SHIP_ROTATION_SENSITIVITY;
		pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
	}
});

function moveShip() {
	ship.rotation.order = "YXZ";
	ship.rotation.y = yaw;
	ship.rotation.x = pitch;

	const direction = new THREE.Vector3();

	if (keys['z']) direction.z -= 1;
	if (keys['s']) direction.z += 1;
	if (keys['q']) direction.x -= 1;
	if (keys['d']) direction.x += 1;
	if (keys[' ']) direction.y += 1;
	if (keys['shift']) direction.y -= 1;

	direction.normalize();
	direction.applyEuler(ship.rotation);

	ship.position.add(direction.multiplyScalar(SHIP_SPEED));
}

// === Déplacement des astéroïdes ===
function moveAsteroids() {
	for (let asteroid of asteroids) {
		asteroid.position.add(asteroid.userData.velocity);
	}
}

// === Détection de collisions ===
function detectCollisions() {
	const shipBox = new THREE.Box3().setFromObject(ship);

	for (let asteroid of asteroids) {
		const asteroidBox = new THREE.Box3().setFromObject(asteroid);
		if (shipBox.intersectsBox(asteroidBox)) {
			alert('Crash!');
			window.location.reload();
		}
	}
}

// === Gestion des astéroïdes ===
function manageAsteroids() {
	for (let i = asteroids.length - 1; i >= 0; i--) {
		const asteroid = asteroids[i];
		const distance = ship.position.distanceTo(asteroid.position);
		if (distance > ASTEROID_REMOVE_DISTANCE) {
			scene.remove(asteroid);
			asteroids.splice(i, 1);
		}
	}
	while (asteroids.length < ASTEROID_COUNT) {
		createAsteroid();
	}
}

// === Etoile de fond animée ===
const starGeometry = new THREE.BufferGeometry();
const starsArray = []; // Stockage des étoiles individuelles

function createStar() {
	const star = new THREE.Vector3(
		ship.position.x + (Math.random() - 0.5) * STAR_FIELD_SIZE,
		ship.position.y + (Math.random() - 0.5) * STAR_FIELD_SIZE,
		ship.position.z + (Math.random() - 0.5) * STAR_FIELD_SIZE
	);
	starsArray.push(star);
}

// Création initiale des étoiles
for (let i = 0; i < starCount; i++) {
	createStar();
}

const starPositions = new Float32Array(starsArray.length * 3);
for (let i = 0; i < starsArray.length; i++) {
	starPositions[i * 3] = starsArray[i].x;
	starPositions[i * 3 + 1] = starsArray[i].y;
	starPositions[i * 3 + 2] = starsArray[i].z;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0x888888, size: 0.8, sizeAttenuation: true });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

function moveStars() {
	for (let i = 0; i < starsArray.length; i++) {
		starsArray[i].x += (Math.random() - 0.5) * 0.05;
		starsArray[i].y += (Math.random() - 0.5) * 0.05;
		starsArray[i].z += (Math.random() - 0.5) * 0.05;
	}

	for (let i = starsArray.length - 1; i >= 0; i--) {
		if (starsArray[i].distanceTo(ship.position) > STAR_REMOVE_DISTANCE) {
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
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040); 
scene.add(ambientLight);

// === Mise à jour de la caméra ===
function updateCamera() {
	const offset = new THREE.Vector3(0, 0, CAMERA_OFFSET_Z);
	offset.applyEuler(ship.rotation);
	camera.position.copy(ship.position.clone().add(offset));
	camera.lookAt(ship.position.clone().add(new THREE.Vector3(0, 0, CAMERA_LOOK_AT_OFFSET)));
}

// === Boucle d'animation ===
function animate() {
	moveStars();
	requestAnimationFrame(animate);
	moveShip();
	moveAsteroids();
	// detectCollisions(); // désactivé pour l'instant pour des raisons de debug (ignorer)
	manageAsteroids();
	updateCamera();
	renderer.render(scene, camera);
}

animate();

// === Adaptation de la taille du rendu lors du redimensionnement de la fenêtre ===
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
	