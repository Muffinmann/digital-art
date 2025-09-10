let scene, camera, renderer, controls;
let boids = [];
let boundarySize = 100;

const params = {
    numBoids: 200,
    visualRange: 20,
    separationDistance: 10,
    maxSpeed: 2,
    maxForce: 0.05,
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    boundaryForce: 0.5,
    boundaryBufferZone: 0.15,
    boundaryMinSpeed: 0.7,
    boundaryCurve: 3,
    showBoundary: true
};

class Boid {
    constructor() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * boundarySize,
            (Math.random() - 0.5) * boundarySize,
            (Math.random() - 0.5) * boundarySize
        );
        
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        
        this.acceleration = new THREE.Vector3();
        
        const geometry = new THREE.ConeGeometry(1.5, 4, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x004444,
            shininess: 100
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        scene.add(this.mesh);
    }
    
    edges() {
        const margin = boundarySize / 2;
        const bufferZone = margin * params.boundaryBufferZone;
        const turnFactor = params.boundaryForce;
        
        // Calculate distances to boundaries
        const distToRight = margin - this.position.x;
        const distToLeft = this.position.x + margin;
        const distToTop = margin - this.position.y;
        const distToBottom = this.position.y + margin;
        const distToFront = margin - this.position.z;
        const distToBack = this.position.z + margin;
        
        // Find minimum distance to any boundary
        const minDist = Math.min(
            distToRight, distToLeft,
            distToTop, distToBottom,
            distToFront, distToBack
        );
        
        // Apply speed dampening only very close to boundaries
        if (minDist < bufferZone) {
            // Gradually reduce speed as we approach boundary
            const speedMultiplier = params.boundaryMinSpeed + 
                ((1 - params.boundaryMinSpeed) * (minDist / bufferZone));
            this.velocity.multiplyScalar(speedMultiplier);
        }
        
        // Apply smooth turning forces based on proximity to boundaries
        // The force increases exponentially as we get closer
        if (distToRight < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToRight / bufferZone), params.boundaryCurve);
            this.velocity.x -= force;
        } else if (distToLeft < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToLeft / bufferZone), params.boundaryCurve);
            this.velocity.x += force;
        }
        
        if (distToTop < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToTop / bufferZone), params.boundaryCurve);
            this.velocity.y -= force;
        } else if (distToBottom < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToBottom / bufferZone), params.boundaryCurve);
            this.velocity.y += force;
        }
        
        if (distToFront < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToFront / bufferZone), params.boundaryCurve);
            this.velocity.z -= force;
        } else if (distToBack < bufferZone) {
            const force = turnFactor * Math.pow(1 - (distToBack / bufferZone), params.boundaryCurve);
            this.velocity.z += force;
        }
    }
    
    separation(neighbors) {
        const steer = new THREE.Vector3();
        let count = 0;
        
        for (let other of neighbors) {
            const d = this.position.distanceTo(other.position);
            if (d > 0 && d < params.separationDistance) {
                const diff = new THREE.Vector3().subVectors(this.position, other.position);
                diff.normalize();
                diff.divideScalar(d);
                steer.add(diff);
                count++;
            }
        }
        
        if (count > 0) {
            steer.divideScalar(count);
            steer.normalize();
            steer.multiplyScalar(params.maxSpeed);
            steer.sub(this.velocity);
            steer.clampLength(0, params.maxForce);
        }
        
        return steer;
    }
    
    alignment(neighbors) {
        const sum = new THREE.Vector3();
        let count = 0;
        
        for (let other of neighbors) {
            const d = this.position.distanceTo(other.position);
            if (d > 0 && d < params.visualRange) {
                sum.add(other.velocity);
                count++;
            }
        }
        
        if (count > 0) {
            sum.divideScalar(count);
            sum.normalize();
            sum.multiplyScalar(params.maxSpeed);
            const steer = new THREE.Vector3().subVectors(sum, this.velocity);
            steer.clampLength(0, params.maxForce);
            return steer;
        }
        
        return new THREE.Vector3();
    }
    
    cohesion(neighbors) {
        const sum = new THREE.Vector3();
        let count = 0;
        
        for (let other of neighbors) {
            const d = this.position.distanceTo(other.position);
            if (d > 0 && d < params.visualRange) {
                sum.add(other.position);
                count++;
            }
        }
        
        if (count > 0) {
            sum.divideScalar(count);
            return this.seek(sum);
        }
        
        return new THREE.Vector3();
    }
    
    seek(target) {
        const desired = new THREE.Vector3().subVectors(target, this.position);
        desired.normalize();
        desired.multiplyScalar(params.maxSpeed);
        const steer = new THREE.Vector3().subVectors(desired, this.velocity);
        steer.clampLength(0, params.maxForce);
        return steer;
    }
    
    flock(boids) {
        const sep = this.separation(boids);
        const ali = this.alignment(boids);
        const coh = this.cohesion(boids);
        
        sep.multiplyScalar(params.separationWeight);
        ali.multiplyScalar(params.alignmentWeight);
        coh.multiplyScalar(params.cohesionWeight);
        
        this.acceleration.add(sep);
        this.acceleration.add(ali);
        this.acceleration.add(coh);
    }
    
    update() {
        this.velocity.add(this.acceleration);
        this.velocity.clampLength(0, params.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.multiplyScalar(0);
        
        this.edges();
        
        this.mesh.position.copy(this.position);
        
        if (this.velocity.length() > 0) {
            const direction = this.velocity.clone().normalize();
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            this.mesh.quaternion.copy(quaternion);
        }
        
        const speed = this.velocity.length();
        const hue = 0.5 - (speed / params.maxSpeed) * 0.3;
        this.mesh.material.color.setHSL(hue, 1, 0.5);
        this.mesh.material.emissive.setHSL(hue, 1, 0.2);
    }
}

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0a, 100, 300);
    
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(100, 50, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 300;
    controls.minDistance = 20;
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x00ffff, 0.5, 200);
    pointLight.position.set(0, 50, 0);
    scene.add(pointLight);
    
    createBoundaryBox();
    
    for (let i = 0; i < params.numBoids; i++) {
        boids.push(new Boid());
    }
    
    initGUI();
    
    window.addEventListener('resize', onWindowResize, false);
}

function createBoundaryBox() {
    const geometry = new THREE.BoxGeometry(boundarySize, boundarySize, boundarySize);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ 
        color: 0x00ffff, 
        opacity: 0.3,
        transparent: true
    });
    
    if (window.boundaryBox) {
        scene.remove(window.boundaryBox);
    }
    
    window.boundaryBox = new THREE.LineSegments(edges, material);
    window.boundaryBox.visible = params.showBoundary;
    scene.add(window.boundaryBox);
}

function initGUI() {
    const gui = new dat.GUI();
    
    const flockingFolder = gui.addFolder('Flocking Behavior');
    flockingFolder.add(params, 'separationWeight', 0, 5).step(0.1).name('Separation');
    flockingFolder.add(params, 'alignmentWeight', 0, 5).step(0.1).name('Alignment');
    flockingFolder.add(params, 'cohesionWeight', 0, 5).step(0.1).name('Cohesion');
    flockingFolder.open();
    
    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'maxSpeed', 0.5, 10).step(0.1).name('Max Speed');
    physicsFolder.add(params, 'maxForce', 0.01, 0.5).step(0.01).name('Max Force');
    physicsFolder.add(params, 'visualRange', 5, 50).step(1).name('Visual Range');
    physicsFolder.add(params, 'separationDistance', 2, 30).step(1).name('Separation Dist');
    physicsFolder.open();
    
    const environmentFolder = gui.addFolder('Environment');
    environmentFolder.add(params, 'boundaryForce', 0, 2).step(0.1).name('Boundary Force');
    environmentFolder.add(params, 'boundaryBufferZone', 0.05, 0.5).step(0.05).name('Buffer Zone %');
    environmentFolder.add(params, 'boundaryMinSpeed', 0.1, 1.0).step(0.1).name('Min Speed at Edge');
    environmentFolder.add(params, 'boundaryCurve', 1, 5).step(0.5).name('Turn Sharpness');
    environmentFolder.add(params, 'showBoundary').name('Show Boundary').onChange((value) => {
        if (window.boundaryBox) {
            window.boundaryBox.visible = value;
        }
    });
    
    const generalFolder = gui.addFolder('General');
    generalFolder.add(params, 'numBoids', 10, 500).step(10).name('Number of Boids').onChange((value) => {
        while (boids.length < value) {
            boids.push(new Boid());
        }
        while (boids.length > value) {
            const boid = boids.pop();
            scene.remove(boid.mesh);
        }
    });
    
    const resetButton = {
        reset: function() {
            boids.forEach(boid => scene.remove(boid.mesh));
            boids = [];
            for (let i = 0; i < params.numBoids; i++) {
                boids.push(new Boid());
            }
        }
    };
    generalFolder.add(resetButton, 'reset').name('Reset Simulation');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    for (let boid of boids) {
        boid.flock(boids);
        boid.update();
    }
    
    controls.update();
    renderer.render(scene, camera);
}

init();
animate();