export function getGroundAt(x, z, blocks, playerRadius) {
    // 關鍵： default ground 設為負無窮大。如果沒有方塊支撐，
    // 就沒有任何地面邏輯會擋住你墜落。
    let maxH = -Infinity; 

    for (let b of blocks) {
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            // 檢查方塊頂部
            if (b.position.y + 0.5 > maxH) maxH = b.position.y + 0.5;
        }
    }
    return maxH;
}

export function checkWall(x, y, z, blocks, playerRadius) {
    for (let b of blocks) {
        const bPos = b.position;
        if (x + playerRadius > bPos.x - 0.5 && x - playerRadius < bPos.x + 0.5 &&
            z + playerRadius > bPos.z - 0.5 && z - playerRadius < bPos.z + 0.5) {
            // 身體高度範圍判定 (身體與腳底)
            if (y - 0.8 < bPos.y + 0.5 && y + 0.1 > bPos.y - 0.5) return true;
        }
    }
    return false;
}