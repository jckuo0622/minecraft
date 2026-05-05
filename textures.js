import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

// 核心繪圖邏輯：回傳一個畫好像素的 Canvas
export function getPixelCanvas(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for(let x=0; x<16; x++) for(let y=0; y<16; y++) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(x,y,1,1);
    }
    return canvas;
}

export function createPixelTexture(c1, c2) {
    const canvas = getPixelCanvas(c1, c2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

export function getMaterials(type) {
    if (type === 'stone') {
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: createPixelTexture('#888888', '#777777')}));
    } 
    else if (type === 'sand') {
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: createPixelTexture('#e2c693', '#d1b47e')}));
    }
    else if (type === 'wood') {
        const side = createPixelTexture('#4d2d18', '#3e2413');
        const top = createPixelTexture('#6b4226', '#5d3a21');
        return [
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side}),
            new THREE.MeshLambertMaterial({map: top}),  new THREE.MeshLambertMaterial({map: top}),
            new THREE.MeshLambertMaterial({map: side}), new THREE.MeshLambertMaterial({map: side})
        ];
    } 
    else if (type === 'leaf') {
        return new Array(6).fill(new THREE.MeshLambertMaterial({map: createPixelTexture('#2d5a27', '#3d7a33'), transparent: true, opacity: 0.9}));
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

// 新增：專門給 UI 使用的圖示顏色清單
export const blockIconColors = {
    grass: ['#5dad44', '#77bc43'],
    stone: ['#888888', '#777777'],
    wood: ['#4d2d18', '#3e2413'],
    leaf: ['#2d5a27', '#3d7a33'],
    sand: ['#e2c693', '#d1b47e']
};