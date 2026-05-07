const CHUNK_SIZE = 16;

function getNoiseHeight(x, z) {
  let mountain = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
  let hills = Math.sin(x * 0.15) * Math.sin(z * 0.15) * 2;
  let detail = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.5;
  return Math.round(mountain + hills + detail);
}

function getBiomeNoise(x, z) {
  return Math.sin(x * 0.015) + Math.cos(z * 0.015);
}

function seededRandom(x, z, seed = 1337) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.01) * 43758.5453123;
  return n - Math.floor(n);
}

function buildChunk(cx, cz, removedKeys) {
  const removed = new Set(removedKeys);
  const blocks = [];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      const h = getNoiseHeight(wx, wz);
      const biomeVal = getBiomeNoise(wx, wz);
      const isDesert = biomeVal > 0.6;

      if (removed.has(`${wx},${h},${wz}`)) continue;
      blocks.push({ x: wx, y: h, z: wz, type: isDesert ? 'sand' : 'grass' });

      if (!isDesert && h >= 0 && seededRandom(wx, wz) < 0.015) {
        const treeH = 3 + Math.floor(seededRandom(wx + 19, wz + 23) * 2);
        for (let ty = 1; ty <= treeH; ty++) {
          blocks.push({ x: wx, y: h + ty, z: wz, type: 'wood' });
        }
        for (let lx = -1; lx <= 1; lx++) {
          for (let lz = -1; lz <= 1; lz++) {
            for (let ly = 0; ly < 2; ly++) {
              if (Math.abs(lx) + Math.abs(lz) === 2 && seededRandom(wx + lx * 3, wz + lz * 3 + ly * 5) > 0.5) continue;
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
  const { type, cx, cz, removedBlocks } = event.data;
  if (type !== 'generate_chunk') return;
  const blocks = buildChunk(cx, cz, removedBlocks || []);
  self.postMessage({ type: 'chunk_generated', key: `${cx},${cz}`, cx, cz, blocks });
};
