import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { getPixelCanvas } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

const animalTypes = {
    pig: { name: '豬', body: ['#f7a9b8', '#e892a4'], accent: '#d97b8e', spawnWeight: 0.4, health: 5, drop: 'raw_pork' },
    cow: { name: '牛', body: ['#5b4638', '#463527'], accent: '#f4f0e8', spawnWeight: 0.3, health: 7, drop: 'raw_beef' },
    sheep: { name: '羊', body: ['#efefef', '#d8d8d8'], accent: '#555555', spawnWeight: 0.3, health: 5, drop: 'raw_mutton' }
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
    mob.scale.setScalar(1.45);
    mob.userData = {
        animalType,
        health: config.health,
        dropItemId: config.drop,
        hitCooldown: 0,
        hitFlashTime: 0,
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

export function createAnimalSystem({ scene, camera, getNearbyBlocks, getSurfaceHeightApprox, onAnimalDeath }) {
    const animals = [];
    const spawnedAnimalCells = new Set();

    function animalCellKey(x, z) {
        return `${Math.floor(x / 7)},${Math.floor(z / 7)}`;
    }

    function setAnimalDamageTint(mob, active) {
        mob.traverse((part) => {
            if (!part.isMesh) return;
            const materials = Array.isArray(part.material) ? part.material : [part.material];
            for (const material of materials) {
                if (!material?.emissive) continue;
                material.emissive.setHex(active ? 0xff1d1d : 0x000000);
                material.emissiveIntensity = active ? 0.85 : 1;
            }
        });
    }

    function chooseTerrainAwareDirection(mob) {
        const nearby = getNearbyBlocks(mob.position.x, mob.position.z, 3);
        const currentProbeY = mob.position.y + 1.6;
        const currentGround = getGroundAt(mob.position.x, mob.position.z, nearby, 0.36, currentProbeY);
        let bestDirection = mob.userData.direction.clone();
        let bestScore = Infinity;

        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const candidate = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            const probeX = mob.position.x + candidate.x * 0.9;
            const probeZ = mob.position.z + candidate.z * 0.9;
            const probeBlocks = getNearbyBlocks(probeX, probeZ, 3);
            const ground = getGroundAt(probeX, probeZ, probeBlocks, 0.36, currentProbeY);
            if (ground === -999 || currentGround === -999) continue;

            const heightDiff = ground - currentGround;
            const blocked = checkWall(probeX, mob.position.y + 1.2, probeZ, probeBlocks, 0.36);
            if (blocked && heightDiff <= 0.55) continue;
            if (heightDiff > 1.25 || heightDiff < -1.1) continue;

            // Prefer level ground and gentle climbs over continually walking downhill.
            const downhillPenalty = heightDiff < -0.15 ? Math.abs(heightDiff) * 1.8 : 0;
            const steepPenalty = Math.abs(heightDiff) * 0.55;
            const continuityBonus = candidate.dot(mob.userData.direction) * 0.18;
            const score = downhillPenalty + steepPenalty - continuityBonus + Math.random() * 0.2;
            if (score < bestScore) {
                bestScore = score;
                bestDirection = candidate;
            }
        }
        return bestDirection.normalize();
    }

    function trySpawnAt(rx, rz) {
        const cell = animalCellKey(rx, rz);
        if (spawnedAnimalCells.has(cell)) return false;

        const y = getSurfaceHeightApprox(rx, rz) + 0.01;
        if (y < -8) return false;
        const near = getNearbyBlocks(rx + 0.5, rz + 0.5, 2);
        const ground = getGroundAt(rx + 0.5, rz + 0.5, near, 0.36, y + 0.35);
        if (ground === -999) return false;
        const blocked = checkWall(rx + 0.5, ground + 1.15, rz + 0.5, near, 0.36);
        if (blocked) return false;

        const type = chooseAnimalType(rx, rz);
        const spawnY = ground + 0.28;
        const mob = createAnimal(type, rx + 0.5, spawnY, rz + 0.5);
        scene.add(mob);
        animals.push(mob);
        spawnedAnimalCells.add(cell);
        return true;
    }

    function countAnimalsInView(maxDistance = 42) {
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        if (camForward.lengthSq() < 0.0001) return 0;
        camForward.normalize();
        const cosHalfFov = Math.cos(Math.PI / 6);
        const maxDistSq = maxDistance * maxDistance;
        let visibleCount = 0;

        for (const mob of animals) {
            const toMob = new THREE.Vector3(
                mob.position.x - camera.position.x,
                0,
                mob.position.z - camera.position.z
            );
            const distSq = toMob.lengthSq();
            if (distSq > maxDistSq || distSq < 4) continue;
            toMob.normalize();
            if (toMob.dot(camForward) >= cosHalfFov) visibleCount += 1;
        }
        return visibleCount;
    }

    function spawnAnimalsNearPlayer(maxAnimals = 18) {
        const dynamicMaxAnimals = Math.max(maxAnimals, 52);
        if (animals.length >= dynamicMaxAnimals) return;
        const px = Math.floor(camera.position.x);
        const pz = Math.floor(camera.position.z);

        for (let i = 0; i < 7 && animals.length < dynamicMaxAnimals; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 10 + Math.random() * 24;
            const rx = Math.floor(px + Math.cos(angle) * distance);
            const rz = Math.floor(pz + Math.sin(angle) * distance);
            trySpawnAt(rx, rz);
        }

        if (animals.length >= dynamicMaxAnimals) return;

        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        if (camForward.lengthSq() < 0.0001) return;
        camForward.normalize();

        const minVisibleAnimals = 10;
        let visibleCount = countAnimalsInView();
        const remainingSlots = dynamicMaxAnimals - animals.length;
        const maxViewSpawnAttempts = Math.min(80, Math.max(18, remainingSlots * 6));

        for (let i = 0; i < maxViewSpawnAttempts && animals.length < dynamicMaxAnimals && visibleCount < minVisibleAnimals; i++) {
            const distance = 8 + Math.random() * 22;
            const sideOffset = (Math.random() - 0.5) * 16;
            const rx = Math.floor(px + camForward.x * distance - camForward.z * sideOffset);
            const rz = Math.floor(pz + camForward.z * distance + camForward.x * sideOffset);
            if (trySpawnAt(rx, rz)) {
                visibleCount = countAnimalsInView();
            }
        }
    }

    function updateAnimals(dt) {
        for (let i = animals.length - 1; i >= 0; i--) {
            const mob = animals[i];
            const data = mob.userData;
            data.hitCooldown = Math.max(0, data.hitCooldown - dt);
            if (data.hitFlashTime > 0) {
                data.hitFlashTime = Math.max(0, data.hitFlashTime - dt);
                if (data.hitFlashTime === 0) setAnimalDamageTint(mob, false);
            }
            data.turnTimer -= dt;
            data.blockedTurnCooldown = Math.max(0, (data.blockedTurnCooldown || 0) - dt);
            if (data.turnTimer <= 0) {
                data.turnTimer = 1 + Math.random() * 3;
                const terrainDirection = chooseTerrainAwareDirection(mob);
                data.direction.lerp(terrainDirection, 0.72).normalize();
            }

            const stepX = data.direction.x * data.walkSpeed * dt;
            const stepZ = data.direction.z * data.walkSpeed * dt;
            const nextX = mob.position.x + stepX;
            const nextZ = mob.position.z + stepZ;
            const nearby = getNearbyBlocks(mob.position.x, mob.position.z, 3);

            const groundProbeY = mob.position.y + 1.6;
            const currentGround = getGroundAt(mob.position.x, mob.position.z, nearby, 0.36, groundProbeY);
            const nextGround = getGroundAt(nextX, nextZ, nearby, 0.36, groundProbeY);

            const blockedX = checkWall(nextX, mob.position.y + 1.2, mob.position.z, nearby, 0.36);
            const blockedZ = checkWall(mob.position.x, mob.position.y + 1.2, nextZ, nearby, 0.36);
            const dropTooHigh = currentGround !== -999 && nextGround !== -999 && (currentGround - nextGround) > 1.1;
            const stepUpTooHigh = currentGround !== -999 && nextGround !== -999 && (nextGround - currentGround) > 0.55;
            const canJumpUp = currentGround !== -999 && nextGround !== -999 && (nextGround - currentGround) > 0.55 && (nextGround - currentGround) <= 1.25;
            const voidAhead = currentGround !== -999 && nextGround === -999;
            const steepDropAhead = dropTooHigh || voidAhead || stepUpTooHigh;
            const climbingStep = canJumpUp && data.velocityY > 0.01;

            let moved = false;
            if (!blockedX && (!steepDropAhead || climbingStep)) {
                mob.position.x = nextX;
                moved = true;
            }
            if (!blockedZ && (!steepDropAhead || climbingStep)) {
                mob.position.z = nextZ;
                moved = true;
            }
            if (!moved && canJumpUp && data.velocityY <= 0.01) {
                data.velocityY = 9.5;
                moved = true;
            }
            if (moved && currentGround !== -999 && nextGround !== -999 && nextGround > currentGround) {
                mob.position.y = Math.max(mob.position.y, nextGround);
                data.velocityY = 0;
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
                    const nudgeBlocked = checkWall(nudgeX, mob.position.y + 1.2, nudgeZ, nearby, 0.36);
                    const nudgeGround = getGroundAt(nudgeX, nudgeZ, nearby, 0.36, mob.position.y + 0.15);
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
            const ground = getGroundAt(mob.position.x, mob.position.z, nearbyAfterMove, 0.36, feetY);
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
            const distSq = dx * dx + dz * dz;

            if (distSq < 12 * 12 && data.blockedTurnCooldown <= 0.05) {
                const away = new THREE.Vector3(dx, 0, dz);
                if (away.lengthSq() > 0.0001) {
                    away.normalize();
                    data.direction.lerp(away, 0.35).normalize();
                }
            }

            if (distSq > 110 * 110) {
                scene.remove(mob);
                animals.splice(i, 1);
                spawnedAnimalCells.delete(animalCellKey(mob.position.x, mob.position.z));
            }
        }
    }

    function damageAnimal(mob, amount, hitDirection) {
        if (!mob || !animals.includes(mob) || (mob.userData.hitCooldown > 0 && amount < 999)) return false;
        mob.userData.health -= amount;
        mob.userData.hitCooldown = 0.25;
        mob.userData.hitFlashTime = 0.18;
        setAnimalDamageTint(mob, true);
        if (hitDirection?.lengthSq() > 0.0001) {
            const away = hitDirection.clone().setY(0).normalize();
            const stepDistance = 0.1;
            for (let step = 0; step < 8; step++) {
                const targetX = mob.position.x + away.x * stepDistance;
                const targetZ = mob.position.z + away.z * stepDistance;
                const nearby = getNearbyBlocks(targetX, targetZ, 3);
                const blocked = checkWall(targetX, mob.position.y + 1.2, targetZ, nearby, 0.36);
                const currentGround = getGroundAt(mob.position.x, mob.position.z, nearby, 0.36, mob.position.y + 1.6);
                const targetGround = getGroundAt(targetX, targetZ, nearby, 0.36, mob.position.y + 1.6);
                const safeDrop = currentGround !== -999 && targetGround !== -999 && currentGround - targetGround <= 1.1;
                if (blocked || !safeDrop) break;
                mob.position.x = targetX;
                mob.position.z = targetZ;
            }
            mob.userData.direction.copy(away);
        }
        mob.userData.velocityY = Math.max(mob.userData.velocityY, 3.5);
        if (mob.userData.health > 0) return false;

        const index = animals.indexOf(mob);
        if (index >= 0) animals.splice(index, 1);
        spawnedAnimalCells.delete(animalCellKey(mob.position.x, mob.position.z));
        scene.remove(mob);
        onAnimalDeath?.(mob.userData.dropItemId, mob.position.clone(), mob.userData.animalType);
        return true;
    }

    return {
        spawnAnimalsNearPlayer,
        updateAnimals,
        getAnimals: () => animals,
        damageAnimal
    };
}
