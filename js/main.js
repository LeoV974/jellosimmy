import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { SIMMY } from './simmy.js';
import { COLLISIONS } from './collision.js';

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
        this.simulator = new SIMMY.Simulator(new THREE.Vector3(0, -9.8, 0));
        this.setupLights();
        
        // Setup material presets first
        this.setupMaterialPresets();
        this.currentMaterialType = 'standard';

        // pause functionality
        this.isPaused = false;
        
        // Initialize collision objects
        this.collisionType = 'plane';
        this.initCollisionObjects();
        this.setupScene();
        
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.resetJello = this.resetJello.bind(this);
        this.disturbJello = this.disturbJello.bind(this);
        this.changeShader = this.changeShader.bind(this); // Bind changeShader method
        this.togglePause = this.togglePause.bind(this);
        
        window.addEventListener('resize', this.onWindowResize);
        document.getElementById('pause').addEventListener('click', () => this.togglePause());
        document.getElementById('reset').addEventListener('click', this.resetJello);
        document.getElementById('disturb').addEventListener('click', this.disturbJello);
        document.getElementById('debug-toggle').addEventListener('click', () => this.toggleDebugVisuals());
        
        document.getElementById('collisionType').addEventListener('change', (e) => {
            this.switchCollisionType(e.target.value);
        });

        document.getElementById('shaderType').addEventListener('change', (e) => {
            this.changeShader(e.target.value);
        });
        
        // Start animation loop
        this.lastTime = Date.now();
        this.animate();
        this.setupDebugControls();
        this.enableDebugVisuals();
    }

    //diff materials
    setupMaterialPresets() {
        // Create environment map for crystal and mirror materials
        const cubeTextureLoader = new THREE.CubeTextureLoader();
        const envMap = cubeTextureLoader.setPath('https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/cube/pisa/')
            .load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);
            
        this.materialPresets = {
            standard: new THREE.MeshPhongMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                flatShading: false
            }),
            phong: new THREE.MeshPhongMaterial({
                color: 0x8800ff,
                specular: 0xffffff,
                shininess: 100,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                flatShading: false
            }),

            toon: new THREE.MeshToonMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            }),
            
            physical: new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.6,
                roughness: 0.2,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            }),
            
            wireframe: new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                wireframe: true,
                transparent: true,
                opacity: 0.9
            }),

            crystal: new THREE.MeshPhysicalMaterial({
                color: 0x88ccff,
                metalness: 0.0,
                roughness: 0.0,
                transmission: 0.95,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                envMap: envMap,
                envMapIntensity: 1.5,
                clearcoat: 0.8,
                clearcoatRoughness: 0.2,
                ior: 2.33,
                reflectivity: 0.8
            }),
            
            mirror: new THREE.MeshStandardMaterial({
                color: 0xf0f0f0,
                metalness: 1.0,
                roughness: 0.05,
                envMap: envMap,
                envMapIntensity: 1.5,
                side: THREE.DoubleSide
            }),

            material: new THREE.MeshPhongMaterial({
                color: 0x2194ce,
                shininess: 30,
                side: THREE.DoubleSide
            })
        };
    }

    changeShader(shaderType) {
        if (!this.jelloCube || !this.materialPresets[shaderType]) {
            console.error('Cannot change shader: missing cube or material type');
            return;
        }
        const newMaterial = this.materialPresets[shaderType].clone();
        this.jelloCube.mesh.material = newMaterial;
        this.jelloCube.mesh.geometry.computeVertexNormals();
        this.currentMaterialType = shaderType;
        this.renderer.render(this.scene, this.camera);
    }
    
    initCollisionObjects() {
        // Create floor plane
        this.floor = new COLLISIONS.Plane(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 1, 0), 20, 20, this.scene);
        this.floor.mesh.receiveShadow = true;
        this.simulator.addPlane(this.floor);
        
        // Create sphere but don't add to simulator yet
        this.sphere = new COLLISIONS.Sphere(new THREE.Vector3(0, -5, 0), 2, this.scene);
        this.sphere.mesh.receiveShadow = true;
        this.sphere.mesh.visible = false;

        // Create a box
        this.box = new COLLISIONS.Box(-1, 1, -3, -1, -1, 1, this.scene);
        this.box.mesh.receiveShadow = true;
        this.box.mesh.visible = false;
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
        const size = 2.5;
        const nodes = 4;

        this.jelloCube = new SIMMY.Cube(size, size, size, nodes, nodes, nodes, 0, 2, 0, this.scene);
        this.jelloCube.mesh.castShadow = true;
        this.jelloCube.mesh.receiveShadow = true;
        
        // Apply initial material
        if (this.currentMaterialType && this.materialPresets[this.currentMaterialType]) {
            this.jelloCube.mesh.material = this.materialPresets[this.currentMaterialType].clone();
        }
        
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
        } else if (type == 'box') {
            this.clearScene();
            // Remove plane from simulator
            const planeIndex = this.simulator.planes.indexOf(this.floor);
            if (planeIndex !== -1) {
                this.simulator.planes.splice(planeIndex, 1);
            }
            // Remove sphere from simulator
            const sphereIndex = this.simulator.spheres.indexOf(this.sphere);
            if (sphereIndex !== -1) {
                this.simulator.spheres.splice(sphereIndex, 1);
            }
            
            // show box
            this.floor.mesh.visible = false;
            this.sphere.mesh.visible = false;
            this.box.mesh.visible = true;
        }
        // todo: some other scenes 
        // eg: tetrominos, falling through several objects
        // 
        
        
        // Reset jello position
        this.resetJello();
    }

    clearScene() {
        // TODO 
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        // Calculate delta time
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastTime) / 5000;
        this.lastTime = currentTime;
        const subSteps = 10;

        if (!this.isPaused) {
            // Physics update code runs only when not paused
            const subSteps = 10;
            for (let i = 0; i < subSteps; i++) {
                this.simulator.update(deltaTime / subSteps);
            }
            this.jelloCube.updateGeometry();
        }

        this.jelloCube.updateGeometry();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        
        // Update debug visuals if enabled
        if (this.debugVisualsEnabled && this.debugPoints && this.animateDebug) {
            for (let i = 0; i < this.debugPoints.length; i++) {
                this.debugPoints[i].mesh.position.copy(this.debugPoints[i].node.position);
            }
            this.disableDebugVisuals();
            this.enableDebugVisuals();
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    resetJello() {
        this.jelloCube.reset();

        if (this.currentMaterialType && this.materialPresets[this.currentMaterialType]) {
            this.jelloCube.mesh.material = this.materialPresets[this.currentMaterialType].clone();
        }
        
        this.jelloCube.updateGeometry();
    }
    
    disturbJello() {
        this.jelloCube.disturb();
    }
}

// DEBUG VISUALIZATION
JelloSimulator.prototype.enableDebugVisuals = function() {
    if (this.debugObjects) this.scene.remove(this.debugObjects); // clear debug
    
    this.debugObjects = new THREE.Group(); // contains debug springs and nodes
    this.scene.add(this.debugObjects);
    
    this.visualizePoints();
    this.visualizeSprings();
    this.debugVisualsEnabled = true;
};

JelloSimulator.prototype.disableDebugVisuals = function() {
    if (this.debugObjects) {
        this.scene.remove(this.debugObjects);
        this.debugObjects = null;
        this.debugPoints = [];
    }
    this.debugVisualsEnabled = false;
};

JelloSimulator.prototype.toggleDebugVisuals = function() {
    if (!this.debugVisualsEnabled) {
        this.enableDebugVisuals();
        this.animateDebug = true;
        this.debugVisualsEnabled = true;
    } else if (this.animateDebug) {
        this.animateDebug = false;
    } else {
        this.disableDebugVisuals();
        this.debugVisualsEnabled = false;
    }
};

JelloSimulator.prototype.visualizePoints = function () {
    this.debugPoints = [];
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const nodeGeometry = new THREE.SphereGeometry(0.05, 8, 8); // sphere per node
    

    for (let i = 0; i < this.jelloCube.nodes.length; i++) {
        for (let j = 0; j < this.jelloCube.nodes[i].length; j++) {
            for (let k = 0; k < this.jelloCube.nodes[i][j].length; k++) {
                const node = this.jelloCube.nodes[i][j][k];
                let material;
                material = nodeMaterial;
                const nodeSphere = new THREE.Mesh(nodeGeometry, material);
                nodeSphere.position.copy(node.position);
                this.debugObjects.add(nodeSphere);
                this.debugPoints.push({
                    node: node,
                    mesh: nodeSphere
                });
            }
        }
    }

}

JelloSimulator.prototype.visualizeSprings = function() {
    if (!this.debugObjects) return;
    const springMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.3
    });
    const visualizedSprings = new Set(); // avoid duplicates

    for (let i = 0; i < this.jelloCube.nodes.length; i++) {
        for (let j = 0; j < this.jelloCube.nodes[i].length; j++) {
            for (let k = 0; k < this.jelloCube.nodes[i][j].length; k++) {
                const node = this.jelloCube.nodes[i][j][k];
                
                // Visualize all linear springs for this node
                for (let s = 0; s < node.linearSprings.length; s++) {
                    const spring = node.linearSprings[s];
                    
                    // Create unique key for this spring to avoid duplicates
                    const key1 = `${spring.node1.position.x},${spring.node1.position.y},${spring.node1.position.z}-${spring.node2.position.x},${spring.node2.position.y},${spring.node2.position.z}`;
                    const key2 = `${spring.node2.position.x},${spring.node2.position.y},${spring.node2.position.z}-${spring.node1.position.x},${spring.node1.position.y},${spring.node1.position.z}`;
                    
                    // Skip if already visualized
                    if (visualizedSprings.has(key1) || visualizedSprings.has(key2)) {
                        continue;
                    }
                    
                    // Mark as visualized
                    visualizedSprings.add(key1);
                    
                    // Create line geometry for this spring
                    const points = [
                        spring.node1.position,
                        spring.node2.position
                    ];
                    
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, springMaterial);
                    this.debugObjects.add(line);
                }
            }
        }
    }
};

JelloSimulator.prototype.setElasticity = function(value) {
    // Update elasticity for all planes
    for (let i = 0; i < this.simulator.planes.length; i++) {
        this.simulator.planes[i].elasticity = value;
    }
    
    // Update elasticity for all spheres
    for (let i = 0; i < this.simulator.spheres.length; i++) {
        this.simulator.spheres[i].elasticity = value;
    }
    
    console.log(`Set elasticity to ${value}`);
};


document.addEventListener('DOMContentLoaded', () => {
    const app = new JelloSimulator();
});