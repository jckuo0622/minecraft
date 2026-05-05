import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

export function createPixelTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for(let x=0; x<16; x++) for(let y=0; y<16; y++) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(x,y,1,1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

// 根據類型獲取材質包
export function getMaterials(type) {
    let top, side, bottom;
    
    if (type === 'stone') {
        const stone = createPixelTexture('#888888', '#777777');
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: stone}));
    } 
    else if (type === 'wood') {
        top = createPixelTexture('#6b4226', '#5d3a21'); // 年輪
        side = createPixelTexture('#4d2d18', '#3e2413'); // 樹皮
        return [
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side}),
            new THREE.MeshLambertMaterial({map: top}),  new THREE.MeshLambertMaterial({map: top}),
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side})
        ];
    } 
    else { // 預設草地
        const grassTop = createPixelTexture('#5dad44', '#77bc43');
        const dirtSide = createPixelTexture('#8b5a2b', '#7a4e25');
        return [
            new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide}),
            new THREE.MeshLambertMaterial({map: grassTop}), new THREE.MeshLambertMaterial({map: dirtSide}),
            new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide})
        ];
    }
}