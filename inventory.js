export class BlockItem {
  constructor(id, nameZh) { this.id = id; this.nameZh = nameZh; }
}

export class Inventory {
  constructor(size = 36, maxStack = 64, onChange = null) {
    this.slots = Array.from({ length: size }, () => null); // { itemId, count }
    this.maxStack = maxStack;
    this.onChange = onChange;
  }

  add(itemId, amount = 1, preferHotbar = false) {
    if (typeof itemId !== 'string' || !Number.isInteger(amount) || amount <= 0) return 0;
    let remain = amount;
    const originalRemain = remain;
    const ranges = preferHotbar ? [[27, 36], [0, 27]] : [[0, this.slots.length]];

    // 先填滿同類未滿堆疊
    for (const [start, end] of ranges) {
      for (let i = start; i < end; i++) {
        const slot = this.slots[i];
        if (!slot || slot.itemId !== itemId || slot.count >= this.maxStack) continue;
        const addable = Math.min(this.maxStack - slot.count, remain);
        slot.count += addable;
        remain -= addable;
        if (remain <= 0) {
          this.onChange?.();
          return originalRemain;
        }
      }
    }
    // 再塞空位
    for (const [start, end] of ranges) {
      for (let i = start; i < end && remain > 0; i++) {
        if (this.slots[i] !== null) continue;
        const stackCount = Math.min(this.maxStack, remain);
        this.slots[i] = { itemId, count: stackCount };
        remain -= stackCount;
      }
    }
    if (remain < originalRemain) this.onChange?.();
    return originalRemain - remain;
  }

  has(itemId, amount = 1) {
    let total = 0;
    for (const slot of this.slots) if (slot && slot.itemId === itemId) total += slot.count;
    return total >= amount;
  }

  remove(itemId, amount = 1) {
    if (!this.has(itemId, amount)) return false;
    let need = amount;
    for (let i = 0; i < this.slots.length && need > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const used = Math.min(slot.count, need);
      slot.count -= used;
      need -= used;
      if (slot.count <= 0) this.slots[i] = null;
    }
    this.onChange?.();
    return true;
  }

  moveSlot(from, to) {
    if (from === to) return;
    const temp = this.slots[from];
    this.slots[from] = this.slots[to];
    this.slots[to] = temp;
    this.onChange?.();
  }

  entries() {
    const map = new Map();
    for (const slot of this.slots) {
      if (!slot) continue;
      map.set(slot.itemId, (map.get(slot.itemId) || 0) + slot.count);
    }
    return Array.from(map.entries());
  }

  getSlots(start, end) {
    return this.slots.slice(start, end);
  }
}

export class CraftingRecipe {
  constructor(id, label, inputs, output) { this.id = id; this.label = label; this.inputs = inputs; this.output = output; }
}

export class CraftingManager {
  constructor(inventory) { this.inventory = inventory; this.recipes = []; }
  addRecipe(recipe) { this.recipes.push(recipe); }
  canCraft(recipe) { return recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount)); }
  craft(recipe) {
    if (!this.canCraft(recipe)) return { ok: false, message: '材料不足' };
    for (const input of recipe.inputs) this.inventory.remove(input.itemId, input.amount);
    this.inventory.add(recipe.output.itemId, recipe.output.amount);
    return { ok: true, message: `合成成功：${recipe.label}` };
  }
}
