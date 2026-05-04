export function getGroundAt(x, z, blocks, playerRadius) {
    let maxH = -1;
    for (let b of blocks) {
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            if (b.position.y + 0.5 > maxH) maxH = b.position.y + 0.5;
        }
    }
    return maxH;
}

export function checkWall(x, y, z, blocks, playerRadius) {
    for (let b of blocks) {
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            // 檢查胸口與腳底範圍的碰撞
            if (y - 0.8 < b.position.y + 0.5 && y + 0.1 > b.position.y - 0.5) return true;
        }
    }
    return false;
}