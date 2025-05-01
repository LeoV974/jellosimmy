import * as THREE from 'three';
import { COLLISIONS } from './collision.js';

const SIMMY = {};

SIMMY.Simulator = function(gravity) {
    this.gravity = gravity || new THREE.Vector3(0,-9.8,0);
    this.springMeshes = [];
    this.planes = [];
    this.spheres = [];
};

SIMMY.Simulator.prototype.addSpringMesh = function(obj) {
    this.springMeshes.push(obj);
};

SIMMY.Simulator.prototype.addPlane = function(obj) {
    this.planes.push(obj);
};

SIMMY.Simulator.prototype.addSphere = function(obj) {
    this.spheres.push(obj);
};

SIMMY.Simulator.prototype.update = function(tdelta) {
    let i;
    
    // Reset all force vectors
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].resetForces();
    }
    
    // Calculate and accumulate gravity forces
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcGravity(this.gravity, tdelta);
    }
    
    // Calculate and accumulate all other forces
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcInfluence(this, tdelta);
    }
    
    // Apply the accumulated forces and update positions
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].applyForces(tdelta);
    }
};

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

SIMMY.SpringMesh.prototype.calcGravity = function(gravity, tdelta) {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                node.receiveInfluence(gravity.clone().multiplyScalar(node.mass), tdelta);
            }
        }
    }
};

// Reset all force vectors to zero
SIMMY.SpringMesh.prototype.resetForces = function() {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                node.forceVec.set(0, 0, 0);
                node.forceApplied = false;
            }
        }
    }
};

// Apply all accumulated forces at once
SIMMY.SpringMesh.prototype.applyForces = function(tdelta) {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                if (node.forceApplied) {
                    // Apply all accumulated forces
                    const aVec = node.forceVec.clone().multiplyScalar(1/node.mass);
                    const posDiff = node.velocityVec.clone().multiplyScalar(tdelta).add(aVec.clone().multiplyScalar(0.5 * tdelta * tdelta));
                    const vDiff = aVec.clone().multiplyScalar(tdelta);
                    
                    node.updatePosition(posDiff);
                    node.velocityVec.add(vDiff);
                }
            }
        }
    }
};

SIMMY.SpringMesh.prototype.calcInfluence = function(collisionObjects, tdelta) {
    let node;

    // Calculate spring forces
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                node.sendInfluence(tdelta);
            }
        }
    }

    // Check for collisions
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                
                // Check plane collisions
                for (let n = 0; n < collisionObjects.planes.length; n++) {
                    const plane = collisionObjects.planes[n];
                    const ret = plane.nodeBelow(node);
                    if (ret.status) {
                        const offset = 0.001;
                        node.position.copy(ret.proj.add(plane.normal.clone().multiplyScalar(offset)));
                        
                        // Calculate bounce with capped restitution
                        const restitution = 0.2;
                        const normal = plane.normal.clone();
                        const vDotN = node.velocityVec.dot(normal);

                        if (vDotN < 0) {
                            // Add collision response force
                            const bounceForce = normal.multiplyScalar(-vDotN * (1 + restitution) * node.mass / tdelta);
                            node.receiveInfluence(bounceForce, tdelta, true);
                            
                            // Zero out the component of velocity in the direction of the normal
                            node.velocityVec.sub(normal.clone().multiplyScalar(vDotN));
                        }
                    }
                }
                
                // Check sphere collisions
                for (let n = 0; n < collisionObjects.spheres.length; n++) {
                    const sphere = collisionObjects.spheres[n];
                    const ret = sphere.nodeBelow(node);
                    if (ret.status) {
                        const normal = node.position.clone().sub(sphere.center).normalize();
                        
                        // Move node slightly outside the sphere
                        const offset = 0.001;
                        node.position.copy(sphere.center.clone().add(normal.multiplyScalar(sphere.radius + offset)));
                        const restitution = 0.2;
                        const vDotN = node.velocityVec.dot(normal);
            
                        if (vDotN < 0) {
                            // Add collision response force
                            const bounceForce = normal.multiplyScalar(-vDotN * (1 + restitution) * node.mass / tdelta);
                            node.receiveInfluence(bounceForce, tdelta, true);
                            
                            // Zero out the component of velocity in the direction of the normal
                            node.velocityVec.sub(normal.clone().multiplyScalar(vDotN));
                        }
                    }
                }
            }
        }
    }
};

SIMMY.SpringNode = function(position, mass) {
    this.velocityVec = new THREE.Vector3(0,0,0);
    this.position = position;
    this.mass = mass;
    this.linearSprings = [];
    this.angleSprings = [];
    this.forceVec = new THREE.Vector3(0,0,0);
    // Track whether forces have been applied this timestep
    this.forceApplied = false;
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
    // Instead of immediately applying forces, accumulate them in forceVec
    const c = override ? 0.0 : 0.6;  // Damping factor
    const dampingForce = this.velocityVec.clone().multiplyScalar(c);
    
    // Add the force to the accumulated force vector
    this.forceVec.add(forceVec);
    
    // If not overridden, also apply damping forces
    if (!override) {
        this.forceVec.sub(dampingForce);
    }
    
    this.forceApplied = true;
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
    
    // Apply force to both nodes in opposite directions
    this.node1.receiveInfluence(dir.clone().multiplyScalar(-force), tdelta);
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
    const angle = Math.acos(Math.min(Math.max(v1.dot(v2), -1), 1)); // Clamp to avoid NaN
    
    if (angle > this.angle) {
        const negMoveV1 = moveV1.negate();
        const negMoveV2 = moveV2.negate();
        
        // Calculate forces for all three nodes
        const force1 = negMoveV1.multiplyScalar((angle - this.angle) * this.k);
        const force2 = negMoveV2.multiplyScalar((angle - this.angle) * this.k);
        
        // Apply forces to outer nodes
        this.node1.receiveInfluence(force1, tdelta);
        this.node2.receiveInfluence(force2, tdelta);
        
        // Apply equal and opposite forces to center node to maintain conservation of momentum
        const centerForce = force1.clone().negate().add(force2.clone().negate());
        this.cNode.receiveInfluence(centerForce, tdelta);
    } else {
        // Calculate forces for all three nodes
        const force1 = moveV1.multiplyScalar((this.angle - angle) * this.k);
        const force2 = moveV2.multiplyScalar((this.angle - angle) * this.k);
        
        // Apply forces to outer nodes
        this.node1.receiveInfluence(force1, tdelta);
        this.node2.receiveInfluence(force2, tdelta);
        
        // Apply equal and opposite forces to center node to maintain conservation of momentum
        const centerForce = force1.clone().negate().add(force2.clone().negate());
        this.cNode.receiveInfluence(centerForce, tdelta);
    }
};

// Export the collision objects from the other file as part of SIMMY
SIMMY.Plane = COLLISIONS.Plane;
SIMMY.Sphere = COLLISIONS.Sphere;

export { SIMMY };