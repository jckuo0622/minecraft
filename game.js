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

// --- 新增：方塊選擇 UI ---
const inventoryUI = document.createElement('div');
inventoryUI.style.position = 'absolute';
inventoryUI.style.bottom = '20px';
inventoryUI.style.left = '50%';
inventoryUI.style.transform = 'translateX(-50%)';
inventoryUI.style.color = 'white';
inventoryUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
inventoryUI.style.padding = '10px 20px';
inventoryUI.style.borderRadius = '5px';
inventoryUI.style.fontFamily = 'Arial, sans-serif';
inventoryUI.innerHTML = '1: 草地 | 2: 石頭 | 3: 木頭 <br> <center><b>當前：草地</b></center>';
document.body.appendChild(inventoryUI);

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; inventoryUI.style.display = 'block'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; inventoryUI.style.display = 'none'; });

// --- B. 生成世界 ---
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const blocks = [];

for (let x = -20; x < 20; x++) {
    for (let z = -20; z < 20; z++) {
        let h = Math.round(Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1.5);
        for (let y = -2; y <= h; y++) {
            const m = new THREE.Mesh(boxGeo, getMaterials(y === h ? 'grass' : 'stone'));
            m.position.set(x, y, z);
            scene.add(m);
            blocks.push(m);
        }
    }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(10, 20, 10);
scene.add(sun);
camera.position.set(0, 5, 10);

// --- C. 狀態變數 ---
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false, isCrouching = false;
const velocity = new THREE.Vector3();
const playerRadius = 0.3;
let currentHeight = 1.7;

// --- 重點：當前選擇的方塊類型 ---
let selectedBlockType = 'grass';
const typeNames = { 'grass': '草地', 'stone': '石頭', 'wood': '木頭' };

// --- D. 輸入監聽 ---
document.addEventListener('keydown', (e) => {
    // 移動控制
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'Space' && canJump) { velocity.y += 8.5; canJump = false; }
    if (e.shiftKey) isCrouching = true;

    // --- 重點：數字鍵切換方塊 ---
    if (e.code === 'Digit1') { selectedBlockType = 'grass'; }
    if (e.code === 'Digit2') { selectedBlockType = 'stone'; }
    if (e.code === 'Digit3') { selectedBlockType = 'wood'; }
    
    // 更新 UI 顯示
    inventoryUI.innerHTML = `1: 草地 | 2: 石頭 | 3: 木頭 <br> <center><b>當前：${typeNames[selectedBlockType]}</b></center>`;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
    if (!e.shiftKey) isCrouching = false;
});

// --- E. 挖掘與建造 ---
const raycaster = new THREE.Raycaster();
window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(blocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) { // 左鍵挖除
            scene.remove(intersect.object);
            blocks.splice(blocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) { // 右鍵放置選中的方塊
            const newBlock = new THREE.Mesh(boxGeo, getMaterials(selectedBlockType));
            newBlock.position.copy(intersect.object.position).add(intersect.face.normal);
            scene.add(newBlock);
            blocks.push(newBlock);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- F. 物理循環 (與之前相同) ---
let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);

        const oldX = camera.position.x;
        const oldZ = camera.position.z;
        const feetY = camera.position.y - currentHeight;

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
        if (moveF) moveDir.add(forward);
        if (moveB) moveDir.sub(forward);
        if (moveL) moveDir.add(right);
        if (moveR) moveDir.sub(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            let speed = (isCrouching && canJump) ? 22 : 60;
            velocity.x += moveDir.x * speed * dt;
            velocity.z += moveDir.z * speed * dt;
        }

        const currentGroundH = getGroundAt(oldX, oldZ, blocks, playerRadius, feetY);

        const nextX = oldX + velocity.x * dt;
        let canMoveX = !checkWall(nextX, camera.position.y, oldZ, blocks, playerRadius);
        if (isCrouching && canJump && canMoveX) {
            if (getGroundAt(nextX, oldZ, blocks, playerRadius, feetY) < currentGroundH - 0.1) canMoveX = false;
        }
        if (canMoveX) camera.position.x = nextX;

        const nextZ = oldZ + velocity.z * dt;
        let canMoveZ = !checkWall(camera.position.x, camera.position.y, nextZ, blocks, playerRadius);
        if (isCrouching && canJump && canMoveZ) {
            if (getGroundAt(camera.position.x, nextZ, blocks, playerRadius, feetY) < currentGroundH - 0.1) canMoveZ = false;
        }
        if (canMoveZ) camera.position.z = nextZ;

        if (!isCrouching && canJump) {
            if (getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, feetY) === -Infinity) {
                camera.position.x = oldX; camera.position.z = oldZ;
            }
        }

        camera.position.y += velocity.y * dt;
        if (camera.position.y < -30) { camera.position.set(0, 10, 0); velocity.set(0, 0, 0); }

        const finalGround = getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, camera.position.y - currentHeight);
        if (camera.position.y - currentHeight <= finalGround) {
            if (velocity.y < 0) {
                velocity.y = 0;
                camera.position.y = finalGround + currentHeight;
                canJump = true;
            }
        } else { canJump = false; }
        
        prevT = t;
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});