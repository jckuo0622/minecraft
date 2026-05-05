import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

// --- A. 初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);
scene.fog = new THREE.FogExp2(0xbfd1e5, 0.04); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1); // 固定像素比以提升效能
document.getElementById('game-container').appendChild(renderer.domElement);
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

// --- B. 麥塊級區塊系統 ---
const CHUNK_SIZE = 16;       // 模仿正版 16x16
const RENDER_DISTANCE = 2;    // 視距
const loadedChunks = new Map();
const blocks = [];            // 僅存儲「表面」方塊供物理與挖掘使用
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function getNoiseHeight(x, z) {
    return Math.round(Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 + Math.sin(x * 0.05) * 2);
}

// 模仿麥塊邏輯：只生成「看得到」的方塊面 (簡易版實作)
function spawnChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (loadedChunks.has(key)) return;

    const chunkGroup = new THREE.Group();
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            const h = getNoiseHeight(wx, wz);

            // 只有當方塊位於表面時，才真正建立 Mesh (遮擋剔除概念)
            const m = new THREE.Mesh(boxGeo, getMaterials('grass'));
            m.position.set(wx, h, wz);
            
            // 優化：如果四周都被包圍，則不加入場景 (這裡簡化為只畫地表)
            chunkGroup.add(m);
            blocks.push(m);
        }
    }
    scene.add(chunkGroup);
    loadedChunks.set(key, chunkGroup);
}

const generationQueue = [];
function updateWorld() {
    const px = Math.floor(camera.position.x / CHUNK_SIZE);
    const pz = Math.floor(camera.position.z / CHUNK_SIZE);

    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const key = `${px + x},${pz + z}`;
            if (!loadedChunks.has(key) && !generationQueue.includes(key)) {
                generationQueue.push(key);
            }
        }
    }

    // 卸載遠處區塊
    for (let [key, group] of loadedChunks) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - px) > RENDER_DISTANCE + 1 || Math.abs(cz - pz) > RENDER_DISTANCE + 1) {
            group.children.forEach(b => {
                const idx = blocks.indexOf(b);
                if (idx > -1) blocks.splice(idx, 1);
            });
            scene.remove(group);
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

// --- C. UI 與 物品欄 (維持 4 格) ---
const hotbar = document.createElement('div');
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:5px; border:2px solid #333; display:none;`;
document.body.appendChild(hotbar);
const blockTypes = ['grass', 'stone', 'wood', 'leaf'];
const slots = [];
for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = `width:50px; height:50px; border:2px solid #8b8b8b; background:#555; display:flex; align-items:center; justify-content:center; color:white; font-size:12px;`;
    slot.innerHTML = i + 1;
    hotbar.appendChild(slot);
    slots.push(slot);
}
function updateSelection(idx) {
    slots.forEach((s, i) => s.style.border = (i === idx) ? '4px solid white' : '2px solid #8b8b8b');
}
updateSelection(0);

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; hotbar.style.display = 'flex'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; hotbar.style.display = 'none'; });

// --- D. 遊戲邏輯 ---
let selectedIdx = 0;
const velocity = new THREE.Vector3();
const playerRadius = 0.35;
let canJump = false, isCrouching = false, currentHeight = 1.7;

document.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Digit')) {
        const val = parseInt(e.code.replace('Digit', '')) - 1;
        if (val >= 0 && val < 4) { selectedIdx = val; updateSelection(val); }
    }
    if (e.code === 'Space' && canJump) { velocity.y += 8.5; canJump = false; }
    if (e.shiftKey) isCrouching = true;
});
document.addEventListener('keyup', (e) => { if (!e.shiftKey) isCrouching = false; });
window.addEventListener('wheel', (e) => {
    if (!controls.isLocked) return;
    selectedIdx = (selectedIdx + (e.deltaY > 0 ? 1 : -1) + 4) % 4;
    updateSelection(selectedIdx);
}, { passive: true });

// 挖掘與建造
window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(blocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) {
            scene.remove(intersect.object);
            blocks.splice(blocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) {
            const b = new THREE.Mesh(boxGeo, getMaterials(blockTypes[selectedIdx]));
            b.position.copy(intersect.object.position).add(intersect.face.normal);
            scene.add(b); blocks.push(b);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(10, 20, 10);
scene.add(sun);
camera.position.set(0, 10, 0);

// --- E. 物理循環 ---
let prevT = performance.now();
const keys = {};
document.addEventListener('keydown', (e) => keys[e.code] = true);
document.addEventListener('keyup', (e) => keys[e.code] = false);

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
        velocity.y -= 28 * dt;

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

        const oldPos = camera.position.clone();
        const feetY = camera.position.y - currentHeight;
        const groundH = getGroundAt(oldPos.x, oldPos.z, blocks, playerRadius, feetY);

        // 分軸移動 (含潛行檢查)
        const nextX = oldPos.x + velocity.x * dt;
        if (!checkWall(nextX, camera.position.y, oldPos.z, blocks, playerRadius)) {
            if (!(isCrouching && canJump && getGroundAt(nextX, oldPos.z, blocks, playerRadius, feetY) < groundH - 0.1)) {
                camera.position.x = nextX;
            }
        }
        const nextZ = oldPos.z + velocity.z * dt;
        if (!checkWall(camera.position.x, camera.position.y, nextZ, blocks, playerRadius)) {
            if (!(isCrouching && canJump && getGroundAt(camera.position.x, nextZ, blocks, playerRadius, feetY) < groundH - 0.1)) {
                camera.position.z = nextZ;
            }
        }

        camera.position.y += velocity.y * dt;
        const finalGround = getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, camera.position.y - currentHeight);
        if (camera.position.y - currentHeight <= finalGround) {
            velocity.y = 0;
            camera.position.y = finalGround + currentHeight;
            canJump = true;
        } else {
            canJump = false;
        }

        if (camera.position.y < -30) camera.position.set(0, 20, 0);
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});