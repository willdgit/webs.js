# webs.js

An embeddable particle system library that provides a clean API for creating interactive particle animations in web applications.

`webs.js` is the first public release of my original **webs** project after a complete rework. You can view a demo of that original project [here](https://willdgit.github.io/webs/).

## Install & Quick Start

```bash
npm install webs.js
```

**CDN (Recommended for quick prototyping):**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Particle System Demo</title>
</head>
<body>
    <canvas id="myCanvas" width="800" height="600"></canvas>
    <script src="https://unpkg.com/webs.js@latest/webs.js"></script>
    <script>
        const canvas = document.getElementById('myCanvas');
        const particles = initParticles(canvas, {
            particleCount: 100,
            radius: 2,
            particleColor: '#00ff00'
        });
        particles.start();
    </script>
</body>
</html>
```

**ES6 Modules:**
```javascript
import { initParticles } from 'webs.js';

const canvas = document.getElementById('myCanvas');
const particles = initParticles(canvas, {
    particleCount: 100,
    radius: 2,
    particleColor: '#00ff00'
});
particles.start();
```

## Features

- **Embeddable**: No DOM dependencies, can be used in any canvas element
- **Optimized**: Spatial partitioning and efficient batch rendering
- **Configurable**: Extensive options for customization
- **Instantiatable**: Can run multiple independent systems on the same page
- **Interactive**: Provides a clean and enjoyable user experience

## Basic Usage

```javascript
// Initialize with canvas element
const canvas = document.getElementById('particleCanvas');
const particleSystem = initParticles(canvas, {
    particleCount: 200,
    radius: 2,
    particleColor: '#00ff00',
    backgroundColor: '#000000',
});

// Start the simulation
particleSystem.start();

// Add a particle where we click
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    particleSystem.addParticle(e.clientX - rect.left, e.clientY - rect.top);
});
```

## API Reference

### Entry Function

#### `initParticles(canvas, options)`
Initializes a new particle system on the specified canvas element.
**Parameters:**

-  `canvas` (HTMLCanvasElement): The canvas element to render on

-  `options` (Object, optional): Configuration options

  

**Returns:** An object with methods to control the particle system

  

### Configuration Options

```javascript
const options = {
	// Simulation settings
	particleCount: 300,           // Number of particles
	radius: 1,                    // Particle radius in pixels
	spawnVelocity: 0.75,          // Initial velocity multiplier
	speed: 1.0,                   // Simulation speed multiplier (1.0 = normal, 2.0 = 2x speed, 0.5 = half speed)

	// Connection settings
	maxConnectionDistance: 100,   // Maximum distance for any connection
	fadeStartDistance: 60,        // Distance where connections start to fade
	opacityStep: 0.2,             // Maximum alpha for connections
	connectionHysteresis: 0.1,    // Hysteresis factor to prevent flickering

	// Rendering settings
	backgroundColor: '#5a5b62',   // Background color
	particleColor: '#ffffff',     // Particle color
	enableConnections: true,      // Draw lines between particles
	enablePersistence: false,     // Don't clear canvas each frame
	enableTrails: false,          // Enable trail effect
	connectionTrailDuration: 100, // Trail duration in milliseconds

	// Performance settings
	enableSpatialPartitioning: true, // Use spatial grid optimization
	gridSize: 20,                 // Grid cell size for spatial partitioning
	enableObjectPooling: true,    // Reuse particle objects
	enableAdaptiveLOD: true,      // Adaptive level of detail
	enableBatchRendering: true,   // Batch render particles and connections
	maxConnectionsPerParticle: 10, // Limit connections per particle
	performanceThreshold: 40,     // FPS threshold for LOD mode
	lodConnectionReduction: 0.5,  // Reduce connections in LOD mode

	// Mouse interaction settings
	enableMouseRepel: false,      // Enable mouse repelling force
	mouseRepelRadius: 100,        // Radius of mouse repelling effect
	mouseRepelStrength: 0.5,      // Strength of repelling force (0-1)

	// Physics settings
	enableAdvancedPhysics: false, // Use advanced Verlet integration
	damping: 0.99,                // Velocity damping factor
	gravity: { x: 0, y: 50 }      // Gravity force vector
};
```

### Returned API Methods

#### Lifecycle Methods

-  `start()` - Start the animation loop

-  `stop()` - Stop the animation loop

-  `resize()` - Resize the canvas and rebuild the system

-  `destroy()` - Clean up resources and remove event listeners

#### Particle Management
-  `addParticle(x, y)` - Add a particle at specific coordinates

-  `removeParticle()` - Remove the last particle
-  `setParticleCount(count)` - Set the total number of particles
-  `getParticleCount()` - Get the current particle count
-  `addRandomParticle()` - Add a particle at a random position

#### Configuration
-  `updateOptions(options)` - Update simulation parameters in real-time

#### Statistics & Monitoring
-  `getStats()` - Get performance statistics
  - Returns: `{ fps, particleCount, lodMode, poolSize, connectionCount }`

## Browser Support

- Modern browsers with ES6 support

- Canvas API support required

- No external dependencies

## Examples

You can find live examples and demos at:

- [GitHub Repository](https://github.com/willdgit/webs.js) - View source code and examples

- [Live Demo](https://willdgit.github.io/webs.js) - Interactive particle system demonstrations


## Development & Testing

For local development, clone the repository:

```bash
git clone https://github.com/willdgit/webs.js.git
cd webs.js

# Install dependencies (if any)
npm install

# Run tests
npm test

# Start development (if you add a dev server)
npm run dev
```

### Testing

The library includes a simple test suite that verifies:
- Module loads correctly
- Core classes and functions are present
- UMD export pattern works
- JSDoc documentation is included

Run tests with: `npm test`

### CI/CD

GitHub Actions automatically:
- Runs tests on push/PR
- Builds the project
- Deploys demos to GitHub Pages

## Questions, Comments, Contributions

Contributions, suggestions, and feedback are welcome and appreciated! 

You can view the repo [here](https://github.com/willdgit/webs.js).

Please open an [issue](https://github.com/willdgit/webs.js/issues) or start a discussion to participate.

This library was inspired by [particles.js](https://github.com/VincentGarreau/particles.js/) and designed from scratch with modern principles in mind.

## License

ISC
