import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getMaterials, getPixelCanvas, blockIconColors, getItemIconCanvas } from './textures.js';
import { getGroundAt, checkWall, checkCapsuleWall } from './physics.js';
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
    wood_axe: new BlockItem('wood_axe', '木斧'),
    iron_axe: new BlockItem('iron_axe', '鐵斧'),
    stick: new BlockItem('stick', '木棍'),
    stone_pickaxe: new BlockItem('stone_pickaxe', '石鎬'),
    wood_pickaxe: new BlockItem('wood_pickaxe', '木鎬'),
    iron_pickaxe: new BlockItem('iron_pickaxe', '鐵鎬'),
    stone_sword: new BlockItem('stone_sword', '石劍'),
    wood_sword: new BlockItem('wood_sword', '木劍'),
    iron_sword: new BlockItem('iron_sword', '鐵劍'),
    rope: new BlockItem('rope', '草繩'),
    sandstone: new BlockItem('sandstone', '砂岩'),
    crafting_table: new BlockItem('crafting_table', '合成台'),
    furnace: new BlockItem('furnace', '熔爐'),
    coal_ore: new BlockItem('coal_ore', '煤礦'),
    iron_ore: new BlockItem('iron_ore', '鐵礦'),
    iron: new BlockItem('iron', '鐵錠'),
    raw_pork: new BlockItem('raw_pork', '生豬肉'),
    raw_beef: new BlockItem('raw_beef', '生牛肉'),
    raw_mutton: new BlockItem('raw_mutton', '生羊肉'),
    cooked_pork: new BlockItem('cooked_pork', '熟豬肉'),
    cooked_beef: new BlockItem('cooked_beef', '熟牛肉'),
    cooked_mutton: new BlockItem('cooked_mutton', '熟羊肉'),
    volleyball: new BlockItem('volleyball', '排球'),
    wood_helmet: new BlockItem('wood_helmet', '木頭帽子'),
    wood_chest: new BlockItem('wood_chest', '木頭護甲'),
    wood_legs: new BlockItem('wood_legs', '木頭護腿'),
    wood_boots: new BlockItem('wood_boots', '木頭鞋子'),
    iron_helmet: new BlockItem('iron_helmet', '鐵帽子'),
    iron_chest: new BlockItem('iron_chest', '鐵護甲'),
    iron_legs: new BlockItem('iron_legs', '鐵護腿'),
    iron_boots: new BlockItem('iron_boots', '鐵鞋子')
};

const itemIconDataUrl = {};
Object.keys(blockIconColors).forEach((id) => {
    const colors = blockIconColors[id];
    const cv = getItemIconCanvas(id);
    itemIconDataUrl[id] = cv.toDataURL();
});

const inventory = new Inventory();
inventory.add('volleyball', 1, false);
const craftingManager = new CraftingManager(inventory);
craftingManager.addRecipe(new CraftingRecipe('plank_recipe', '木頭 x1 → 木板 x4', [{ itemId: 'wood', amount: 1 }], { itemId: 'plank', amount: 4 }));
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
const furnaceProgressFillEl = document.getElementById('furnace-progress-fill');
const fpHandEl = document.getElementById('first-person-hand');
const fpHeldItemEl = document.getElementById('fp-held-item');
const survivalHudEl = document.getElementById('survival-hud');
const healthBarEl = document.getElementById('health-bar');
const hungerBarEl = document.getElementById('hunger-bar');
const miningProgressEl = document.getElementById('mining-progress');
const miningProgressFillEl = document.getElementById('mining-progress-fill');
const eatingProgressEl = document.getElementById('eating-progress');
const eatingProgressFillEl = document.getElementById('eating-progress-fill');
const throwProgressEl = document.getElementById('throw-progress');
const throwProgressFillEl = document.getElementById('throw-progress-fill');

let inventoryOpen = false;
let gameMode = 'survival';
let craftingMode = 'inventory'; // inventory | table | furnace
let openedInventoryFromLock = false;
let unlockingForInventory = false;
let craftSlots = Array.from({ length: 4 }, () => null);
let activeFurnaceKey = null;
const furnaceStates = new Map();
const equipment = { helmet: null, chest: null, legs: null, boots: null };
let selectedIdx = 0;
let isThirdPerson = false;
let lastViewToggleAt = 0;
let thirdPersonYaw = 0;
let thirdPersonPitch = -0.2;

const MAX_HEALTH = 20;
const MAX_HUNGER = 20;
let playerHealth = MAX_HEALTH;
let playerHunger = MAX_HUNGER;
let hungerExhaustion = 0;
let survivalTick = 0;
let regenerationTick = 0;
let starvationTick = 0;
let damageCooldown = 0;
let wasAirborne = false;
let peakFallSpeed = 0;
let ignoreFallDamageUntilGround = true;

const blockMiningRules = {
    leaf: { hardness: 0.25, tool: 'axe' },
    sand: { hardness: 0.4, tool: 'shovel' },
    grass: { hardness: 0.65, tool: 'shovel' },
    wood: { hardness: 1.5, tool: 'axe' },
    plank: { hardness: 1.2, tool: 'axe' },
    crafting_table: { hardness: 1.8, tool: 'axe' },
    stone: { hardness: 2.8, tool: 'pickaxe' },
    sandstone: { hardness: 2.2, tool: 'pickaxe' },
    coal_ore: { hardness: 3.2, tool: 'pickaxe' },
    iron_ore: { hardness: 4.2, tool: 'pickaxe' },
    furnace: { hardness: 3.5, tool: 'pickaxe' }
};

let miningState = null;
let leftMouseDown = false;
let lastMiningSwingAt = 0;
let eatingState = null;
let rightMouseDown = false;
let lastEatingSwingAt = 0;
let throwChargeState = null;
const volleyballProjectiles = [];

const foodValues = {
    raw_pork: 3,
    raw_beef: 3,
    raw_mutton: 2,
    cooked_pork: 8,
    cooked_beef: 8,
    cooked_mutton: 6
};

function renderStatusRow(container, value, iconClass) {
    container.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const icon = document.createElement('span');
        const remaining = value - i * 2;
        icon.className = `status-icon ${iconClass}`;
        if (remaining <= 0) icon.classList.add('empty');
        else if (remaining === 1) icon.classList.add('half');
        container.appendChild(icon);
    }
}

function renderSurvivalHud() {
    renderStatusRow(healthBarEl, playerHealth, 'health-icon');
    renderStatusRow(hungerBarEl, playerHunger, 'hunger-icon');
    healthBarEl.setAttribute('aria-label', `生命值 ${playerHealth} / ${MAX_HEALTH}`);
    hungerBarEl.setAttribute('aria-label', `飢餓值 ${playerHunger} / ${MAX_HUNGER}`);
}

function armorPoints() {
    const values = {
        wood_helmet: 1, wood_chest: 2, wood_legs: 2, wood_boots: 1,
        iron_helmet: 2, iron_chest: 5, iron_legs: 4, iron_boots: 2
    };
    return Object.values(equipment).reduce((sum, item) => sum + (values[item?.itemId] || 0), 0);
}

function damagePlayer(amount, source = 'generic', ignoreArmor = false) {
    if (amount <= 0 || playerHealth <= 0 || damageCooldown > 0) return;
    const reduction = ignoreArmor ? 0 : Math.min(0.6, armorPoints() * 0.04);
    const damage = Math.max(1, Math.ceil(amount * (1 - reduction)));
    playerHealth = Math.max(0, playerHealth - damage);
    damageCooldown = source === 'starvation' ? 0.35 : 0.65;
    renderSurvivalHud();
    document.body.classList.remove('damage-flash');
    void document.body.offsetWidth;
    document.body.classList.add('damage-flash');
    if (playerHealth <= 0) respawnPlayer();
}

function respawnPlayer() {
    playerHealth = MAX_HEALTH;
    playerHunger = MAX_HUNGER;
    hungerExhaustion = 0;
    velocity.set(0, 0, 0);
    camera.position.set(0, 30, 0);
    playerAnchor.set(0, 30, 0);
    ignoreFallDamageUntilGround = true;
    wasAirborne = false;
    peakFallSpeed = 0;
    miningState = null;
    miningProgressEl.style.display = 'none';
    cancelEating();
    renderSurvivalHud();
}

function addExhaustion(amount) {
    hungerExhaustion += amount;
    while (hungerExhaustion >= 4 && playerHunger > 0) {
        hungerExhaustion -= 4;
        playerHunger--;
        renderSurvivalHud();
    }
}

function updateSurvival(dt, horizontalSpeed) {
    damageCooldown = Math.max(0, damageCooldown - dt);
    survivalTick += dt;
    addExhaustion(dt * 0.015 + horizontalSpeed * dt * (isCrouching ? 0.003 : 0.007));

    if (playerHunger >= 18 && playerHealth < MAX_HEALTH) {
        regenerationTick += dt;
        if (regenerationTick >= 4) {
            regenerationTick = 0;
            playerHealth++;
            addExhaustion(1.5);
            renderSurvivalHud();
        }
    } else {
        regenerationTick = 0;
    }

    if (playerHunger <= 0) {
        starvationTick += dt;
        if (starvationTick >= 4) {
            starvationTick = 0;
            damagePlayer(1, 'starvation', true);
        }
    } else {
        starvationTick = 0;
    }

    if (survivalTick >= 30) {
        survivalTick = 0;
        addExhaustion(0.25);
    }
}

function selectedItemId() {
    return inventory.getSlots(27, 36)[selectedIdx]?.itemId || null;
}

function miningDuration(blockType) {
    const rule = blockMiningRules[blockType] || { hardness: 2, tool: null };
    const itemId = selectedItemId() || '';
    const toolType = itemId.includes('pickaxe') ? 'pickaxe' : itemId.includes('axe') ? 'axe' : null;
    const tier = itemId.startsWith('iron_') ? 3 : itemId.startsWith('stone_') ? 2 : itemId.startsWith('wood_') ? 1 : 0;
    let speed = 1;
    if (rule.tool && toolType === rule.tool) speed = 2.2 + tier * 1.35;
    else if (toolType) speed = 0.8;
    return Math.max(0.18, rule.hardness * 0.75 / speed);
}


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
    if (itemId === 'raw_pork') return 'cooked_pork';
    if (itemId === 'raw_beef') return 'cooked_beef';
    if (itemId === 'raw_mutton') return 'cooked_mutton';
    return null;
}

function renderFurnaceSlot(el, slot) {
    if (!slot) {
        el.innerHTML = '';
        el.removeAttribute('title');
        return;
    }
    el.innerHTML = `
        <div class="mc-item-icon furnace-item-icon" style="background-image:url(${itemIconDataUrl[slot.itemId] || ''})"></div>
        <span class="furnace-item-count">x${slot.count}</span>
    `;
    el.title = itemDefs[slot.itemId]?.nameZh || slot.itemId;
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
    const pct = Math.max(0, Math.min(100, (f.progress / 3.5) * 100));
    furnaceProgressFillEl.style.width = `${pct}%`;
}


function armorSlotForItem(itemId) {
    if (!itemId) return null;
    if (itemId.endsWith('_helmet')) return 'helmet';
    if (itemId.endsWith('_chest')) return 'chest';
    if (itemId.endsWith('_legs')) return 'legs';
    if (itemId.endsWith('_boots')) return 'boots';
    return null;
}

function renderEquipment() {
    document.querySelectorAll('.equip-slot').forEach((el) => {
        const slot = el.dataset.equip;
        const equipped = equipment[slot];
        if (!equipped) el.innerHTML = '';
        else el.innerHTML = `<div class="mc-item-icon" style="background-image:url(${itemIconDataUrl[equipped.itemId] || ''})"></div><span style="position:absolute;right:4px;bottom:2px;color:white;font-size:10px;">x1</span>`;

        el.ondragover = (e) => e.preventDefault();
        el.ondrop = (e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isNaN(from)) return;
            const invSlot = inventory.slots[from];
            if (!invSlot || invSlot.count < 1) return;
            const want = armorSlotForItem(invSlot.itemId);
            if (want !== slot) return;
            if (equipment[slot]) {
                inventory.add(equipment[slot].itemId, 1, false);
            }
            inventory.remove(invSlot.itemId, 1);
            equipment[slot] = { itemId: invSlot.itemId };
            renderInventory(); renderHotbar(); renderEquipment();
        };

        el.onclick = () => {
            if (!equipment[slot]) return;
            inventory.add(equipment[slot].itemId, 1, false);
            equipment[slot] = null;
            renderInventory(); renderHotbar(); renderEquipment();
        };
    });
    renderHeldItemInHand();
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
            renderEquipment();
            renderQuickCraft();
        });
    });
    renderHeldItemInHand();
}


function matchArmorRecipe() {
    if (craftSlots.length !== 9) return null;
    const mats = ['plank', 'iron'];
    const at = (r, c) => craftSlots[r * 3 + c];
    for (const mat of mats) {
        const hasOnly = () => craftSlots.every(sl => !sl || sl.itemId === mat);
        if (!hasOnly()) continue;

        // helmet: top row 3 + mid left/right
        if (at(0,0)&&at(0,1)&&at(0,2)&&at(1,0)&&at(1,2) && !at(1,1) && !at(2,0)&&!at(2,1)&&!at(2,2)) {
            return { output: { itemId: `${mat === 'plank' ? 'wood' : 'iron'}_helmet`, amount: 1 } };
        }
        // chest: except top middle empty
        const chestNeed=[[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]];
        const chestOk=chestNeed.every(([r,c])=>at(r,c)) && !at(0,1);
        if (chestOk) return { output: { itemId: `${mat === 'plank' ? 'wood' : 'iron'}_chest`, amount: 1 } };

        // legs: top row3 + mid left/right + bot left/right
        if (at(0,0)&&at(0,1)&&at(0,2)&&at(1,0)&&at(1,2)&&at(2,0)&&at(2,2) && !at(1,1)&&!at(2,1)) {
            return { output: { itemId: `${mat === 'plank' ? 'wood' : 'iron'}_legs`, amount: 1 } };
        }

        // boots: two columns left/right bottom two rows
        if (at(1,0)&&at(2,0)&&at(1,2)&&at(2,2) && !at(0,0)&&!at(0,1)&&!at(0,2)&&!at(1,1)&&!at(2,1)) {
            return { output: { itemId: `${mat === 'plank' ? 'wood' : 'iron'}_boots`, amount: 1 } };
        }
    }
    return null;
}

function isRecipeLargerThan2x2(recipe) {
    const totalInputs = recipe.inputs.reduce((sum, input) => sum + input.amount, 0);
    return totalInputs > 4;
}

function matchStickRecipe() {
    const size = Math.sqrt(craftSlots.length);
    if (size !== 2 && size !== 3) return null;
    const need = new Set();
    if (size === 2) {
        for (let c = 0; c < 2; c++) {
            need.clear();
            need.add(0 * 2 + c);
            need.add(1 * 2 + c);
            let ok = true;
            for (let i = 0; i < craftSlots.length; i++) {
                const slot = craftSlots[i];
                if (need.has(i)) { if (!slot || slot.itemId !== 'plank') ok = false; }
                else if (slot) ok = false;
            }
            if (ok) return { output: { itemId: 'stick', amount: 4 } };
        }
        return null;
    }
    for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 2; r++) {
            need.clear();
            need.add(r * 3 + c);
            need.add((r + 1) * 3 + c);
            let ok = true;
            for (let i = 0; i < craftSlots.length; i++) {
                const slot = craftSlots[i];
                if (need.has(i)) { if (!slot || slot.itemId !== 'plank') ok = false; }
                else if (slot) ok = false;
            }
            if (ok) return { output: { itemId: 'stick', amount: 4 } };
        }
    }
    return null;
}

function matchStoneToolRecipes() {
    if (craftSlots.length !== 9) return null;
    const mats = [
        { id: 'stone', key: 'stone', zh: '石' },
        { id: 'plank', key: 'wood', zh: '木' },
        { id: 'iron', key: 'iron', zh: '鐵' }
    ];
    const at = (r, c, id) => {
        const slot = craftSlots[r * 3 + c];
        return slot && slot.itemId === id;
    };
    const emptyElse = (allowed) => craftSlots.every((slot, i) => !slot || allowed.has(i));

    for (const mat of mats) {
        const m = mat.id;
        if (at(0,0,m) && at(0,1,m) && at(1,0,m) && at(1,1,'stick') && at(2,1,'stick') && emptyElse(new Set([0,1,3,4,7]))) {
            return { output: { itemId: `${mat.key}_axe`, amount: 1 } };
        }

        if (at(0,0,m) && at(0,1,m) && at(0,2,m) && at(1,1,'stick') && at(2,1,'stick') && emptyElse(new Set([0,1,2,4,7]))) {
            return { output: { itemId: `${mat.key}_pickaxe`, amount: 1 } };
        }

        if (at(0,1,m) && at(1,1,m) && at(2,1,'stick') && emptyElse(new Set([1,4,7]))) {
            return { output: { itemId: `${mat.key}_sword`, amount: 1 } };
        }
    }

    return null;
}

function getCraftResult() {
    const stickRecipe = matchStickRecipe();
    if (stickRecipe) return stickRecipe;

    const size = Math.sqrt(craftSlots.length);

    if (size === 3) {
        const armorRecipe = matchArmorRecipe();
        if (armorRecipe) return armorRecipe;
        const stoneToolRecipe = matchStoneToolRecipes();
        if (stoneToolRecipe) return stoneToolRecipe;
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
        if (craftingMode !== 'table' && isRecipeLargerThan2x2(recipe)) continue;
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
            renderEquipment();
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
        const needsTable = isRecipeLargerThan2x2(recipe);
        btn.disabled = !craftingManager.canCraft(recipe) || (needsTable && craftingMode !== 'table');
        btn.onclick = () => {
            if (isRecipeLargerThan2x2(recipe) && craftingMode !== 'table') {
                setCraftMessage('此配方需要在合成台（3x3）製作');
                return;
            }
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
    renderHeldItemInHand();
}

function toggleInventory(mode = 'inventory') {
    if (!inventoryOpen) setCraftMode(mode);
    inventoryOpen = !inventoryOpen;

    if (inventoryOpen) {
        leftMouseDown = false;
        rightMouseDown = false;
        cancelMining();
        cancelEating();
        cancelThrowCharge();
        openedInventoryFromLock = controls.isLocked;
        if (controls.isLocked) {
            unlockingForInventory = true;
            controls.unlock(); // 開背包時解鎖游標
        }
        inventoryPanel.classList.add('open');
        fpHandEl.style.display = 'none';
        renderInventory();
        renderCrafting();
        renderFurnace();
        renderHotbar();
        renderEquipment();
        renderQuickCraft();
        setCraftMessage('');
    } else {
        inventoryPanel.classList.remove('open');
        fpHandEl.style.display = controls.isLocked ? 'block' : 'none';
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
const DAY_DURATION = 10 * 60;
const NIGHT_DURATION = 10 * 60;
const DAY_NIGHT_CYCLE = DAY_DURATION + NIGHT_DURATION;
let worldTime = 90;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const playButton = document.getElementById('btn-play');
playButton?.addEventListener('click', () => {
    overlay.style.display = 'none';
    controls.lock();
});

// --- B. 地型與區塊系統變數 ---
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2;
const loadedChunks = new Map();
const blocks = []; 
const blockByPos = new Map();
const columnIndex = new Map();
const removedBlocks = new Set(); // 儲存被挖掉的座標 "x,y,z"
const placedBlocks = new Map(); // 玩家放置的方塊，座標字串 -> 方塊類型
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const worldWorker = new Worker('./worldWorker.js', { type: 'module' });
const pendingChunks = new Set();
const chunkBuildQueue = [];
const animalSystem = createAnimalSystem({
    scene,
    camera,
    getNearbyBlocks,
    getSurfaceHeightApprox,
    onAnimalDeath: (itemId, position) => {
        const amount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < amount; i++) {
            dropSystem.spawnDrop(itemId, position.x, position.y + i * 0.08, position.z);
        }
    }
});

const zombies = [];
let zombieSpawnTimer = 0;
const creepers = [];
let creeperSpawnTimer = 0;

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton.classList.toggle('selected', peaceful);
    peacefulModeButton.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton.classList.toggle('selected', !peaceful);
    survivalModeButton.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton.classList.toggle('selected', peaceful);
    peacefulModeButton.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton.classList.toggle('selected', !peaceful);
    survivalModeButton.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton?.classList.toggle('selected', peaceful);
    peacefulModeButton?.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton?.classList.toggle('selected', !peaceful);
    survivalModeButton?.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton?.classList.toggle('selected', peaceful);
    peacefulModeButton?.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton?.classList.toggle('selected', !peaceful);
    survivalModeButton?.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function clearPeacefulModeZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton?.classList.toggle('selected', peaceful);
    peacefulModeButton?.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton?.classList.toggle('selected', !peaceful);
    survivalModeButton?.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearPeacefulModeZombies();
}

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton?.classList.toggle('selected', peaceful);
    peacefulModeButton?.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton?.classList.toggle('selected', !peaceful);
    survivalModeButton?.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function clearZombies() {
    for (const zombie of zombies) scene.remove(zombie);
    zombies.length = 0;
    zombieSpawnTimer = 0;
}

function setGameMode(mode) {
    gameMode = mode === 'peaceful' ? 'peaceful' : 'survival';
    const peaceful = gameMode === 'peaceful';
    peacefulModeButton?.classList.toggle('selected', peaceful);
    peacefulModeButton?.setAttribute('aria-pressed', String(peaceful));
    survivalModeButton?.classList.toggle('selected', !peaceful);
    survivalModeButton?.setAttribute('aria-pressed', String(!peaceful));
    if (peaceful) clearZombies();
}

function createZombie(x, y, z) {
    const zGroup = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0x7dbb7d });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x2a5f8e });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3b2f7a });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), skin);
    head.position.y = 1.55;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.3), cloth);
    body.position.y = 1.02;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skin);
    armL.position.set(-0.4, 1.03, 0.1);
    const armR = armL.clone(); armR.position.x = 0.4;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), pants);
    legL.position.set(-0.16, 0.32, 0);
    const legR = legL.clone(); legR.position.x = 0.16;
    zGroup.add(head, body, armL, armR, legL, legR);
    zGroup.position.set(x, y, z);
    zGroup.userData = { health: 5, hitCooldown: 0, velocityY: 0, phase: Math.random() * Math.PI * 2, arms: [armL, armR], legs: [legL, legR], canJump: true };
    return zGroup;
}

function spawnZombieNearPlayer() {
    for (let t = 0; t < 8; t++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 18;
        const x = Math.floor(camera.position.x + Math.cos(ang) * dist) + 0.5;
        const z = Math.floor(camera.position.z + Math.sin(ang) * dist) + 0.5;
        const near = getNearbyBlocks(x, z, 2);
        const approx = getSurfaceHeightApprox(Math.round(x), Math.round(z));
        const g = getGroundAt(x, z, near, 0.34, approx + 1.5);
        if (g === -999) continue;
        const wall = checkWall(x, g + 1.1, z, near, 0.34);
        if (wall) continue;
        const zombie = createZombie(x, g, z);
        scene.add(zombie);
        zombies.push(zombie);
        return;
    }
}

function updateZombies(dt) {
    if (gameMode === 'peaceful') return;
    zombieSpawnTimer += dt;
    if (zombieSpawnTimer >= 30) {
        zombieSpawnTimer = 0;
        spawnZombieNearPlayer();
    }
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        const d = z.userData;
        d.hitCooldown = Math.max(0, d.hitCooldown - dt);
        const toPlayer = new THREE.Vector3(camera.position.x - z.position.x, 0, camera.position.z - z.position.z);
        const horizontalDist = toPlayer.length();
        if (horizontalDist > 0.001) toPlayer.normalize();
        const speed = 1.8;
        const minPlayerGap = 1.05;
        const chaseDist = Math.max(0, horizontalDist - minPlayerGap);
        const step = Math.min(chaseDist, speed * dt);
        const nx = z.position.x + toPlayer.x * step;
        const nz = z.position.z + toPlayer.z * step;
        const near = getNearbyBlocks(z.position.x, z.position.z, 3);
        const nearAhead = getNearbyBlocks(nx, nz, 3);
        const blocked = checkWall(nx, z.position.y + 1.1, nz, nearAhead, 0.34);
        const currentGround = getGroundAt(z.position.x, z.position.z, near, 0.34, z.position.y + 0.8);
        const gy = getGroundAt(nx, nz, nearAhead, 0.34, z.position.y + 1.2);
        const heightDiff = currentGround !== -999 && gy !== -999 ? (gy - currentGround) : 0;
        const canStep = currentGround !== -999 && gy !== -999 && heightDiff <= 1.05;
        const canJumpUp = currentGround !== -999 && gy !== -999 && heightDiff > 0.7 && heightDiff <= 1.6;
        if (!blocked && gy !== -999 && canStep) {
            z.position.x = nx; z.position.z = nz; z.position.y = gy;
        } else if (canJumpUp && d.canJump) {
            d.velocityY = 9.5;
            d.canJump = false;
            z.position.x += toPlayer.x * 0.32;
            z.position.z += toPlayer.z * 0.32;
        }

        if (currentGround !== -999) d.velocityY -= 28 * dt;
        z.position.y += d.velocityY * dt;
        const feetY = z.position.y + 0.1;
        const gNow = getGroundAt(z.position.x, z.position.z, near, 0.34, feetY);
        if (gNow !== -999 && z.position.y <= gNow) {
            z.position.y = gNow;
            d.velocityY = 0;
            d.canJump = true;
        }
        d.phase += dt * 8;
        d.legs[0].rotation.x = Math.sin(d.phase) * 0.5;
        d.legs[1].rotation.x = Math.sin(d.phase + Math.PI) * 0.5;
        d.arms[0].rotation.x = Math.sin(d.phase + Math.PI) * 0.35;
        d.arms[1].rotation.x = Math.sin(d.phase) * 0.35;
        z.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

        const playerCenterY = camera.position.y - currentHeight * 0.5;
        const zombieCenterY = z.position.y + 0.9;
        const verticalDist = playerCenterY - zombieCenterY;
        const attackDistance = Math.hypot(
            camera.position.x - z.position.x,
            verticalDist,
            camera.position.z - z.position.z
        );
        if (attackDistance < 1.55 && d.hitCooldown <= 0) {
            d.hitCooldown = 0.9;
            damagePlayer(3, 'zombie');
            velocity.x += toPlayer.x * 11.5;
            velocity.z += toPlayer.z * 11.5;
            velocity.y += 5.2;
        }
        const dx = z.position.x - camera.position.x;
        const dz = z.position.z - camera.position.z;
        if (dx * dx + dz * dz > 150 * 150) {
            scene.remove(z); zombies.splice(i, 1);
        }
    }
}

function createCreeper(x, y, z) {
    const group = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x55a832 });
    const darkGreen = new THREE.MeshLambertMaterial({ color: 0x397a25 });
    const face = new THREE.MeshLambertMaterial({ color: 0x172617 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), green);
    head.position.y = 1.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.42), darkGreen);
    body.position.y = 0.75;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), face);
    eyeL.position.set(-0.17, 1.62, -0.375);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.17;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.03), face);
    mouth.position.set(0, 1.38, -0.375);
    const legs = [];
    for (const [lx, lz] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), green);
        leg.position.set(lx, 0.21, lz);
        legs.push(leg);
    }
    group.add(head, body, eyeL, eyeR, mouth, ...legs);
    group.position.set(x, y, z);
    group.userData = {
        health: 4,
        hitCooldown: 0,
        velocityY: 0,
        canJump: true,
        phase: Math.random() * Math.PI * 2,
        fuse: 0,
        legs
    };
    return group;
}

function spawnCreeperNearPlayer() {
    for (let attempt = 0; attempt < 8; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 14 + Math.random() * 18;
        const x = Math.floor(camera.position.x + Math.cos(angle) * distance) + 0.5;
        const z = Math.floor(camera.position.z + Math.sin(angle) * distance) + 0.5;
        const nearby = getNearbyBlocks(x, z, 2);
        const approximateY = getSurfaceHeightApprox(Math.round(x), Math.round(z));
        const groundY = getGroundAt(x, z, nearby, 0.34, approximateY + 1.5);
        if (groundY === -999 || checkWall(x, groundY + 1.1, z, nearby, 0.34)) continue;
        const creeper = createCreeper(x, groundY, z);
        scene.add(creeper);
        creepers.push(creeper);
        return;
    }
}

function removeCreeper(target) {
    const index = creepers.indexOf(target);
    if (index < 0) return false;
    scene.remove(target);
    creepers.splice(index, 1);
    return true;
}

function explodeCreeper(creeper) {
    const distance = creeper.position.distanceTo(camera.position);
    if (distance < 5) {
        const strength = Math.max(0, 1 - distance / 5);
        damagePlayer(Math.max(2, Math.ceil(12 * strength)), 'creeper');
        const away = new THREE.Vector3(
            camera.position.x - creeper.position.x,
            0,
            camera.position.z - creeper.position.z
        );
        if (away.lengthSq() > 0.0001) away.normalize();
        velocity.x += away.x * 15 * strength;
        velocity.z += away.z * 15 * strength;
        velocity.y += 7 * strength;
    }
    removeCreeper(creeper);
}

function updateCreepers(dt) {
    creeperSpawnTimer += dt;
    if (creeperSpawnTimer >= 45) {
        creeperSpawnTimer = 0;
        if (creepers.length < 4) spawnCreeperNearPlayer();
    }
    for (let i = creepers.length - 1; i >= 0; i--) {
        const creeper = creepers[i];
        const data = creeper.userData;
        data.hitCooldown = Math.max(0, data.hitCooldown - dt);
        const toPlayer = new THREE.Vector3(
            camera.position.x - creeper.position.x,
            0,
            camera.position.z - creeper.position.z
        );
        const horizontalDistance = toPlayer.length();
        if (horizontalDistance > 0.001) toPlayer.normalize();

        const playerCenterY = camera.position.y - currentHeight * 0.5;
        const distanceToPlayer = Math.hypot(
            camera.position.x - creeper.position.x,
            playerCenterY - (creeper.position.y + 0.9),
            camera.position.z - creeper.position.z
        );
        if (distanceToPlayer < 2.8) {
            data.fuse += dt;
            const pulse = 1 + Math.sin(data.fuse * 22) * Math.min(0.08, data.fuse * 0.04);
            creeper.scale.set(pulse, 1 + (pulse - 1) * 1.8, pulse);
            if (data.fuse >= 1.5) {
                explodeCreeper(creeper);
                continue;
            }
        } else {
            data.fuse = Math.max(0, data.fuse - dt * 2);
            creeper.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 10));
            const step = Math.min(Math.max(0, horizontalDistance - 1.8), 1.45 * dt);
            const nextX = creeper.position.x + toPlayer.x * step;
            const nextZ = creeper.position.z + toPlayer.z * step;
            const nearby = getNearbyBlocks(creeper.position.x, creeper.position.z, 3);
            const ahead = getNearbyBlocks(nextX, nextZ, 3);
            const currentGround = getGroundAt(creeper.position.x, creeper.position.z, nearby, 0.34, creeper.position.y + 0.8);
            const nextGround = getGroundAt(nextX, nextZ, ahead, 0.34, creeper.position.y + 1.2);
            const heightDifference = currentGround !== -999 && nextGround !== -999 ? nextGround - currentGround : 0;
            const blocked = checkWall(nextX, creeper.position.y + 1.1, nextZ, ahead, 0.34);
            if (!blocked && nextGround !== -999 && heightDifference <= 1.05) {
                creeper.position.set(nextX, nextGround, nextZ);
            } else if (heightDifference > 0.7 && heightDifference <= 1.6 && data.canJump) {
                data.velocityY = 9.5;
                data.canJump = false;
            }
            if (currentGround !== -999) data.velocityY -= 28 * dt;
            creeper.position.y += data.velocityY * dt;
            const groundNow = getGroundAt(creeper.position.x, creeper.position.z, nearby, 0.34, creeper.position.y + 0.1);
            if (groundNow !== -999 && creeper.position.y <= groundNow) {
                creeper.position.y = groundNow;
                data.velocityY = 0;
                data.canJump = true;
            }
        }

        data.phase += dt * 7;
        for (let legIndex = 0; legIndex < data.legs.length; legIndex++) {
            data.legs[legIndex].rotation.x = Math.sin(data.phase + (legIndex % 2) * Math.PI) * 0.45;
        }
        creeper.rotation.y = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
        const dx = creeper.position.x - camera.position.x;
        const dz = creeper.position.z - camera.position.z;
        if (dx * dx + dz * dz > 150 * 150) removeCreeper(creeper);
    }
}

const dropSystem = createDropSystem({
    scene,
    camera,
    inventory,
    getNearbyBlocks,
    getMaterials,
    onInventoryUpdated: () => {
        renderHotbar();
        renderHeldItemInHand();
        if (inventoryOpen) { renderInventory(); renderCrafting(); }
    },
    getPlayerFeetY: () => camera.position.y - currentHeight
});

function removeZombie(target) {
    const index = zombies.indexOf(target);
    if (index < 0) return false;
    scene.remove(target);
    zombies.splice(index, 1);
    return true;
}

function recoverVolleyball(position) {
    dropSystem.spawnDrop('volleyball', position.x, position.y, position.z);
}

function launchVolleyball(charge) {
    const selectedSlot = inventory.getSlots(27, 36)[selectedIdx];
    if (!selectedSlot || selectedSlot.itemId !== 'volleyball') return;
    if (!inventory.remove('volleyball', 1)) return;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();
    const ballMaterial = getMaterials('volleyball')[0];
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), ballMaterial);
    ball.position.copy(camera.position).addScaledVector(direction, 0.7);
    ball.userData.velocity = direction.multiplyScalar(8 + charge * 20);
    ball.userData.velocity.y += 1.5 + charge * 2.5;
    ball.userData.age = 0;
    scene.add(ball);
    volleyballProjectiles.push(ball);
    renderHotbar();
    renderHeldItemInHand();
}

function finishVolleyballProjectile(index, position) {
    const ball = volleyballProjectiles[index];
    if (!ball) return;
    scene.remove(ball);
    volleyballProjectiles.splice(index, 1);
    recoverVolleyball(position);
}

function updateVolleyballProjectiles(dt) {
    for (let i = volleyballProjectiles.length - 1; i >= 0; i--) {
        const ball = volleyballProjectiles[i];
        const previous = ball.position.clone();
        ball.userData.age += dt;
        ball.userData.velocity.y -= 12 * dt;
        ball.position.addScaledVector(ball.userData.velocity, dt);
        ball.rotation.x += dt * 9;
        ball.rotation.z += dt * 7;

        const travel = ball.position.clone().sub(previous);
        const travelDistance = travel.length();
        if (travelDistance > 0.0001) {
            const raycaster = new THREE.Raycaster(previous, travel.normalize(), 0, travelDistance + 0.25);
            const nearbyBlocks = getNearbyBlocks(ball.position.x, ball.position.z, 2);
            if (raycaster.intersectObjects(nearbyBlocks).length > 0) {
                finishVolleyballProjectile(i, previous);
                continue;
            }
        }

        let hitMob = false;
        for (const animal of [...animalSystem.getAnimals()]) {
            const center = animal.position.clone().add(new THREE.Vector3(0, 0.8, 0));
            if (center.distanceToSquared(ball.position) > 0.85 * 0.85) continue;
            const direction = ball.userData.velocity.clone().setY(0);
            animalSystem.damageAnimal(animal, 999, direction);
            hitMob = true;
            break;
        }
        if (!hitMob) {
            for (const zombie of [...zombies]) {
                const center = zombie.position.clone().add(new THREE.Vector3(0, 0.9, 0));
                if (center.distanceToSquared(ball.position) > 0.85 * 0.85) continue;
                removeZombie(zombie);
                hitMob = true;
                break;
            }
        }
        if (hitMob) {
            finishVolleyballProjectile(i, ball.position.clone());
            continue;
        }
        if (ball.userData.age >= 8 || ball.position.y < -20) {
            finishVolleyballProjectile(i, ball.position.clone());
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
    const sx = x + (worldSeed % 997);
    const sz = z + (Math.floor(worldSeed / 997) % 991);
    let mountain = Math.sin(sx * 0.05) * Math.cos(sz * 0.05) * 5;
    let hills = Math.sin(sx * 0.15) * Math.sin(sz * 0.15) * 2;
    let detail = Math.sin(sx * 0.4) * Math.cos(sz * 0.4) * 0.5;
    return Math.round(mountain + hills + detail);
}

// 挖掘原始地形後只補出正下方的石頭，避免每次挖掘向六面擴張出石頭群。
function updateNeighbors(x, y, z) {
    const directions = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
    ];

    directions.forEach(([dx, dy, dz]) => {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const neighborKey = `${nx},${ny},${nz}`;

        if (removedBlocks.has(neighborKey)) return;
        if (ny > getSurfaceHeightApprox(nx, nz) || ny < -20) return;
        if (blockByPos.has(posKey(nx, ny, nz))) return;

        const m = new THREE.Mesh(boxGeo, getMaterials('stone'));
        m.userData.blockType = 'stone';
        m.position.set(nx, ny, nz);
        addBlockMesh(m);
    });
    renderHeldItemInHand();
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
        removedBlocks: Array.from(removedBlocks),
        worldSeed
    });
    renderHeldItemInHand();
}

worldWorker.onmessage = (event) => {
    const { type, key, blocks: blockData } = event.data;
    if (type !== 'chunk_generated') return;
    pendingChunks.delete(key);
    if (loadedChunks.has(key) || chunkBuildQueue.some(chunk => chunk.key === key)) return;
    chunkBuildQueue.push({ key, blockData });
};

function flushChunkBuildQueue(maxChunksPerFrame = 1) {
    for (let i = 0; i < maxChunksPerFrame && chunkBuildQueue.length > 0; i++) {
        const { key, blockData } = chunkBuildQueue.shift();
        if (loadedChunks.has(key)) continue;
        const chunkBlocks = [];
        for (const data of blockData) {
            const key = posKey(data.x, data.y, data.z);
            if (placedBlocks.has(key) || removedBlocks.has(key)) continue;
            const m = new THREE.Mesh(boxGeo, getMaterials(data.type));
            m.userData.blockType = data.type;
            m.position.set(data.x, data.y, data.z);
            if (addBlockMesh(m)) chunkBlocks.push(m);
        }
        const [cx, cz] = key.split(',').map(Number);
        for (const [positionKey, blockType] of placedBlocks) {
            const [x, y, z] = positionKey.split(',').map(Number);
            if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) continue;
            const m = new THREE.Mesh(boxGeo, getMaterials(blockType));
            m.userData.blockType = blockType;
            m.userData.playerPlaced = true;
            m.position.set(x, y, z);
            if (addBlockMesh(m)) chunkBlocks.push(m);
        }
        loadedChunks.set(key, chunkBlocks);
    }
}

const generationQueue = [];
function updateWorld() {
    const worldX = isThirdPerson ? playerAnchor.x : camera.position.x;
    const worldZ = isThirdPerson ? playerAnchor.z : camera.position.z;
    const px = Math.floor(worldX / CHUNK_SIZE);
    const pz = Math.floor(worldZ / CHUNK_SIZE);
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
    renderHeldItemInHand();
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

function playHandSwing() {
    if (!controls.isLocked || inventoryOpen) return;
    fpHandEl.classList.remove('swing');
    void fpHandEl.offsetWidth;
    fpHandEl.classList.add('swing');
}

function renderHeldItemInHand() {
    const selectedSlot = inventory.getSlots(27, 36)[selectedIdx];
    if (!selectedSlot) {
        fpHeldItemEl.style.backgroundImage = '';
        fpHandEl.classList.remove('has-item');
        return;
    }
    fpHeldItemEl.style.backgroundImage = `url(${itemIconDataUrl[selectedSlot.itemId] || ''})`;
    fpHandEl.classList.add('has-item');
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
    renderHeldItemInHand();
}
renderHotbar();
renderEquipment();
updateSelection(0);
renderHeldItemInHand();
renderSurvivalHud();

// --- D. 控制與點擊 ---
controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
    crosshair.style.display = inventoryOpen ? 'none' : 'block';
    hotbar.style.display = 'flex';
    survivalHudEl.style.display = 'flex';
    fpHandEl.style.display = (inventoryOpen || isThirdPerson) ? 'none' : 'block';
    playerModel.visible = isThirdPerson;
});
controls.addEventListener('unlock', () => {
    leftMouseDown = false;
    rightMouseDown = false;
    cancelMining();
    cancelEating();
    cancelThrowCharge();
    if (unlockingForInventory) {
        unlockingForInventory = false;
        overlay.style.display = 'none';
        crosshair.style.display = 'none';
        hotbar.style.display = 'flex';
        survivalHudEl.style.display = 'flex';
        fpHandEl.style.display = 'none';
        return;
    }
    overlay.style.display = 'flex';
    crosshair.style.display = 'none';
    hotbar.style.display = 'none';
    survivalHudEl.style.display = 'none';
    fpHandEl.style.display = 'none';
    playerModel.visible = false;
});

const velocity = new THREE.Vector3();
const playerRadius = 0.35;
let canJump = false, isCrouching = false, currentHeight = 1.8;
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
    if (e.code === 'KeyQ') {
        if (e.repeat) return;
        const now = performance.now();
        if (now - lastViewToggleAt < 180) return;
        lastViewToggleAt = now;
        const d = new THREE.Vector3();
        camera.getWorldDirection(d);
        d.y = 0;
        if (d.lengthSq() > 0.0001) {
            d.normalize();
            thirdPersonYaw = Math.atan2(d.x, d.z);
        }
        const nextThirdPerson = !isThirdPerson;
        if (!nextThirdPerson) {
            thirdPersonYaw += Math.PI;
            camera.position.set(playerAnchor.x, playerAnchor.y + currentHeight, playerAnchor.z);
            velocity.y = 0;
            canJump = true;
        }
        isThirdPerson = nextThirdPerson;
        playerModel.visible = isThirdPerson && controls.isLocked;
        fpHandEl.style.display = (!isThirdPerson && controls.isLocked && !inventoryOpen) ? 'block' : 'none';
        return;
    }
    if (e.code === 'Space' && canJump) {
        const px = isThirdPerson ? playerAnchor.x : camera.position.x;
        const pz = isThirdPerson ? playerAnchor.z : camera.position.z;
        const feetY = isThirdPerson ? playerAnchor.y : (camera.position.y - currentHeight);
        const near = getNearbyBlocks(px, pz, 2);
        const blockedHead = checkCapsuleWall(px, feetY + 0.05, pz, near, playerRadius, currentHeight + 0.2);
        if (!blockedHead) {
            velocity.y += 9.5;
            canJump = false;
            addExhaustion(0.35);
        }
    }
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

function getCenterRayHits() {
    const raycaster = new THREE.Raycaster();
    raycaster.far = 5;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const interactableBlocks = getNearbyBlocks(camera.position.x, camera.position.z, 5);
    return {
        blocks: raycaster.intersectObjects(interactableBlocks),
        zombies: raycaster.intersectObjects(zombies, true),
        animals: raycaster.intersectObjects(animalSystem.getAnimals(), true)
    };
}

function findRootInCollection(object, collection) {
    let current = object;
    while (current) {
        if (collection.includes(current)) return current;
        current = current.parent;
    }
    return null;
}

function cancelMining() {
    miningState = null;
    miningProgressFillEl.style.width = '0%';
    miningProgressEl.style.display = 'none';
}

function beginMining(mesh) {
    miningState = {
        mesh,
        key: posKey(Math.round(mesh.position.x), Math.round(mesh.position.y), Math.round(mesh.position.z)),
        elapsed: 0,
        duration: miningDuration(mesh.userData.blockType || 'stone')
    };
    miningProgressFillEl.style.width = '0%';
    miningProgressEl.style.display = 'block';
}

function finishMining(mesh) {
    if (!mesh || !blocks.includes(mesh)) {
        cancelMining();
        return;
    }
    const pos = mesh.position.clone();
    const blockType = mesh.userData.blockType || 'stone';
    removedBlocks.add(`${pos.x},${pos.y},${pos.z}`);
    dropSystem.spawnDrop(blockType, pos.x, pos.y, pos.z);
    removeBlockMesh(mesh);
    updateNeighbors(pos.x, pos.y, pos.z);
    addExhaustion(0.08);
    cancelMining();
}

function updateMining(dt, now) {
    if (!leftMouseDown || !controls.isLocked || inventoryOpen) {
        cancelMining();
        return;
    }
    const hits = getCenterRayHits();
    if (hits.zombies.length > 0 && (!hits.blocks.length || hits.zombies[0].distance < hits.blocks[0].distance)) {
        cancelMining();
        return;
    }
    if (hits.animals.length > 0 && (!hits.blocks.length || hits.animals[0].distance < hits.blocks[0].distance)) {
        cancelMining();
        return;
    }
    const target = hits.blocks[0]?.object;
    if (!target) {
        cancelMining();
        return;
    }
    const key = posKey(Math.round(target.position.x), Math.round(target.position.y), Math.round(target.position.z));
    if (!miningState || miningState.key !== key) beginMining(target);
    miningState.elapsed += dt;
    miningState.duration = miningDuration(target.userData.blockType || 'stone');
    const progress = Math.min(1, miningState.elapsed / miningState.duration);
    miningProgressFillEl.style.width = `${progress * 100}%`;
    if (now - lastMiningSwingAt > 260) {
        lastMiningSwingAt = now;
        playHandSwing();
    }
    if (progress >= 1) finishMining(target);
}

function cancelEating() {
    eatingState = null;
    eatingProgressFillEl.style.width = '0%';
    eatingProgressEl.style.display = 'none';
}

function beginEating() {
    const itemId = selectedItemId();
    if (!foodValues[itemId] || playerHunger >= MAX_HUNGER) return false;
    eatingState = { itemId, elapsed: 0, duration: 1.45 };
    eatingProgressFillEl.style.width = '0%';
    eatingProgressEl.style.display = 'block';
    return true;
}

function finishEating() {
    if (!eatingState) return;
    const selectedSlot = inventory.getSlots(27, 36)[selectedIdx];
    if (!selectedSlot || selectedSlot.itemId !== eatingState.itemId) {
        cancelEating();
        return;
    }
    const foodValue = foodValues[eatingState.itemId] || 0;
    if (foodValue <= 0 || playerHunger >= MAX_HUNGER) {
        cancelEating();
        return;
    }
    inventory.remove(eatingState.itemId, 1);
    playerHunger = Math.min(MAX_HUNGER, playerHunger + foodValue);
    hungerExhaustion = Math.max(0, hungerExhaustion - 1);
    renderSurvivalHud();
    renderHotbar();
    if (inventoryOpen) renderInventory();
    cancelEating();
}

function updateEating(dt, now) {
    if (!rightMouseDown || !controls.isLocked || inventoryOpen || !eatingState) {
        cancelEating();
        return;
    }
    if (selectedItemId() !== eatingState.itemId || playerHunger >= MAX_HUNGER) {
        cancelEating();
        return;
    }
    eatingState.elapsed += dt;
    const progress = Math.min(1, eatingState.elapsed / eatingState.duration);
    eatingProgressFillEl.style.width = `${progress * 100}%`;
    if (now - lastEatingSwingAt > 220) {
        lastEatingSwingAt = now;
        playHandSwing();
    }
    if (progress >= 1) finishEating();
}

function cancelThrowCharge() {
    throwChargeState = null;
    throwProgressFillEl.style.width = '0%';
    throwProgressEl.style.display = 'none';
}

function beginThrowCharge() {
    if (selectedItemId() !== 'volleyball') return false;
    throwChargeState = { elapsed: 0, maxDuration: 2 };
    throwProgressFillEl.style.width = '0%';
    throwProgressEl.style.display = 'block';
    return true;
}

function updateThrowCharge(dt) {
    if (!rightMouseDown || !controls.isLocked || inventoryOpen || !throwChargeState) {
        cancelThrowCharge();
        return;
    }
    if (selectedItemId() !== 'volleyball') {
        cancelThrowCharge();
        return;
    }
    throwChargeState.elapsed = Math.min(
        throwChargeState.maxDuration,
        throwChargeState.elapsed + dt
    );
    const charge = throwChargeState.elapsed / throwChargeState.maxDuration;
    throwProgressFillEl.style.width = `${charge * 100}%`;
}

function releaseThrowCharge() {
    if (!throwChargeState) return;
    const charge = Math.max(
        0.08,
        Math.min(1, throwChargeState.elapsed / throwChargeState.maxDuration)
    );
    launchVolleyball(charge);
    cancelThrowCharge();
}

window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    playHandSwing();
    if (e.button === 2 && selectedItemId() === 'volleyball') {
        rightMouseDown = beginThrowCharge();
        return;
    }
    if (e.button === 2 && foodValues[selectedItemId()]) {
        rightMouseDown = beginEating();
        return;
    }
    const hits = getCenterRayHits();
    const intersects = hits.blocks;
    const zombieHits = hits.zombies;
    const animalHits = hits.animals;
    if (zombieHits.length > 0 && e.button === 0) {
        const nearestAnimalDistance = animalHits[0]?.distance ?? Infinity;
        if (intersects.length > 0 && intersects[0].distance < zombieHits[0].distance && intersects[0].distance < nearestAnimalDistance) {
            leftMouseDown = true;
            beginMining(intersects[0].object);
            return;
        }
        if (nearestAnimalDistance < zombieHits[0].distance) {
            const animal = findRootInCollection(animalHits[0].object, animalSystem.getAnimals());
            if (animal) {
                const away = new THREE.Vector3(animal.position.x - camera.position.x, 0, animal.position.z - camera.position.z);
                animalSystem.damageAnimal(animal, selectedItemId() === 'volleyball' ? 999 : 1, away);
                return;
            }
        }
        const zombieRoot = zombieHits[0].object.parent;
        const target = zombies.find(z => z === zombieRoot || z.children.includes(zombieHits[0].object));
        if (target) {
            const idx = zombies.indexOf(target);
            const away = new THREE.Vector3(target.position.x - camera.position.x, 0, target.position.z - camera.position.z);
            if (away.lengthSq() > 0.0001) away.normalize();
            target.position.x += away.x * 1.9;
            target.position.z += away.z * 1.9;
            target.userData.velocityY = Math.max(target.userData.velocityY || 0, 4.8);
            target.userData.health -= selectedItemId() === 'volleyball' ? 999 : 1;
            if (target.userData.health <= 0 && idx >= 0) {
                removeZombie(target);
            }
            return;
        }
    }
    if (animalHits.length > 0 && e.button === 0) {
        const nearestBlockDistance = intersects[0]?.distance ?? Infinity;
        const nearestZombieDistance = zombieHits[0]?.distance ?? Infinity;
        if (animalHits[0].distance < nearestBlockDistance && animalHits[0].distance < nearestZombieDistance) {
            const animal = findRootInCollection(animalHits[0].object, animalSystem.getAnimals());
            if (animal) {
                const away = new THREE.Vector3(
                    animal.position.x - camera.position.x,
                    0,
                    animal.position.z - camera.position.z
                );
                animalSystem.damageAnimal(animal, selectedItemId() === 'volleyball' ? 999 : 1, away);
                return;
            }
        }
    }
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const pos = intersect.object.position.clone();
        if (e.button === 0) { // 挖掘
            leftMouseDown = true;
            beginMining(intersect.object);
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
            renderEquipment();
            renderQuickCraft();
            const placePos = pos.add(intersect.face.normal);
            b.position.copy(placePos);
            const key = posKey(Math.round(placePos.x), Math.round(placePos.y), Math.round(placePos.z));
            b.userData.playerPlaced = true;
            if (addBlockMesh(b)) {
                placedBlocks.set(key, selectedSlot.itemId);
                removedBlocks.delete(key);
            }
        }
    }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        leftMouseDown = false;
        cancelMining();
    }
    if (e.button === 2) {
        releaseThrowCharge();
        rightMouseDown = false;
        cancelEating();
    }
});
window.addEventListener('blur', () => {
    leftMouseDown = false;
    rightMouseDown = false;
    cancelMining();
    cancelEating();
    cancelThrowCharge();
});
window.addEventListener('mousemove', (e) => {
    if (!controls.isLocked || !isThirdPerson) return;
    thirdPersonYaw -= e.movementX * 0.0025;
    thirdPersonPitch = Math.max(-0.9, Math.min(0.55, thirdPersonPitch - e.movementY * 0.0018));
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


function tickFurnaces(dt) {
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
}

// --- E. 燈光與遊戲循環 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(10, 20, 10);
scene.add(sun);
const initialPlayerPosition = { x: 0, y: 30, z: 0 };
camera.position.set(initialPlayerPosition.x, initialPlayerPosition.y, initialPlayerPosition.z);

const playerAnchor = new THREE.Vector3(
    initialPlayerPosition.x,
    initialPlayerPosition.y - 1.8,
    initialPlayerPosition.z
);
const thirdPersonDistance = 4.2;
const thirdPersonFrontDistance = 3.2;
const playerFacingDir = new THREE.Vector3(0, 0, 1);
const daySkyColor = new THREE.Color(0x79b9e8);
const sunsetSkyColor = new THREE.Color(0xc98262);
const nightSkyColor = new THREE.Color(0x071326);
const blendedSkyColor = new THREE.Color();

function updateDayNight(dt) {
    worldTime = (worldTime + dt) % DAY_NIGHT_CYCLE;
    const isDayHalf = worldTime < DAY_DURATION;
    const halfProgress = isDayHalf
        ? worldTime / DAY_DURATION
        : (worldTime - DAY_DURATION) / NIGHT_DURATION;
    const daylight = isDayHalf
        ? Math.sin(halfProgress * Math.PI)
        : 0;
    const transition = isDayHalf
        ? Math.min(1, daylight * 2.5)
        : Math.max(0, Math.cos(halfProgress * Math.PI) * 0.18);
    const horizonTint = isDayHalf ? Math.min(1, Math.abs(halfProgress - 0.5) * 2) : 0;

    blendedSkyColor.copy(nightSkyColor).lerp(daySkyColor, transition);
    if (isDayHalf && horizonTint > 0.72) {
        blendedSkyColor.lerp(sunsetSkyColor, (horizonTint - 0.72) * 0.35);
    }
    scene.background.copy(blendedSkyColor);
    scene.fog.color.copy(blendedSkyColor);
    scene.fog.density = THREE.MathUtils.lerp(0.085, 0.022, transition);
    ambientLight.intensity = THREE.MathUtils.lerp(0.14, 0.72, transition);
    sun.intensity = THREE.MathUtils.lerp(0.05, 0.85, daylight);

    const cycleAngle = (worldTime / DAY_NIGHT_CYCLE) * Math.PI * 2 - Math.PI / 2;
    sun.position.set(Math.cos(cycleAngle) * 40, Math.sin(cycleAngle) * 45, 18);
}

function createPlayerModel() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0b18d });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x39a0ff });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3f4a5d });
    const faceTex = new THREE.TextureLoader().load('./player-face.png');
    faceTex.magFilter = THREE.NearestFilter;
    faceTex.minFilter = THREE.NearestFilter;
    const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
    const headMats = [skin, skin, skin, skin, faceMat, faceMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), headMats);
    head.position.y = 1.55;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.3), shirt);
    body.position.y = 1.02;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skin);
    armL.position.set(-0.4, 1.03, 0);
    const armR = armL.clone();
    armR.position.x = 0.4;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), pants);
    legL.position.set(-0.16, 0.32, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(head, body, armL, armR, legL, legR);
    g.userData = {
        head,
        armL,
        armR,
        legL,
        legR,
        walkPhase: 0,
        lastPos: new THREE.Vector3()
    };
    g.visible = false;
    return g;
}

const playerModel = createPlayerModel();
scene.add(playerModel);

let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const t = performance.now();
    const dt = Math.min((t - prevT) / 1000, 0.05);
    prevT = t;
    tickFurnaces(dt);
    if (inventoryOpen && craftingMode === "furnace") renderFurnace();
    updateWorld();
    processQueue();
    flushChunkBuildQueue();

    if (controls.isLocked) {
        updateDayNight(dt);
        if (isThirdPerson) {
            camera.position.set(playerAnchor.x, playerAnchor.y + currentHeight, playerAnchor.z);
        }
        dropSystem.updateDrops(dt);
        animalSystem.spawnAnimalsNearPlayer();
        animalSystem.updateAnimals(dt);
        updateZombies(dt);
        updateMining(dt, t);
        updateEating(dt, t);
        updateThrowCharge(dt);
        updateVolleyballProjectiles(dt);

        const targetH = isCrouching ? 1.2 : 1.8;
        currentHeight += (targetH - currentHeight) * 0.2;
        velocity.x -= velocity.x * 10 * dt;
        velocity.z -= velocity.z * 10 * dt;
        
        const feetY = camera.position.y - currentHeight;
        const nearbyGroundBlocks = getNearbyBlocks(camera.position.x, camera.position.z);
        const groundH = getGroundAt(camera.position.x, camera.position.z, nearbyGroundBlocks, playerRadius, feetY);

        if (groundH === -999) { velocity.y = 0; }
        else { velocity.y -= 28 * dt; }

        const forward = new THREE.Vector3();
        if (isThirdPerson) {
            forward.set(Math.sin(thirdPersonYaw), 0, Math.cos(thirdPersonYaw));
        } else {
            camera.getWorldDirection(forward);
            forward.y = 0;
            if (forward.lengthSq() < 0.0001) forward.set(playerFacingDir.x, 0, playerFacingDir.z);
        }
        forward.normalize();
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
            if (!isThirdPerson) playerFacingDir.copy(moveDir).normalize();
        }

        const nextX = camera.position.x + velocity.x * dt;
        if (!checkCapsuleWall(nextX, feetY + 0.05, camera.position.z, nearbyGroundBlocks, playerRadius, currentHeight - 0.1)) {
            if (getGroundAt(nextX, camera.position.z, nearbyGroundBlocks, playerRadius, feetY) !== -999) camera.position.x = nextX;
        }
        const nextZ = camera.position.z + velocity.z * dt;
        if (!checkCapsuleWall(camera.position.x, feetY + 0.05, nextZ, nearbyGroundBlocks, playerRadius, currentHeight - 0.1)) {
            if (getGroundAt(camera.position.x, nextZ, nearbyGroundBlocks, playerRadius, feetY) !== -999) camera.position.z = nextZ;
        }
        camera.position.y += velocity.y * dt;
        const newFeetY = camera.position.y - currentHeight;
        const hitCeiling = checkCapsuleWall(camera.position.x, newFeetY + 0.05, camera.position.z, nearbyGroundBlocks, playerRadius, currentHeight - 0.1);
        if (velocity.y > 0 && hitCeiling) {
            velocity.y = 0;
            camera.position.y = Math.floor(camera.position.y) - 0.01;
        }
        if (groundH !== -999 && camera.position.y - currentHeight <= groundH) {
            if (!ignoreFallDamageUntilGround && wasAirborne && peakFallSpeed > 13.5) {
                const fallDamage = Math.floor((peakFallSpeed - 11.5) / 2);
                damagePlayer(fallDamage, 'fall');
            }
            velocity.y = 0; camera.position.y = groundH + currentHeight; canJump = true;
            ignoreFallDamageUntilGround = false;
            wasAirborne = false;
            peakFallSpeed = 0;
        } else if (groundH !== -999) {
            canJump = false;
            wasAirborne = true;
            if (velocity.y < 0) peakFallSpeed = Math.max(peakFallSpeed, -velocity.y);
        }
        if (camera.position.y < -30) {
            damagePlayer(MAX_HEALTH, 'void', true);
        }

        playerAnchor.set(camera.position.x, camera.position.y - currentHeight, camera.position.z);
        const viewDir = isThirdPerson
            ? new THREE.Vector3(Math.sin(thirdPersonYaw), 0, Math.cos(thirdPersonYaw))
            : playerFacingDir.clone();
        playerModel.rotation.y = Math.atan2(viewDir.x, viewDir.z) + Math.PI;
        playerModel.position.copy(playerAnchor);

        const pdata = playerModel.userData;
        const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
        updateSurvival(dt, horizontalSpeed);
        pdata.walkPhase += dt * Math.min(10, horizontalSpeed * 0.45 + 2.5);
        const swing = horizontalSpeed > 0.2 ? Math.sin(pdata.walkPhase) * 0.65 : 0;
        pdata.legL.rotation.x = swing;
        pdata.legR.rotation.x = -swing;
        pdata.armL.rotation.x = -swing * 0.75;
        pdata.armR.rotation.x = swing * 0.75;

        if (isThirdPerson) {
            const front = viewDir.lengthSq() > 0.0001 ? viewDir.clone().normalize() : new THREE.Vector3(0, 0, 1);
            const camDir = new THREE.Vector3(
                Math.sin(thirdPersonYaw) * Math.cos(thirdPersonPitch),
                Math.sin(thirdPersonPitch),
                Math.cos(thirdPersonYaw) * Math.cos(thirdPersonPitch)
            ).normalize();
            camera.position.set(
                playerAnchor.x + camDir.x * thirdPersonFrontDistance,
                playerAnchor.y + 1.7 + camDir.y * thirdPersonFrontDistance,
                playerAnchor.z + camDir.z * thirdPersonFrontDistance
            );
            camera.lookAt(playerAnchor.x, playerAnchor.y + 1.35, playerAnchor.z);
            fpHandEl.style.display = 'none';
        }
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight);
});
