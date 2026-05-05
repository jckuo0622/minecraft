import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

// --- A. 初始化設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);
scene.fog = new THREE.FogExp2(0xbfd1e5, 0.05); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

// --- B. 無限地圖配置 ---
const CHUNK_SIZE = 8;        // 每個區塊的大小
const RENDER_DISTANCE = 3;   // 讀取距離 (玩家周圍 3 圈區塊)
const loadedChunks = new Map(); // 儲存已生成的區塊
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const blocks = []; // 全域方塊陣列，供物理引擎使用

// 地形高度公式：輸入座標，輸出唯一確定的高度
function getNoiseHeight(x, z) {
    return Math.round(
        Math.sin(x * 0.15) * Math.cos(z * 0.15) * 1.5 + 
        Math.sin(x * 0.05) * 1.5
    );
}

// 更新世界區塊
function updateWorld() {
    const playerChunkX = Math.floor(camera.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(camera.position.z / CHUNK_SIZE);

    // 1. 生成新區塊
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const cx = playerChunkX + x;
            const cz = playerChunkZ + z;
            const key = `${cx},${cz}`;

            if (!loadedChunks.has(key)) {
                const chunkBlocks = [];
                for (let bx = 0; bx < CHUNK_SIZE; bx++) {
                    for (let bz = 0; bz < CHUNK_SIZE; bz++) {
                        const wx = cx * CHUNK_SIZE + bx;
                        const wz = cz * CHUNK_SIZE + bz;
                        const h = getNoiseHeight(wx, wz);
                        
                        for (let y = -2; y <= h; y++) {
                            const m = new THREE.Mesh(boxGeo, getMaterials(y === h ? 'grass' : 'stone'));
                            m.position.set(wx, y, wz);
                            scene.add(m);
                            blocks.push(m);
                            chunkBlocks.push(m);
                        }
                    }
                }
                loadedChunks.set(key, chunkBlocks);
            }
        }
    }

    // 2. 卸載遠方區塊 (優化記憶體)
    for (let [key, chunkBlocks] of loadedChunks) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - playerChunkX) > RENDER_DISTANCE + 1 || 
            Math.abs(cz - playerChunkZ) > RENDER_DISTANCE + 1) {
            
            chunkBlocks.forEach(b => {
                scene.remove(b);
                const idx = blocks.indexOf(b);
                if (idx > -1) blocks.splice(idx, 1);
            });
            loadedChunks.delete(key);
        }
    }
}

// --- C. UI 物品欄 (4格) ---
const hotbar = document.createElement('div');
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:5px; border:2px solid #333; display:none; border-radius:5px;`;
document.body.appendChild(hotbar);
const slots = [];
const blockTypes = ['grass', 'stone', 'wood', 'leaf'];
const blockNames = ['草地', '石頭', '木頭', '葉子'];
for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = `width:50px; height:50px; border:2px solid #8b8b8b; background:#555; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; position:relative;`;
    slot.innerHTML = `<span style="position:absolute; top:2px; left:4px;">${i+1}</span>${blockNames[i]}`;
    hotbar.appendChild(slot);
    slots.push(slot);
}
function updateSelection(index) {
    slots.forEach((s, idx) => {
        s.style.border = (idx === index) ? '4px solid white' : '2px solid #8b8b8b';
        s.style.backgroundColor = (idx === index) ? '#777' : '#555';
    });
}
updateSelection(0);

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; hotbar.style.display = 'flex'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; hotbar.style.display = 'none'; });

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(10, 20, 10); scene.add(sun);
camera.position.set(0, 5, 0); // 從原點上方出生

// --- D. 狀態與控制 ---
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false, isCrouching = false;
let selectedIndex = 0;
const velocity = new THREE.Vector3();
const playerRadius = 0.35;
let currentHeight = 1.7;

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'Space' && canJump) { velocity.y += 8.5; canJump = false; }
    if (e.shiftKey) isCrouching = true;
    if (e.code === 'Digit1') { selectedIndex = 0; updateSelection(0); }
    if (e.code === 'Digit2') { selectedIndex = 1; updateSelection(1); }
    if (e.code === 'Digit3') { selectedIndex = 2; updateSelection(2); }
    if (e.code === 'Digit4') { selectedIndex = 3; updateSelection(3); }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
    if (!e.shiftKey) isCrouching = false;
});

// 滾輪切換
window.addEventListener('wheel', (e) => {
    if (!controls.isLocked) return;
    if (e.deltaY > 0) selectedIndex++; else selectedIndex--;
    selectedIndex = (selectedIndex + 4) % 4;
    updateSelection(selectedIndex);
}, { passive: true });

const raycaster = new THREE.Raycaster();
window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(blocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) { 
            scene.remove(intersect.object); blocks.splice(blocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) {
            const b = new THREE.Mesh(boxGeo, getMaterials(blockTypes[selectedIndex]));
            b.position.copy(intersect.object.position).add(intersect.face.normal);
            scene.add(b); blocks.push(b);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- E. 遊戲迴圈 ---
let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        updateWorld(); // <-- 關鍵：動態加載地圖

        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);
        const oldX = camera.position.x; const oldZ = camera.position.z;
        const targetH = isCrouching ? 1.2 : 1.7; currentHeight += (targetH - currentHeight) * 0.2;

        velocity.x -= velocity.x * 10 * dt; velocity.z -= velocity.z * 10 * dt; velocity.y -= 28 * dt;
        const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (moveF) moveDir.add(forward); if (moveB) moveDir.sub(forward); if (moveL) moveDir.add(right); if (moveR) moveDir.sub(right);
        
        if (moveDir.length() > 0) {
            moveDir.normalize();
            let speed = (isCrouching && canJump) ? 22 : 60;
            velocity.x += moveDir.x * speed * dt; velocity.z += moveDir.z * speed * dt;
        }

        const feetY = camera.position.y - currentHeight;
        const currentGroundH = getGroundAt(oldX, oldZ, blocks, playerRadius, feetY);

        const nextX = oldX + velocity.x * dt;
        let canMoveX = !checkWall(nextX, camera.position.y, oldZ, blocks, playerRadius);
        if (isCrouching && canJump && canMoveX && getGroundAt(nextX, oldZ, blocks, playerRadius, feetY) < currentGroundH - 0.1) canMoveX = false;
        if (canMoveX) camera.position.x = nextX;

        const nextZ = oldZ + velocity.z * dt;
        let canMoveZ = !checkWall(camera.position.x, camera.position.y, nextZ, blocks, playerRadius);
        if (isCrouching && canJump && canMoveZ && getGroundAt(camera.position.x, nextZ, blocks, playerRadius, feetY) < currentGroundH - 0.1) canMoveZ = false;
        if (canMoveZ) camera.position.z = nextZ;

        if (!isCrouching && canJump && getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, feetY) === -Infinity) {
            camera.position.x = oldX; camera.position.z = oldZ;
        }

        camera.position.y += velocity.y * dt;
        if (camera.position.y < -30) { camera.position.set(0, 10, 0); velocity.set(0, 0, 0); }

        const finalGround = getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, camera.position.y - currentHeight);
        if (camera.position.y - currentHeight <= finalGround) {
            if (velocity.y < 0) { velocity.y = 0; camera.position.y = finalGround + currentHeight; canJump = true; }
        } else { canJump = false; }
        prevT = t;
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});