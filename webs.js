/**
 * A high-performance particle system using position Verlet integration to resolve physics and render
 * on an HTML5 canvas. Features spatial partitioning, object pooling, adaptive LOD, and multiple
 * performance optimizations for smooth rendering even with thousands of particles.
 * Author: WillD
 * Date: 09-07-2025
 */

class ParticleSystem {

    //#region Constructor and initialization

    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.running = false;
        this.animationId = null;
        
        //tab switch resume
        this.wasRunningBeforeHidden = false;
        
        //default options, to be customized via options param
        this.opts = {
            //simulation settings
            particleCount: 300,
            radius: 1,
            spawnVelocity: 0.75,
            speed: 1.0, //simulation speed factor (1.0 = 60 FPS, 2.0 = 120 FPS, 0.5 = 30 FPS)

            //connection settings
            maxConnectionDistance: 100,    //maximum distance for any connection
            fadeStartDistance: 60,         //distance where connections start to fade
            opacityStep: 0.2,               //maximum alpha for connections
            connectionHysteresis: 0.1,     //hysteresis factor to prevent connection flickering (0.1 = 10% hysteresis)

            //rendering
            backgroundColor: '#5a5b62',
            particleColor: '#ffffff',
            enableConnections: true,
            enablePersistence: false,
            enableTrails: false,
            connectionTrailDuration: 100,   //trail duration in milliseconds (0.1 seconds)

            //performance settings
            enableSpatialPartitioning: true,
            gridSize: 20,
            
            //advanced performance settings
            enableObjectPooling: true,
            enableAdaptiveLOD: true,
            enableBatchRendering: true,
            maxConnectionsPerParticle: 10, //limit connections per particle
            performanceThreshold: 40, //fPS threshold for LOD
            lodConnectionReduction: 0.5, //reduce connections by 50% in LOD mode

            //mouse interaction settings
            enableMouseRepel: false,
            mouseRepelRadius: 100,
            mouseRepelStrength: 0.5,

            //physics settings
            enableAdvancedPhysics: false, //toggle between basic and advanced verlet integration
            damping: 0.99, //velocity damping factor (0.99 = 1% energy loss per frame)
            gravity: { x: 0, y: 50 }, //gravity force vector

            // ...existing (default) options
            ...options
        };
        
        //initial / internal state
        this.particles = [];
        this.particlePool = [];
        this.grid = new Map();
        this.lastTime = 0;
        this.accumulator = 0;
        
        //performance tracking
        this.frameCount = 0;
        this.lastFPSCheck = 0;
        this.currentFPS = 60;
        this.lodMode = false;
        
        //batch rendering arrays
        this.particlePositions = [];
        this.connectionLines = [];
        
        this.mouse = { x: -9999, y: -9999 };
        
        //canvas sizing & listeners
        this.fitToParent();
        this.boundResize = this.fitToParent.bind(this);
        this.boundVisibilityChange = this.handleVisibilityChange.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseLeave = this.handleMouseLeave.bind(this);
        
        window.addEventListener('resize', this.boundResize);
        document.addEventListener('visibilitychange', this.boundVisibilityChange);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseleave', this.boundMouseLeave);
    }
    //#endregion

    //#region Canvas sizing and event handlers
    
    //responsive canvas size / resolution resizing
    fitToParent() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        //set internal buffer size
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        //set CSS size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        //set transform for HiDPI
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        //store dimensions in CSS pixels for physics
        this.width = rect.width;
        this.height = rect.height;
        
        //rebuild grid if particles exist
        if (this.particles.length > 0) {
            this.rebuildGrid();
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            //pause the animation but remember that it was running
            if (this.running) {
                this.wasRunningBeforeHidden = true;
                this.stop();
            }
        } else {
            //resume if it was running before being hidden
            if (this.wasRunningBeforeHidden) {
                this.wasRunningBeforeHidden = false;
                this.start();
            }
        }
    }
    //#endregion
    
    //#region Performance tracking

    //updates FPS tracking and LOD mode
    updatePerformanceTracking(currentTime) {
        this.frameCount++;
        if (currentTime - this.lastFPSCheck >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSCheck = currentTime;
            
            //update LOD mode based on performance
            if (this.opts.enableAdaptiveLOD) {
                this.lodMode = this.currentFPS < this.opts.performanceThreshold;
            }else{
                this.lodMode = false;
            }
        }
    }
    //#endregion

    //#region Mouse interaction

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
    }

    handleMouseLeave() {
        //set to arbitrarily offscreen to prevent simulation interaction
        this.mouse.x = -9999;
        this.mouse.y = -9999;
    }


    applyMouseRepel() {
        if (!this.opts.enableMouseRepel) return;
        
        //reset force accumulators for all particles
        for (const particle of this.particles) {
            particle.fx = 0;
            particle.fy = 0;
        }
        
        for (const particle of this.particles) {
            const dx = particle.x - this.mouse.x;
            const dy = particle.y - this.mouse.y;
            const distanceSquared = dx * dx + dy * dy;

            //calculate repel radius
            const repelRadiusSquared = this.opts.mouseRepelRadius * this.opts.mouseRepelRadius;
            
            //only apply force if within radius
            if (distanceSquared < repelRadiusSquared) {
                const invRepelRadius = 1 / this.opts.mouseRepelRadius;
                const distance = Math.sqrt(distanceSquared);
                const force = (this.opts.mouseRepelRadius - distance) * invRepelRadius;
                
                //normalize direction and apply force
                const invDistance = 1 / distance;
                const repelX = dx * invDistance * force * this.opts.mouseRepelStrength;
                const repelY = dy * invDistance * force * this.opts.mouseRepelStrength;
                
                //accumulate acting forces
                particle.fx += repelX;
                particle.fy += repelY;
            }
        }
    }
    //#endregion 
    
    //#region Spatial partitioning functions

    //resolve the proper grid position (key) for a given coordinate
    getGridKey(x, y) {
        if (!this.opts.enableSpatialPartitioning) return null;
        //use numeric keys instead of strings for better performance
        const gridX = Math.floor(x / this.opts.gridSize);
        const gridY = Math.floor(y / this.opts.gridSize);
        return gridX * 10000 + gridY; //assuming grid size won't exceed 10000 in either dimension
    }
    
    /**
     * Adds a particle to it's respective grid cell depending on the grid key
     * @param {*} particle the particle to add
     * @returns the particle's grid key
     */
    addToGrid(particle) {
        if (!this.opts.enableSpatialPartitioning) return;
        const key = this.getGridKey(particle.x, particle.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(particle);
        particle.gridKey = key;
    }
    
    /**
     * Removes a particle from its current grid cell
     * this is called when a particle moves to a different grid cell
     * @param {*} particle 
     * @returns 
     */
    removeFromGrid(particle) {
        if (!this.opts.enableSpatialPartitioning || !particle.gridKey) return;
        if (this.grid.has(particle.gridKey)) {
            const cell = this.grid.get(particle.gridKey);
            const index = cell.indexOf(particle);
            if (index > -1) {
                cell.splice(index, 1);
                if (cell.length === 0) {
                    this.grid.delete(particle.gridKey);
                }
            }
        }
    }
    
    /**
     * Gets the nearby particles for a given particle, to draw connections
     * @param {*} particle the particle to check
     * @returns array of nearby particle objects
     */
    getNearbyParticles(particle) {
        if (!this.opts.enableSpatialPartitioning) {
            return this.particles;
        }
        
        const nearby = [];
        const key = this.getGridKey(particle.x, particle.y);
        if (!key) return this.particles;
        
        //extract grid coordinates from numeric key
        const gridY = key % 10000;
        const gridX = (key - gridY) / 10000;
        
        //pre-calculate grid keys for surrounding cells to avoid repeated calculations
        const surroundingKeys = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                surroundingKeys.push((gridX + dx) * 10000 + (gridY + dy));
            }
        }
        
        //check current cell and 8 surrounding cells (3x3 grid area)
        for (const checkKey of surroundingKeys) {
            if (this.grid.has(checkKey)) {
                const cell = this.grid.get(checkKey);
                //use array spread to push all elements at once for better performance
                nearby.push(...cell);
            }
        }
        return nearby;
    }
    
    /**
    * Rebuilds the spatial grid, clearing it and re-adding all particles
    * Used for mass / instant updates of entire grid, such as during window resize or
    * When particles are added/removed in bulk
    */
    rebuildGrid() {
        this.grid.clear();
        for (const particle of this.particles) {
            this.addToGrid(particle);
        }
    }
    
    /**
     * Gets a particle from pool, or creates new one if none
     */
    getPooledParticle(x, y) {
        let particle;
        if (this.opts.enableObjectPooling && this.particlePool.length > 0) {
            particle = this.particlePool.pop();
            //reset particle properties
            particle.x = x;
            particle.y = y;
            particle.pastX = x + (Math.random() - 0.5) * 2 * this.opts.spawnVelocity;
            particle.pastY = y + (Math.random() - 0.5) * 2 * this.opts.spawnVelocity;
            particle.vx = 0;
            particle.vy = 0;
            particle.fx = 0;
            particle.fy = 0;
            particle.gridKey = null;
        } else {
            particle = {
                x: x,
                y: y,
                gridKey: null,
                pastX: x + (Math.random() - 0.5) * 2 * this.opts.spawnVelocity,
                pastY: y + (Math.random() - 0.5) * 2 * this.opts.spawnVelocity,
                vx: 0,
                vy: 0,
                fx: 0,
                fy: 0
            };
        }
        
        this.addToGrid(particle);
        return particle;
    }
    
    /**
     * Returns particle to pool instead of garbage collection
     */
    returnParticleToPool(particle) {
        if (this.opts.enableObjectPooling) {
            this.removeFromGrid(particle);
            this.particlePool.push(particle);
        }
    }

    //#endregion

    //#region Particle management and simulation loop

    /**
     * Creates a new particle at the given position, using object pooling if enabled
     * @param {number} x - x-coordinate for the particle
     * @param {number} y - y-coordinate for the particle
     * @returns {Object} particle object from our pool. creates new one if none available (or pooling disabled)
     */
    createParticle(x, y) {
        return this.getPooledParticle(x, y);
    }
    
    /**
     * Updates a particle's position using Verlet integration, handles boundary collisions,
     * Manages spatial partitioning grid updates, and applies velocity damping.
     * @param {Object} particle - particle object to update
     * @param {number} deltaTime - time since last update in milliseconds
     */
    updateParticle(particle, deltaTime = 16.67) {

        const oldGridKey = particle.gridKey;
        
        //use verlet integration to resolve new / next position
        //store the current position before updating
        const currentX = particle.x;
        const currentY = particle.y;
        
        //calculate velocity from previous positions
        //here .vx represents the change in position (delta x) since last frame
        particle.vx = currentX - particle.pastX;
        particle.vy = currentY - particle.pastY;
        
        let newX, newY;
        
        const dt = deltaTime / 1000;
        
        if (this.opts.enableAdvancedPhysics) {
            //advanced verlet integration with acceleration and damping
            //newPosition = 2 * currentPosition - pastPosition + acceleration * dt²
            
            //apply damping to velocity
            particle.vx *= this.opts.damping;
            particle.vy *= this.opts.damping;
            
            //calculate acceleration, gravity + particle's stored forces (from mouse repel, etc.)
            //scale mouse forces for acceleration (convert from position units to acceleration units)
            const forceScale = 1 / (dt * dt); 
            const ax = this.opts.gravity.x + particle.fx * forceScale;
            const ay = this.opts.gravity.y + particle.fy * forceScale;
            
            //apply verlet integration formula with acceleration
            newX = 2 * currentX - particle.pastX + ax * dt * dt;
            newY = 2 * currentY - particle.pastY + ay * dt * dt;
        } else {
            //basic verlet integration with mouse forces
            //newPosition = currentPosition + velocity + force
            newX = currentX + particle.vx + particle.fx;
            newY = currentY + particle.vy + particle.fy;
        }

        particle.pastX = particle.x;
        particle.pastY = particle.y;
        particle.x = newX;
        particle.y = newY;

        //edge bounce logic
        if (particle.x >= this.width) {

            //reverse the velocity (i.e. bounce away from edge)
            const vx = particle.x - particle.pastX;
            particle.x = this.width;
            particle.pastX = particle.x + vx;

        } else if (particle.x <= 0) {

            //same as above, for left edge
            const vx = particle.x - particle.pastX;
            particle.x = 0;
            particle.pastX = particle.x + vx;
        }
        if (particle.y >= this.height) {

            //bottom edge
            const vy = particle.y - particle.pastY;
            particle.y = this.height;
            particle.pastY = particle.y + vy;

        } else if (particle.y <= 0) {

            //top edge
            const vy = particle.y - particle.pastY;
            particle.y = 0;
            particle.pastY = particle.y + vy;
        }
        
        //check if we moved to different grid cell
        if (this.opts.enableSpatialPartitioning) {
            const newGridKey = this.getGridKey(particle.x, particle.y);
            if (newGridKey !== oldGridKey) {
                this.removeFromGrid(particle);
                this.addToGrid(particle);
            }
        }
        
    }

    /**
     * Preformance friendly update for LOD mode - velocity, forces, and boundary checks
     * @param {Object} particle - particle to update minimally
     */
    applyMinimalParticleUpdate(particle) {

        const oldGridKey = particle.gridKey;

        //apply accumulated forces (mouse repel, etc.) to velocity
        particle.vx += particle.fx;
        particle.vy += particle.fy;

        //simple position update using updated velocity
        particle.x += particle.vx;
        particle.y += particle.vy;

        //update past positions for velocity calculation
        particle.pastX = particle.x - particle.vx;
        particle.pastY = particle.y - particle.vy;

        //simplified boundary logic
        if (particle.x >= this.width) {
            particle.x = this.width;
            particle.vx = -Math.abs(particle.vx);
        } else if (particle.x <= 0) {
            particle.x = 0;
            particle.vx = Math.abs(particle.vx);
        }

        if (particle.y >= this.height) {
            particle.y = this.height;
            particle.vy = -Math.abs(particle.vy);
        } else if (particle.y <= 0) {
            particle.y = 0;
            particle.vy = Math.abs(particle.vy)
        }

        //reset forces before next frame
        particle.fx = 0;
        particle.fy = 0;

        //update grid if moved to different cell
        if (this.opts.enableSpatialPartitioning) {
            const newGridKey = this.getGridKey(particle.x, particle.y);
            if (newGridKey !== oldGridKey) {
                this.removeFromGrid(particle);
                this.addToGrid(particle);
            }
        }

    }
    //simulation update / frame
    update(deltaTime) {

        //in LOD mode, update every second particle with the minimal update method
        if (this.lodMode && this.opts.enableAdaptiveLOD) {
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                if (i % 2 === 1) {
                    this.updateParticle(particle, deltaTime);
                } else {
                    this.applyMinimalParticleUpdate(particle, deltaTime);
                }
            }
        } else {
            //update all particles normally
            for (const particle of this.particles) {
                this.updateParticle(particle, deltaTime);
            }
        }

        if (this.opts.enableMouseRepel) {
            this.applyMouseRepel();
        }
    }
    
    //#endregion
    
    //#region Rendering

    /**
     * Calculate connection alpha based on distance (intuitive: closer = brighter)
     * @param {number} distance - Distance between particles
     * @returns {number} Alpha value between 0 and opacityStep
     */
    calculateConnectionAlpha(distance) {
        if (distance > this.opts.maxConnectionDistance) {
            //no connection beyond max distance
            return 0;
        }
        
        if (distance <= this.opts.fadeStartDistance) {
            //full opacity for close particles
            return this.opts.opacityStep; 
        }
        
        //linear fade from fadeStartDistance to maxConnectionDistance
        const fadeRange = this.opts.maxConnectionDistance - this.opts.fadeStartDistance;
        const fadeProgress = (distance - this.opts.fadeStartDistance) / fadeRange;
        const alpha = this.opts.opacityStep * (1.0 - fadeProgress);
        
        //minimum visible alpha
        return Math.max(alpha, 0.01); 
    }

    
    //batch collect all rendering data before drawing
    collectRenderData() {
        //pre-allocate arrays to reduce reallocations
        if (this.particlePositions.length !== this.particles.length) {
            //ensure we have enough positions
            while (this.particlePositions.length < this.particles.length) {
                this.particlePositions.push({ x: 0, y: 0 });
            }
            //trim if we have too many
            this.particlePositions.length = this.particles.length;
        }
        
        this.connectionLines.length = 0;
        
        //apply LOD reduction to max connection distance
        //scale connection distance inversely with particle count
        const baseConnectionDistance = this.opts.maxConnectionDistance;
        //density factor: more particles = smaller connections, fewer particles = larger connections
        const densityFactor = Math.max(0.5, 1000 / Math.max(1, this.particles.length));
        const scaledConnectionDistance = baseConnectionDistance * densityFactor;

        //add hysteresis in LOD mode to prevent connection flickering
        const hysteresisFactor = this.lodMode ? (1 + this.opts.connectionHysteresis) : 1.0;

        const maxConnectionDistance = this.lodMode ?
            scaledConnectionDistance * this.opts.lodConnectionReduction * hysteresisFactor :
            scaledConnectionDistance;
        
        //collect particle positions
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            this.particlePositions[i].x = particle.x;
            this.particlePositions[i].y = particle.y;
        }
        
        //collect connections (with LOD and limits)
        if (this.opts.enableConnections) {
            //pre-allocate some connection objects to reduce allocations
            //use a more adaptive approach based on particle count and connections per particle
            const estimatedConnections = Math.min(
                this.particles.length * this.opts.maxConnectionsPerParticle,
                30000 //reasonable upper limit to prevent excessive memory usage
            );
            while (this.connectionLines.length < estimatedConnections) {
                this.connectionLines.push({ x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0 });
            }
            let connectionIndex = 0;
            
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                const nearbyParticles = this.getNearbyParticles(particle);
                let connectionCount = 0;
                
                for (const otherParticle of nearbyParticles) {
                    if (otherParticle === particle) continue;
                    if (connectionCount >= this.opts.maxConnectionsPerParticle) break;
                    
                    const dx = particle.x - otherParticle.x;
                    const dy = particle.y - otherParticle.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > maxConnectionDistance) continue;
                    
                    const alpha = this.calculateConnectionAlpha(distance);
                    if (alpha <= 0.01) continue;
                    
                    //reuse connection objects to reduce allocations
                    if (connectionIndex >= this.connectionLines.length) {
                        this.connectionLines.push({
                            x1: particle.x,
                            y1: particle.y,
                            x2: otherParticle.x,
                            y2: otherParticle.y,
                            alpha: alpha
                        });
                    } else {
                        const connection = this.connectionLines[connectionIndex];
                        connection.x1 = particle.x;
                        connection.y1 = particle.y;
                        connection.x2 = otherParticle.x;
                        connection.y2 = otherParticle.y;
                        connection.alpha = alpha;
                    }
                    connectionIndex++;
                    
                    connectionCount++;
                }
            }
            //set the actual length based on last used index
            this.connectionLines.length = connectionIndex;
        }
    }
    
    //batch render all particles and connections
    render() {
        //clear canvas (unless options are enabled)
        if (!this.opts.enablePersistence && !this.opts.enableTrails) {
            this.ctx.fillStyle = this.opts.backgroundColor;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (this.opts.enableTrails && !this.opts.enablePersistence) {
            //for trails, use a semi-transparent overlay to create fade effect
            this.ctx.fillStyle = this.opts.backgroundColor + '20';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        //collect all render data first
        if (this.opts.enableBatchRendering) {
            this.collectRenderData();
            
            //render connections
            this.batchRenderConnections();
            this.batchRenderParticles();
        } else {
            //fallback to individual rendering
            this.ctx.strokeStyle = this.opts.particleColor;
            this.ctx.lineWidth = 1;
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            
            for (const particle of this.particles) {
                this.ctx.beginPath();
                this.drawParticle(particle);
                this.ctx.closePath();
            }
        }
    }
    
    //batch render all particles at once
    batchRenderParticles() {
        this.ctx.strokeStyle = this.opts.particleColor;
        this.ctx.lineWidth = 1;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        this.ctx.beginPath();
        for (const pos of this.particlePositions) {
            this.ctx.moveTo(pos.x + this.opts.radius, pos.y);
            this.ctx.arc(pos.x, pos.y, this.opts.radius, 0, 2 * Math.PI);
        }
        this.ctx.stroke();
    }
    
    
    //batch render all connections
    batchRenderConnections() {
        //early exit if no connections to render
        if (this.connectionLines.length === 0) return;
        
        const color = parseColor(this.opts.particleColor);
        
        //group connections by alpha for batch rendering
        const alphaGroups = new Map();
        
        //process current connections
        for (const line of this.connectionLines) {
            
            if(line.alpha <= 0) continue;

            //pre-multiply alpha by 100 and round to avoid division during rendering
            const alphaKey = Math.round(line.alpha * 100);
            if (!alphaGroups.has(alphaKey)) {
                alphaGroups.set(alphaKey, []);
            }
            alphaGroups.get(alphaKey).push(line);
        }
        
        //pre-calculate alpha values for each group to avoid division in the loop
        const alphaValues = new Map();
        for (const [alphaKey, lines] of alphaGroups) {
            alphaValues.set(alphaKey, alphaKey / 100);
        }

        //render each alpha group in one batch
        for (const [alphaKey, lines] of alphaGroups) {
            //use pre-calculated alpha value
            const alpha = alphaValues.get(alphaKey);
            this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            this.ctx.beginPath();
            
            for (const line of lines) {
                this.ctx.moveTo(line.x1, line.y1);
                this.ctx.lineTo(line.x2, line.y2);
            }
            
            this.ctx.stroke();
        }
    }
    
    drawParticle(particle) {

        this.ctx.save();
        
        //draw the particle
        this.ctx.arc(particle.x, particle.y, this.opts.radius, 0, 2 * Math.PI);
        this.ctx.stroke();

        //draw connections if enabled
        if (this.opts.enableConnections) {
            this.drawConnections(particle);
        }
        
        this.ctx.restore();
    }
    
    drawConnections(particle) {

        const nearbyParticles = this.getNearbyParticles(particle);
        
        let connectionCount = 0;
        for (const otherParticle of nearbyParticles) {
            if (otherParticle === particle) continue;
            if (connectionCount >= this.opts.maxConnectionsPerParticle) break;
            
            const dx = particle.x - otherParticle.x;
            const dy = particle.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            //distance threshold check - use scaled distance for consistency
            const baseConnectionDistance = this.opts.maxConnectionDistance;
            const densityFactor = Math.max(0.5, 1000 / Math.max(1, this.particles.length));
            const scaledConnectionDistance = baseConnectionDistance * densityFactor;
            //add hysteresis in LOD mode to prevent connection flickering
            const hysteresisFactor = this.lodMode ? (1 + this.opts.connectionHysteresis) : 1.0;
            const maxConnectionDistance = this.lodMode ?
                scaledConnectionDistance * this.opts.lodConnectionReduction * hysteresisFactor :
                scaledConnectionDistance;
                
            if (distance > maxConnectionDistance) continue;
            
            //dalculate alpha
            const alpha = this.calculateConnectionAlpha(distance);
            if (alpha <= 0.01) continue;
            
            //parse color and apply alpha
            const color = parseColor(this.opts.particleColor);
            this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            
            this.ctx.beginPath();
            this.ctx.moveTo(particle.x, particle.y);
            this.ctx.lineTo(otherParticle.x, otherParticle.y);
            this.ctx.stroke();
            
            connectionCount++;
        }
    }

    /**
      * main loop for continuously scheduling the next frame using requestAnimationFrame.
      * uses fixed timestep for physics simulation with accumulator pattern.
      *
      * @param {number} currentTime - Current timestamp from requestAnimationFrame
      */
    animate(currentTime) {
        if (!this.running) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.updatePerformanceTracking(currentTime);
        
        //always use fixed timestep for physics simulation, adjusted by speed
        this.accumulator += deltaTime;

        const targetFPS = 60;
        const effectiveTimestep = (1000 / targetFPS) / this.opts.speed;

        while (this.accumulator >= effectiveTimestep) {
            this.update(effectiveTimestep);
            this.accumulator -= effectiveTimestep;
        }
        
        this.render();
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
    //#endregion

    //#region API methods

    start() {
        if (this.running) return;
        
        this.running = true;
        this.lastTime = performance.now();
        this.lastFPSCheck = this.lastTime;
        this.frameCount = 0;
        this.animate(this.lastTime);
    }
    
    stop() {
        if (!this.running) return;
        
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    resize() {
        this.fitToParent();
    }
    
    destroy() {
        this.stop();

        window.removeEventListener('resize', this.boundResize);
        document.removeEventListener('visibilitychange', this.boundVisibilityChange);
 
        this.particles = [];
        this.particlePool = [];
        this.grid.clear();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * @param {Object} newOptions - new options to merge with existing
     */
    updateOptions(newOptions) {
        this.opts = { ...this.opts, ...newOptions };
        
        if (newOptions.gridSize || newOptions.enableSpatialPartitioning !== undefined) {
            this.rebuildGrid();
        }
    }
    
    /**
     * Return performance statistics
     */
    getStats() {
        return {
            fps: this.currentFPS,
            particleCount: this.particles.length,
            lodMode: this.lodMode,
            poolSize: this.particlePool.length,
            connectionCount: this.connectionLines.length
        };
    }
    
    addParticle(x, y) {
        const particle = this.createParticle(x, y);
        this.particles.push(particle);
        return particle;
    }
    
    removeParticle() {
        if (this.particles.length > 0) {
            const particle = this.particles.pop();
            this.returnParticleToPool(particle);
            return particle;
        }
        return null;
    }
    
    setParticleCount(count) {
        const targetCount = Math.max(0, Math.floor(count));
        
        while (this.particles.length < targetCount) {
            this.addParticle(
                Math.random() * this.width,
                Math.random() * this.height
            );
        }
        
        while (this.particles.length > targetCount) {
            this.removeParticle();
        }
    }

    getParticleCount() {
        return this.particles.length;
    }
    
    addRandomParticle() {
        this.addParticle(
            Math.random() * this.width,
            Math.random() * this.height
        );
    }
    //#endregion

}

//#region Helpers and UMD export

/**
* parses a color string and returns RGB values as an object.
* supports hex and rgb format, returns white (255, 255, 255) as default
* hex value to seperate r, g, and b method courtesy stackoverflow user Tim Down
* https://stackoverflow.com/a/5624139 
* 
* @param {string} colorString - The color string to parse
* @returns {Object} our color represented as RGB (0-255)
*/
function parseColor(colorString) {
    if (colorString.startsWith('#')) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorString);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    } else if (colorString.startsWith('rgb')) {
        const result = colorString.match(/\d+/g);
        return result ? {
            r: parseInt(result[0]),
            g: parseInt(result[1]),
            b: parseInt(result[2])
        } : { r: 255, g: 255, b: 255 };
    }
    return { r: 255, g: 255, b: 255 };
}


/**
 * initializes a particle system with the given canvas and configuration options.
 * creates a ParticleSystem instance and returns an API object for controlling the animation.
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to render particles on
 * @param {Object} options - Configuration options for the particle system
 * @returns {Object} API object with methods to control the particle system
 */
function initParticles(canvas, options = {}) {
    const system = new ParticleSystem(canvas, options);
    
    //initialize with default particles
    system.setParticleCount(options.particleCount || 2000);
    
    return {
        start: () => system.start(),
        stop: () => system.stop(),
        resize: () => system.resize(),
        destroy: () => system.destroy(),
        updateOptions: (opts) => system.updateOptions(opts),
        addParticle: (x, y) => system.addParticle(x, y),
        removeParticle: () => system.removeParticle(),
        setParticleCount: (count) => system.setParticleCount(count),
        getParticleCount: () => system.getParticleCount(),
        addRandomParticle: () => system.addRandomParticle(),
        getStats: () => system.getStats()
    };
}

/**
 * Universal module definition (UMD) pattern for exposing ParticleSystem and initParticles.
 * supports CommonJS (Node.js), AMD (RequireJS), and global browser environments.
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initParticles, ParticleSystem };
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return { initParticles, ParticleSystem }; });
} else {
    window.initParticles = initParticles;
    window.ParticleSystem = ParticleSystem;
}
//#endregion
