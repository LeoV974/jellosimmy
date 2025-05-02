import * as THREE from 'three';
import { COLLISIONS } from './collision.js';

const SIMMY = {};


///////////////////////////// SIMUALATOR /////////////////////////////
SIMMY.Simulator = function(gravity) {
    this.gravity = gravity || new THREE.Vector3(0,-9.8,0);
    this.springMeshes = [];
    this.planes = [];
    this.spheres = [];
    this.boxes = [];
    this.k_collision = 5000; // change this to adjust how "bouncy" collisions are
};

SIMMY.Simulator.prototype.addSpringMesh = function(obj) {
    this.springMeshes.push(obj);
};

SIMMY.Simulator.prototype.addPlane = function(obj) {
    obj.type = 'plane';
    this.planes.push(obj);
};

SIMMY.Simulator.prototype.addSphere = function(obj) {
    obj.type = 'sphere';
    this.spheres.push(obj);
};

SIMMY.Simulator.prototype.addBox = function(obj) {
    obj.type = 'box';
    this.boxes.push(obj);
};

SIMMY.Simulator.prototype.update = function(tdelta) {
    let i;
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcGravity(this.gravity,this.wind || new THREE.Vector3(0,0,0), tdelta);
    }
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcInfluence(this, tdelta);
    }
};

SIMMY.Simulator.prototype.setWind = function(windForce) {
    this.wind = windForce;
  };

///////////////////////////// SPRING MESH /////////////////////////////
SIMMY.SpringMesh = function() {
    this.nodes = [];
    this.spheres = [];
};

SIMMY.SpringMesh.prototype.addNode = function(i, j, k, node) {
    if (!this.nodes[i]) {
        this.nodes[i] = [];
    }
    if (!this.nodes[i][j]) {
        this.nodes[i][j] = [];
    }
    this.nodes[i][j][k] = node;
    const sphere = new THREE.Sphere(node.position, 30);
    this.spheres.push(sphere);
};

SIMMY.SpringMesh.prototype.calcGravity = function(gravity, windForce, tdelta) {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                // Combine gravity and wind forces
                const combinedForce = gravity.clone().multiplyScalar(node.mass).add(windForce.clone().multiplyScalar(node.mass));
                node.receiveInfluence(combinedForce, tdelta);
                //node.receiveInfluence(gravity.clone().multiplyScalar(node.mass), tdelta);
            }
        }
    }
};

SIMMY.SpringMesh.prototype.calcInfluence = function(scene, tdelta) {
    let node;

    // Multi-directional iterations to avoid biasing the simulation
    const directions = [
        [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
        [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]
    ];

    for (const dir of directions) {
        const iStart = dir[0] ? 0 : this.nodes.length - 1;
        const iEnd = dir[0] ? this.nodes.length : -1;
        const iStep = dir[0] ? 1 : -1;

        for (let i = iStart; dir[0] ? i < iEnd : i > iEnd; i += iStep) {
            const jStart = dir[1] ? 0 : this.nodes[i].length - 1;
            const jEnd = dir[1] ? this.nodes[i].length : -1;
            const jStep = dir[1] ? 1 : -1;

            for (let j = jStart; dir[1] ? j < jEnd : j > jEnd; j += jStep) {
                const kStart = dir[2] ? 0 : this.nodes[i][j].length - 1;
                const kEnd = dir[2] ? this.nodes[i][j].length : -1;
                const kStep = dir[2] ? 1 : -1;

                for (let k = kStart; dir[2] ? k < kEnd : k > kEnd; k += kStep) {
                    node = this.nodes[i][j][k];
                    node.sendInfluence(tdelta);
                }
            }
        }
    }

    // Check for collisions
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                // Check plane collisions
                for (let n = 0; n < scene.planes.length; n++) {
                    const plane = scene.planes[n];
                    const ret = plane.nodeBelow(node);
                    if (ret.status) {
                        // reverted to 0ing velocity
                        // node.position.copy(ret.proj); 
                        // node.velocityVec.set(0,0,0);


                        // force-based collision that kind of works but slides
                        
                        // force of collision is modeled by k * d * n, 
                        // where k is a constant, d is the distance the particle has penetrated the surface, and n is the normal of the surface
                        const distance = node.position.distanceTo(ret.proj);
                        console.log(distance);
                        // force of imaginary collision spring
                        const collision_force = plane.normal.clone().normalize().multiplyScalar(scene.k_collision * distance);
                        console.log(collision_force);

                        // ????
                        // node.receiveInfluence(collision_force, tdelta);
                        // if (node.velocityVec.length() > 15){
                        //     // Position correction - add a small offset to prevent sticking
                        //     const offset = 0.05;
                        //     const offsetPosition = ret.proj.clone().add(
                        //         planes.planes[n].normal.clone().multiplyScalar(offset)
                        //     );
                        //     node.position.copy(offsetPosition);
                        //     node.velocityVec.copy(ret.reflectedVel);
                        // } else{
                        //     node.position.copy(ret.proj);
                        //     node.velocityVec.set(0,0,0);
                        // }
                        
                    }
                }
                
                // Check sphere collisions
                for (let n = 0; n < scene.spheres.length; n++) {
                    const sphere = scene.spheres[n];
                    const ret = sphere.nodeBelow(node);
                    if (ret.status) {
                        const distance = node.position.distanceTo(ret.proj);
                        const normal = ret.proj.sub(sphere.center);
                        const collision_force = normal.clone().normalize().multiplyScalar(scene.k_collision * distance);
                        node.receiveInfluence(collision_force, tdelta);

                        // reverted to 0ing velocity
                        // node.position.copy(ret.proj); 
                        // node.velocityVec.set(0,0,0);

                        // const normal = node.position.clone().sub(sphere.center).normalize();
                        
                        // // Move node slightly outside the sphere
                        // const offset = 0.001;
                        // node.position.copy(sphere.center.clone().add(normal.multiplyScalar(sphere.radius + offset)));
                        // const restitution = 0.2;
                        // const vDotN = node.velocityVec.dot(normal);
            
                        // if (vDotN < 0) {
                        //     node.velocityVec.add(normal.multiplyScalar(-vDotN * (1 + restitution)));
                        // }
                    }
                }

                // TODO: collision with axis-aligned rectangular prism
                for (let n = 0; n < scene.boxes.length; n++) {
                    const box = scene.boxes[n];
                    const ret = box.nodeBelow(node);
                    if (ret.status) {
                        node.position.copy(ret.proj);
                        node.velocityVec.set(0,0,0);
                        // lol
                        // I don't want to do this stuff yet bc I would like to consolidate all collision objects into one loop
                        // and if possible have collisions be handled by creating an imaginary collision spring
                    }
                }

            }
        }
    }
};

///////////////////////////// SPRING NODE /////////////////////////////
SIMMY.SpringNode = function(position, mass) {
    this.velocityVec = new THREE.Vector3(0,0,0);
    this.position = position;
    this.mass = mass;
    this.linearSprings = [];
    this.angleSprings = [];
    // TODO: make force calculation work by timestep instead of whats happening rn
    // this.forceVec = new THREE.Vector3(0,0,0);
};

SIMMY.SpringNode.prototype.addSpring = function(spring) {
    if (spring instanceof SIMMY.Spring) {
        this.linearSprings.push(spring);
    } else if (spring instanceof SIMMY.AngleSpring) {
        this.angleSprings.push(spring);
    }
};

SIMMY.SpringNode.prototype.updatePosition = function(posDiff) {
    this.position.add(posDiff);
};

SIMMY.SpringNode.prototype.receiveInfluence = function(forceVec, tdelta, override) {
    const c = override ? 0.0 : 0.6;  // Damping factor
    const realForce = forceVec.sub(this.velocityVec.clone().multiplyScalar(c));
    const aVec = realForce.clone().multiplyScalar(1/this.mass);
    const posDiff = this.velocityVec.clone().multiplyScalar(tdelta).add(aVec.clone().multiplyScalar(0.5 * tdelta * tdelta));
    const vDiff = aVec.clone().multiplyScalar(tdelta);
    this.updatePosition(posDiff);
    this.velocityVec.add(vDiff);
};

SIMMY.SpringNode.prototype.sendInfluence = function(tdelta) {
    let spring;
    for (let i = 0; i < this.linearSprings.length; i++) {
        spring = this.linearSprings[i];
        spring.calcForce(tdelta);
    }
    for (let i = 0; i < this.angleSprings.length; i++) {
        spring = this.angleSprings[i];
        spring.calcForce(tdelta);
    }
};

///////////////////////////// SPRINGS /////////////////////////////
SIMMY.Spring = function(node1, node2, length, k) {
    this.node1 = node1;
    this.node2 = node2;
    this.length = length;
    this.k = k;
};

SIMMY.Spring.prototype.calcForce = function(tdelta) {
    const dir = this.node2.position.clone().sub(this.node1.position).normalize();
    const newLength = this.node2.position.clone().sub(this.node1.position).length();
    const lenDiff = this.length - newLength;
    const force = Math.min(Math.max(lenDiff * this.k, -4), 4); // Limit force magnitude
    this.node2.receiveInfluence(dir.multiplyScalar(force), tdelta);
};

SIMMY.AngleSpring = function(cNode, node1, node2, angle, k) {
    this.cNode = cNode;
    this.node1 = node1;
    this.node2 = node2;
    this.angle = angle;
    this.k = k;
};

SIMMY.AngleSpring.prototype.calcForce = function(tdelta) {
    const v1 = this.node1.position.clone().sub(this.cNode.position).normalize();
    const v2 = this.node2.position.clone().sub(this.cNode.position).normalize();
    const normal = v1.clone().cross(v2).normalize();
    const vDiff = v2.clone().sub(v1).normalize();
    const c = vDiff.clone().cross(normal).normalize();
    const normC = c.clone().cross(vDiff).normalize();
    const moveV1 = normC.clone().cross(v1.clone().negate()).normalize();
    const moveV2 = normC.clone().cross(v2).normalize();
    const angle = Math.acos(v1.dot(v2));
    
    if (angle > this.angle) {
        const negMoveV1 = moveV1.negate();
        const negMoveV2 = moveV2.negate();
        this.node1.receiveInfluence(negMoveV1.multiplyScalar((angle - this.angle)*this.k), tdelta);
        this.node2.receiveInfluence(negMoveV2.multiplyScalar((angle - this.angle)*this.k), tdelta);
    } else {
        this.node1.receiveInfluence(moveV1.multiplyScalar((this.angle - angle)*this.k), tdelta);
        this.node2.receiveInfluence(moveV2.multiplyScalar((this.angle - angle)*this.k), tdelta);
    }
};

SIMMY.Plane = COLLISIONS.Plane;
SIMMY.Sphere = COLLISIONS.Sphere;


export { SIMMY };