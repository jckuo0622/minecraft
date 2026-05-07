// 物品資料結構：可表示方塊或工具
export class BlockItem {
  constructor(id, nameZh) {
    this.id = id;
    this.nameZh = nameZh;
  }
}

// 背包：管理物品與數量
export class Inventory {
  constructor() {
    this.items = new Map();
  }

  add(itemId, amount = 1) {
    const current = this.items.get(itemId) || 0;
    this.items.set(itemId, current + amount);
  }

  has(itemId, amount = 1) {
    return (this.items.get(itemId) || 0) >= amount;
  }

  remove(itemId, amount = 1) {
    if (!this.has(itemId, amount)) return false;
    const next = (this.items.get(itemId) || 0) - amount;
    if (next <= 0) this.items.delete(itemId);
    else this.items.set(itemId, next);
    return true;
  }

  entries() {
    return Array.from(this.items.entries());
  }
}

// 合成配方
export class CraftingRecipe {
  constructor(id, label, inputs, output) {
    this.id = id;
    this.label = label;
    this.inputs = inputs; // [{ itemId, amount }]
    this.output = output; // { itemId, amount }
  }
}

// 合成管理：檢查材料與執行合成
export class CraftingManager {
  constructor(inventory) {
    this.inventory = inventory;
    this.recipes = [];
  }

  addRecipe(recipe) {
    this.recipes.push(recipe);
  }

  canCraft(recipe) {
    return recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount));
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) return { ok: false, message: '材料不足' };

    for (const input of recipe.inputs) {
      this.inventory.remove(input.itemId, input.amount);
    }
    this.inventory.add(recipe.output.itemId, recipe.output.amount);
    return { ok: true, message: `合成成功：${recipe.label}` };
  }
}
