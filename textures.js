import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

const textureCache = new Map();
const materialCache = new Map();

function makeOreTexture(baseA, baseB, oreA, oreB) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = Math.random() > 0.5 ? baseA : baseB;
        ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 24; i++) {
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 16);
        ctx.fillStyle = Math.random() > 0.5 ? oreA : oreB;
        ctx.fillRect(x, y, 1, 1);
        if (Math.random() > 0.65 && x < 15) ctx.fillRect(x + 1, y, 1, 1);
    }
    return new THREE.CanvasTexture(canvas);
}

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
    else if (type === 'plank') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#b88650', '#a57442') });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'sandstone') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#b9b3a3', '#9e9888') });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'rope') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#93a54f', '#839544') });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'furnace') {
        const side = new THREE.MeshLambertMaterial({ map: createPixelTexture('#7a7a7a', '#575757') });
        const top = new THREE.MeshLambertMaterial({ map: createPixelTexture('#9b9b9b', '#747474') });
        const front = new THREE.MeshLambertMaterial({ map: createPixelTexture('#505050', '#2f2f2f') });
        materials = [side, side, top, side, front, side];
    }
    else if (type === 'coal_ore') {
        const oreTex = makeOreTexture('#8d8d8d', '#777777', '#252525', '#161616');
        oreTex.magFilter = THREE.NearestFilter;
        oreTex.minFilter = THREE.NearestFilter;
        oreTex.generateMipmaps = false;
        const mat = new THREE.MeshLambertMaterial({ map: oreTex });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'iron_ore') {
        const oreTex = makeOreTexture('#8d8d8d', '#777777', '#c18f66', '#9d6e49');
        oreTex.magFilter = THREE.NearestFilter;
        oreTex.minFilter = THREE.NearestFilter;
        oreTex.generateMipmaps = false;
        const mat = new THREE.MeshLambertMaterial({ map: oreTex });
        materials = [mat, mat, mat, mat, mat, mat];
    }
    else if (type === 'crafting_table') {
        const side = new THREE.MeshLambertMaterial({ map: createPixelTexture('#8d5f34', '#6e4626') });
        const top = new THREE.MeshLambertMaterial({ map: createPixelTexture('#b7864e', '#a17343') });
        materials = [side, side, top, side, side, side];
    }
    else if (type === 'stone_axe') {
        const mat = new THREE.MeshLambertMaterial({ map: createPixelTexture('#9fa5ad', '#838b95') });
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


export function getItemIconCanvas(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');

    if (type === 'furnace') {
        const colors = ['#707070', '#4f4f4f'];
        return getPixelCanvas(colors[0], colors[1]);
    }

    if (type === 'iron') {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(3, 5, 10, 6);
        ctx.fillStyle = '#9f9f9f';
        ctx.fillRect(4, 6, 8, 4);
        return canvas;
    }

    if (type === 'stone_axe') {
        // 石斧頭
        ctx.fillStyle = '#9fa5ad';
        ctx.fillRect(8, 2, 6, 5);
        ctx.fillStyle = '#838b95';
        ctx.fillRect(7, 3, 4, 4);
        // 木柄
        ctx.fillStyle = '#7a4e25';
        ctx.fillRect(5, 7, 2, 8);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(6, 7, 1, 8);
        return canvas;
    }

    const colors = blockIconColors[type] || ['#ffffff', '#dddddd'];
    return getPixelCanvas(colors[0], colors[1]);
}

// 新增：專門給 UI 使用的圖示顏色清單
export const blockIconColors = {
    grass: ['#5dad44', '#77bc43'],
    stone: ['#888888', '#777777'],
    wood: ['#4d2d18', '#3e2413'],
    leaf: ['#2d5a27', '#3d7a33'],
    sand: ['#e2c693', '#d1b47e'],
    plank: ['#b88650', '#a57442'],
    sandstone: ['#b9b3a3', '#9e9888'],
    rope: ['#93a54f', '#839544'],
    stone_axe: ['#9fa5ad', '#838b95'],
    crafting_table: ['#8c6239', '#6f4a2d'],
    furnace: ['#6f6f6f', '#4e4e4e'],
    coal_ore: ['#4b4b4b', '#222222'],
    iron_ore: ['#b88f6f', '#8e6d54'],
    iron: ['#c8c8c8', '#9f9f9f']
};
