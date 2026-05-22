import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials, getPixelCanvas, blockIconColors, getItemIconCanvas } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';
import { BlockItem, Inventory, CraftingRecipe, CraftingManager } from './inventory.js';
import { createAnimalSystem } from './animals.js';
import { createDropSystem } from './drops.js';


const itemDefs = {
    wood: new BlockItem('wood', '木頭'),
    sand: new BlockItem('sand', '沙子'),
    leaf: new BlockItem('leaf', '樹葉'),
    stone: new BlockItem('stone', '石頭'),
    plank: new BlockItem('plank', '木板'),
    stone_axe: new BlockItem('stone_axe', '石斧'),
    rope: new BlockItem('rope', '草繩'),
    sandstone: new BlockItem('sandstone', '砂岩'),
    crafting_table: new BlockItem('crafting_table', '合成台'),
    furnace: new BlockItem('furnace', '熔爐'),
    coal_ore: new BlockItem('coal_ore', '煤礦'),
    iron_ore: new BlockItem('iron_ore', '鐵礦'),
    iron: new BlockItem('iron', '鐵錠')
};

const itemIconDataUrl = {};
Object.keys(blockIconColors).forEach((id) => {
    const colors = blockIconColors[id];
    const cv = getItemIconCanvas(id);
    itemIconDataUrl[id] = cv.toDataURL();
});

const inventory = new Inventory();
const craftingManager = new CraftingManager(inventory);
craftingManager.addRecipe(new CraftingRecipe('plank_recipe', '木頭 x1 → 木板 x4', [{ itemId: 'wood', amount: 1 }], { itemId: 'plank', amount: 4 }));
craftingManager.addRecipe(new CraftingRecipe('axe_recipe', '石頭 x2 + 木頭 x1 → 石斧 x1', [{ itemId: 'stone', amount: 2 }, { itemId: 'wood', amount: 1 }], { itemId: 'stone_axe', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('rope_recipe', '樹葉 x2 → 草繩 x1', [{ itemId: 'leaf', amount: 2 }], { itemId: 'rope', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('crafting_table_recipe', '木板 x4 → 合成台 x1', [{ itemId: 'plank', amount: 4 }], { itemId: 'crafting_table', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('furnace_recipe', '石頭 x8 → 熔爐 x1', [{ itemId: 'stone', amount: 8 }], { itemId: 'furnace', amount: 1 }));
craftingManager.addRecipe(new CraftingRecipe('sandstone_recipe', '沙子 x2 + 石頭 x1 → 砂岩 x1', [{ itemId: 'sand', amount: 2 }, { itemId: 'stone', amount: 1 }], { itemId: 'sandstone', amount: 1 }));

const inventoryPanel = document.getElementById('inventory-panel');
const inventoryList = document.getElementById('inventory-list');
const inventoryHotbarGrid = document.getElementById('inventory-hotbar-grid');
const craftingMessage = document.getElementById('crafting-message');
const craftResultEl = document.getElementById('craft-result');
const quickCraftList = document.getElementById('quick-craft-list');
const craftGridEl = document.getElementById('craft-grid');
const craftingTitleEl = document.getElementById('crafting-title');
const craftingAreaEl = document.getElementById('crafting-area');
const furnaceAreaEl = document.getElementById('furnace-area');
const furnaceInputEl = document.getElementById('furnace-input');
const furnaceFuelEl = document.getElementById('furnace-fuel');
const furnaceOutputEl = document.getElementById('furnace-output');
let inventoryOpen = false;
let craftingMode = 'inventory'; // inventory | table | furnace
let openedInventoryFromLock = false;
let unlockingForInventory = false;
let craftSlots = Array.from({ length: 4 }, () => null);
let activeFurnaceKey = null;
const furnaceStates = new Map();


function setCraftMode(mode) {
    craftingMode = mode;
    const size = craftingMode === 'table' ? 3 : 2;
    craftingAreaEl.style.display = craftingMode === 'furnace' ? 'none' : 'block';
    furnaceAreaEl.style.display = craftingMode === 'furnace' ? 'block' : 'none';
    craftSlots = Array.from({ length: size * size }, () => null);
    craftGridEl.style.gridTemplateColumns = `repeat(${size},42px)`;
    craftingTitleEl.textContent = `${size}x${size}`;
    craftGridEl.innerHTML = '';
    for (let i = 0; i < craftSlots.length; i++) {
        const el = document.createElement('div');
        el.className = 'slot craft-slot';
        el.dataset.cslot = String(i);
        craftGridEl.appendChild(el);
    }
}


function getFurnaceState(key) {
    if (!furnaceStates.has(key)) furnaceStates.set(key, { input: null, fuel: null, output: null, progress: 0, burnTime: 0 });
    return furnaceStates.get(key);
}

function fuelTime(itemId) {
    if (itemId === 'coal_ore') return 12;
    if (itemId === 'wood' || itemId === 'plank') return 5;
    return 0;
}

function smeltResult(itemId) {
    if (itemId === 'wood') return 'coal_ore';
    if (itemId === 'iron_ore') return 'iron';
    return null;
}

function renderFurnaceSlot(el, slot) {
    if (!slot) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="mc-item-icon" style="background-image:url(${itemIconDataUrl[slot.itemId] || ''})"></div><span style="position:absolute;right:4px;bottom:2px;color:white;font-size:10px;">x${slot.count}</span>`;
}


function canPlaceInFurnace(slotType, itemId) {
    if (slotType === 'fuel') return fuelTime(itemId) > 0;
    if (slotType === 'input') return smeltResult(itemId) !== null;
    return false;
}

function moveOneFromInventoryToFurnace(invIndex, slotType) {
    if (!activeFurnaceKey) return;
    const invSlot = inventory.slots[invIndex];
    if (!invSlot || !canPlaceInFurnace(slotType, invSlot.itemId)) return;
    const f = getFurnaceState(activeFurnaceKey);
    const target = slotType === 'fuel' ? 'fuel' : 'input';
    if (!f[target]) f[target] = { itemId: invSlot.itemId, count: 0 };
    if (f[target].itemId !== invSlot.itemId) return;
    inventory.remove(invSlot.itemId, 1);
    f[target].count += 1;
}

function bindFurnaceSlot(el, slotType) {
    el.ondragover = (e) => e.preventDefault();
    el.ondrop = (e) => {
        e.preventDefault();
        if (!activeFurnaceKey || !inventoryOpen || craftingMode !== 'furnace') return;
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isNaN(from)) return;
        moveOneFromInventoryToFurnace(from, slotType);
        renderInventory(); renderHotbar(); renderFurnace();
    };
    el.onclick = () => {
        if (!activeFurnaceKey || !inventoryOpen || craftingMode !== 'furnace') return;
        const f = getFurnaceState(activeFurnaceKey);
        const target = slotType === 'fuel' ? 'fuel' : 'input';
        if (!f[target]) return;
        inventory.add(f[target].itemId, 1, true);
        f[target].count -= 1;
        if (f[target].count <= 0) f[target] = null;
        renderInventory(); renderHotbar(); renderFurnace();
    };
}

function renderFurnace() {
    if (!activeFurnaceKey) return;
    const f = getFurnaceState(activeFurnaceKey);
    renderFurnaceSlot(furnaceInputEl, f.input);
    renderFurnaceSlot(furnaceFuelEl, f.fuel);
    renderFurnaceSlot(furnaceOutputEl, f.output);
}

function setCraftMessage(msg) {
    craftingMessage.textContent = msg;
}

function slotHtml(slot, slotIndex) {
    if (!slot) return `<div class="mc-item-slot" draggable="true" data-slot="${slotIndex}"></div>`;
    return `<div class="mc-item-slot" draggable="true" data-slot="${slotIndex}"><span class="mc-item-name">${itemDefs[slot.itemId]?.nameZh || slot.itemId}</span><div class="mc-item-icon" style="background-image:url(${itemIconDataUrl[slot.itemId] || ''})"></div><span>x${slot.count}</span></div>`;
}

function renderInventory() {
    const bagSlots = inventory.getSlots(0, 27);
    const hotbarSlots = inventory.getSlots(27, 36);
    inventoryList.innerHTML = bagSlots.map((slot, i) => slotHtml(slot, i)).join('');
    inventoryHotbarGrid.innerHTML = hotbarSlots.map((slot, i) => slotHtml(slot, 27 + i)).join('');

    document.querySelectorAll('.mc-item-slot').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', el.dataset.slot);
        });
        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData('text/plain'));
            const to = Number(el.dataset.slot);
            inventory.moveSlot(from, to);
            renderInventory();
            renderHotbar();
            renderQuickCraft();
        });
    });
}

function getCraftResult() {
    const size = Math.sqrt(craftSlots.length);

    if (size === 3) {
        const isPlankAt = (r, c) => {
            const slot = craftSlots[r * 3 + c];
            return slot && slot.itemId === 'plank' && slot.count >= 1;
        };
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
                const matches2x2 = isPlankAt(r, c) && isPlankAt(r, c + 1) && isPlankAt(r + 1, c) && isPlankAt(r + 1, c + 1);
                if (!matches2x2) continue;
                let otherCount = 0;
                for (let i = 0; i < craftSlots.length; i++) {
                    const rr = Math.floor(i / 3), cc = i % 3;
                    const inSquare = rr >= r && rr <= r + 1 && cc >= c && cc <= c + 1;
                    if (!inSquare && craftSlots[i]) otherCount++;
                }
                if (otherCount === 0) {
                    return { id: 'crafting_table_from_grid', output: { itemId: 'crafting_table', amount: 1 } };
                }
            }
        }
    }

    const counts = new Map();
    for (const slot of craftSlots) {
        if (!slot) continue;
        counts.set(slot.itemId, (counts.get(slot.itemId) || 0) + slot.count);
    }

    for (const recipe of craftingManager.recipes) {
        const needs = new Map(recipe.inputs.map(i => [i.itemId, i.amount]));
        if (counts.size !== needs.size) continue;
        let ok = true;
        for (const [id, amount] of needs) {
            if ((counts.get(id) || 0) !== amount) { ok = false; break; }
        }
        if (ok) return recipe;
    }
    return null;
}

function renderCrafting() {
    document.querySelectorAll('.craft-slot').forEach((el) => {
        const idx = Number(el.dataset.cslot);
        const slot = craftSlots[idx];
        if (!slot) el.innerHTML = '';
        else el.innerHTML = `<div class="mc-item-icon" style="background-image:url(${itemIconDataUrl[slot.itemId] || ''})"></div><span style="position:absolute;right:4px;bottom:2px;color:white;font-size:10px;">x${slot.count}</span>`;

        el.ondragover = (e) => e.preventDefault();
        el.ondrop = (e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isNaN(from)) return;
            const invSlot = inventory.slots[from];
            if (!invSlot) return;
            craftSlots[idx] = { itemId: invSlot.itemId, count: 1 };
            inventory.remove(invSlot.itemId, 1);
            renderInventory();
            renderHotbar();
            renderQuickCraft();
            renderCrafting();
        renderFurnace();
            renderQuickCraft();
        };
        el.onclick = () => {
            const c = craftSlots[idx];
            if (!c) return;
            inventory.add(c.itemId, c.count, false);
            craftSlots[idx] = null;
            renderInventory(); renderHotbar(); renderCrafting(); renderQuickCraft();
        };
    });

    const recipe = getCraftResult();
    if (!recipe) {
        craftResultEl.innerHTML = '';
        craftResultEl.onclick = null;
        return;
    }
    craftResultEl.innerHTML = `<div class="mc-item-icon" style="background-image:url(${itemIconDataUrl[recipe.output.itemId] || ''})"></div><span style="position:absolute;right:4px;bottom:2px;color:white;font-size:10px;">x${recipe.output.amount}</span>`;
    craftResultEl.onclick = () => {
        // 消耗 crafting 格
        for (let i = 0; i < craftSlots.length; i++) craftSlots[i] = null;
        inventory.add(recipe.output.itemId, recipe.output.amount, false);
        setCraftMessage(`合成成功：${itemDefs[recipe.output.itemId]?.nameZh || recipe.output.itemId}`);
        renderInventory(); renderHotbar(); renderCrafting();
    };
}


function renderQuickCraft() {
    quickCraftList.innerHTML = '';
    craftingManager.recipes.forEach((recipe) => {
        const row = document.createElement('div');
        row.className = 'quick-craft-item';
        const icon = document.createElement('div');
        icon.className = 'mc-item-icon';
        icon.style.position = 'static';
        icon.style.width = '18px';
        icon.style.height = '18px';
        icon.style.backgroundImage = `url(${itemIconDataUrl[recipe.output.itemId] || ''})`;
        const name = document.createElement('span');
        name.textContent = `${itemDefs[recipe.output.itemId]?.nameZh || recipe.output.itemId} x${recipe.output.amount}`;
        name.style.flex = '1';
        name.style.marginLeft = '6px';
        name.style.fontSize = '12px';

        const btn = document.createElement('button');
        btn.textContent = '合成';
        btn.disabled = !craftingManager.canCraft(recipe);
        btn.onclick = () => {
            const result = craftingManager.craft(recipe);
            setCraftMessage(result.message);
            renderInventory(); renderHotbar(); renderCrafting(); renderQuickCraft(); renderQuickCraft();
        };

        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.appendChild(icon);
        left.appendChild(name);

        row.appendChild(left);
        row.appendChild(btn);
        quickCraftList.appendChild(row);
    });
}

function toggleInventory(mode = 'inventory') {
    if (!inventoryOpen) setCraftMode(mode);
    inventoryOpen = !inventoryOpen;

    if (inventoryOpen) {
        openedInventoryFromLock = controls.isLocked;
        if (controls.isLocked) {
            unlockingForInventory = true;
            controls.unlock(); // 開背包時解鎖游標
        }
        inventoryPanel.classList.add('open');
        renderInventory();
        renderCrafting();
        renderFurnace();
        renderHotbar();
        renderQuickCraft();
        setCraftMessage('');
    } else {
        inventoryPanel.classList.remove('open');
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
const animalSystem = createAnimalSystem({
    scene,
    camera,
    getNearbyBlocks,
    getSurfaceHeightApprox
});

const dropSystem = createDropSystem({
    scene,
    camera,
    inventory,
    getNearbyBlocks,
    getMaterials,
    onInventoryUpdated: () => {
        renderHotbar();
        if (inventoryOpen) { renderInventory(); renderCrafting(); }
    },
    getPlayerFeetY: () => camera.position.y - currentHeight
});

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
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; flex-wrap:nowrap; width:max-content; gap:6px; background:rgba(0,0,0,0.7); padding:10px; border:4px solid #333; display:none; border-radius:8px;`;
document.body.appendChild(hotbar);

const blockTypes = ['grass', 'stone', 'wood', 'leaf', 'sand', 'sandstone', 'crafting_table', 'coal_ore', 'iron_ore', 'furnace'];
const slots = [];

function renderHotbar() {
    const hotbarSlots = inventory.getSlots(27, 36);
    slots.forEach((slot, i) => {
        const icon = slot.querySelector('.hb-icon');
        const label = slot.querySelector('.hb-count');
        const entry = hotbarSlots[i];
        if (!entry) {
            icon.style.backgroundImage = '';
            label.textContent = '';
            return;
        }
        icon.style.backgroundImage = `url(${itemIconDataUrl[entry.itemId] || ''})`;
        label.textContent = `x${entry.count}`;
    });
}

for (let i = 0; i < 9; i++) {
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
        if (val >= 0 && val < 9) { selectedIdx = val; updateSelection(val); }
    }
    if (e.code === 'KeyE') {
        toggleInventory('inventory');
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
    selectedIdx = (selectedIdx + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
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
            dropSystem.spawnDrop(blockType, pos.x, pos.y, pos.z);
            removeBlockMesh(intersect.object);
            updateNeighbors(pos.x, pos.y, pos.z);
        } else if (e.button === 2) { // 建造/使用
            if (intersect.object.userData.blockType === 'crafting_table') {
                toggleInventory('table');
                return;
            }
            if (intersect.object.userData.blockType === 'furnace') {
                activeFurnaceKey = `${intersect.object.position.x},${intersect.object.position.y},${intersect.object.position.z}`;
                toggleInventory('furnace');
                return;
            }
            const selectedSlot = inventory.getSlots(27, 36)[selectedIdx];
            if (!selectedSlot || !blockTypes.includes(selectedSlot.itemId)) return;
            const b = new THREE.Mesh(boxGeo, getMaterials(selectedSlot.itemId));
            b.userData.blockType = selectedSlot.itemId;
            inventory.remove(selectedSlot.itemId, 1);
            renderInventory();
            renderHotbar();
            renderQuickCraft();
            const placePos = pos.add(intersect.face.normal);
            b.position.copy(placePos);
            removedBlocks.delete(`${placePos.x},${placePos.y},${placePos.z}`);
            addBlockMesh(b);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());


bindFurnaceSlot(furnaceInputEl, 'input');
bindFurnaceSlot(furnaceFuelEl, 'fuel');

furnaceOutputEl.addEventListener('click', () => {
    if (!activeFurnaceKey || !inventoryOpen || craftingMode !== 'furnace') return;
    const f = getFurnaceState(activeFurnaceKey);
    if (!f.output) return;
    inventory.add(f.output.itemId, 1, true);
    f.output.count -= 1;
    if (f.output.count <= 0) f.output = null;
    renderInventory(); renderHotbar(); renderFurnace();
});


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
        dropSystem.updateDrops(dt);
        animalSystem.spawnAnimalsNearPlayer();
        animalSystem.updateAnimals(dt);
        for (const f of furnaceStates.values()) {
            if (f.burnTime > 0) f.burnTime -= dt;
            const resultId = f.input ? smeltResult(f.input.itemId) : null;
            if (f.input && resultId && (!f.output || f.output.itemId === resultId)) {
                if (f.burnTime <= 0 && f.fuel && fuelTime(f.fuel.itemId) > 0) {
                    f.fuel.count -= 1;
                    f.burnTime += fuelTime(f.fuel.itemId);
                    if (f.fuel.count <= 0) f.fuel = null;
                }
                if (f.burnTime > 0) {
                    f.progress += dt;
                    if (f.progress >= 3.5) {
                        f.progress = 0;
                        f.input.count -= 1;
                        if (f.input.count <= 0) f.input = null;
                        if (!f.output) f.output = { itemId: resultId, count: 0 };
                        f.output.count += 1;
                    }
                }
            } else {
                f.progress = 0;
            }
        }
        if (inventoryOpen && craftingMode === "furnace") renderFurnace();

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