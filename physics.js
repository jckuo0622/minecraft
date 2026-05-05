export function getGroundAt(x, z, blocks, playerRadius, feetY) {
    let maxH = -Infinity; 
    for (let b of blocks) {
        const bPos = b.position;
        if (Math.abs(bPos.x - x) > 1.5 || Math.abs(bPos.z - z) > 1.5) continue;
        const intersectX = (x + playerRadius > bPos.x - 0.5) && (x - playerRadius < bPos.x + 0.5);
        const intersectZ = (z + playerRadius > bPos.z - 0.5) && (z - playerRadius < bPos.z + 0.5);
        if (intersectX && intersectZ) {
            const blockTop = bPos.y + 0.5;
            if (blockTop <= feetY + 0.15) {
                if (blockTop > maxH) maxH = blockTop;
            }
        }
    }
    return maxH;
}

export function checkWall(x, y, z, blocks, playerRadius) {
    for (let b of blocks) {
        const bPos = b.position;
        if (Math.abs(bPos.x - x) > 1.5 || Math.abs(bPos.z - z) > 1.5) continue;
        if (x + playerRadius > bPos.x - 0.5 && x - playerRadius < bPos.x + 0.5 &&
            z + playerRadius > bPos.z - 0.5 && z - playerRadius < bPos.z + 0.5) {
            if (y - 0.8 < bPos.y + 0.5 && y + 0.1 > bPos.y - 0.5) return true;
        }
    }
    return false;
}