import * as THREE from 'three';
import { COLLISIONS } from './collision.js';

const SIMMY = {};

SIMMY.Simulator = function(gravity) {
    this.gravity = gravity || new THREE.Vector3(0,-9.8,0);
    this.wind = new THREE.Vector3(0,0,0);
    this.springMeshes = [];
    this.planes = [];
    this.spheres = [];
    this.boxes = [];
    this.k_collision = 1000; // change this to adjust how "bouncy" collisions are
    // idk im having the problem where at like 80 it bounces way too far
    // but any lower and it falls through the plane
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
    // console.log("58");
    // console.log(this.velocityVec.clone());
    this.position = position.clone();
    // console.log("59");
    // console.log(position.clone()); // prints numbers
    // console.log("61");
    // console.log(this.position.clone()); // prints numbers
    // console.log("v");
    // console.log(this.velocityVec.clone()); // 0,0,0 as expected
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
        // const externalForces = this.gravity.add(this.wind);
        // console.log("external forces");
        // console.log(externalForces);
        this.springMeshes[i].calcExternalForces(this.gravity.add(this.wind));

        // for each spring, apply correction force to each endpoint.
        this.springMeshes[i].calcSpringForces();

        // handle collisions with other primitives. 
        for (let j = 0; j < this.planes.length; j++) {
            this.springMeshes[i].handleCollisions(this.planes[i], this.k_collision);
        }
        for (let j = 0; j < this.spheres.length; j++) {
            this.springMeshes[j].handleCollisions(this.spheres[j], this.k_collision);
        }
        for (let j = 0; j < this.boxes.length; j++) {
            this.springMeshes[j].handleCollisions(this.boxes[j], this.k_collision);
        }

        // use implicit euler to compute new point mass positions.
        this.springMeshes[i].applyForces(tdelta);
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
                // console.log("forceVec before add");
                // console.log(node.forceVec);
                // console.log("external forces");
                // console.log(externalForces);
                node.forceVec.add(externalForces);
                // console.log("forceVec after add");
                // console.log(node.forceVec);
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
        // the prev anglespring code was complete garbage
        // we just need to test if the angle is much bigger/smaller than 90 degrees
        // but tbh if angle springs arent even necessary then I'm not gonna bother to fill this
        
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
                node.position = node.position.clone().add(posDiff);
            }
        }
    }
    
}

SIMMY.SpringMesh.prototype.handleCollisions = function(obj, k_collision) {
    let node;
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];

                // console.log("205");
                // console.log(node.position.clone());
                const ret = obj.nodeBelow(node);
                if (ret.status) {

                // force of collision is modeled by k * d * n, 
                // where k is a constant, d is the distance the particle has penetrated the surface, and n is the normal of the surface
                const distance = node.position.distanceTo(ret.proj);

                // console.log(k_collision);

                // force of imaginary collision spring
                const collision_force = ret.normal.clone().normalize().multiplyScalar(k_collision * distance);
                // console.log(collision_force);
                node.forceVec.add(collision_force);
                // console.log(node.forceVec);
                }
                
            }
        }
    }
}

SIMMY.Plane = COLLISIONS.Plane;
SIMMY.Sphere = COLLISIONS.Sphere;
SIMMY.Box = COLLISIONS.Box;


export { SIMMY };