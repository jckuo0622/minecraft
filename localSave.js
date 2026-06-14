export const SAVE_KEY = 'minecraft-web-edition-save';
export const SAVE_VERSION = 1;

function storageOrDefault(storage) {
    if (storage) return storage;
    if (typeof window !== 'undefined') return window.localStorage;
    return null;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPosition(value) {
    return value
        && isFiniteNumber(value.x)
        && isFiniteNumber(value.y)
        && isFiniteNumber(value.z);
}

function isItemStack(value) {
    return value
        && typeof value.itemId === 'string'
        && Number.isInteger(value.count)
        && value.count > 0
        && value.count <= 64;
}

function isBlockEntry(value) {
    return value
        && Number.isInteger(value.x)
        && Number.isInteger(value.y)
        && Number.isInteger(value.z)
        && typeof value.type === 'string';
}

function validateSave(data) {
    if (!data || typeof data !== 'object') throw new Error('save data is not an object');
    if (data.version !== SAVE_VERSION) throw new Error(`unsupported save version: ${data.version}`);
    if (!Number.isInteger(data.worldSeed)) throw new Error('invalid world seed');
    if (!isPosition(data.player?.position)) throw new Error('invalid player position');
    if (!isFiniteNumber(data.player.health) || !isFiniteNumber(data.player.hunger)) {
        throw new Error('invalid player survival state');
    }
    if (!Array.isArray(data.inventory) || data.inventory.length !== 36) {
        throw new Error('invalid inventory');
    }
    if (!data.inventory.every(slot => slot === null || isItemStack(slot))) {
        throw new Error('invalid inventory slot');
    }
    if (!data.equipment || typeof data.equipment !== 'object') throw new Error('invalid equipment');
    if (!isFiniteNumber(data.worldTime)) throw new Error('invalid world time');
    if (!Array.isArray(data.removedBlocks) || !data.removedBlocks.every(key => typeof key === 'string')) {
        throw new Error('invalid removed blocks');
    }
    if (!Array.isArray(data.placedBlocks) || !data.placedBlocks.every(isBlockEntry)) {
        throw new Error('invalid placed blocks');
    }
    return data;
}

export function serializeInventory(inventory) {
    return inventory.slots.map(slot => slot ? { itemId: slot.itemId, count: slot.count } : null);
}

export function deserializeInventory(inventory, slots) {
    if (!Array.isArray(slots) || slots.length !== inventory.slots.length) {
        throw new Error('inventory size does not match');
    }
    inventory.slots = slots.map(slot => slot ? { itemId: slot.itemId, count: slot.count } : null);
}

export function serializeWorldChanges(removedBlocks, placedBlocks) {
    const normalizedRemoved = Array.from(removedBlocks).filter(key => !placedBlocks.has(key));
    return {
        removedBlocks: normalizedRemoved,
        placedBlocks: Array.from(placedBlocks, ([key, type]) => {
            const [x, y, z] = key.split(',').map(Number);
            return { x, y, z, type };
        })
    };
}

export function applyWorldChanges(data, removedBlocks, placedBlocks) {
    removedBlocks.clear();
    placedBlocks.clear();
    for (const key of data.removedBlocks) removedBlocks.add(key);
    for (const block of data.placedBlocks) {
        const key = `${block.x},${block.y},${block.z}`;
        placedBlocks.set(key, block.type);
        removedBlocks.delete(key);
    }
}

export function saveGame(data, storage) {
    const target = storageOrDefault(storage);
    if (!target) return false;
    try {
        target.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
        return true;
    } catch (error) {
        console.warn('[save] Unable to save local game:', error);
        return false;
    }
}

export function loadGame(storage) {
    const target = storageOrDefault(storage);
    if (!target) return null;
    try {
        const raw = target.getItem(SAVE_KEY);
        if (!raw) return null;
        return validateSave(JSON.parse(raw));
    } catch (error) {
        console.warn('[save] Ignoring corrupted or incompatible local save:', error);
        return null;
    }
}

export function clearSave(storage) {
    const target = storageOrDefault(storage);
    if (!target) return false;
    try {
        target.removeItem(SAVE_KEY);
        return true;
    } catch (error) {
        console.warn('[save] Unable to clear local save:', error);
        return false;
    }
}

export function createDirtyTracker() {
    let dirty = false;
    return {
        markSaveDirty() { dirty = true; },
        isSaveDirty() { return dirty; },
        markSaved() { dirty = false; }
    };
}
