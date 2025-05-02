import * as THREE from 'three';
import { SIMMY } from './simmy.js';
SIMMY.Cube = function(xSize, ySize, zSize, xNodes, yNodes, zNodes, x, y, z, scene) {
    SIMMY.SpringMesh.call(this);
    
    // Create geometry for the jello cube
    const geometry = new THREE.BufferGeometry();
    
    const k_s = 50; // spring constant
    const kAngleSpring = 20;   // Angle spring strength
    const nodesDict = {};
    this.linearSprings = [];
    this.angleSprings = [];
    
    const startX = x - xSize/2;
    const startY = y - ySize/2;
    const startZ = z - zSize/2;
    const diffX = xSize/(xNodes-1);
    const diffY = ySize/(yNodes-1);
    const diffZ = zSize/(zNodes-1);
    
    let i, j, k, node;
    
    // Create nodes grid
    for (i = 0; i < xNodes; i++) {
        const currentX = startX + i*diffX;
        for (j = 0; j < yNodes; j++) {
            const currentY = startY + j*diffY;
            for (k = 0; k < zNodes; k++) {
                const currentZ = startZ + k*diffZ;
                const position = new THREE.Vector3(currentX, currentY, currentZ);
                // console.log(position);
                node = new SIMMY.SpringNode(position, 1);
                console.log(node.position.clone());
                this.addNode(i, j, k, node);
                nodesDict[i+"_"+j+"_"+k] = node;
            }
        }
    }
    
    // Connect the nodes with springs
    for (i = 0; i < xNodes; i++) {
        for (j = 0; j < yNodes; j++) {
            for (k = 0; k < zNodes; k++) {
                node = nodesDict[i+"_"+j+"_"+k];
                let s;
                const springs = {};
                const k_bending = 0.2 * k_s;
                
                // X-axis springs
                if (i > 0) { // -x
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+j+"_"+k], diffX, k_s);
                    node.addSpring(s);
                    springs['-x'] = s;
                }
                if (i < xNodes-1) { //+x
                    s = new SIMMY.Spring(node, nodesDict[(i+1)+"_"+j+"_"+k], diffX, k_s);
                    node.addSpring(s);
                    springs['+x'] = s;
                }
                // X-axis bending springs (2nd neighbor)
                if (i > 1) { // -2x
                    s = new SIMMY.Spring(node, nodesDict[(i-2)+"_"+j+"_"+k], 2 * diffX, k_bending);
                    node.addSpring(s);
                    springs['-2x'] = s;
                }
                if (i < xNodes-2) { //+2x
                    s = new SIMMY.Spring(node, nodesDict[(i+2)+"_"+j+"_"+k], 2 * diffX, k_bending);
                    node.addSpring(s);
                    springs['+2x'] = s;
                }
                
                // Y-axis springs
                if (j > 0) { //-y
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j-1)+"_"+k], diffY, k_s);
                    node.addSpring(s);
                    springs['-y'] = s;
                }
                if (j < yNodes-1) { //+y
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j+1)+"_"+k], diffY, k_s);
                    node.addSpring(s);
                    springs['+y'] = s;
                }
                // Y-axis bending springs
                if (j > 1) { //-2y
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j-2)+"_"+k], 2 * diffY, k_bending);
                    node.addSpring(s);
                    springs['-2y'] = s;
                }
                if (j < yNodes-2) { //+2y
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j+2)+"_"+k], 2 * diffY, k_bending);
                    node.addSpring(s);
                    springs['+2y'] = s;
                }
                
                // Z-axis springs
                if (k > 0) { //-z
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+j+"_"+(k-1)], diffZ, k_s);
                    node.addSpring(s);
                    springs['-z'] = s;
                }
                if (k < zNodes-1) { //+z
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+j+"_"+(k+1)], diffZ, k_s);
                    node.addSpring(s);
                    springs['+z'] = s;
                }
                // Z-axis bending springs
                if (k > 1) { //-z
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+j+"_"+(k-2)], 2 * diffZ, k_bending);
                    node.addSpring(s);
                    springs['-2z'] = s;
                }
                if (k < zNodes-2) { //+z
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+j+"_"+(k+2)], 2 * diffZ, k_bending);
                    node.addSpring(s);
                    springs['+2z'] = s;
                }
                
                const k_shearing_face = 2 * k_s;
                // In-plane diagonal springs for better shape retention

                // Add diagonals in XY plane
                const XYdiagLength = Math.sqrt(diffX*diffX + diffY*diffY);
                if (i > 0 && j > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j-1)+"_"+k], 
                        XYdiagLength, k_shearing_face);
                    node.addSpring(s);
                }
                if (i > 0 && j < yNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j+1)+"_"+k], 
                        XYdiagLength, k_shearing_face);
                    node.addSpring(s);
                }

                // Add diagonals in XZ plane
                const XZdiagLength = Math.sqrt(diffX*diffX + diffZ*diffZ);
                if (i > 0 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+j+"_"+(k-1)], 
                        XZdiagLength, k_shearing_face);
                    node.addSpring(s);
                }
                if (i > 0 && k < zNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+j+"_"+(k+1)], 
                        XZdiagLength, k_shearing_face);
                    node.addSpring(s);
                }

                // Add diagonals in YZ plane
                const YZdiagLength = Math.sqrt(diffY*diffY + diffZ*diffZ);
                if (j > 0 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j-1)+"_"+(k-1)], 
                        YZdiagLength, k_shearing_face);
                    node.addSpring(s);
                }
                if (j > 0 && k < yNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[i+"_"+(j-1)+"_"+(k+1)], 
                        YZdiagLength, k_shearing_face);
                    node.addSpring(s);
                }

                // Cross bracing springs for additional stability
                // (diagonals between opposite vertices of a cube)
                // there are 4 of these in a cube, and 8 per vertex
                const cubeDiagLength = Math.sqrt(diffX*diffX + diffY*diffY + diffZ*diffZ);
                const k_shearing_body = 2 * k_s; // can adjust this later
                // -1, -1, -1
                if (i > 0 && j > 0 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j-1)+"_"+(k-1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // -1, -1, +1
                if (i > 0 && j > 0 && k < zNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j-1)+"_"+(k+1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // -1, +1, -1
                if (i > 0 && j < yNodes - 1 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j+1)+"_"+(k-1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // -1, +1, +1
                if (i > 0 && j < yNodes - 1 && k < zNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[(i-1)+"_"+(j+1)+"_"+(k+1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // +1, -1, -1
                if (i < xNodes-1 && j > 0 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i+1)+"_"+(j-1)+"_"+(k-1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // +1, -1, +1
                if (i < xNodes - 1 && j > 0 && k < zNodes - 1) {
                    s = new SIMMY.Spring(node, nodesDict[(i+1)+"_"+(j-1)+"_"+(k+1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // +1, +1, -1
                if (i < xNodes-1 && j < yNodes - 1 && k > 0) {
                    s = new SIMMY.Spring(node, nodesDict[(i+1)+"_"+(j+1)+"_"+(k-1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }
                // +1, +1, +1
                if (i < xNodes-1 && j < yNodes-1 && k < zNodes-1) {
                    s = new SIMMY.Spring(node, nodesDict[(i+1)+"_"+(j+1)+"_"+(k+1)], 
                        cubeDiagLength, k_shearing_body);
                    node.addSpring(s);
                }

                // Angle springs to maintain cube shape
                const paths = [
                    ['-x', '+y', '+x', '-y'],
                    ['-x', '+z', '+x', '-z'],
                    ['-z', '+y', '+z', '-y']
                ];

                for (let n = 0; n < paths.length; n++) {
                    for (let m = 0; m < paths[n].length - 1; m++) {
                        const s1 = springs[paths[n][m]];
                        const s2 = springs[paths[n][m + 1]];
                        if (s1 && s2) {
                            const angleSpring = new SIMMY.AngleSpring(node, s1.node2, s2.node2, Math.PI / 2, kAngleSpring);
                            node.addSpring(angleSpring);
                        }
                    }
                }


            }
        }
    }
    
    for (i = 0; i < xNodes; i++) {
        for (j = 0; j < yNodes; j++) {
            for (k = 0; k < zNodes; k++) {
                console.log(nodesDict[i+"_"+j+"_"+k]);
            }
        }
    }

    
    // Create faces for rendering
    const positions = [];
    const indices = [];
    let faceIndex = 0;
    
    // Function to create cube face
    function createFace(p1, p2, p3, p4) {
        const idx = positions.length / 3;
        
        // Add vertices
        positions.push(
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p3.x, p3.y, p3.z,
            p4.x, p4.y, p4.z
        );
        
        // Add two triangles
        indices.push(
            idx, idx + 1, idx + 2,
            idx, idx + 2, idx + 3
        );
        
        faceIndex += 4;
    }
    
    // Create the six faces of the cube
    // Left face
    i = 0;
    for (j = 0; j < yNodes-1; j++) {
        for (k = 0; k < zNodes-1; k++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+(k+1)].position,
                nodesDict[i+"_"+j+"_"+(k+1)].position
            );
        }
    }
    
    // Right face
    i = xNodes-1;
    for (j = 0; j < yNodes-1; j++) {
        for (k = 0; k < zNodes-1; k++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+(k+1)].position,
                nodesDict[i+"_"+j+"_"+(k+1)].position
            );
        }
    }
    
    // Bottom face
    j = 0;
    for (i = 0; i < xNodes-1; i++) {
        for (k = 0; k < zNodes-1; k++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+(k+1)].position,
                nodesDict[i+"_"+j+"_"+(k+1)].position
            );
        }
    }
    
    // Top face
    j = yNodes-1;
    for (i = 0; i < xNodes-1; i++) {
        for (k = 0; k < zNodes-1; k++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+(k+1)].position,
                nodesDict[i+"_"+j+"_"+(k+1)].position
            );
        }
    }
    
    // Back face
    k = 0;
    for (i = 0; i < xNodes-1; i++) {
        for (j = 0; j < yNodes-1; j++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+k].position,
                nodesDict[(i+1)+"_"+(j+1)+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+k].position
            );
        }
    }
    
    // Front face
    k = zNodes-1;
    for (i = 0; i < xNodes-1; i++) {
        for (j = 0; j < yNodes-1; j++) {
            createFace(
                nodesDict[i+"_"+j+"_"+k].position,
                nodesDict[i+"_"+(j+1)+"_"+k].position,
                nodesDict[(i+1)+"_"+(j+1)+"_"+k].position,
                nodesDict[(i+1)+"_"+j+"_"+k].position
            );
        }
    }
    
    // Set geometry attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    //geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Create mesh
    const material = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        flatShading: false,
        specular: 0xffffff,
        shininess: 30
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);
    
    // Save reference for reset
    this.originalNodePositions = {};
    for (i = 0; i < xNodes; i++) {
        for (j = 0; j < yNodes; j++) {
            for (k = 0; k < zNodes; k++) {
                this.originalNodePositions[i+"_"+j+"_"+k] = nodesDict[i+"_"+j+"_"+k].position.clone();
            }
        }
    }
    
    // Store parameters for disturb function
    this.nodesDict = nodesDict;
    this.dimensions = { xNodes, yNodes, zNodes };
    
    // Method to update geometry from node positions
    this.updateGeometry = function() {
        const positionAttribute = this.mesh.geometry.getAttribute('position');
        let vertIdx = 0;
        
        // Function to update a single face's vertices
        function updateFaceVertices(p1, p2, p3, p4) {
            positionAttribute.setXYZ(vertIdx++, p1.x, p1.y, p1.z);
            positionAttribute.setXYZ(vertIdx++, p2.x, p2.y, p2.z);
            positionAttribute.setXYZ(vertIdx++, p3.x, p3.y, p3.z);
            positionAttribute.setXYZ(vertIdx++, p4.x, p4.y, p4.z);
        }
        
        // Left face
        i = 0;
        for (j = 0; j < yNodes-1; j++) {
            for (k = 0; k < zNodes-1; k++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+(k+1)].position,
                    nodesDict[i+"_"+j+"_"+(k+1)].position
                );
            }
        }
        
        // Right face
        i = xNodes-1;
        for (j = 0; j < yNodes-1; j++) {
            for (k = 0; k < zNodes-1; k++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+(k+1)].position,
                    nodesDict[i+"_"+j+"_"+(k+1)].position
                );
            }
        }
        
        // Bottom face
        j = 0;
        for (i = 0; i < xNodes-1; i++) {
            for (k = 0; k < zNodes-1; k++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+(k+1)].position,
                    nodesDict[i+"_"+j+"_"+(k+1)].position
                );
            }
        }
        
        // Top face
        j = yNodes-1;
        for (i = 0; i < xNodes-1; i++) {
            for (k = 0; k < zNodes-1; k++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+(k+1)].position,
                    nodesDict[i+"_"+j+"_"+(k+1)].position
                );
            }
        }
        
        // Back face
        k = 0;
        for (i = 0; i < xNodes-1; i++) {
            for (j = 0; j < yNodes-1; j++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+k].position,
                    nodesDict[(i+1)+"_"+(j+1)+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+k].position
                );
            }
        }
        
        // Front face
        k = zNodes-1;
        for (i = 0; i < xNodes-1; i++) {
            for (j = 0; j < yNodes-1; j++) {
                updateFaceVertices(
                    nodesDict[i+"_"+j+"_"+k].position,
                    nodesDict[i+"_"+(j+1)+"_"+k].position,
                    nodesDict[(i+1)+"_"+(j+1)+"_"+k].position,
                    nodesDict[(i+1)+"_"+j+"_"+k].position
                );
            }
        }
        
        positionAttribute.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
    };
    
    // Reset function to restore original positions
    this.reset = function() {
        for (i = 0; i < xNodes; i++) {
            for (j = 0; j < yNodes; j++) {
                for (k = 0; k < zNodes; k++) {
                    const key = i+"_"+j+"_"+k;
                    nodesDict[key].position.copy(this.originalNodePositions[key]);
                    nodesDict[key].velocityVec.set(0, 0, 0);
                }
            }
        }
        this.updateGeometry();
    };
    
    // Disturb function to apply random force to jello
    this.disturb = function() {
        const midX = (this.dimensions.xNodes - 1)/ 2;
        const midY = (this.dimensions.yNodes - 1)/ 2;
        const midZ = (this.dimensions.zNodes - 1)/ 2;

        // randomly choose which direction to disturb, but always disturb with same magnitude of force
        // (avoids issue where sometimes you click it and it doesn't move much because it lowrolled all 3) 
        const forceDir = new THREE.Vector3(Math.round(Math.random()), Math.round(Math.random()), Math.round(Math.random()));
        // just a multiplier in case u want to change the magnitude of the disturbing force
        const multiplier = 0.5;

        // apply it to a central cube of size half the full jello cube
        for (i = Math.ceil(this.dimensions.xNodes / 4); i < Math.floor(3 * this.dimensions.xNodes / 4); i++) {
            for (j = Math.ceil(this.dimensions.yNodes / 4); j < Math.floor(3 * this.dimensions.yNodes / 4); j++) {
                for (k = Math.ceil(this.dimensions.zNodes / 4); k < Math.floor(3 * this.dimensions.zNodes / 4); k++) {
                    // force scales down as you get further from the center (will be 0 on a face node)
                    const force = new THREE.Vector3(multiplier * k_s * forceDir.x * (midX - Math.abs(i - midX)) / this.dimensions.xNodes, 
                                                    multiplier * k_s * forceDir.y * (midY - Math.abs(j - midY)) / this.dimensions.yNodes, 
                                                    multiplier * k_s * forceDir.z * (midZ - Math.abs(k - midZ)) / this.dimensions.zNodes);
                    
                    this.nodesDict[i+"_"+j+"_"+k].receiveInfluence(force, 0.1, true);
                }
            }
        }
        
    };
};

SIMMY.Cube.prototype = Object.create(SIMMY.SpringMesh.prototype);
SIMMY.Cube.prototype.constructor = SIMMY.Cube;