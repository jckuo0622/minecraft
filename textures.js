import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

const textureCache = new Map();
const materialCache = new Map();

function makeCraftingTableTopTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = (x === 0 || y === 0 || x === 15 || y === 15) ? '#5d3b22' : '#b78951';
        if ((x + y) % 3 === 0) ctx.fillStyle = '#a07243';
        ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 3; i < 13; i += 3) {
        ctx.fillStyle = '#7a4d2d';
        ctx.fillRect(i, 2, 1, 12);
        ctx.fillRect(2, i, 12, 1);
    }
    return new THREE.CanvasTexture(canvas);
}

function makeCraftingTableSideTexture(kind = 'front') {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#83552f' : '#6a4325';
        ctx.fillRect(x, y, 1, 1);
    }
    if (kind === 'front' || kind === 'back') {
        ctx.fillStyle = '#b78951';
        ctx.fillRect(3, 3, 10, 10);
        ctx.fillStyle = '#754a2b';
        ctx.fillRect(4, 4, 8, 8);
    } else {
        ctx.fillStyle = '#9a6b3f';
        ctx.fillRect(2, 3, 12, 3);
        ctx.fillRect(2, 10, 12, 3);
    }
    return new THREE.CanvasTexture(canvas);
}

function makeFurnaceFrontTexture() {

    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#6e6e6e' : '#5b5b5b';
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(3, 3, 10, 3);
    ctx.fillStyle = '#202020';
    ctx.fillRect(4, 9, 8, 5);
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(4, 4, 8, 1);
    return new THREE.CanvasTexture(canvas);
}

function makeFurnaceSideTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#7a7a7a' : '#666666';
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(3, 4, 10, 8);
    return new THREE.CanvasTexture(canvas);
}

function makeFurnaceTopTexture() {
    return createPixelTexture('#9a9a9a', '#7a7a7a');
}

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
        const sideTex = makeFurnaceSideTexture();
        const topTex = makeFurnaceTopTexture();
        const frontTex = makeFurnaceFrontTexture();
        sideTex.magFilter = THREE.NearestFilter; sideTex.minFilter = THREE.NearestFilter; sideTex.generateMipmaps = false;
        topTex.magFilter = THREE.NearestFilter; topTex.minFilter = THREE.NearestFilter; topTex.generateMipmaps = false;
        frontTex.magFilter = THREE.NearestFilter; frontTex.minFilter = THREE.NearestFilter; frontTex.generateMipmaps = false;
        const side = new THREE.MeshLambertMaterial({ map: sideTex });
        const top = new THREE.MeshLambertMaterial({ map: topTex });
        const front = new THREE.MeshLambertMaterial({ map: frontTex });
        materials = [side, side, top, top, front, side];
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
        const topTex = makeCraftingTableTopTexture();
        const frontTex = makeCraftingTableSideTexture('front');
        const sideTex = makeCraftingTableSideTexture('side');
        const backTex = makeCraftingTableSideTexture('back');
        topTex.magFilter = THREE.NearestFilter; topTex.minFilter = THREE.NearestFilter; topTex.generateMipmaps = false;
        frontTex.magFilter = THREE.NearestFilter; frontTex.minFilter = THREE.NearestFilter; frontTex.generateMipmaps = false;
        sideTex.magFilter = THREE.NearestFilter; sideTex.minFilter = THREE.NearestFilter; sideTex.generateMipmaps = false;
        backTex.magFilter = THREE.NearestFilter; backTex.minFilter = THREE.NearestFilter; backTex.generateMipmaps = false;
        const top = new THREE.MeshLambertMaterial({ map: topTex });
        const front = new THREE.MeshLambertMaterial({ map: frontTex });
        const side = new THREE.MeshLambertMaterial({ map: sideTex });
        const back = new THREE.MeshLambertMaterial({ map: backTex });
        materials = [side, side, top, top, front, back];
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
        ctx.fillStyle = '#666666'; ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#2f2f2f'; ctx.fillRect(3, 3, 10, 3);
        ctx.fillStyle = '#1f1f1f'; ctx.fillRect(4, 9, 8, 5);
        return canvas;
    }

    if (type === 'crafting_table') {
        ctx.fillStyle = '#b78951'; ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#7a4d2d';
        for (let i = 3; i < 13; i += 3) {
            ctx.fillRect(i, 2, 1, 12);
            ctx.fillRect(2, i, 12, 1);
        }
        return canvas;
    }

    if (type === 'iron') {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(3, 5, 10, 6);
        ctx.fillStyle = '#9f9f9f';
        ctx.fillRect(4, 6, 8, 4);
        return canvas;
    }


    if (type === 'wood_helmet' || type === 'wood_chest' || type === 'wood_legs' || type === 'wood_boots' ||
        type === 'iron_helmet' || type === 'iron_chest' || type === 'iron_legs' || type === 'iron_boots') {
        const isIron = type.startsWith('iron_');
        const c1 = isIron ? '#c8c8c8' : '#9a6b3f';
        const c2 = isIron ? '#9f9f9f' : '#754a2b';
        const part = type.split('_')[1];
        ctx.fillStyle = c1;
        if (part === 'helmet') { ctx.fillRect(3, 3, 10, 4); ctx.fillRect(3, 7, 2, 2); ctx.fillRect(11, 7, 2, 2); }
        if (part === 'chest') { ctx.fillRect(3, 3, 10, 3); ctx.fillRect(2, 6, 12, 7); }
        if (part === 'legs') { ctx.fillRect(3, 3, 10, 3); ctx.fillRect(3, 6, 3, 8); ctx.fillRect(10, 6, 3, 8); }
        if (part === 'boots') { ctx.fillRect(3, 9, 3, 5); ctx.fillRect(10, 9, 3, 5); }
        ctx.fillStyle = c2; ctx.fillRect(4, 4, 8, 1);
        return canvas;
    }

    if (type === 'stick') {
        ctx.fillStyle = '#7a4e25';
        ctx.fillRect(7, 2, 2, 12);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(8, 2, 1, 12);
        return canvas;
    }

    const drawPixels = (pixels, color) => {
        ctx.fillStyle = color;
        pixels.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    };

    if (['stone_axe', 'wood_axe', 'iron_axe'].includes(type)) {
        const isWood = type === 'wood_axe';
        const isIron = type === 'iron_axe';
        const headLight = isWood ? '#b88650' : (isIron ? '#d9d9d9' : '#9fa5ad');
        const headDark = isWood ? '#8f6036' : (isIron ? '#b0b0b0' : '#7f8792');
        drawPixels([[10,2],[11,2],[12,2],[9,3],[10,3],[11,3],[12,3],[8,4],[9,4],[10,4],[11,4],[8,5],[9,5],[10,5]], headLight);
        drawPixels([[12,4],[11,5],[10,6],[9,6],[8,6]], headDark);
        drawPixels([[6,6],[7,7],[8,8],[9,9],[10,10],[9,11],[8,12],[7,13]], '#7a4e25');
        drawPixels([[7,6],[8,7],[9,8],[10,9],[11,10],[10,11],[9,12]], '#8b5a2b');
        return canvas;
    }

    if (['stone_pickaxe', 'wood_pickaxe', 'iron_pickaxe'].includes(type)) {
        const isWood = type === 'wood_pickaxe';
        const isIron = type === 'iron_pickaxe';
        const headLight = isWood ? '#b88650' : (isIron ? '#d9d9d9' : '#9fa5ad');
        const headDark = isWood ? '#8f6036' : (isIron ? '#b0b0b0' : '#7f8792');
        drawPixels([[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[12,2],[4,3],[8,3],[12,3]], headLight);
        drawPixels([[5,3],[6,3],[7,3],[9,3],[10,3],[11,3]], headDark);
        drawPixels([[8,4],[8,5],[8,6],[8,7],[8,8],[9,9],[9,10],[9,11],[10,12],[10,13]], '#7a4e25');
        drawPixels([[9,4],[9,5],[9,6],[9,7],[9,8],[10,9],[10,10],[10,11],[11,12]], '#8b5a2b');
        return canvas;
    }

    if (['stone_sword', 'wood_sword', 'iron_sword'].includes(type)) {
        const isWood = type === 'wood_sword';
        const isIron = type === 'iron_sword';
        const bladeLight = isWood ? '#b88650' : (isIron ? '#d9d9d9' : '#9fa5ad');
        const bladeDark = isWood ? '#8f6036' : (isIron ? '#b0b0b0' : '#7f8792');
        drawPixels([[8,2],[9,3],[10,4],[9,5],[8,6],[7,7]], bladeLight);
        drawPixels([[7,3],[8,4],[9,4],[8,5],[7,6],[6,7]], bladeDark);
        drawPixels([[6,8],[7,8],[8,9],[9,10],[10,11]], '#7a4e25');
        drawPixels([[8,8],[9,9],[10,10],[11,11],[9,12]], '#8b5a2b');
        drawPixels([[7,9],[8,10],[9,11]], '#c6a96e');
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
    stick: ['#8b5a2b', '#7a4e25'],
    stone_pickaxe: ['#9fa5ad', '#838b95'],
    stone_sword: ['#9fa5ad', '#838b95'],
    wood_axe: ['#b88650', '#9b6d3f'],
    wood_pickaxe: ['#b88650', '#9b6d3f'],
    wood_sword: ['#b88650', '#9b6d3f'],
    iron_axe: ['#d2d2d2', '#aeaeae'],
    iron_pickaxe: ['#d2d2d2', '#aeaeae'],
    iron_sword: ['#d2d2d2', '#aeaeae'],
    crafting_table: ['#8c6239', '#6f4a2d'],
    furnace: ['#6f6f6f', '#4e4e4e'],
    coal_ore: ['#4b4b4b', '#222222'],
    iron_ore: ['#b88f6f', '#8e6d54'],
    iron: ['#c8c8c8', '#9f9f9f'],
    wood_helmet: ['#9a6b3f', '#754a2b'],
    wood_chest: ['#9a6b3f', '#754a2b'],
    wood_legs: ['#9a6b3f', '#754a2b'],
    wood_boots: ['#9a6b3f', '#754a2b'],
    iron_helmet: ['#c8c8c8', '#9f9f9f'],
    iron_chest: ['#c8c8c8', '#9f9f9f'],
    iron_legs: ['#c8c8c8', '#9f9f9f'],
    iron_boots: ['#c8c8c8', '#9f9f9f']
};
