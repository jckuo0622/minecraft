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

export function getMaterials(type) {
    if (type === 'stone') {
        const stone = createPixelTexture('#888888', '#777777');
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: stone}));
    } 
    else if (type === 'wood') {
        const top = createPixelTexture('#6b4226', '#5d3a21');
        const side = createPixelTexture('#4d2d18', '#3e2413');
        return [
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side}),
            new THREE.MeshLambertMaterial({map: top}),  new THREE.MeshLambertMaterial({map: top}),
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side})
        ];
    } 
    else if (type === 'leaf') {
        // 新增：深淺交替的葉子綠色
        const leaf = createPixelTexture('#2d5a27', '#3d7a33');
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: leaf, transparent: true, opacity: 0.9}));
    }
    else { // grass
        const grassTop = createPixelTexture('#5dad44', '#77bc43');
        const dirtSide = createPixelTexture('#8b5a2b', '#7a4e25');
        return [
            new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide}),
            new THREE.MeshLambertMaterial({map: grassTop}), new THREE.MeshLambertMaterial({map: dirtSide}),
            new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide})
        ];
    }
}