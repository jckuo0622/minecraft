import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

// --- A. 初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);
scene.fog = new THREE.FogExp2(0xbfd1e5, 0.03); // 霧氣稍微調淡，可以看到更遠的山
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
document.getElementById('game-container').appendChild(renderer.domElement);
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

// --- B. 多層次地形與區塊系統 ---
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2;
const loadedChunks = new Map();
const blocks = []; 
const removedBlocks = new Set(); 
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// 模擬柏林雜訊的多層疊加 (Fractal Brownian Motion)
function getNoiseHeight(x, z) {
    // 層次 1：巨大的山脈 (低頻、高幅)
    let mountain = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
    // 層次 2：起伏的小丘 (中頻、中幅)
    let hills = Math.sin(x * 0.15) * Math.sin(z * 0.15) * 2;
    // 層次 3：地表凹凸細節 (高頻、低幅)
    let detail = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.5;
    
    // 將三者疊加，並確保地形不會太「平」
    return Math.round(mountain + hills + detail);
}

function getBiomeNoise(x, z) {
    return Math.sin(x * 0.015) + Math.cos(z * 0.015);
}

function updateNeighbors(x, y, z) {
    const directions = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
    directions.forEach(([dx, dy, dz]) => {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const posKey = `${nx},${ny},${nz}`;
        if (removedBlocks.has(posKey)) return;
        if (ny > getNoiseHeight(nx, nz) || ny < -20) return; // 深度限制調深一點
        const exists = blocks.some(b => Math.abs(b.position.x - nx) < 0.1 && Math.abs(b.position.y - ny) < 0.1 && Math.abs(b.position.z - nz) < 0.1);
        if (!exists) {
            const m = new THREE.Mesh(boxGeo, getMaterials('stone'));
            m.position.set(nx, ny, nz);
            scene.add(m);
            blocks.push(m);
        }
    });
}

function spawnChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (loadedChunks.has(key)) return;
    const chunkBlocks = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            const h = getNoiseHeight(wx, wz);
            const biomeVal = getBiomeNoise(wx, wz);
            const isDesert = biomeVal > 0.6;

            if (!removedBlocks.has(`${wx},${h},${wz}`)) {
                const type = isDesert ? 'sand' : 'grass';
                const m = new THREE.Mesh(boxGeo, getMaterials(type));
                m.position.set(wx, h, wz);
                scene.add(m);
                blocks.push(m);
                chunkBlocks.push(m);

                // 生成樹木邏輯 (只在平坦一點的草地長樹，增加真實感)
                if (!isDesert && h >= 0 && Math.random() < 0.015) {
                    const treeH = 3 + Math.floor(Math.random() * 2);
                    for (let ty = 1; ty <= treeH; ty++) {
                        const wood = new THREE.Mesh(boxGeo, getMaterials('wood'));
                        wood.position.set(wx, h + ty, wz);
                        scene.add(wood);
                        blocks.push(wood);
                        chunkBlocks.push(wood);
                    }
                    for (let lx = -1; lx <= 1; lx++) {
                        for (let lz = -1; lz <= 1; lz++) {
                            for (let ly = 0; ly < 2; ly++) {
                                if (Math.abs(lx) + Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                                const leaf = new THREE.Mesh(boxGeo, getMaterials('leaf'));
                                leaf.position.set(wx + lx, h + treeH + ly + 1, wz + lz);
                                scene.add(leaf);
                                blocks.push(leaf);
                                chunkBlocks.push(leaf);
                            }
                        }
                    }
                }
            }
        }
    }
    loadedChunks.set(key, chunkBlocks);
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
            chunkBlocks.forEach(b => { scene.remove(b); const idx = blocks.indexOf(b); if (idx > -1) blocks.splice(idx, 1); });
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

// --- C. UI ---
const hotbar = document.createElement('div');
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:5px; border:2px solid #333; display:none;`;
document.body.appendChild(hotbar);
const blockTypes = ['grass', 'stone', 'wood', 'leaf', 'sand'];
const slots = [];
for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = `width:50px; height:50px; border:2px solid #8b8b8b; background:#555; display:flex; align-items:center; justify-content:center; color:white; font-size:12px;`;
    slot.innerHTML = i + 1;
    hotbar.appendChild(slot);
    slots.push(slot);
}
function updateSelection(idx) { slots.forEach((s, i) => s.style.border = (i === idx) ? '4px solid white' : '2px solid #8b8b8b'); }
updateSelection(0);

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; hotbar.style.display = 'flex'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; hotbar.style.display = 'none'; });

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
    if (e.code === 'Space' && canJump) { velocity.y += 9.5; canJump = false; } // 加強一點跳躍力來應對陡坡
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
    const intersects = raycaster.intersectObjects(blocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) { 
            const pos = intersect.object.position.clone();
            removedBlocks.add(`${pos.x},${pos.y},${pos.z}`);
            scene.remove(intersect.object);
            const idx = blocks.indexOf(intersect.object);
            if (idx > -1) blocks.splice(idx, 1);
            updateNeighbors(pos.x, pos.y, pos.z);
        } else if (e.button === 2) { 
            const b = new THREE.Mesh(boxGeo, getMaterials(blockTypes[selectedIdx]));
            const placePos = intersect.object.position.clone().add(intersect.face.normal);
            b.position.copy(placePos);
            removedBlocks.delete(`${placePos.x},${placePos.y},${placePos.z}`);
            scene.add(b); blocks.push(b);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(10, 20, 10);
scene.add(sun);
camera.position.set(0, 20, 0); // 出生點設高一點，以免卡在山裡

let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        updateWorld();
        processQueue();
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);
        prevT = t;
        const targetH = isCrouching ? 1.2 : 1.7;
        currentHeight += (targetH - currentHeight) * 0.2;
        velocity.x -= velocity.x * 10 * dt;
        velocity.z -= velocity.z * 10 * dt;
        const feetY = camera.position.y - currentHeight;
        const groundH = getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, feetY);
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
        if (!checkWall(nextX, camera.position.y, camera.position.z, blocks, playerRadius)) {
            if (getGroundAt(nextX, camera.position.z, blocks, playerRadius, feetY) !== -999) camera.position.x = nextX;
        }
        const nextZ = camera.position.z + velocity.z * dt;
        if (!checkWall(camera.position.x, camera.position.y, nextZ, blocks, playerRadius)) {
            if (getGroundAt(camera.position.x, nextZ, blocks, playerRadius, feetY) !== -999) camera.position.z = nextZ;
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
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});