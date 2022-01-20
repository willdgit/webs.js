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
    let spawnVel = 0.75;
    
    //constraint vars
    let opacityStep = 0.1;
    let distThreshold = 300;
    let threshold = 100;
    
    //SetInterval vars
    var timestep = 15;
    var intervalId;

    var colorR = 255;
    var colorG = 255;
    var colorB = 255;

    //use session storage to get desired amount of points
    let amount = sessionStorage.getItem("amount");
    if (amount == null || amount == 0 || amount == "") {
        amount = 200;
    }

    //return random float between max and min, round to nearest int by default
    function getRandomNum(max, min, round = 1) {
        num = Math.random() * (max - min) + min;
        return Math.round(num * round) / round;//round = 4 will round to nearest 0.25
    }
    
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
    class Circle {
        constructor(x, y) {
            this.constraints = [];
            this.x = x;
            this.y = y;

            this.pastX = x + getRandomNum(spawnVel, -spawnVel, 4);
            this.pastY = y + getRandomNum(spawnVel, -spawnVel, 4);
            this.vx = 0;
            this.vy = 0;
        }

        update() {
            //preform the verlet, velocity is calculated based on our past and current position
            //no (real) need to asign velocity to a var, it will be constant through the simulation (no drag / gravity)
            this.vx = this.x - this.pastX;
            this.vy = this.y - this.pastY;

            //update next position based on that velocity
            let newX = this.x + this.vx;
            let newY = this.y + this.vy;

            //update past and next positions
            this.pastX = this.x;
            this.pastY = this.y;
            this.x = newX;
            this.y = newY;

            //reset velocity
            this.vy = this.vx = 0;

            //edge bounce logic (if point is beyond the canvas, move it to edge and reverse direction)
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

        //we may not need to set i here, since every point is connected to every point, we 
        //should know the exact number of constraints for each point (n factorial?)
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
        //create a new constraint between this and point, add it to constraints[]
        attach(point) {
            this.constraints.push(new Constraint(this, point));
        }
        //remove constraint from this points constraint array
        sever(constraint) {
            this.constraints.splice(this.constraints.indexOf(constraint), 1);
        }
    }


    class Constraint {
        //each constraint takes in 2 points, use canvas lineTo to draw the constraint between the points
        constructor(p1, p2) {
            this.p1 = p1;
            this.p2 = p2;
            this.alpha = 0;//alpha will depend on a base value minus the distance multiplied by a coefficent
            this.dist = 0;//distance between the 2 points
        }

        update() {
            this.alpha = 0;
            //calculate the distance between each point
            let distx = this.p1.x - this.p2.x;
            let disty = this.p1.y - this.p2.y;
            this.dist = Math.sqrt(distx * distx + disty * disty);

            //this should help performance?, it does hugely the opposite
            // if (this.dist > 500){
            //    this.p1.sever(this);
            //    this.p2.sever(this);
            // }else if(this.dist<499){//AND we are not attached <- thats whats killing performance
            //     //this.p1.attach(this.p2);
            // }
            
            //calculate the difference between the distance and the threshold, 
            let diff = distThreshold - this.dist;
            if (this.dist < threshold) {
                if (diff > 0) {
                    //for every int in index(calculated above), 
                    //increase alpha by an amount times the coeffecent
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

    var c;//inital circle (declared here to be refrenced from canvas click listener)
    //spawns a cricle at a random x and y
    function spawnCircle(x, y) {
        c = new Circle(x, y);
        circles[numCircles] = c;
        numCircles++;
        //update view
        document.getElementById("count").innerHTML = numCircles + " particles";
    }

    //call spawnCircle() amount times, attaching each circle to all others
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

    //update the canvas every _interval ms
    function startInterval(_interval) {
        //store the id of the interval so we can stop & re-start it later
        intervalId = setInterval(update, _interval);
    }

    //main canvas update function
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

    //start the simulation
    startInterval(timestep);

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
}
