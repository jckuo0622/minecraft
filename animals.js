import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { getPixelCanvas } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

const animalTypes = {
    pig: { name: '豬', body: ['#f7a9b8', '#e892a4'], accent: '#d97b8e', spawnWeight: 0.4 },
    cow: { name: '牛', body: ['#5b4638', '#463527'], accent: '#f4f0e8', spawnWeight: 0.3 },
    sheep: { name: '羊', body: ['#efefef', '#d8d8d8'], accent: '#555555', spawnWeight: 0.3 }
};

function chooseAnimalType(x, z) {
    const roll = (Math.sin(x * 0.17 + z * 0.21) + 1) * 0.5;
    let acc = 0;
    for (const [type, cfg] of Object.entries(animalTypes)) {
        acc += cfg.spawnWeight;
        if (roll <= acc) return type;
    }
    return 'pig';
}

function createAnimal(animalType, x, y, z) {
    const config = animalTypes[animalType] || animalTypes.pig;
    const mob = new THREE.Group();

    const bodyTex = new THREE.CanvasTexture(getPixelCanvas(config.body[0], config.body[1]));
    bodyTex.magFilter = THREE.NearestFilter;
    bodyTex.minFilter = THREE.NearestFilter;
    bodyTex.generateMipmaps = false;
    const bodyMat = new THREE.MeshLambertMaterial({ map: bodyTex });

    const accentMat = new THREE.MeshLambertMaterial({ color: config.accent });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.45), bodyMat);
    body.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), bodyMat);
    head.position.set(0, 0.74, 0.42);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.09), accentMat);
    nose.position.set(0, 0.7, 0.63);

    const legGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16);
    const legs = [
        [-0.28, 0.23, 0.15], [0.28, 0.23, 0.15],
        [-0.28, 0.23, -0.15], [0.28, 0.23, -0.15]
    ].map(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(lx, ly, lz);
        mob.add(leg);
        return leg;
    });

    mob.add(body, head, nose);
    mob.position.set(x, y, z);
    mob.userData = {
        animalType,
        velocityY: 0,
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        turnTimer: 1 + Math.random() * 3,
        walkSpeed: 0.8 + Math.random() * 0.5,
        legPhase: Math.random() * Math.PI * 2,
        stuckTime: 0,
        blockedTurnCooldown: 0,
        legs,
        homeY: y
    };
    return mob;
}

export function createAnimalSystem({ scene, camera, getNearbyBlocks, getSurfaceHeightApprox }) {
    const animals = [];
    const spawnedAnimalCells = new Set();

    function animalCellKey(x, z) {
        return `${Math.floor(x / 12)},${Math.floor(z / 12)}`;
    }

    function spawnAnimalsNearPlayer(maxAnimals = 18) {
        if (animals.length >= maxAnimals) return;
        const px = Math.floor(camera.position.x);
        const pz = Math.floor(camera.position.z);
        for (let i = 0; i < 2 && animals.length < maxAnimals; i++) {
            const rx = px + Math.floor((Math.random() - 0.5) * 44);
            const rz = pz + Math.floor((Math.random() - 0.5) * 44);
            const cell = animalCellKey(rx, rz);
            if (spawnedAnimalCells.has(cell)) continue;
            const y = getSurfaceHeightApprox(rx, rz) + 0.01;
            if (y < -8) continue;
            const type = chooseAnimalType(rx, rz);
            const mob = createAnimal(type, rx + 0.5, y, rz + 0.5);
            scene.add(mob);
            animals.push(mob);
            spawnedAnimalCells.add(cell);
        }
    }

    function updateAnimals(dt) {
        for (let i = animals.length - 1; i >= 0; i--) {
            const mob = animals[i];
            const data = mob.userData;
            data.turnTimer -= dt;
            data.blockedTurnCooldown = Math.max(0, (data.blockedTurnCooldown || 0) - dt);
            if (data.turnTimer <= 0) {
                data.turnTimer = 1 + Math.random() * 3;
                const jitter = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                data.direction.lerp(jitter, 0.65).normalize();
            }

            const stepX = data.direction.x * data.walkSpeed * dt;
            const stepZ = data.direction.z * data.walkSpeed * dt;
            const nextX = mob.position.x + stepX;
            const nextZ = mob.position.z + stepZ;
            const nearby = getNearbyBlocks(mob.position.x, mob.position.z, 3);

            const currentFeetY = mob.position.y + 0.15;
            const currentGround = getGroundAt(mob.position.x, mob.position.z, nearby, 0.25, currentFeetY);
            const nextGround = getGroundAt(nextX, nextZ, nearby, 0.25, currentFeetY);

            const blockedX = checkWall(nextX, mob.position.y + 1.0, mob.position.z, nearby, 0.24);
            const blockedZ = checkWall(mob.position.x, mob.position.y + 1.0, nextZ, nearby, 0.24);
            const dropTooHigh = currentGround !== -999 && nextGround !== -999 && (currentGround - nextGround) > 1.1;
            const voidAhead = currentGround !== -999 && nextGround === -999;
            const steepDropAhead = dropTooHigh || voidAhead;

            let moved = false;
            if (!blockedX && !steepDropAhead) {
                mob.position.x = nextX;
                moved = true;
            }
            if (!blockedZ && !steepDropAhead) {
                mob.position.z = nextZ;
                moved = true;
            }

            if (!moved) {
                data.stuckTime += dt;
                if (data.blockedTurnCooldown <= 0) {
                    const turn = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    data.direction.lerp(turn, 0.55).normalize();
                    data.turnTimer = 0.35 + Math.random() * 0.5;
                    data.blockedTurnCooldown = 0.25;
                }
                if (data.stuckTime > 1.2) {
                    const nudgeX = mob.position.x + data.direction.x * 0.25;
                    const nudgeZ = mob.position.z + data.direction.z * 0.25;
                    const nudgeBlocked = checkWall(nudgeX, mob.position.y + 1.0, nudgeZ, nearby, 0.24);
                    const nudgeGround = getGroundAt(nudgeX, nudgeZ, nearby, 0.25, mob.position.y + 0.15);
                    if (!nudgeBlocked && nudgeGround !== -999) {
                        mob.position.x = nudgeX;
                        mob.position.z = nudgeZ;
                    }
                    data.stuckTime = 0;
                }
            } else {
                data.stuckTime = 0;
            }

            data.velocityY -= 20 * dt;
            const nearbyAfterMove = getNearbyBlocks(mob.position.x, mob.position.z, 3);
            const feetY = mob.position.y + 0.15;
            const ground = getGroundAt(mob.position.x, mob.position.z, nearbyAfterMove, 0.25, feetY);
            if (ground !== -999) {
                const nextY = mob.position.y + data.velocityY * dt;
                mob.position.y = Math.max(nextY, ground);
                if (mob.position.y <= ground + 0.001) data.velocityY = 0;
            } else {
                mob.position.y += data.velocityY * dt;
                const fallbackGround = getSurfaceHeightApprox(Math.round(mob.position.x), Math.round(mob.position.z));
                if (mob.position.y < fallbackGround - 2) {
                    mob.position.y = fallbackGround;
                    data.velocityY = 0;
                }
                if (mob.position.y < -25) {
                    mob.position.x = Math.round(mob.position.x) + 0.5;
                    mob.position.z = Math.round(mob.position.z) + 0.5;
                    mob.position.y = getSurfaceHeightApprox(Math.round(mob.position.x), Math.round(mob.position.z));
                    data.velocityY = 0;
                }
            }

            const targetYaw = Math.atan2(data.direction.x, data.direction.z);
            let yawDelta = targetYaw - mob.rotation.y;
            yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
            mob.rotation.y += yawDelta * Math.min(1, dt * 8);
            data.legPhase += dt * 8;
            data.legs[0].rotation.x = Math.sin(data.legPhase) * 0.35;
            data.legs[1].rotation.x = Math.sin(data.legPhase + Math.PI) * 0.35;
            data.legs[2].rotation.x = Math.sin(data.legPhase + Math.PI) * 0.35;
            data.legs[3].rotation.x = Math.sin(data.legPhase) * 0.35;

            const dx = mob.position.x - camera.position.x;
            const dz = mob.position.z - camera.position.z;
            if (dx * dx + dz * dz > 110 * 110) {
                scene.remove(mob);
                animals.splice(i, 1);
                spawnedAnimalCells.delete(animalCellKey(mob.position.x, mob.position.z));
            }
        }
    }

    return { spawnAnimalsNearPlayer, updateAnimals };
}
