import * as THREE from 'three';
const COLLISIONS = {};

COLLISIONS.Plane = function (position, normal, width, height, scene) {
    this.plane = new THREE.Plane();
    this.position = position || new THREE.Vector3(0, 0, 0);
    this.normal = normal || new THREE.Vector3(0, 1, 0);
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

COLLISIONS.Plane.prototype.nodeBelow = function (node) {
    const projPoint = new THREE.Vector3();
    this.plane.projectPoint(node.position, projPoint);
    const nodeVec = node.position.clone().sub(projPoint).normalize();
    return {
        status: nodeVec.dot(this.normal) < 0,
        proj: projPoint
    };
};

COLLISIONS.Sphere = function (center, radius, scene) {
    this.center = center || new THREE.Vector3(0, 0, 0);
    this.radius = radius || 5;

    // Create visual representation
    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x666666,
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.3
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.center);

    if (scene) scene.add(this.mesh);
};

COLLISIONS.Sphere.prototype.nodeBelow = function (node) {
    const nodeToCenter = node.position.clone().sub(this.center);
    const distance = nodeToCenter.length();

    if (distance < this.radius) {
        // Node is inside sphere, project it to the surface
        const direction = nodeToCenter.normalize();
        const projPoint = this.center.clone().add(direction.multiplyScalar(this.radius));

        return {
            status: true,
            proj: projPoint
        };
    }

    return {
        status: false,
        proj: node.position.clone()
    };
};

COLLISIONS.Box = function (xMin, xMax, yMin, yMax, zMin, zMax, scene) {
    this.xMin = xMin || -1;
    this.xMax = xMax || 1;
    this.yMin = yMin || -1;
    this.yMax = yMax || 1;
    this.zMin = zMin || -1;
    this.zMax = zMax || 1;

    const geometry = new THREE.BoxGeometry(xMax - xMin, yMax - yMin, zMax - zMin );
    const material = new THREE.MeshPhongMaterial({
        color: 0x666666,
        side: THREE.FrontSide,
        wireframe: false,
        transparent: true,
        opacity: 0.3
    })

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(new THREE.Vector3((xMin + xMax) / 2, (yMin + yMax) / 2, (zMin + zMax) / 2));

    if (scene) scene.add(this.mesh);
}

COLLISIONS.Box.prototype.nodeBelow = function (node) {
    // tbh what does this do
}

export { COLLISIONS };

