window.onload = function () {
    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    //slider UI vars
    var sliderButton = document.getElementById("showSliders");
    let sliderBG = document.getElementById("sliderBG");
    let sliderDiv = document.getElementById("sliderDiv");
    var timestepSlider = document.getElementById("timestep");
    sliderBG.style.display = 'none';//sliders hidden by default
    sliderDiv.style.display = 'none';
    
    //point vars
    let circles = [];
    let numCircles = 0;
    let radius = 1;//0.5 look scool
    let spawnVel = 0.5;
    
    //constraint vars
    let opacityStep = 0.1;
    let distThreshold = 50;
    let threshold = 50;
    
    //SetInterval vars
    var timestep = 15;
    var intervalId;

    //color vars
    var color;
    var colorR = 255;
    var colorG = 255;
    var colorB = 255;

    //use session to get desired amount of points
    let amount = sessionStorage.getItem("amount");
    if (amount == null || amount == 0 || amount == "") {
        amount = 200;
    }

    //return random float between max and min
    function getRandomNum(max, min) {
        num = Math.random() * (max - min) + min;
        return Math.round(num * 4) / 4;;//round to nearest 0.25
    }
    //TODO find out how to make mouse influence work
    //if point within radius from mouse pos, set its past vel to 0?

    //add pastVelOffset param to circle, letting us set the past vel offset
    //add checkbox to scale circle alpha with constraint alpha
    //add checkbox to change circle fillstyle color to set color (WIHTOUT AFFECTING PERFORMANCE)
    //add text to top of control saying "further down (on the list), higher performace impact"
    //add num input for # of cirlcles spawned per click, for loop spawn code in canvas click listener
    //add button to reset slider values (and or var values) to default

    //spawn multiple points in an area on click

    //PERFORMACE: ROUND EVERY USEAGE OF SLIDER VALUES, ESP MULTIPLICATION
    class Circle {
        constructor(x, y) {
            this.constraints = [];
            this.x = x;
            this.y = y;

            this.pastX = x + getRandomNum(spawnVel, -spawnVel);
            this.pastY = y + getRandomNum(spawnVel, -spawnVel);
            this.vx = 0;
            this.vy = 0;
        }

        update() {
            //preform the verlet, velocity is calculated based on our past and current position
            //no need to asign velocity to a var, it will be constant (no drag / gravity)
            this.vx = this.x - this.pastX;
            this.vy = this.y - this.pastY;

            let newX = this.x + /*(this.x - this.pastX) +*/ this.vx;
            let newY = this.y + this.vy;

            this.pastX = this.x;
            this.pastY = this.y;

            //and we update our next position based on that velocity
            this.x = newX;
            this.y = newY;

            this.vy = this.vx = 0;

            //screen bounce logic
            if (this.x >= canvas.width) {
                this.pastX = canvas.width + (canvas.width - this.pastX);
                this.x = canvas.width;
            } else if (this.x <= 0) {
                this.pastX *= -1;
                this.x = 0;
            }
            if (this.y >= canvas.height) {
                this.pastY = canvas.height + (canvas.height - this.pastY);
                this.y = canvas.height;
            } else if (this.y <= 0) {
                this.pastY *= -1;
                this.y = 0;
            }
            this.constraints.forEach((constraint) => constraint.update());
        }

        draw() {
            let i = this.constraints.length;
            while (i--) {
                if (this.constraints[i].dist < threshold) {
                    ctx.beginPath();
                    this.constraints[i].draw();
                    ctx.closePath();
                }
            }
            ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
        }
        attach(point) {
            this.constraints.push(new Constraint(this, point));
        }
        free(constraint) {
            this.constraints.splice(this.constraints.indexOf(constraint), 1);
        }
    }

    class Constraint {
        constructor(p1, p2) {
            this.p1 = p1;
            this.p2 = p2;
            this.alpha = 0;
            this.dist = 0;
        }

        update() {
            this.alpha = 0;
            let dx = this.p1.x - this.p2.x;
            let dy = this.p1.y - this.p2.y;
            this.dist = Math.sqrt(dx * dx + dy * dy);

            // if (this.dist > 200){
            //    this.p1.free(this);
            //    this.p2.free(this);
            // }else{
            //     this.p1.attach(this.p2);
            // }

            //console.log(dist);
            //for every int distance less than threshold (say 250 or smth(500 is too high)) increase alpha by 0.1?
            let diff = threshold - this.dist;

            if (this.dist < distThreshold) {
                if (diff > 0) {//only update the alpha if the line is visible (i.e. within distance)
                    for (let index = 0; index < diff; index = index + 1) {
                        this.alpha += 0.1 * opacityStep;

                    }
                }
            }

        }

        draw() {
            ctx.strokeStyle = "rgba(" + colorR + "," + colorG + "," + colorB + "," + this.alpha + ")";
            ctx.moveTo(this.p1.x, this.p1.y);
            ctx.lineTo(this.p2.x, this.p2.y);
            ctx.stroke();
        }
    }

    var c;//inital circle
    //spawns a cricle at a random x and y
    function spawnCircle(x, y) {
        c = new Circle(x, y);
        circles[numCircles] = c;
        numCircles++;
        document.getElementById("count").innerHTML = numCircles + " particles";
    }

    for (let index = 0; index < amount; index++) {
        spawnCircle(getRandomNum(canvas.width - radius, radius * 2), getRandomNum(canvas.height - radius, radius * 2));
        if (index !== 0) {
            //foreach circle in circles, attach to every circle
            //TODO prevent circle from attaching to itself
            circles.forEach(circle => {
                circle.attach(circles[index])
            });
        }
    }


    //update the canvas every 10 ms,
    function startInterval(_interval) {
        // Store the id of the interval so we can clear it later
        intervalId = setInterval(update, _interval);
    }

    function update() {
        //fill the canvas
        ctx.beginPath();
        ctx.fillStyle = '#5a5b62';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.closePath();
        ctx.fillStyle = "#FFFFFF";

        circles.forEach(element => {
            element.update();
            ctx.beginPath();
            element.draw();
            ctx.closePath();
        });
    }

    //#region slider UI

    var radSlider = document.getElementById("radius");
    radSlider.addEventListener('input', function () {
        radius = radSlider.value;
    });

    var opacitySlider = document.getElementById("opacity");
    opacitySlider.addEventListener('input', function () {
        opacityStep = opacitySlider.value;
    });

    var thresholdSlider = document.getElementById("threshold");
    thresholdSlider.addEventListener('input', function () {
        threshold = thresholdSlider.value;
    });

    var distThresholdSlider = document.getElementById("distThreshold");
    distThresholdSlider.addEventListener('input', function () {
        distThreshold = distThresholdSlider.value;
    });


    timestepSlider.addEventListener('mouseup', function () {
        timestep = timestepSlider.value;
        clearInterval(intervalId);
        startInterval(timestep);
    });

    var amountBox = document.getElementById("amount");
    amountBox.addEventListener('input', function () {
        sessionStorage.setItem("amount", amountBox.value);
    });

    //pause button toggle
    var pauseToggle = false;
    var pause = document.getElementById("pause");
    pause.addEventListener("click", function () {
        if (!pauseToggle) {
            clearInterval(intervalId);
            pauseToggle = true;
            pause.innerHTML = "Play";
        } else {
            startInterval(timestepSlider.value);
            pauseToggle = false;
            pause.innerHTML = "Pause";
        }
    });

    //slider div toggle
    var divToggle = true;
    sliderButton.addEventListener("click", function () {
        if (!divToggle) {
            sliderBG.style.display = 'none';
            sliderDiv.style.display = 'none';
            divToggle = true;
        }
        else {
            sliderBG.style.display = 'block';
            sliderDiv.style.display = 'block';
            divToggle = false;
        }
    });

    //colour picker listener
    document.getElementById("colorPicker").addEventListener("change", function (event) {
        var color = event.target.value;
        colorR = hexToRgb(color).r;
        colorG = hexToRgb(color).g;
        colorB = hexToRgb(color).b
    }, false);

    //#endregion slider UI

    //add a circle on canvas click
    canvas.addEventListener('click', event => {
        var rect = canvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;

        spawnCircle(x, y);
        circles.forEach(circle => {
            circle.attach(c);
        });
    });

    //hex value to seperate r, g, and b method courtesy stackoverflow user Tim Down
    //https://stackoverflow.com/a/5624139 
    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    //start the simulation
    startInterval(timestep);
}
