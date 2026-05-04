import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';

// --- 1. 貼圖生成 ---
function createPixelTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for(let x=0; x<16; x++) for(let y=0; y<16; y++) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(x,y,1,1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}
const grassTop = createPixelTexture('#5dad44', '#77bc43');
const dirtSide = createPixelTexture('#8b5a2b', '#7a4e25');
const grassMaterials = [
    new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide}),
    new THREE.MeshLambertMaterial({map: grassTop}), new THREE.MeshLambertMaterial({map: dirtSide}),
    new THREE.MeshLambertMaterial({map: dirtSide}), new THREE.MeshLambertMaterial({map: dirtSide})
];

// --- 2. 初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; });

// --- 3. 世界生成 ---
const boxGeo = new THREE.BoxGeometry(1,1,1);
const blocks = [];
for(let x=-10; x<10; x++) for(let z=-10; z<10; z++) {
    const m = new THREE.Mesh(boxGeo, grassMaterials);
    m.position.set(x, 0, z);
    scene.add(m);
    blocks.push(m);
}
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
camera.position.set(0, 1.7, 5);

// --- 4. 物理與狀態 ---
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false, isCrouching = false;
const velocity = new THREE.Vector3();
const playerRadius = 0.3;
let currentHeight = 1.7; // 動態高度

document.addEventListener('keydown', (e) => {
    if(e.code==='KeyW') moveF=true; if(e.code==='KeyS') moveB=true;
    if(e.code==='KeyA') moveL=true; if(e.code==='KeyD') moveR=true;
    if(e.code==='Space' && canJump) { velocity.y += 8.5; canJump = false; }
    if(e.shiftKey) isCrouching = true; // 使用 shiftKey 判定更穩定
});
document.addEventListener('keyup', (e) => {
    if(e.code==='KeyW') moveF=false; if(e.code==='KeyS') moveB=false;
    if(e.code==='KeyA') moveL=false; if(e.code==='KeyD') moveR=false;
    if(!e.shiftKey) isCrouching = false;
});

// --- 5. 核心判定函數 ---
function getGroundAt(x, z) {
    let maxH = -1; // 虛擬世界保底高度
    for (let b of blocks) {
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            if (b.position.y + 0.5 > maxH) maxH = b.position.y + 0.5;
        }
    }
    return maxH;
}

function checkWall(x, y, z) {
    for (let b of blocks) {
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            // 檢查是否撞到方塊側面 (胸口高度判定)
            if (y - 0.8 < b.position.y + 0.5 && y + 0.1 > b.position.y - 0.5) return true;
        }
    }
    return false;
}

// --- 6. 遊戲主迴圈 ---
let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);

        // 視角高度平滑切換
        const targetH = isCrouching ? 1.3 : 1.7;
        currentHeight += (targetH - currentHeight) * 0.15;

        // 物理阻力
        velocity.x -= velocity.x * 10 * dt;
        velocity.z -= velocity.z * 10 * dt;
        velocity.y -= 28 * dt; // 重力 $g = 28$

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
            let speed = isCrouching ? 20 : 60;
            velocity.x += moveDir.x * speed * dt;
            velocity.z += moveDir.z * speed * dt;
        }

        // 當前地面高度
        const currentGround = getGroundAt(camera.position.x, camera.position.z);

        // 分軸移動與潛行鎖定
        const nextX = camera.position.x + velocity.x * dt;
        let canMoveX = !checkWall(nextX, camera.position.y, camera.position.z);
        if (isCrouching && canJump && canMoveX) {
            // 關鍵：如果移動後的高度低於當前高度，強制鎖定
            if (getGroundAt(nextX, camera.position.z) < currentGround - 0.1) canMoveX = false;
        }
        if (canMoveX) camera.position.x = nextX;

        const nextZ = camera.position.z + velocity.z * dt;
        let canMoveZ = !checkWall(camera.position.x, camera.position.y, nextZ);
        if (isCrouching && canJump && canMoveZ) {
            if (getGroundAt(camera.position.x, nextZ) < currentGround - 0.1) canMoveZ = false;
        }
        if (canMoveZ) camera.position.z = nextZ;

        // 垂直處理
        camera.position.y += velocity.y * dt;
        const finalGround = getGroundAt(camera.position.x, camera.position.z);
        
        if (camera.position.y - currentHeight <= finalGround) {
            if (velocity.y < 0) {
                velocity.y = 0;
                camera.position.y = finalGround + currentHeight;
                canJump = true;
            }
        } else {
            canJump = false;
        }

        prevT = t;
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});