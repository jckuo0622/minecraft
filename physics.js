export function getGroundAt(x, z, blocks, playerRadius, feetY) {
    let maxH = -Infinity;
    for (let b of blocks) {
        const bPos = b.position;
        // 檢查玩家足跡範圍 [x-r, x+r] 是否與方塊範圍 [bx-0.5, bx+0.5] 有交集
        const intersectX = (x + playerRadius > bPos.x - 0.5) && (x - playerRadius < bPos.x + 0.5);
        const intersectZ = (z + playerRadius > bPos.z - 0.5) && (z - playerRadius < bPos.z + 0.5);

        if (intersectX && intersectZ) {
            const blockTop = bPos.y + 0.5;
            // 偵測腳底位置以下的最近方塊
            if (blockTop <= feetY + 0.2) {
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
            // 判定身體碰撞
            if (y - 0.8 < bPos.y + 0.5 && y + 0.1 > bPos.y - 0.5) return true;
        }
    }
    return false;
}