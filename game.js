import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { getGrassMaterials } from './textures.js';
import { getGroundAt, checkWall } from './physics.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

document.getElementById('btn-play').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { overlay.style.display = 'none'; crosshair.style.display = 'block'; });
controls.addEventListener('unlock', () => { overlay.style.display = 'flex'; crosshair.style.display = 'none'; });

const grassMaterials = getGrassMaterials();
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const blocks = [];
for (let x = -10; x < 10; x++) {
    for (let z = -10; z < 10; z++) {
        const m = new THREE.Mesh(boxGeo, grassMaterials);
        m.position.set(x, 0, z);
        scene.add(m);
        blocks.push(m);
    }
}
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
camera.position.set(0, 5, 5);

let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false, isCrouching = false;
const velocity = new THREE.Vector3();
const playerRadius = 0.3;
let currentHeight = 1.7;

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'Space' && canJump) { velocity.y += 8.5; canJump = false; }
    if (e.shiftKey) isCrouching = true;
});
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
            scene.remove(intersect.object);
            blocks.splice(blocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) {
            const newBlock = new THREE.Mesh(boxGeo, grassMaterials);
            newBlock.position.copy(intersect.object.position).add(intersect.face.normal);
            scene.add(newBlock);
            blocks.push(newBlock);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

let prevT = performance.now();
function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const t = performance.now();
        const dt = Math.min((t - prevT) / 1000, 0.05);

        const targetH = isCrouching ? 1.3 : 1.7;
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
            let speed = (isCrouching && canJump) ? 25 : 60; 
            velocity.x += moveDir.x * speed * dt;
            velocity.z += moveDir.z * speed * dt;
        }

        const oldX = camera.position.x;
        const oldZ = camera.position.z;
        const feetY = camera.position.y - currentHeight;

        // 核心：分離 X 軸與 Z 軸的潛行判定
        
        // --- 處理 X 軸 ---
        const nextX = oldX + velocity.x * dt;
        let canMoveX = !checkWall(nextX, camera.position.y, oldZ, blocks, playerRadius);
        
        if (canMoveX) {
            if (isCrouching && canJump) {
                // 如果移動後腳下沒方塊
                if (getGroundAt(nextX, oldZ, blocks, playerRadius, feetY) === -Infinity) {
                    // 尋找最近的方塊邊界，把玩家拉回去
                    // 這邊用一個簡單暴力但有效的方法：直接退回上一步
                    camera.position.x = oldX;
                    velocity.x = 0;
                } else {
                    camera.position.x = nextX;
                }
            } else {
                camera.position.x = nextX;
            }
        } else {
            velocity.x = 0;
        }

        // --- 處理 Z 軸 ---
        const nextZ = oldZ + velocity.z * dt;
        let canMoveZ = !checkWall(camera.position.x, camera.position.y, nextZ, blocks, playerRadius);

        if (canMoveZ) {
            if (isCrouching && canJump) {
                if (getGroundAt(camera.position.x, nextZ, blocks, playerRadius, feetY) === -Infinity) {
                    // 同樣退回上一步
                    camera.position.z = oldZ;
                    velocity.z = 0;
                } else {
                    camera.position.z = nextZ;
                }
            } else {
                camera.position.z = nextZ;
            }
        } else {
            velocity.z = 0;
        }

        // 垂直位移與真實落地
        camera.position.y += velocity.y * dt;
        const finalGround = getGroundAt(camera.position.x, camera.position.z, blocks, playerRadius, camera.position.y - currentHeight);

        if (camera.position.y - currentHeight <= finalGround) {
            if (velocity.y < 0) {
                velocity.y = 0;
                camera.position.y = finalGround + currentHeight;
                canJump = true;
            }
        } else {
            canJump = false;
        }

        // 重生機制
        if (camera.position.y < -30) {
            camera.position.set(0, 5, 0);
            velocity.set(0, 0, 0);
        }
        
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