import * as THREE from 'three';
import { getGroundAt } from './physics.js';

export function createDropSystem({ scene, camera, inventory, getNearbyBlocks, getMaterials, onInventoryUpdated, getPlayerFeetY }) {
    const droppedItems = [];

    function spawnDrop(itemId, x, y, z) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), getMaterials(itemId));
        drop.position.set(x, y + 0.6, z);
        drop.userData.itemId = itemId;
        drop.userData.vy = 0;
        scene.add(drop);
        droppedItems.push(drop);
    }

    function updateDrops(dt) {
        for (let i = droppedItems.length - 1; i >= 0; i--) {
            const drop = droppedItems[i];
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
                inventory.add(drop.userData.itemId, 1, true);
                onInventoryUpdated();
                scene.remove(drop);
                droppedItems.splice(i, 1);
            }
        }
    }

    return { spawnDrop, updateDrops };
}
