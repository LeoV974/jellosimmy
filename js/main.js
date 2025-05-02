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
        // changed gravity from -9.8 -98, let's pretend that our simulation is in units of 1 unit = 0.1m
        // bc a 2.5m jello cube "looks" like it falls too slowly, but that's bc we never see jello cubes that r 2.5m
        this.simulator = new SIMMY.Simulator(new THREE.Vector3(0, -98, 0));
        this.setupLights();
        
        // Setup material presets first
        this.setupMaterialPresets();
        this.currentMaterialType = 'phong';

        // pause functionality
        this.isPaused = false;
        
        // Initialize collision objects
        this.collisionObjects = [];
        this.collisionType = 'plane';
        this.initPlaneScene();
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

        this.windForce = new THREE.Vector3(0, 0, 0);
        this.windEnabled = false;
        document.getElementById('wind-toggle').addEventListener('click', () => {
            this.windEnabled = !this.windEnabled;
            const windForce = this.windEnabled ? new THREE.Vector3(5, 0, 0) : new THREE.Vector3(0, 0, 0);
            this.simulator.setWind(windForce);
        });
        
        // Start animation loop
        this.lastTime = Date.now();
        this.animate();
        this.setupDebugControls();
        this.enableDebugVisuals();
    }

    createWindIndicator() {
        const windArrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-5, 2, 0),
          3,
          0xff0000,
          0.5,
          0.3
        );
        this.windIndicator = windArrow;
        this.scene.add(windArrow);
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

    initPlane(position, normal, width, height) {
        const obj = new COLLISIONS.Plane(position, normal, width, height, this.scene);
        obj.mesh.receiveShadow = true;
        this.simulator.addPlane(obj);
        obj.mesh.visible = true;
        obj.type = 'plane';
        this.collisionObjects.push(obj);
    }

    initSphere(center, radius) {
        const obj = new COLLISIONS.Sphere(center, radius, this.scene);
        obj.mesh.receiveShadow = true;
        this.simulator.addPlane(obj);
        obj.mesh.visible = true;
        obj.type = 'sphere';
        this.collisionObjects.push(obj);
    }

    initBox(xMin, xMax, yMin, yMax, zMin, zMax) {
        const obj = new COLLISIONS.Box(xMin, xMax, yMin, yMax, zMin, zMax, this.scene);
        obj.mesh.receiveShadow = true;
        this.simulator.addPlane(obj);
        obj.mesh.visible = true;
        obj.type = 'box';
        this.collisionObjects.push(obj);
    }
    
    // this is the initial scene
    initPlaneScene() {
        this.initPlane(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 1, 0), 20, 20);
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
        this.createWindIndicator();
    }
    
    switchCollisionType(type) {
        this.collisionType = type;
        this.clearScene();
        
        if (type === 'plane') {
            this.initPlaneScene();
        } else if (type === 'sphere') {
            this.initSphere(new THREE.Vector3(0, -5, 0), 2);
        } else if (type == 'box') {
            this.initBox(-1, 1, -3, -1, -1, 1);
        } else if (type == 'scene1') {
            // the chute 
            this.initPlane(new THREE.Vector3(0, -6, 0), new THREE.Vector3(1, 1, 1), 20, 20);
            this.initPlane(new THREE.Vector3(0, -6, 0), new THREE.Vector3(-1, 1, 1), 20, 20);
        } else if (type == 'scene2') {
            // incline plane scene
            this.initPlane(new THREE.Vector3(1, -3, 1), new THREE.Vector3(1, 1, 1), 10, 20);
        } else if (type == 'scene3') {
            this.initSphere(new THREE.Vector3(1.5, 0, 1.5), 1.25);
            this.initSphere(new THREE.Vector3(1.5, -2, -1.5), 1.25);
            this.initSphere(new THREE.Vector3(-1.5, -4, -1.5), 1.25);
            this.initSphere(new THREE.Vector3(-1.5, -6, +1.5), 1.25);
            this.initSphere(new THREE.Vector3(1.5, -8, 1.5), 1.25);
            this.initSphere(new THREE.Vector3(1.5, -10, -1.5), 1.25);
            this.initSphere(new THREE.Vector3(-1.5, -12, -1.5), 1.25);
            this.initSphere(new THREE.Vector3(-1.5, -14, +1.5), 1.25);
        }
        // todo: some other scenes 
        // eg: "tetrominos", falling between several objects like plinko
        // 
        
        // Reset jello position
        this.resetJello();
    }

    clearScene() {
        // hide all objects
        for (const obj of this.collisionObjects) {
            
            obj.mesh.visible = false;
        }

        // clear all objects
        this.simulator.planes = [];
        this.simulator.spheres = [];
        this.simulator.boxes = [];
    }
    
    animate() {
        if (this.windIndicator) {
            this.windIndicator.visible = this.windEnabled;
            if (this.windEnabled) {
              this.windIndicator.setDirection(this.simulator.wind.clone().normalize());
            }
        }
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