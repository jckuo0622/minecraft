const CHUNK_SIZE = 16;

function seedCoordinates(x, z, seed) {
  return [x + (seed % 997), z + (Math.floor(seed / 997) % 991)];
}

function getNoiseHeight(x, z, seed) {
  const [sx, sz] = seedCoordinates(x, z, seed);
  let mountain = Math.sin(sx * 0.05) * Math.cos(sz * 0.05) * 5;
  let hills = Math.sin(sx * 0.15) * Math.sin(sz * 0.15) * 2;
  let detail = Math.sin(sx * 0.4) * Math.cos(sz * 0.4) * 0.5;
  return Math.round(mountain + hills + detail);
}

function getBiomeNoise(x, z, seed) {
  const [sx, sz] = seedCoordinates(x, z, seed);
  return Math.sin(sx * 0.015) + Math.cos(sz * 0.015);
}

function seededRandom(x, z, seed = 1337) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.01) * 43758.5453123;
  return n - Math.floor(n);
}


function addOreVein(blocks, removed, wx, wy, wz, oreType, seedOffset, radius = 1) {
  const points = [
    [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    [0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, -1]
  ];
  for (const [ox, oy, oz] of points) {
    const x = wx + ox;
    const y = wy + oy;
    const z = wz + oz;
    if (Math.abs(ox) + Math.abs(oy) + Math.abs(oz) > radius + 1) continue;
    if (removed.has(`${x},${y},${z}`)) continue;
    if (seededRandom(x + seedOffset, z + seedOffset, y * 17) > 0.62) continue;
    blocks.push({ x, y, z, type: oreType });
  }
}

function buildChunk(cx, cz, removedKeys, worldSeed) {
  const removed = new Set(removedKeys);
  const blocks = [];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      const h = getNoiseHeight(wx, wz, worldSeed);
      const biomeVal = getBiomeNoise(wx, wz, worldSeed);
      const isDesert = biomeVal > 0.6;

      if (removed.has(`${wx},${h},${wz}`)) continue;
      blocks.push({ x: wx, y: h, z: wz, type: isDesert ? 'sand' : 'grass' });

      // 地下礦脈生成（煤礦較淺、鐵礦較深）
      const coalY = h - 3 - Math.floor(seededRandom(wx + 41, wz + 59, worldSeed) * 6);
      const ironY = h - 6 - Math.floor(seededRandom(wx + 79, wz + 11, worldSeed) * 7);
      if (coalY > -18 && seededRandom(wx + 211, wz + 307, worldSeed) < 0.08) {
        addOreVein(blocks, removed, wx, coalY, wz, 'coal_ore', worldSeed + 701, 1);
      }
      if (ironY > -22 && seededRandom(wx + 509, wz + 131, worldSeed) < 0.055) {
        addOreVein(blocks, removed, wx, ironY, wz, 'iron_ore', worldSeed + 1701, 1);
      }

      if (!isDesert && h >= 0 && seededRandom(wx, wz, worldSeed) < 0.015) {
        const treeH = 3 + Math.floor(seededRandom(wx + 19, wz + 23, worldSeed) * 2);
        for (let ty = 1; ty <= treeH; ty++) {
          blocks.push({ x: wx, y: h + ty, z: wz, type: 'wood' });
        }
        for (let lx = -1; lx <= 1; lx++) {
          for (let lz = -1; lz <= 1; lz++) {
            for (let ly = 0; ly < 2; ly++) {
              if (Math.abs(lx) + Math.abs(lz) === 2 && seededRandom(wx + lx * 3, wz + lz * 3 + ly * 5, worldSeed) > 0.5) continue;
              blocks.push({ x: wx + lx, y: h + treeH + ly + 1, z: wz + lz, type: 'leaf' });
            }
          }
        }
      }
    }
  }
  return blocks;
}

self.onmessage = (event) => {
  const { type, cx, cz, removedBlocks, worldSeed } = event.data;
  if (type !== 'generate_chunk') return;
  const blocks = buildChunk(cx, cz, removedBlocks || [], worldSeed);
  self.postMessage({ type: 'chunk_generated', key: `${cx},${cz}`, cx, cz, blocks });
};
