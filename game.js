import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';

// --- A. 視覺資源生成 ---
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

// --- B. 初始化 3D 環境 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; });

// --- C. 世界與物理設定 ---
const boxGeo = new THREE.BoxGeometry(1,1,1);
const blocks = [];
for(let x=-10; x<10; x++) for(let z=-10; z<10; z++) {
    const m = new THREE.Mesh(boxGeo, grassMaterials);
    m.position.set(x, 0, z);
    scene.add(m);
    blocks.push(m);
}
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
camera.position.set(0, 2, 5);

let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false, isCrouching = false;
const velocity = new THREE.Vector3();
const playerRadius = 0.3; 
let playerHeight = 1.7;

// --- D. 監聽控制 ---
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveF = true; break;
        case 'KeyS': moveB = true; break;
        case 'KeyA': moveL = true; break;
        case 'KeyD': moveR = true; break;
        case 'Space': if (canJump) velocity.y += 8.5; canJump = false; break;
        case 'ShiftLeft': 
        case 'ShiftRight': isCrouching = true; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveF = false; break;
        case 'KeyS': moveB = false; break;
        case 'KeyA': moveL = false; break;
        case 'KeyD': moveR = false; break;
        case 'ShiftLeft': 
        case 'ShiftRight': isCrouching = false; break;
    }
});

const raycaster = new THREE.Raycaster();
window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const inter = raycaster.intersectObjects(blocks);
    if (inter.length > 0) {
        if (e.button === 0) {
            scene.remove(inter[0].object);
            blocks.splice(blocks.indexOf(inter[0].object), 1);
        } else if (e.button === 2) {
            const b = new THREE.Mesh(boxGeo, grassMaterials);
            b.position.copy(inter[0].object.position).add(inter[0].face.normal);
            scene.add(b);
            blocks.push(b);
        }
    }
});

// --- E. 物理判定輔助 ---

// 1. 取得指定座標腳下的最大地面高度
function getGroundHeight(x, z) {
    let maxH = 0; // 預設虛擬地板為 0
    for (let b of blocks) {
        // 檢查玩家半徑範圍內是否有交集
        if (x + playerRadius > b.position.x - 0.5 && x - playerRadius < b.position.x + 0.5 &&
            z + playerRadius > b.position.z - 0.5 && z - playerRadius < b.position.z + 0.5) {
            if (b.position.y + 0.5 > maxH) maxH = b.position.y + 0.5;
        }
    }
    return maxH;
}

// 2. 檢查身體碰撞
function isColliding(x, y, z, checkType = 'body') {
    for (let block of blocks) {
        const b = block.position;
        if (x + playerRadius > b.x - 0.5 && x - playerRadius < b.x + 0.5 &&
            z + playerRadius > b.z - 0.5 && z - playerRadius < b.z + 0.5) {
            if (checkType === 'body') {
                if (y - 1.3 < b.y + 0.5 && y + 0.1 > b.y - 0.5) return true;
            } else if (checkType === 'head') {
                if (y + 0.3 > b.y - 0.5 && y < b.y - 0.5) return true;
            }
        }
    }
    return false;
}

// --- F. 遊戲主迴圈 ---
let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05); // 限制 dt 防止大幅跳轉

        if (isCrouching && canJump) {
            playerHeight = 1.4;
            velocity.x *= 0.5; // 潛行時強制減速，增加判定穩定性
            velocity.z *= 0.5;
        } else {
            playerHeight = 1.7;
        }

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
            let currentSpeed = (isCrouching && canJump) ? 20 : 60;
            velocity.x += moveDir.x * currentSpeed * dt;
            velocity.z += moveDir.z * currentSpeed * dt;
        }

        // --- 強勢分軸鎖定邏輯 ---
        const currentH = getGroundHeight(camera.position.x, camera.position.z);

        // X 軸移動
        let nextX = camera.position.x + velocity.x * dt;
        let canMoveX = !isColliding(nextX, camera.position.y, camera.position.z, 'body');
        if (isCrouching && canJump && canMoveX) {
            // 如果 X 位移會導致高度下降超過 0.1，強制封鎖
            if (getGroundHeight(nextX, camera.position.z) < currentH - 0.1) {
                canMoveX = false;
                velocity.x = 0;
            }
        }
        if (canMoveX) camera.position.x = nextX;

        // Z 軸移動
        let nextZ = camera.position.z + velocity.z * dt;
        let canMoveZ = !isColliding(camera.position.x, camera.position.y, nextZ, 'body');
        if (isCrouching && canJump && canMoveZ) {
            if (getGroundHeight(camera.position.x, nextZ) < currentH - 0.1) {
                canMoveZ = false;
                velocity.z = 0;
            }
        }
        if (canMoveZ) camera.position.z = nextZ;

        // 垂直移動
        camera.position.y += velocity.y * dt;

        if (velocity.y > 0 && isColliding(camera.position.x, camera.position.y, camera.position.z, 'head')) {
            velocity.y = 0; 
        }

        // 最終落地判定
        const finalH = getGroundHeight(camera.position.x, camera.position.z);
        const feetY = camera.position.y - playerHeight;
        if (feetY <= finalH) {
            if (velocity.y < 0) {
                camera.position.y = finalH + playerHeight;
                velocity.y = 0;
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