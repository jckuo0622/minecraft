import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { getGroundAt } from './physics.js';

export function createDropSystem({ scene, camera, inventory, getNearbyBlocks, getMaterials, onInventoryUpdated, getPlayerFeetY }) {
    const droppedItems = [];

    function spawnDrop(itemId, x, y, z) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), getMaterials(itemId));
        drop.position.set(x, y + 0.6, z);
        drop.userData.itemId = itemId;
        drop.userData.vy = 0;
        drop.userData.collected = false;
        scene.add(drop);
        droppedItems.push(drop);
    }

    function updateDrops(dt) {
        for (let i = droppedItems.length - 1; i >= 0; i--) {
            const drop = droppedItems[i];
            if (!drop || drop.userData.collected) continue;
            drop.userData.vy -= 18 * dt;
            drop.position.y += drop.userData.vy * dt;

            const nearby = getNearbyBlocks(drop.position.x, drop.position.z, 2);
            const groundTop = getGroundAt(drop.position.x, drop.position.z, nearby, 0.2, drop.position.y + 0.5);
            if (groundTop !== -999 && drop.position.y <= groundTop + 0.18) {
                drop.position.y = groundTop + 0.18;
                drop.userData.vy = 0;
            }
            if (drop.position.y < -20) {
                drop.position.y = -20;
                drop.userData.vy = 0;
            }

            const playerFeetY = getPlayerFeetY();
            const dx = drop.position.x - camera.position.x;
            const dy = (drop.position.y + 0.5) - (playerFeetY + 0.6);
            const dz = drop.position.z - camera.position.z;
            if ((dx * dx + dy * dy + dz * dz) < 2.25) {
                drop.userData.collected = true;
                scene.remove(drop);
                droppedItems.splice(i, 1);
                const added = inventory.add(drop.userData.itemId, 1, true);
                if (added === 1) {
                    onInventoryUpdated();
                } else {
                    drop.userData.collected = false;
                    scene.add(drop);
                    droppedItems.push(drop);
                }
            }
        }
    }

    return { spawnDrop, updateDrops };
}
