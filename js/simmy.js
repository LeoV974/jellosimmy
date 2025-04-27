import * as THREE from 'three';
const SIMMY = {};

SIMMY.Simulator = function(gravity) {
    this.gravity = gravity || new THREE.Vector3(0,-9.8,0);
    this.springMeshes = [];
    this.planes = [];
};

SIMMY.Simulator.prototype.addSpringMesh = function(obj) {
    this.springMeshes.push(obj);
};

SIMMY.Simulator.prototype.addPlane = function(obj) {
    this.planes.push(obj);
};

SIMMY.Simulator.prototype.update = function(tdelta) {
    let i;
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcGravity(this.gravity, tdelta);
    }
    for (i = 0; i < this.springMeshes.length; i++) {
        this.springMeshes[i].calcInfluence(this.planes, tdelta);
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

SIMMY.SpringMesh.prototype.calcInfluence = function(planes, tdelta) {
    let node;

    // Multi-directional iterations to avoid biasing the simulation
    const directions = [
        [1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 1, 1],
        [1, 1, 0], [0, 1, 0], [1, 1, 0], [0, 1, 0]
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

    // Check for plane collisions
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = 0; j < this.nodes[i].length; j++) {
            for (let k = 0; k < this.nodes[i][j].length; k++) {
                node = this.nodes[i][j][k];
                for (let n = 0; n < planes.length; n++) {
                    const ret = planes[n].nodeBelow(node);
                    if (ret.status) {
                        node.position.copy(ret.proj);
                        node.velocityVec.set(0,0,0);
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
};

SIMMY.SpringNode.prototype.addSpring = function(spring) {
    if (spring instanceof SIMMY.LinearSpring) {
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

SIMMY.LinearSpring = function(node1, node2, length, k) {
    this.node1 = node1;
    this.node2 = node2;
    this.length = length;
    this.k = k;
};

SIMMY.LinearSpring.prototype.calcForce = function(tdelta) {
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

SIMMY.Plane = function(position, normal, width, height, scene) {
    this.plane = new THREE.Plane();
    this.position = position || new THREE.Vector3(0,0,0);
    this.normal = normal || new THREE.Vector3(0,1,0);
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.position);
    
    // Create visual representation
    const geometry = new THREE.PlaneGeometry(width || 20, height || 20);
    const material = new THREE.MeshPhongMaterial({
        color: 0x666666,
        side: THREE.DoubleSide,
        wireframe: false
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    
    // Orient mesh to match normal
    if (normal.y === 1) {
        this.mesh.rotation.x = -Math.PI / 2;
    } else if (normal.y === -1) {
        this.mesh.rotation.x = Math.PI / 2;
    } else {
        this.mesh.lookAt(this.position.clone().add(this.normal));
    }
    
    if (scene) scene.add(this.mesh);
};

SIMMY.Plane.prototype.nodeBelow = function(node) {
    const projPoint = new THREE.Vector3();
    this.plane.projectPoint(node.position, projPoint);
    const nodeVec = node.position.clone().sub(projPoint).normalize();
    return {
        status: nodeVec.dot(this.normal) < 0,
        proj: projPoint
    };
};

export { SIMMY };