import * as THREE from 'three';
import { COLLISIONS } from './collision.js';

const SIMMY = {};

SIMMY.Simulator = function(gravity) {
    this.gravity = gravity || new THREE.Vector3(0,-9.8,0);
    this.wind = 0;
    this.springMeshes = [];
    this.planes = [];
    this.spheres = [];
    this.boxes = [];
    this.k_collision = 500; // change this to adjust how "bouncy" collisions are
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

SIMMY.Simulator.prototype.setWind = function(windForce) {
    this.wind = windForce;
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
    this.linearSprings = [];
    this.angleSprings = [];
};

SIMMY.SpringNode = function(position, mass) {
    this.velocityVec = new THREE.Vector3(0,0,0);
    this.position = position.clone();
    // console.log(position);
    // console.log(this.position);
    this.mass = mass;
    this.linearSprings = [];
    this.angleSprings = [];
    // TODO: make force calculation work by timestep instead of whats happening rn
    this.forceVec = new THREE.Vector3(0,0,0);
};

SIMMY.SpringNode.prototype.addSpring = function(spring) {
    if (spring instanceof SIMMY.Spring) {
        this.linearSprings.push(spring);
    } else if (spring instanceof SIMMY.AngleSpring) {
        this.angleSprings.push(spring);
    }
};

SIMMY.Spring = function(node1, node2, length, k) {
    this.node1 = node1;
    this.node2 = node2;
    this.length = length;
    this.k = k;
};

SIMMY.AngleSpring = function(cNode, node1, node2, angle, k) {
    this.cNode = cNode;
    this.node1 = node1;
    this.node2 = node2;
    this.angle = angle;
    this.k = k;
};

SIMMY.Simulator.prototype.update = function(tdelta) {
    // TODO: at the start of each loop, set all forces to 0 
    for (let i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].resetForces();
    }
    
    for (let i = 0; i < this.springMeshes.length; i++) {
        // add external accelerations (gravity, wind) to total_force.
        this.springMeshes[i].calcExternalForces(this.gravity.add(this.wind));

        // for each spring, apply correction force to each endpoint.
        // this.springMeshes[i].calcSpringForces();

        // use implicit euler to compute new point mass positions.
        this.springMeshes[i].applyForces();

        // handle collisions with other primitives. 
        
    }
    
}

SIMMY.SpringMesh.prototype.resetForces = function() {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                node.forceVec.set(0, 0, 0);
            }
        }
    }
};

// for gravity, wind, etc
SIMMY.SpringMesh.prototype.calcExternalForces = function(externalForces) {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                node.forceVec.add(externalForces);
            }
        }
    }
};

SIMMY.SpringMesh.prototype.calcSpringForces = function() {
    let spring;
    for (let i = 0; i < this.linearSprings.length; i++) {
        spring = this.linearSprings[i];
        // F = k * change in x
        const dir = spring.node2.position.clone().sub(this.node1.position).normalize();
        const newLength = spring.node2.position.clone().sub(this.node1.position).length();
        const forceMagnitude = (spring.length - newLength) * spring.k;
        
        const force = dir.multiplyScalar(forceMagnitude);
        spring.node1.forceVec.add(dir.multiplyScalar(-force));
        spring.node2.forceVec.add(dir.multiplyScalar(force));
    }
    let angleSpring;
    for (let i = 0; i < this.angleSprings.length; i++) {
        spring = this.angleSprings[i];
        // TODO fml
    }
};

SIMMY.SpringMesh.prototype.applyForces = function(tdelta) {
    // implicit Euler
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                
                // F = ma
                const aVec = node.forceVec.clone().multiplyScalar(1/node.mass);
                
                // update velocity before updating position (so we use future velocity)
                const vDiff = aVec.clone().multiplyScalar(tdelta);
                node.velocityVec.add(vDiff);

                // update position
                const posDiff = node.velocityVec.clone().multiplyScalar(tdelta);
                // WHY IS NODE.POSITION NULL???
                node.position.add(posDiff);
            }
        }
    }
    
}


// SIMMY.Simulator.prototype.update = function(tdelta) {
//     // zero things every timestep, then actually evaluate the force
//     let i;
//     for (i = 0; i < this.springMeshes.length; i++) {
//         this.springMeshes[i].calcGravity(this.gravity,this.wind || new THREE.Vector3(0,0,0), tdelta);
//     }
//     for (i = 0; i < this.springMeshes.length; i++) {
//         this.springMeshes[i].calcInfluence(this, tdelta);
//     }
// };

// SIMMY.SpringNode.prototype.updatePosition = function(posDiff) {
//     this.position.add(posDiff);
// };

// SIMMY.SpringNode.prototype.receiveInfluence = function(forceVec, tdelta, override) {
//     const c = override ? 0.0 : 0.6;  // Damping factor
//     const realForce = forceVec.sub(this.velocityVec.clone().multiplyScalar(c));
//     const aVec = realForce.clone().multiplyScalar(1/this.mass);
//     const posDiff = this.velocityVec.clone().multiplyScalar(tdelta).add(aVec.clone().multiplyScalar(0.5 * tdelta * tdelta));
//     const vDiff = aVec.clone().multiplyScalar(tdelta);
//     this.updatePosition(posDiff);
//     this.velocityVec.add(vDiff);
// };

// SIMMY.SpringNode.prototype.sendInfluence = function(tdelta) {
//     let spring;
//     for (let i = 0; i < this.linearSprings.length; i++) {
//         spring = this.linearSprings[i];
//         spring.calcForce(tdelta);
//     }
//     for (let i = 0; i < this.angleSprings.length; i++) {
//         spring = this.angleSprings[i];
//         spring.calcForce(tdelta);
//     }
// };

// SIMMY.SpringMesh.prototype.calcGravity = function(gravity, windForce, tdelta) {
//     let node;
//     for (let i = 0; i < this.nodes.length; i++) {
//         for (let j = 0; j < this.nodes[i].length; j++) {
//             for (let k = 0; k < this.nodes[i][j].length; k++) {
//                 node = this.nodes[i][j][k];
//                 // Combine gravity and wind forces
//                 const combinedForce = gravity.clone().multiplyScalar(node.mass).add(windForce.clone().multiplyScalar(node.mass));
//                 node.receiveInfluence(combinedForce, tdelta);
//                 //node.receiveInfluence(gravity.clone().multiplyScalar(node.mass), tdelta);
//             }
//         }
//     }
// };

// SIMMY.SpringMesh.prototype.calcInfluence = function(scene, tdelta) {
//     let node;

//     // Multi-directional iterations to avoid biasing the simulation
//     const directions = [
//         [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
//         [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]
//     ];

//     for (const dir of directions) {
//         const iStart = dir[0] ? 0 : this.nodes.length - 1;
//         const iEnd = dir[0] ? this.nodes.length : -1;
//         const iStep = dir[0] ? 1 : -1;

//         for (let i = iStart; dir[0] ? i < iEnd : i > iEnd; i += iStep) {
//             const jStart = dir[1] ? 0 : this.nodes[i].length - 1;
//             const jEnd = dir[1] ? this.nodes[i].length : -1;
//             const jStep = dir[1] ? 1 : -1;

//             for (let j = jStart; dir[1] ? j < jEnd : j > jEnd; j += jStep) {
//                 const kStart = dir[2] ? 0 : this.nodes[i][j].length - 1;
//                 const kEnd = dir[2] ? this.nodes[i][j].length : -1;
//                 const kStep = dir[2] ? 1 : -1;

//                 for (let k = kStart; dir[2] ? k < kEnd : k > kEnd; k += kStep) {
//                     node = this.nodes[i][j][k];
//                     node.sendInfluence();
//                 }
//             }
//         }
//     }

//     // Check for collisions
//     for (let i = 0; i < this.nodes.length; i++) {
//         for (let j = 0; j < this.nodes[i].length; j++) {
//             for (let k = 0; k < this.nodes[i][j].length; k++) {
//                 node = this.nodes[i][j][k];

//                 // Check plane collisions
//                 for (let n = 0; n < scene.planes.length; n++) {
//                     const plane = scene.planes[n];
//                     const ret = plane.nodeBelow(node);
//                     if (ret.status) {
//                         // reverted to 0ing velocity
//                         node.position.copy(ret.proj); 
//                         node.velocityVec.set(0,0,0);


//                         /*
//                         // force of collision is modeled by k * d * n, 
//                         // where k is a constant, d is the distance the particle has penetrated the surface, and n is the normal of the surface
//                         const distance = node.position.distanceTo(ret.proj);
//                         console.log(distance);
//                         // force of imaginary collision spring
//                         const collision_force = plane.normal.clone().normalize().multiplyScalar(scene.k_collision * distance);
//                         console.log(collision_force);

//                         // ????
//                         node.receiveInfluence(collision_force, tdelta);
//                         */


//                         // velocity-based collision handling
//                         // const offset = 0.001;
//                         // node.position.copy(ret.proj.add(plane.normal.clone().multiplyScalar(offset)));
                        
//                         // // Calculate bounce with capped restitution
//                         // const restitution = 0.2;
//                         // const normal = plane.normal.clone();
//                         // const vDotN = node.velocityVec.dot(normal);

//                         // if (vDotN < 0) {
//                         //     node.velocityVec.add(normal.multiplyScalar(-vDotN * (1 + restitution)));
//                         // }
//                     }
//                 }
                
//                 // Check sphere collisions
//                 for (let n = 0; n < scene.spheres.length; n++) {
//                     const sphere = scene.spheres[n];
//                     const ret = sphere.nodeBelow(node);
//                     if (ret.status) {
//                         // reverted to 0ing velocity
//                         node.position.copy(ret.proj); 
//                         node.velocityVec.set(0,0,0);

//                         // const normal = node.position.clone().sub(sphere.center).normalize();
                        
//                     }
//                 }

//                 for (let n = 0; n < scene.boxes.length; n++) {
//                     const box = scene.boxes[n];
//                     const ret = box.nodeBelow(node);
//                     if (ret.status) {
//                         node.position.copy(ret.proj);
//                         node.velocityVec.set(0,0,0);
//                         // lol
//                         // I don't want to do this stuff yet bc I would like to consolidate all collision objects into one loop
//                         // and if possible have collisions be handled by creating an imaginary collision spring
//                     }
//                 }

//             }
//         }
//     }
// };

// SIMMY.Spring.prototype.calcForce = function(tdelta) {
//     const dir = this.node2.position.clone().sub(this.node1.position).normalize();
//     const newLength = this.node2.position.clone().sub(this.node1.position).length();
//     const lenDiff = this.length - newLength;
//     const force = Math.min(Math.max(lenDiff * this.k, -4), 4); // Limit force magnitude
//     this.node2.receiveInfluence(dir.multiplyScalar(force), tdelta);
// };

// SIMMY.AngleSpring.prototype.calcForce = function(tdelta) {
//     const v1 = this.node1.position.clone().sub(this.cNode.position).normalize();
//     const v2 = this.node2.position.clone().sub(this.cNode.position).normalize();
//     const normal = v1.clone().cross(v2).normalize();
//     const vDiff = v2.clone().sub(v1).normalize();
//     const c = vDiff.clone().cross(normal).normalize();
//     const normC = c.clone().cross(vDiff).normalize();
//     const moveV1 = normC.clone().cross(v1.clone().negate()).normalize();
//     const moveV2 = normC.clone().cross(v2).normalize();
//     const angle = Math.acos(v1.dot(v2));
    
//     if (angle > this.angle) {
//         const negMoveV1 = moveV1.negate();
//         const negMoveV2 = moveV2.negate();
//         this.node1.receiveInfluence(negMoveV1.multiplyScalar((angle - this.angle)*this.k), tdelta);
//         this.node2.receiveInfluence(negMoveV2.multiplyScalar((angle - this.angle)*this.k), tdelta);
//     } else {
//         this.node1.receiveInfluence(moveV1.multiplyScalar((this.angle - angle)*this.k), tdelta);
//         this.node2.receiveInfluence(moveV2.multiplyScalar((this.angle - angle)*this.k), tdelta);
//     }
// };

SIMMY.Plane = COLLISIONS.Plane;
SIMMY.Sphere = COLLISIONS.Sphere;


export { SIMMY };