import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { SIMMY } from './simmy.js';

// Main application
class JelloSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222233);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(5, 4, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.simulator = new SIMMY.Simulator(new THREE.Vector3(0, -2.5, 0));
        this.setupLights();
        this.setupScene();
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.resetJello = this.resetJello.bind(this);
        this.disturbJello = this.disturbJello.bind(this);
        window.addEventListener('resize', this.onWindowResize);
        document.getElementById('reset').addEventListener('click', this.resetJello);
        document.getElementById('disturb').addEventListener('click', this.disturbJello);
        
        // Start animation loop
        this.lastTime = Date.now();
        this.animate();
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x444444);
        this.scene.add(ambientLight);
        
        // Main directional light with shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
        
        // Fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 8, -7);
        this.scene.add(fillLight);
    }
    
    setupScene() {
        // Add floor plane
        const floor = new SIMMY.Plane(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 1, 0), 20, 20, this.scene);
        floor.mesh.receiveShadow = true;
        this.simulator.addPlane(floor);
        // Add jello cube
        this.jelloCube = new SIMMY.Cube(2.5, 2.5, 2.5, 4, 4, 4, 0, 2, 0, this.scene);
        this.jelloCube.mesh.castShadow = true;
        this.jelloCube.mesh.receiveShadow = true;
        this.simulator.addSpringMesh(this.jelloCube);
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        // Calculate delta time
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastTime) / 5000;
        this.lastTime = currentTime;
        const subSteps = 10;
        for (let i = 0; i < subSteps; i++) {
            this.simulator.update(deltaTime / subSteps);
        }
        this.jelloCube.updateGeometry();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    resetJello() {
        this.jelloCube.reset();
    }
    disturbJello() {
        this.jelloCube.disturb();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new JelloSimulator();
});