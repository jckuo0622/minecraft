export function getGroundAt(x, z, blocks, playerRadius, feetY) {
    let maxH = -Infinity; 

    for (let b of blocks) {
        const bPos = b.position;
        // 檢查 XZ 平面是否重疊
        if (x + playerRadius > bPos.x - 0.5 && x - playerRadius < bPos.x + 0.5 &&
            z + playerRadius > bPos.z - 0.5 && z - playerRadius < bPos.z + 0.5) {
            
            const blockTop = bPos.y + 0.5;
            // 關鍵：只找「在腳底之下」或「腳底附近」的方塊頂面
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
            // 判定身體碰撞 (避開腳底 0.1 單位)
            if (y - 0.8 < bPos.y + 0.5 && y + 0.1 > bPos.y - 0.5) return true;
        }
    }
    return false;
}