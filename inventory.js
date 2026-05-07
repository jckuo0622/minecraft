export class BlockItem {
  constructor(id, nameZh) { this.id = id; this.nameZh = nameZh; }
}

export class Inventory {
  constructor(size = 36) {
    this.slots = Array.from({ length: size }, () => null); // { itemId, count }
  }

  add(itemId, amount = 1) {
    // 先疊加同類
    for (const slot of this.slots) {
      if (slot && slot.itemId === itemId) {
        slot.count += amount;
        return;
      }
    }
    // 再找空位
    const idx = this.slots.findIndex(s => s === null);
    if (idx >= 0) this.slots[idx] = { itemId, count: amount };
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
    return true;
  }

  moveSlot(from, to) {
    if (from === to) return;
    const temp = this.slots[from];
    this.slots[from] = this.slots[to];
    this.slots[to] = temp;
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
