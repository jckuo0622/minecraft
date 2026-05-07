import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

const textureCache = new Map();
const materialCache = new Map();

// 核心繪圖邏輯：回傳一個畫好像素的 Canvas
export function getPixelCanvas(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(x, y, 1, 1);
    }
    return canvas;
}

export function createPixelTexture(c1, c2) {
    const key = `${c1}|${c2}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = getPixelCanvas(c1, c2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    textureCache.set(key, tex);
    return tex;
}

export function getMaterials(type) {
    if (materialCache.has(type)) return materialCache.get(type);

    let materials;
    if (type === 'stone') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#888888', '#777777') });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'sand') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#e2c693', '#d1b47e') });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'wood') {
        const side = new THREE.MeshLambertMaterial({ map: createPixelTexture('#4d2d18', '#3e2413') });
        const top = new THREE.MeshLambertMaterial({ map: createPixelTexture('#6b4226', '#5d3a21') });
        materials = [side, side, top, top, side, side];
    }
    else if (type === 'leaf') {
        const mat = new THREE.MeshLambertMaterial({
            map: createPixelTexture('#2d5a27', '#3d7a33'),
            transparent: true,
            opacity: 0.9
        });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else { // grass
        const grassTop = new THREE.MeshLambertMaterial({ map: createPixelTexture('#5dad44', '#77bc43') });
        const dirtSide = new THREE.MeshLambertMaterial({ map: createPixelTexture('#8b5a2b', '#7a4e25') });
        materials = [dirtSide, dirtSide, grassTop, dirtSide, dirtSide, dirtSide];
    }

    materialCache.set(type, materials);
    return materials;
}

// 新增：專門給 UI 使用的圖示顏色清單
export const blockIconColors = {
    grass: ['#5dad44', '#77bc43'],
    stone: ['#888888', '#777777'],
    wood: ['#4d2d18', '#3e2413'],
    leaf: ['#2d5a27', '#3d7a33'],
    sand: ['#e2c693', '#d1b47e']
};
