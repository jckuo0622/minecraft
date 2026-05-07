import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials, getPixelCanvas, blockIconColors } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';
import { BlockItem, Inventory, CraftingRecipe, CraftingManager } from './inventory.js';


const itemDefs = {
    wood: new BlockItem('wood', '木頭'),
    sand: new BlockItem('sand', '沙子'),
    leaf: new BlockItem('leaf', '樹葉'),
    stone: new BlockItem('stone', '石頭'),
    plank: new BlockItem('plank', '木板'),
    stone_axe: new BlockItem('stone_axe', '石斧'),
    rope: new BlockItem('rope', '草繩'),
    sandstone: new BlockItem('sandstone', '砂岩')
};

const itemIconDataUrl = {};
Object.keys(blockIconColors).forEach((id) => {
    const colors = blockIconColors[id];
    const cv = getPixelCanvas(colors[0], colors[1]);
    itemIconDataUrl[id] = cv.toDataURL();
});

const inventory = new Inventory();
const craftingManager = new CraftingManager(inventory);
craftingManager.addRecipe(new CraftingRecipe('plank_recipe', '木頭 x1 → 木板 x4', [{ itemId: 'wood', amount: 1 }], { itemId: 'plank', amount: 4 }));
craftingManager.addRecipe(new CraftingRecipe('axe_recipe', '石頭 x2 + 木頭 x1 → 石斧 x1', [{ itemId: 'stone', amount: 2 }, { itemId: 'wood', amount: 1 }], { itemId: 'stone_axe', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('rope_recipe', '樹葉 x2 → 草繩 x1', [{ itemId: 'leaf', amount: 2 }], { itemId: 'rope', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('sandstone_recipe', '沙子 x2 + 石頭 x1 → 砂岩 x1', [{ itemId: 'sand', amount: 2 }, { itemId: 'stone', amount: 1 }], { itemId: 'sandstone', amount: 1 }));

const inventoryPanel = document.getElementById('inventory-panel');
const inventoryList = document.getElementById('inventory-list');
const craftingList = document.getElementById('crafting-list');
const craftingMessage = document.getElementById('crafting-message');
let inventoryOpen = false;
let openedInventoryFromLock = false;
let unlockingForInventory = false;

function setCraftMessage(msg) {
    craftingMessage.textContent = msg;
}

function renderInventory() {
    const items = inventory.entries();
    if (items.length === 0) {
        inventoryList.innerHTML = '<div class="mc-item-slot"><span class="mc-item-name">空</span></div>'.repeat(27);
    } else {
        const slots = items
.map(([id, count]) => `<div class=\"mc-item-slot\"><span class=\"mc-item-name\">${itemDefs[id]?.nameZh || id}</span><div class=\"mc-item-icon\" style=\"background-image:url(${itemIconDataUrl[id] || ''})\"></div><span>x${count}</span></div>`);
        while (slots.length < 27) slots.push('<div class=\"mc-item-slot\"></div>');
        inventoryList.innerHTML = slots.join('');
    }
}

function renderCrafting() {
    craftingList.innerHTML = '';
    craftingManager.recipes.forEach((recipe) => {
        const row = document.createElement('div');
        row.className = 'mc-recipe-row';

        const label = document.createElement('span');
        label.textContent = recipe.label;

        const btn = document.createElement('button');
        btn.textContent = '合成';
        btn.disabled = !craftingManager.canCraft(recipe);
        btn.addEventListener('click', () => {
            const result = craftingManager.craft(recipe);
            setCraftMessage(result.message);
            renderInventory();
            renderCrafting();
            renderHotbar();
        });

        row.appendChild(label);
        row.appendChild(btn);
        craftingList.appendChild(row);
    });
}

function toggleInventory() {
    inventoryOpen = !inventoryOpen;

    if (inventoryOpen) {
        openedInventoryFromLock = controls.isLocked;
        if (controls.isLocked) {
            unlockingForInventory = true;
            controls.unlock(); // 開背包時解鎖游標
        }
        inventoryPanel.style.display = 'flex';
        renderInventory();
        renderCrafting();
        renderHotbar();
        setCraftMessage('');
    } else {
        inventoryPanel.style.display = 'none';
        if (openedInventoryFromLock) {
            controls.lock(); // 關背包時回到遊戲鎖定
        }
        openedInventoryFromLock = false;
    }
}

// --- A. 基礎場景設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);
scene.fog = new THREE.FogExp2(0xbfd1e5, 0.03); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

// --- B. 地型與區塊系統變數 ---
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2;
const loadedChunks = new Map();
const blocks = []; 
const blockByPos = new Map();
const columnIndex = new Map();
const removedBlocks = new Set(); // 儲存被挖掉的座標 "x,y,z"
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const worldWorker = new Worker('./worldWorker.js', { type: 'module' });
const pendingChunks = new Set();
const chunkBuildQueue = [];
const droppedItems = [];

function spawnDrop(itemId, x, y, z) {
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), getMaterials(itemId));
    drop.position.set(x, y + 0.6, z);
    drop.userData.itemId = itemId;
    drop.userData.vy = 0;
    scene.add(drop);
    droppedItems.push(drop);
}

function updateDrops(dt) {
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const drop = droppedItems[i];
        drop.userData.vy -= 18 * dt;
        drop.position.y += drop.userData.vy * dt;

        const nearby = getNearbyBlocks(drop.position.x, drop.position.z, 2);
        const groundTop = getGroundAt(drop.position.x, drop.position.z, nearby, 0.2, drop.position.y + 0.5);
        if (groundTop !== -999 && drop.position.y <= groundTop + 0.18) {
            drop.position.y = groundTop + 0.18;
            drop.userData.vy = 0;
        }
        if (drop.position.y < -20) {
            drop.position.y = -20;
            drop.userData.vy = 0;
        }

        const dx = drop.position.x - camera.position.x;
        const dy = (drop.position.y + 0.5) - (camera.position.y - currentHeight + 0.6);
        const dz = drop.position.z - camera.position.z;
        if ((dx * dx + dy * dy + dz * dz) < 2.25) {
            inventory.add(drop.userData.itemId, 1);
            renderHotbar();
            if (inventoryOpen) { renderInventory(); renderCrafting(); }
            scene.remove(drop);
            droppedItems.splice(i, 1);
        }
    }
}


function posKey(x, y, z) { return `${x},${y},${z}`; }
function colKey(x, z) { return `${x},${z}`; }

function addBlockMesh(mesh) {
    const x = Math.round(mesh.position.x);
    const y = Math.round(mesh.position.y);
    const z = Math.round(mesh.position.z);
    const pKey = posKey(x, y, z);
    if (blockByPos.has(pKey)) return false;

    scene.add(mesh);
    blocks.push(mesh);
    blockByPos.set(pKey, mesh);

    const cKey = colKey(x, z);
    if (!columnIndex.has(cKey)) columnIndex.set(cKey, new Set());
    columnIndex.get(cKey).add(mesh);
    return true;
}

function removeBlockMesh(mesh) {
    const x = Math.round(mesh.position.x);
    const y = Math.round(mesh.position.y);
    const z = Math.round(mesh.position.z);
    const pKey = posKey(x, y, z);

    scene.remove(mesh);
    const idx = blocks.indexOf(mesh);
    if (idx > -1) blocks.splice(idx, 1);
    blockByPos.delete(pKey);

    const cKey = colKey(x, z);
    const col = columnIndex.get(cKey);
    if (col) {
        col.delete(mesh);
        if (col.size === 0) columnIndex.delete(cKey);
    }
}

function getNearbyBlocks(x, z, radius = 2) {
    const cx = Math.round(x);
    const cz = Math.round(z);
    const nearby = [];
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const col = columnIndex.get(colKey(cx + dx, cz + dz));
            if (!col) continue;
            nearby.push(...col);
        }
    }
    return nearby;
}


function getSurfaceHeightApprox(x, z) {
    let mountain = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
    let hills = Math.sin(x * 0.15) * Math.sin(z * 0.15) * 2;
    let detail = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.5;
    return Math.round(mountain + hills + detail);
}

// 核心：補洞邏輯
function updateNeighbors(x, y, z) {
    const directions = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
    ];

    directions.forEach(([dx, dy, dz]) => {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const neighborKey = `${nx},${ny},${nz}`;

        if (removedBlocks.has(neighborKey)) return; // 挖掉的地方不補
        if (ny > getSurfaceHeightApprox(nx, nz) || ny < -20) return; // 限制高度與地底深度

        const exists = blockByPos.has(posKey(nx, ny, nz));

        if (!exists) {
            const m = new THREE.Mesh(boxGeo, getMaterials('stone'));
            m.userData.blockType = 'stone';
            m.position.set(nx, ny, nz);
            addBlockMesh(m);
        }
    });
}

// 生成區塊（改為由 Worker 負責地圖資料計算）
function spawnChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (loadedChunks.has(key) || pendingChunks.has(key)) return;
    pendingChunks.add(key);
    worldWorker.postMessage({
        type: 'generate_chunk',
        cx,
        cz,
        removedBlocks: Array.from(removedBlocks)
    });
}

worldWorker.onmessage = (event) => {
    const { type, key, blocks: blockData } = event.data;
    if (type !== 'chunk_generated') return;
    pendingChunks.delete(key);
    chunkBuildQueue.push({ key, blockData });
};

function flushChunkBuildQueue(maxChunksPerFrame = 1) {
    for (let i = 0; i < maxChunksPerFrame && chunkBuildQueue.length > 0; i++) {
        const { key, blockData } = chunkBuildQueue.shift();
        if (loadedChunks.has(key)) continue;
        const chunkBlocks = [];
        for (const data of blockData) {
            const m = new THREE.Mesh(boxGeo, getMaterials(data.type));
            m.userData.blockType = data.type;
            m.position.set(data.x, data.y, data.z);
            addBlockMesh(m);
            chunkBlocks.push(m);
        }
        loadedChunks.set(key, chunkBlocks);
    }
}

const generationQueue = [];
function updateWorld() {
    const px = Math.floor(camera.position.x / CHUNK_SIZE);
    const pz = Math.floor(camera.position.z / CHUNK_SIZE);
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const key = `${px + x},${pz + z}`;
            if (!loadedChunks.has(key) && !generationQueue.includes(key)) generationQueue.push(key);
        }
    }
    for (let [key, chunkBlocks] of loadedChunks) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - px) > RENDER_DISTANCE + 1 || Math.abs(cz - pz) > RENDER_DISTANCE + 1) {
            chunkBlocks.forEach(b => {
                removeBlockMesh(b);
            });
            loadedChunks.delete(key);
        }
    }
}

function processQueue() {
    if (generationQueue.length > 0) {
        const next = generationQueue.shift().split(',').map(Number);
        spawnChunk(next[0], next[1]);
    }
}

// --- C. 物品欄 UI (含圖示) ---
const hotbar = document.createElement('div');
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; flex-wrap:wrap; width:560px; gap:6px; background:rgba(0,0,0,0.7); padding:10px; border:4px solid #333; display:none; border-radius:8px;`;
document.body.appendChild(hotbar);

const blockTypes = ['grass', 'stone', 'wood', 'leaf', 'sand'];
const slots = [];

function renderHotbar() {
    const entries = inventory.entries();
    slots.forEach((slot, i) => {
        const icon = slot.querySelector('.hb-icon');
        const label = slot.querySelector('.hb-count');
        const entry = entries[i];
        if (!entry) {
            icon.style.backgroundImage = '';
            label.textContent = '';
            return;
        }
        const [id, count] = entry;
        icon.style.backgroundImage = `url(${itemIconDataUrl[id] || ''})`;
        label.textContent = `x${count}`;
    });
}

for (let i = 0; i < 27; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = `width:54px; height:54px; border:3px solid #8b8b8b; background:#555; position:relative;`;

    const icon = document.createElement('div');
    icon.className = 'hb-icon';
    icon.style.cssText = 'position:absolute; left:9px; top:8px; width:32px; height:32px; background-size:cover; image-rendering:pixelated;';

    const count = document.createElement('span');
    count.className = 'hb-count';
    count.style.cssText = 'position:absolute; right:4px; bottom:2px; color:white; font-size:10px; font-family:monospace;';

    slot.appendChild(icon);
    slot.appendChild(count);
    hotbar.appendChild(slot);
    slots.push(slot);
}

function updateSelection(idx) {
    slots.forEach((s, i) => {
        if (i === idx) {
            s.style.border = '4px solid white';
            s.style.backgroundColor = '#777';
            s.style.transform = 'scale(1.05)';
        } else {
            s.style.border = '3px solid #8b8b8b';
            s.style.backgroundColor = '#555';
            s.style.transform = 'scale(1)';
        }
    });
}
renderHotbar();
updateSelection(0);

// --- D. 控制與點擊 ---
document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
    crosshair.style.display = inventoryOpen ? 'none' : 'block';
    hotbar.style.display = 'flex';
});
controls.addEventListener('unlock', () => {
    if (unlockingForInventory) {
        unlockingForInventory = false;
        overlay.style.display = 'none';
        crosshair.style.display = 'none';
        hotbar.style.display = 'flex';
        return;
    }
    overlay.style.display = 'flex';
    crosshair.style.display = 'none';
    hotbar.style.display = 'none';
});

let selectedIdx = 0;
const velocity = new THREE.Vector3();
const playerRadius = 0.35;
let canJump = false, isCrouching = false, currentHeight = 1.7;
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code.startsWith('Digit')) {
        const val = parseInt(e.code.replace('Digit', '')) - 1;
        if (val >= 0 && val < 5) { selectedIdx = val; updateSelection(val); }
    }
    if (e.code === 'KeyE') {
        toggleInventory();
        return;
    }
    if (e.code === 'Space' && canJump) { velocity.y += 9.5; canJump = false; }
    if (e.shiftKey) isCrouching = true;
});
document.addEventListener('keyup', (e) => { 
    keys[e.code] = false;
    if (!e.shiftKey) isCrouching = false; 
});
window.addEventListener('wheel', (e) => {
    if (!controls.isLocked) return;
    selectedIdx = (selectedIdx + (e.deltaY > 0 ? 1 : -1) + 5) % 5;
    updateSelection(selectedIdx);
}, { passive: true });

window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const interactableBlocks = getNearbyBlocks(camera.position.x, camera.position.z, 4);
    const intersects = raycaster.intersectObjects(interactableBlocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const pos = intersect.object.position.clone();
        if (e.button === 0) { // 挖掘
            removedBlocks.add(`${pos.x},${pos.y},${pos.z}`);
            const blockType = intersect.object.userData.blockType || 'stone';
            spawnDrop(blockType, pos.x, pos.y, pos.z);
            removeBlockMesh(intersect.object);
            updateNeighbors(pos.x, pos.y, pos.z);
        } else if (e.button === 2) { // 建造
            const b = new THREE.Mesh(boxGeo, getMaterials(blockTypes[selectedIdx]));
            b.userData.blockType = blockTypes[selectedIdx];
            const placePos = pos.add(intersect.face.normal);
            b.position.copy(placePos);
            removedBlocks.delete(`${placePos.x},${placePos.y},${placePos.z}`);
            addBlockMesh(b);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- E. 燈光與遊戲循環 ---
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(10, 20, 10);
scene.add(sun);
camera.position.set(0, 30, 0);

let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        updateWorld();
        processQueue();
        flushChunkBuildQueue();
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);
        prevT = t;
        updateDrops(dt);

        const targetH = isCrouching ? 1.2 : 1.7;
        currentHeight += (targetH - currentHeight) * 0.2;
        velocity.x -= velocity.x * 10 * dt;
        velocity.z -= velocity.z * 10 * dt;
        
        const feetY = camera.position.y - currentHeight;
        const nearbyGroundBlocks = getNearbyBlocks(camera.position.x, camera.position.z);
        const groundH = getGroundAt(camera.position.x, camera.position.z, nearbyGroundBlocks, playerRadius, feetY);

        if (groundH === -999) { velocity.y = 0; }
        else { velocity.y -= 28 * dt; }

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (keys['KeyW']) moveDir.add(forward);
        if (keys['KeyS']) moveDir.sub(forward);
        if (keys['KeyA']) moveDir.add(right);
        if (keys['KeyD']) moveDir.sub(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            velocity.x += moveDir.x * (isCrouching ? 25 : 65) * dt;
            velocity.z += moveDir.z * (isCrouching ? 25 : 65) * dt;
        }

        const nextX = camera.position.x + velocity.x * dt;
        if (!checkWall(nextX, camera.position.y, camera.position.z, nearbyGroundBlocks, playerRadius)) {
            if (getGroundAt(nextX, camera.position.z, nearbyGroundBlocks, playerRadius, feetY) !== -999) camera.position.x = nextX;
        }
        const nextZ = camera.position.z + velocity.z * dt;
        if (!checkWall(camera.position.x, camera.position.y, nextZ, nearbyGroundBlocks, playerRadius)) {
            if (getGroundAt(camera.position.x, nextZ, nearbyGroundBlocks, playerRadius, feetY) !== -999) camera.position.z = nextZ;
        }
        camera.position.y += velocity.y * dt;
        if (groundH !== -999 && camera.position.y - currentHeight <= groundH) {
            velocity.y = 0; camera.position.y = groundH + currentHeight; canJump = true;
        } else if (groundH !== -999) { canJump = false; }
        if (camera.position.y < -30) camera.position.set(0, 30, 0);
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight);
});