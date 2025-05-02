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
        color: 0x999999,
        side: THREE.DoubleSide,
        wireframe: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);

    // Orient mesh to match normal
    this.mesh.lookAt(this.position.clone().add(this.normal));

    if (scene) scene.add(this.mesh);
};

COLLISIONS.Plane.prototype.nodeBelow = function (node) {
    const projPoint = new THREE.Vector3();
    this.plane.projectPoint(node.position, projPoint);
    const nodeVec = node.position.clone().sub(projPoint).normalize();
    const isBelowPlane = nodeVec.dot(this.normal) < 0;
    if (isBelowPlane) {
        // Calculate reflected velocity
        const reflectedVelocity = this.reflectVelocity(node.velocityVec.clone(), this.normal, this.elasticity);
        return {
            status: true,
            proj: projPoint,
            reflectedVel: reflectedVelocity
        };
    }
    return {
        status: false,
        proj: projPoint
    };
};

COLLISIONS.Plane.prototype.reflectVelocity = function(velocity, normal, elasticity) {
    // Calculate reflected velocity: v' = v - 2(v·n)n
    const dotProduct = velocity.dot(normal);
    const reflection = velocity.sub(normal.clone().multiplyScalar(2 * dotProduct));
    return reflection.multiplyScalar(elasticity);
};

COLLISIONS.Sphere = function (center, radius, scene) {
    this.center = center || new THREE.Vector3(0, 0, 0);
    this.radius = radius || 5;

    // Create visual representation
    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x999999,
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.7
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

        // Calculate reflected velocity (direction is the normal at the contact point)
        const reflectedVelocity = this.reflectVelocity(node.velocityVec.clone(), direction, this.elasticity);
        
        return {
            status: true,
            proj: projPoint,
            reflectedVel: reflectedVelocity
        };
    }

    return {
        status: false,
        proj: node.position.clone()
    };
};

COLLISIONS.Sphere.prototype.reflectVelocity = function(velocity, normal, elasticity) {
    // Calculate reflected velocity: v' = v - 2(v·n)n
    const dotProduct = velocity.dot(normal);
    const reflection = velocity.sub(normal.clone().multiplyScalar(2 * dotProduct));
    return reflection.multiplyScalar(elasticity);
}


COLLISIONS.Box = function (xMin, xMax, yMin, yMax, zMin, zMax, scene) {
    this.xMin = xMin || -1;
    this.xMax = xMax || 1;
    this.yMin = yMin || -3;
    this.yMax = yMax || -1;
    this.zMin = zMin || -1;
    this.zMax = zMax || 1;
    
    const geometry = new THREE.BoxGeometry(xMax - xMin, yMax - yMin, zMax - zMin );
    const material = new THREE.MeshPhongMaterial({
        color: 0x999999,
        side: THREE.FrontSide,
        wireframe: false,
        transparent: true,
        opacity: 0.7
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(new THREE.Vector3(
        (this.xMin + this.xMax) / 2, 
        (this.yMin + this.yMax) / 2, 
        (this.zMin + this.zMax) / 2
    ));
    
    if (scene) scene.add(this.mesh);
};

COLLISIONS.Box.prototype.nodeBelow = function (node) {
    // Find the closest point on the box to the node's position
    const closestPoint = new THREE.Vector3(
        Math.max(this.xMin, Math.min(node.position.x, this.xMax)),
        Math.max(this.yMin, Math.min(node.position.y, this.yMax)),
        Math.max(this.zMin, Math.min(node.position.z, this.zMax))
    );
    
    // Calculate the distance between the node and the closest point
    const distance = node.position.distanceTo(closestPoint);
    
    // Check if the node is inside or very close to the box surface
    const isInside = (
        this.xMin <= node.position.x && node.position.x <= this.xMax &&
        this.yMin <= node.position.y && node.position.y <= this.yMax &&
        this.zMin <= node.position.z && node.position.z <= this.zMax
    );
    
    // Return collision status based on whether node is inside the box
    if (isInside || distance < 0.1) { // Using a small threshold for "close to surface"
        // If inside, find which face is closest to project onto
        const distToXMin = Math.abs(node.position.x - this.xMin);
        const distToXMax = Math.abs(node.position.x - this.xMax);
        const distToYMin = Math.abs(node.position.y - this.yMin);
        const distToYMax = Math.abs(node.position.y - this.yMax);
        const distToZMin = Math.abs(node.position.z - this.zMin);
        const distToZMax = Math.abs(node.position.z - this.zMax);
        
        // Find minimum distance
        const minDist = Math.min(
            distToXMin, distToXMax, 
            distToYMin, distToYMax, 
            distToZMin, distToZMax
        );
        
        // Project to closest face
        let projPoint = node.position.clone();
        
        if (minDist === distToXMin) {
            projPoint.x = this.xMin - 0.05; // Push slightly outside
        } else if (minDist === distToXMax) {
            projPoint.x = this.xMax + 0.05; // Push slightly outside
        } else if (minDist === distToYMin) {
            projPoint.y = this.yMin - 0.05; // Push slightly outside
        } else if (minDist === distToYMax) {
            projPoint.y = this.yMax + 0.05; // Push slightly outside
        } else if (minDist === distToZMin) {
            projPoint.z = this.zMin - 0.05; // Push slightly outside
        } else if (minDist === distToZMax) {
            projPoint.z = this.zMax + 0.05; // Push slightly outside
        }
        
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
export { COLLISIONS };

