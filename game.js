import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getMaterials } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

// --- A. 初始化與氛圍 ---
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

// --- B. 物品欄 UI (擴充至 4 格) ---
const hotbar = document.createElement('div');
hotbar.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:5px; border:2px solid #333; display:none; border-radius:5px;`;
document.body.appendChild(hotbar);
const slots = [];
const blockTypes = ['grass', 'stone', 'wood', 'leaf']; // 增加 leaf
const blockNames = ['草地', '石頭', '木頭', '葉子']; // 增加 葉子
for (let i = 0; i < 4; i++) { // 改為 4
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

// --- C. 地圖與樹木生成 ---
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const blocks = [];
for (let x = -20; x < 20; x++) {
    for (let z = -20; z < 20; z++) {
        let h = Math.round(Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1.5);
        for (let y = -2; y <= h; y++) {
            const m = new THREE.Mesh(boxGeo, getMaterials(y === h ? 'grass' : 'stone'));
            m.position.set(x, y, z); scene.add(m); blocks.push(m);
        }
        // 樹木生成邏輯優化
        if (h >= 0 && Math.random() < 0.02) {
            let treeH = 3 + Math.floor(Math.random() * 2);
            // 樹幹 (木頭)
            for (let ty = 1; ty <= treeH; ty++) {
                const w = new THREE.Mesh(boxGeo, getMaterials('wood'));
                w.position.set(x, h + ty, z); scene.add(w); blocks.push(w);
            }
            // 樹冠 (葉子) - 簡單的 3x3x2 結構
            for (let lx = -1; lx <= 1; lx++) {
                for (let lz = -1; lz <= 1; lz++) {
                    for (let ly = 0; ly < 2; ly++) {
                        // 隨機去掉一些角落，讓葉子看起來更圓一點
                        if (Math.abs(lx) + Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                        const leaf = new THREE.Mesh(boxGeo, getMaterials('leaf'));
                        leaf.position.set(x + lx, h + treeH + ly + 1, z + lz);
                        scene.add(leaf); blocks.push(leaf);
                    }
                }
            }
        }
    }
}
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(10, 20, 10); scene.add(sun);
camera.position.set(0, 5, 10);

// --- D. 控制與物理 (同前，僅加入 Digit4) ---
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
    // 數字鍵切換
    if (e.code === 'Digit1') { selectedIndex = 0; updateSelection(0); }
    if (e.code === 'Digit2') { selectedIndex = 1; updateSelection(1); }
    if (e.code === 'Digit3') { selectedIndex = 2; updateSelection(2); }
    if (e.code === 'Digit4') { selectedIndex = 3; updateSelection(3); } // 加入第 4 格
});
// --- 新增：滾輪控制物品欄 ---
window.addEventListener('wheel', (e) => {
    if (!controls.isLocked) return;

    // deltaY > 0 代表向下滾，選下一個；deltaY < 0 代表向上滾，選上一個
    if (e.deltaY > 0) {
        selectedIndex++;
    } else {
        selectedIndex--;
    }

    // 循環邏輯：(當前索引 + 總格數) % 總格數
    // 這樣可以確保 index 永遠在 0~3 之間循環，且支援負數往回跳
    selectedIndex = (selectedIndex + 4) % 4;

    updateSelection(selectedIndex);
}, { passive: true });
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
    if (!e.shiftKey) isCrouching = false;
});

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

// --- E. 物理循環 (與之前版本相同) ---
let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
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