export function getGroundAt(x, z, blocks, playerRadius, feetY) {
    let maxH = -Infinity; 
    for (let b of blocks) {
        const bPos = b.position;
        // 檢查 XZ 平面是否重疊 (考慮玩家半徑)
        const intersectX = (x + playerRadius > bPos.x - 0.5) && (x - playerRadius < bPos.x + 0.5);
        const intersectZ = (z + playerRadius > bPos.z - 0.5) && (z - playerRadius < bPos.z + 0.5);

        if (intersectX && intersectZ) {
            const blockTop = bPos.y + 0.5;
            // 只抓「腳底位置或以下」的方塊，避免跳起來時抓到頭頂的方塊
            if (blockTop <= feetY + 0.1) {
                if (blockTop > maxH) maxH = blockTop;
            }
        }
    }
    return maxH;
}

export function checkWall(x, y, z, blocks, playerRadius) {
    for (let b of blocks) {
        const bPos = b.position;
        if (x + playerRadius > bPos.x - 0.5 && x - playerRadius < bPos.x + 0.5 &&
            z + playerRadius > bPos.z - 0.5 && z - playerRadius < bPos.z + 0.5) {
            // 判定身體高度的碰撞
            if (y - 0.8 < bPos.y + 0.5 && y + 0.1 > bPos.y - 0.5) return true;
        }
    }
    return false;
}