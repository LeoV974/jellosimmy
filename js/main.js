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
        
        // Initialize collision objects first
        this.collisionType = 'plane';
        this.initCollisionObjects();
        this.setupScene();
        
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.resetJello = this.resetJello.bind(this);
        this.disturbJello = this.disturbJello.bind(this);
        window.addEventListener('resize', this.onWindowResize);
        document.getElementById('reset').addEventListener('click', this.resetJello);
        document.getElementById('disturb').addEventListener('click', this.disturbJello);
        
        document.getElementById('collisionType').addEventListener('change', (e) => {
            this.switchCollisionType(e.target.value);
        });
        
        // Start animation loop
        this.lastTime = Date.now();
        this.animate();
    }
    
    initCollisionObjects() {
        // Create floor plane
        this.floor = new SIMMY.Plane(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 1, 0), 20, 20, this.scene);
        this.floor.mesh.receiveShadow = true;
        this.simulator.addPlane(this.floor);
        
        // Create sphere but don't add to simulator yet
        this.sphere = new SIMMY.Sphere(new THREE.Vector3(0, -5, 0), 2, this.scene);
        this.sphere.mesh.receiveShadow = true;
        this.sphere.mesh.visible = false;
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
        this.jelloCube = new SIMMY.Cube(2.5, 2.5, 2.5, 4, 4, 4, 0, 2, 0, this.scene);
        this.jelloCube.mesh.castShadow = true;
        this.jelloCube.mesh.receiveShadow = true;
        this.simulator.addSpringMesh(this.jelloCube);
    }
    
    switchCollisionType(type) {
        this.collisionType = type;
        
        if (type === 'plane') {
            // Remove sphere from simulator if it exists
            const sphereIndex = this.simulator.spheres.indexOf(this.sphere);
            if (sphereIndex !== -1) {
                this.simulator.spheres.splice(sphereIndex, 1);
            }
            
            // Add plane to simulator if not already there
            if (this.simulator.planes.indexOf(this.floor) === -1) {
                this.simulator.addPlane(this.floor);
            }
            
            // Update visibility
            this.floor.mesh.visible = true;
            this.sphere.mesh.visible = false;
        } else if (type === 'sphere') {
            // Remove plane from simulator
            const planeIndex = this.simulator.planes.indexOf(this.floor);
            if (planeIndex !== -1) {
                this.simulator.planes.splice(planeIndex, 1);
            }
            
            // Add sphere to simulator if not already there
            if (this.simulator.spheres.indexOf(this.sphere) === -1) {
                this.simulator.addSphere(this.sphere);
            }
            
            this.floor.mesh.visible = false;
            this.sphere.mesh.visible = true;
        }
        
        // Reset jello position
        this.resetJello();
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