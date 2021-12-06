/**
 * This is a behavior to be used by characters in the isometric world of wade.iso. It handles free movement.
 * @constructor
 */
function IsoActionCharacter()
{
    var lastAnimation = null;
    var lastDirection = "se";

    var unitDirections =
    {
        n : {x:0, y:-1},
        ne: {x:0.89443, y:-0.44721},
        e : {x:1, y:0},
        se: {x:0.89443, y:0.44721},
        s : {x:0, y:1},
        sw: {x:-0.89443, y:0.44721},
        w : {x:-1, y:0},
        nw: {x:-0.89443, y:-0.44721}
    };

    var edgeVectors =
    {
        ne:{x:0.89443,  y:0.44721},
        se:{x:-0.89443, y:0.44721},
        sw:{x:-0.89443, y:-0.44721},
        nw:{x:0.89443,  y:-0.44721}
    };

    /**
     * The name of the behavior. This is set to 'IsoActionCharacter'.
     * @type {string}
     */
    this.name = 'IsoActionCharacter';

    /**
     * The movement speed of the character (in world units per second). Note that changing this won't affect any movement that is currently in progress, only future movements. Default is 160.
     * @type {number}
     */
    this.movementSpeed = 160;

    /**
     * The maximum height difference between two tiles that will allow this character to move from one tile to the next. Default is 20.
     * @type {number}
     */
    this.maxStepHeight = 20;

    /**
     * Keyboard keys to control the character. By default arrow keys are used
     * @type {{up: number, down: number, left: number, right: number}}
     */
    this.controls =
    {
        up:38,   // Up    arrow default
        down:40, // Down  arrow default
        left:37, // Left  arrow default
        right:39 // Right arrow default
    };

    /**
     * The game pad to use
     * @type {number} Number representing gamepad
     */
    this.gamePadIndex = 0;

    /**
     * Axis and direction of gamepad controls
     * @type {{up: {axis: number, axisDirection: number, buttons: Array}, down: {axis: number, axisDirection: number, buttons: Array}, left: {axis: number, axisDirection: number, buttons: Array}, right: {axis: number, axisDirection: number, buttons: Array}}}
     */
    this.gamePadControls =
    {
        up:{axis:1, axisDirection:-1, buttons:[]},
        down:{axis:1, axisDirection:1, buttons:[]},
        left:{axis:0, axisDirection:-1, buttons:[]},
        right:{axis:0,axisDirection:1, buttons:[]}
    };

    /**
     * Current state of the gamepad to base movement off
     * @type {{up: boolean, down: boolean, left: boolean, right: boolean}}
     */
    this._gamepadStates =
    {
        up:false,
        down:false,
        left:false,
        right:false
    };

    /**
     * Current state of the keys to base movement off
     * @type {{up: boolean, down: boolean, left: boolean, right: boolean}}
     */
    this._keyStates =
    {
        up:false,
        down:false,
        left:false,
        right:false
    };

    /**
     * Looks at both keyboard and gamepad state data to determine movement
     * @param direction The direction we are wanting to move
     * @returns {*} Whether or not there is input for the provided direction
     * @private
     */
    this._inputState = function(direction)
    {
        return (this._gamepadStates[direction] || this._keyStates[direction]);
    };

    /**
     * Specify the animation names to use for various walking and idle states
     * @type {{idle_n: string, idle_ne: string, idle_e: string, idle_se: string, idle_s: string, idle_sw: string, idle_w: string, idle_nw: string, walk_n: string, walk_ne: string, walk_e: string, walk_se: string, walk_s: string, walk_sw: string, walk_w: string, walk_nw: string}}
     */
    this.animations =
    {
        idle_n : "idle_n",
        idle_ne: "idle_ne",
        idle_e : "idle_e",
        idle_se: "idle_se",
        idle_s : "idle_s",
        idle_sw: "idle_sw",
        idle_w : "idle_w",
        idle_nw: "idle_nw",
        walk_n : "walk_n",
        walk_ne: "walk_ne",
        walk_e : "walk_e",
        walk_se: "walk_se",
        walk_s : "walk_s",
        walk_sw: "walk_sw",
        walk_w : "walk_w",
        walk_nw: "walk_nw"
    };

    /**
     * Current velocity of the object
     * @type {{x: number, y:number}}
     */
    this.velocity = {x:0, y:0};

    /**
     * Helper Function - Returns whether the co-ordinates are inside the isometric map boundary
     * @param x The x cell co-ordinate
     * @param z The z cell co-ordinate
     * @returns {boolean} Returns true if co-ordinates exist on map
     */
    this.inGrid = function(x, z)
    {
        var size = wade.iso.getNumTiles();
        return !(x >= size.x || z >= size.z || x < 0 || z < 0);
    };

    /**
     * Returns the closest movement direction given a provided velocity
     * @param vel Velocity or unit vector to calculate direction from
     */
    this.velocityToDirection = function(vel)
    {
        // var range = Math.PI/8;
        var directions =
        {
            n : 0,
            ne: Math.PI/4,
            e : Math.PI/2,
            se: Math.PI*3/4,
            s : Math.PI,
            sw: Math.PI*5/4,
            w : Math.PI*3/2,
            nw: Math.PI*7/4
        };

        var difference = Math.atan2(vel.y, vel.x) + Math.PI/2; // this is not right, has an error
        if(difference < 0)
        {
            difference += Math.PI*2;
        }
        var closestIt  = "n";
        var closestVal = 100000;
        for(var it in directions)
        {
            if(!directions.hasOwnProperty(it))
            {
                continue;
            }
            var dif = Math.abs(difference - directions[it]);
            if(dif < closestVal)
            {
                closestVal = dif;
                closestIt = it;
            }
        }
        return closestIt;
    };

    /**
     * Samples the gamepad and updates the gamepadStates object
     */
    this.updateGamepadState = function()
    {
        var analogThreshold = 0.4; // The minimum value for analog to register as 1 for digital conversion
        var sign = function(val) // Math.sign not widely supported
        {
            return (val == 0 ? 0 : Math.abs(val)/val);
        };

        // Set all to false
        for(var it in this._gamepadStates)
        {
            if(this._gamepadStates.hasOwnProperty(it))
            {
                this._gamepadStates[it] = false;
            }
        }

        var data = wade.getGamepadData();
        var pad = data[this.gamePadIndex];
        if(!pad)
        {
            return;
        }
        for(it in this.gamePadControls)
        {
            if(!this.gamePadControls.hasOwnProperty(it))
            {
                continue;
            }
            var control = this.gamePadControls[it];
            if(control.axis != -1) // Handle the axis
            {
                var dir = control.axisDirection;
                var padAxis = pad.axes[control.axis];
                if((sign(dir) == sign(padAxis)) && Math.abs(padAxis) > analogThreshold)
                {
                    this._gamepadStates[it] = true;
                }
            }
            for(var i=0; i<control.buttons.length; i++)
            {
                if(pad.buttons[control.buttons[i]] && pad.buttons[control.buttons[i]].pressed)
                {
                    this._gamepadStates[it] = true;
                    break;
                }
            }
        }
    };

    /**
     * Updates keyboard state
     * @param data Event data that specifies keyCode among other things
     * @returns {boolean}
     */
    this.onKeyDown = function(data)
    {
        for(var it in this.controls)
        {
            if(!this.controls.hasOwnProperty(it))
            {
                continue;
            }
            if(this.controls[it] == data.keyCode)
            {
                this._keyStates[it] = true;
            }
        }
        return true;
    };

    /**
     * Updates keyboard state
     * @param data Event data that specifies keyCode among other things
     * @returns {boolean}
     */
    this.onKeyUp = function(data)
    {
        for(var it in this.controls)
        {
            if(!this.controls.hasOwnProperty(it))
            {
                continue;
            }
            if(this.controls[it] == data.keyCode)
            {
                this._keyStates[it] = false;
            }
        }
        return true;
    };

    /**
     * Updates the velocity and calculates the closest direction for the animation system
     * @returns {{noMove: boolean, vel: {x: number, y: number}, direction: *}} Data relevant to resolving movement
     */
    this.updateVelocity = function()
    {
        var vel = {x:0, y:0};
        var noMove = true;
        for(var it in this._keyStates)
        {
            if(!this._keyStates.hasOwnProperty(it) || this._inputState(it) == false)
            {
                continue;
            }
            // Sum velocity
            if(it == "up")
            {
                wade.vec2.addInPlace(vel, unitDirections["n"]);
                noMove = false;
            }
            if(it == "down")
            {
                wade.vec2.addInPlace(vel, unitDirections["s"]);
                noMove = false;
            }
            if(it == "left")
            {
                wade.vec2.addInPlace(vel, unitDirections["w"]);
                noMove = false;
            }
            if(it == "right")
            {
                wade.vec2.addInPlace(vel, unitDirections["e"]);
                noMove = false;
            }
        }

        var direction = this.velocityToDirection(vel);
        this.velocity = wade.vec2.scale(unitDirections[direction], this.movementSpeed);
        if(noMove)
        {
            this.velocity = {x:0, y:0};
        }
        this.owner.setVelocity(this.velocity.x, this.velocity.y);

        return {noMove:noMove, vel:this.velocity, direction:direction};
    };

    /**
     * Plays the correct animation depending on the control input state
     * @param direction A string represent the compass direction that most closely matches the characters movement
     * @param noMove A flag specifying that no input controls are active
     */
    this.updateAnimation = function(direction, noMove)
    {
        var sprite = this.owner.getSprite();
        if(noMove)
        {
            if(sprite.getCurrentAnimationName() != this.animations["idle_" + lastDirection])
            {
                sprite.playAnimation(this.animations["idle_" + lastDirection], "forwards");
            }
        }
        else if(sprite.getCurrentAnimationName() != (this.animations["walk_" + direction]))
        {
            sprite.playAnimation(this.animations["walk_" + direction], "forwards");
            lastAnimation = this.animations["walk_" + direction];
            lastDirection = direction;
        }
    };

    /**
     * Returns true if either the tile is off the grid, or the tile contains a collidable object
     * @param current Current co-ordinates, needed to test step height
     * @param dest Co-ordinates of the tile to test
     * @returns {boolean|*} Is the move illegal
     */
    this.illegalTile = function(current, dest)
    {
        var h0 = wade.iso.getTileHeight(current.x, current.z);
        var h1 = wade.iso.getTileHeight(dest.x, dest.z);
        var dy = h1-h0;
        var illegal = Math.abs(dy) > this.maxStepHeight;
        return (illegal || !this.inGrid(dest.x, dest.z) || wade.iso.checkCollisionsAtTile(dest.x, dest.z));
    };

    // Helper function for handleTileTransition
    var edgeCrossing = function(current, next)
    {
        if(next.z > current.z)
        {
            return "nw";
        }
        else if(next.z < current.z)
        {
            return "se";
        }
        else
        {
            if(next.x > current.x)
            {
                return "ne";
            }
            else if(next.x < current.x)
            {
                return "sw";
            }
        }
        return null;
    };

    /**
     * Tests and handles moving into a new tile
     * @param pos The current position of the character in world space
     * @param vel The characters currently velocity
     * @param tileCoords The characters current co-ordinates
     * @param futureCoords The characters co-ordinates after velocity has been applied
     */
    this.handleTileTransition = function(pos, vel, tileCoords, futureCoords)
    {
        // No slide needed
        if((tileCoords.x == futureCoords.x  &&
            tileCoords.z == futureCoords.z) ||
           !this.illegalTile(tileCoords, futureCoords))
        {
            return;
        }

        // Calculate new movement vector to slide along edge
        var edgeCross = edgeCrossing(tileCoords, futureCoords);
        var newMoveVec = wade.cloneObject(edgeVectors[edgeCross]);
        var dotProduct = wade.vec2.dot(vel, newMoveVec);
        newMoveVec = wade.vec2.scale(newMoveVec, dotProduct);
        this.velocity = newMoveVec;
        this.owner.setVelocity(this.velocity);

        // We must check that our position after sliding is valid
        futureCoords = this.calcFutureCoords(pos, this.velocity);

        if(!this.illegalTile(tileCoords, futureCoords))
        {
            return; // Slide is valid
        }

        // Try to find close valid tile
        var testLocations = [];
        for(var it in unitDirections)
        {
            if(!unitDirections.hasOwnProperty(it))
            {
                continue;
            }
            var location = {x:pos.x + this.velocity.x*wade.c_timeStep + unitDirections[it].x*4*this.movementSpeed/100,
                            y:pos.y + this.velocity.y*wade.c_timeStep + unitDirections[it].y*4*this.movementSpeed/100};
            var tileLocation = wade.iso.getFlatTileCoordinates(location.x, location.y);
            if(!this.illegalTile(tileCoords, tileLocation) && !(tileLocation.x == tileCoords && tileLocation.z == tileCoords.z))
            {
                testLocations.push({worldCoords:location, tileCoords:tileLocation});
            }
        }

        // Find the tile that most closely matches our slide vector
        var bestLocation = null;
        var productValue = -1;
        for(var i=0; i<testLocations.length; i++)
        {
            var val = wade.vec2.dot(wade.vec2.normalize(this.velocity), wade.vec2.normalize(wade.vec2.sub(pos, testLocations[i].worldCoords)));
            if(val > productValue)
            {
                productValue = val;
                bestLocation = testLocations[i].worldCoords;
            }
        }
        if(bestLocation) // Valid move, shift character slightly
        {
            this.owner.setPosition(bestLocation);
            return;
        }
        this.owner.setVelocity(this.velocity = {x:0, y:0}); // No valid movement possible
    };

    /**
     * Applies one tick of velocity to the position, and returns the final cell co-ordinates
     * @param pos The current position
     * @param vel The current velocity in units per second
     * @returns {*} The cell co-ordinates we will be in
     */
    this.calcFutureCoords = function(pos, vel)
    {
        var future = {x:pos.x + vel.x*wade.c_timeStep, y:pos.y + vel.y*wade.c_timeStep};
        return wade.iso.getFlatTileCoordinates(future.x, future.y);
    };

    /**
     * Update character state based on user input
     */
    this.onUpdate = function()
    {
        // Update gamepad state
        this.updateGamepadState();

        // Update movement and get movement direction
        var movementData = this.updateVelocity();
        var direction    = movementData.direction;
        var noMove       = movementData.noMove;
        var vel          = movementData.vel;

        // Play the correct animation
        this.updateAnimation(direction, noMove);

        // Our position
        var pos = this.owner.getPosition();
        var tileCoords = wade.iso.getFlatTileCoordinates(pos.x, pos.y);

        // Will this movement result in us moving to a new tile
        var futureCoords = this.calcFutureCoords(pos, vel);

        // Moving to a different tile
        this.handleTileTransition(pos, vel, tileCoords, futureCoords);

        wade.iso.updateObjectTile(this.owner, tileCoords.x, tileCoords.z)
    };
}