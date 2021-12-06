TilemapCharacter = function()
{
    var self = null;
    var destinations = [];
    var targetObject;
    var followingPath = false;
    var lastAnimation = null;
    var lastDirection = "s";
    var rotation = 0;
    var unitDirections =
    {
        n : {x:0, y:-1},
        ne: {x:0.7071067811865475 , y:-0.7071067811865475},
        e : {x:1, y:0},
        se: {x:0.7071067811865475 , y:0.7071067811865475},
        s : {x:0, y:1},
        sw: {x:-0.7071067811865475, y:0.7071067811865475},
        w : {x:-1, y:0},
        nw: {x:-0.7071067811865475, y:-0.7071067811865475}
    };
    var rotations =
    {
        "n" : 0,
        "ne": Math.PI/4,
        "e" : Math.PI/2,
        "se": Math.PI*3/4,
        "s" : Math.PI,
        "sw": Math.PI*5/4,
        "w" : Math.PI*3/2,
        "nw": Math.PI*7/4
    };

    this.drawCollisionBox = true;

    this.maxPathLength = 18;


    /**
     * Constructs a collision box based on the bounding boxes of all sprites belonging to the scene object.
     * @returns {object} Returns a collision box of form {minX, minY, maxX, maxY}
     */
    this.generateCollisionBox = function()
    {
        var box = null;
        for(var i=0; i<this.owner.getSpriteCount(); i++)
        {
            var sprite = this.owner.getSprite(i);
            var bound = sprite.boundingBox;
            if(!box)
            {
                box = bound;
            }
            wade.expandBox(box, bound);
        }
        return box;
    };

    /**
     * Initialises the collision box and sets the local rotation value from the parent
     * If drawCollisionBox flag is true, draws the debug collision box
     * @returns {object} Returns a collision box of form {minX, minY, maxX, maxY}
     */
    this.onAddToScene = function(params)
    {
        self = this;
        this.collisionBox = this.generateCollisionBox();
        this._tileCoordinates = this.tileCoordinates();
        if(this.drawCollisionBox)
        {
            var sp = new Sprite("procedural_square_border", 3);
            this._debugDrawCollision = new SceneObject(sp);

            if(!wade.getSceneObject("debugOffset"))
            {
                wade.addSceneObject(this._debugDrawCollision, true);
            }
        }
        this.setRotationOffset((params && params.rotationOffset) || this.rotationOffset);
        rotation = this.owner.getRotation();
    };

    /**
     * The name of the behavior. This is set to 'TilemapCharacter'.
     * @type {string}
     */
    this.name = 'TilemapCharacter';

    /**
     * Automatically rotates object to match movement
     * @type {boolean}
     */
    this.automaticRotations = true;

    /**
     * Used for automatic rotations. A sprite can have any orientation
     * This offset is used when calculate the rotation angles for each direction
     * @type {number}
     */
    this.rotationOffset = 0;

    /**
     * Calculates the rotations needed for the character
     * @param offset The rotation offset to use when automatic rotations is enabled
     */
    this.setRotationOffset = function(offset)
    {
        this.rotationOffset = offset;
        this.autoRotations = wade.cloneObject(rotations);
        for(var it in this.autoRotations)
        {
            if(this.autoRotations.hasOwnProperty(it))
            {
                this.autoRotations[it] += this.rotationOffset;
            }
        }
    };

    /**
     * Whether or not to allow diagonal movement, true by default
     * @type {boolean}
     */
    this.allowDiagonal = true;

    /**
     * A flag that specifies if the character can be controlled by player input
     * @type {boolean}
     */
    this.allowInput = true;

    /**
     * The movement speed of the character (in world units per second). Note that changing this won't affect any movement that is currently in progress, only future movements. Default is 160.
     * @type {number}
     */
    this.movementSpeed = 100;

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
     * Applies one tick of velocity to the position, and returns the final cell co-ordinates
     * @param pos The current position
     * @param vel The current velocity in units per second
     * @returns {*} The cell co-ordinates we will be in
     */
    this.calcFutureCoords = function(pos, vel)
    {
        return {x:pos.x + vel.x*wade.c_timeStep, y:pos.y + vel.y*wade.c_timeStep};
    };

    /**
     * Helper Function - Returns whether the co-ordinates are inside the tilemap boundary
     * @param x The x cell co-ordinate
     * @param y The y cell co-ordinate
     * @returns {boolean} Returns true if co-ordinates exist on map
     */
    this.inGrid = function(x, y)
    {
        var size = wade.tilemap.getNumTiles();
        return !(x >= size.x || y >= size.y || x < 0 || y < 0);
    };

    /**
     *
     * @param box Takes a bounding box in the form (minX, minY, maxX, maxY}
     * @returns {boolean} Returns true if the bounding box is completely inside the tilemap area
     */
    this.boxInGrid = function(box)
    {
        var corners = boxToCorners(box);
        for(var i=0; i<corners.length; i++)
        {
            var point = wade.tilemap.getTileCoordinates(corners[i].x, corners[i].y);
            if(!this.inGrid(point.x, point.y))
            {
                return false;
            }
        }
        return true;
    };

    /**
     * Returns the closest movement direction given a provided velocity
     * @param vel Velocity or unit vector to calculate direction from
     */
    this.velocityToDirection = function(vel)
    {
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

        var difference = Math.atan2(vel.y, vel.x) + Math.PI/2;
        if (difference < 0)
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
     * Samples the gamepad to get the current states of the buttons and axis
     * If buttons are pressed, the state is stored in this._gamepadStates
     * Analog values that exceed a threshold value are also stored as true in this._gamepadStates
     */
    this.updateGamepadState = function()
    {
        var analogThreshold = 0.4; // The minimum value for analog to register as 1 for digital conversion
        var sign = function(val) // Math.sign is not widely supported
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
            for(var i=0; i<control.buttons.length; i++) // Handle the buttons
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
    };

    /**
     * Adds a direction velocity, taking into account diagonal motion
     * @param noMove Whether or not a velocity component has already been added
     * @param vel The current velocity
     * @param direction A string representing the compass direction
     */
    this.updateVelComponent = function(noMove, vel, direction)
    {
        if(!noMove && !this.allowDiagonal)
        {
            return; // We are all ready moving in straight line
        }
        wade.vec2.addInPlace(vel, unitDirections[direction]);
    };

    /**
     * Updates the velocity and calculates the closest direction for the animation system
     * @returns {{noMove: boolean, vel: {x: number, y: number}, direction: *}} Data relevant to resolving movement
     */
    this.updateVelocity = function()
    {
        var vel = {x:0, y:0};
        var noMove = true;
        if(this.allowInput)
        {
            for(var it in this._keyStates)
            {
                if(!this._keyStates.hasOwnProperty(it) || this._inputState(it) == false)
                {
                    continue;
                }
                // Sum velocity
                if(it == "up")
                {
                    this.updateVelComponent(noMove, vel, "n");
                    noMove = false;
                }
                if(it == "down")
                {
                    this.updateVelComponent(noMove, vel, "s");
                    noMove = false;
                }
                if(it == "left")
                {
                    this.updateVelComponent(noMove, vel, "w");
                    noMove = false;
                }
                if(it == "right")
                {
                    this.updateVelComponent(noMove, vel, "e");
                    noMove = false;
                }
            }
        }

        var direction = this.velocityToDirection(vel);
        this.velocity = wade.vec2.scale(unitDirections[direction], this.movementSpeed);

        if(followingPath) // If we are following a path, do not override velocity
        {
            this.velocity = this.owner.getVelocity();
            direction = this.velocityToDirection(this.velocity);
        }
        else
        {
            if(noMove)
            {
                this.velocity = {x:0, y:0};
            }
            this.owner.setVelocity(this.velocity.x, this.velocity.y);
        }
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
        var vel = this.owner.getVelocity();
        if((noMove && !followingPath) || (vel.x == 0 && vel.y == 0))
        {
            if(sprite.getCurrentAnimationName() != this.animations["idle_" + lastDirection])
            {
                var tempDirection = lastDirection;
                if(!sprite.hasAnimation(this.animations["idle_" + tempDirection]))
                {
                    // If no idle animation, try pausing current animation instead
                    sprite.stopAnimation();
                }
                else
                {
                    sprite.playAnimation(this.animations["idle_" + tempDirection], "forwards");
                }
            }
        }
        else
        {
            sprite.resumeAnimation();
            if(sprite.getCurrentAnimationName() != (this.animations["walk_" + direction]))
            {
                sprite.playAnimation(this.animations["walk_" + direction], "forwards");


                lastAnimation = this.animations["walk_" + direction];
                lastDirection = direction;
            }
            if(this.automaticRotations)
            {
                this.owner.setRotation(this.autoRotations[direction]);
            }
        }
    };

    /**
     * Returns true if either the tile is off the grid, or the tile contains a collidable object
     * @param dest Co-ordinates of the tile to test
     * @returns {boolean|*} Is the move illegal
     */
    this.illegalTile = function(dest, exception)
    {
        return (!this.inGrid(dest.x, dest.y) || wade.tilemap.checkCollisionsAtTile(dest.x, dest.y, exception));
    };

    /**
     * Returns tile co-ordinates of all terrain tiles overlapping the character
     * @returns {Array} The terrain tile co-ordinates
     */
    this.overlappingTerrainTiles = function(displace)
    {
        displace = displace || {x:0, y:0};
        var corners =
        {
            topLeft:     wade.tilemap.getTileCoordinates(this.collisionBox.minX + displace.x, this.collisionBox.minY + displace.y),
            bottomRight: wade.tilemap.getTileCoordinates(this.collisionBox.maxX + displace.x, this.collisionBox.maxY + displace.y)
        };

        var dx = corners.bottomRight.x - corners.topLeft.x;
        var dy = corners.bottomRight.y - corners.topLeft.y;

        var tiles = [];
        var numX = 1 + dx;
        var numY = 1 + dy;

        // Build tile list
        for(var i=0; i<numX; i++)
        {
            for(var j=0; j<numY; j++)
            {
                var tile = wade.cloneObject(corners.topLeft);
                tile.x += i;
                tile.y += j;
                tiles.push(tile);
            }
        }
        return tiles;
    };

    // Converts local bounding box to world co-ordinates using the provided position
    var boundingToWorld = function(pos, boundingBox)
    {
        var box = {minX:0, minY:0, maxX:0, maxY:0};
        box.minX = pos.x + boundingBox.minX;
        box.maxX = pos.x + boundingBox.maxX;
        box.minY = pos.y + boundingBox.minY;
        box.maxY = pos.y + boundingBox.maxY;
        return box;
    };

    // convert box to list of corners
    var boxToCorners = function(box)
    {
        var corners = [];
        corners.push({x:box.minX, y:box.minY});
        corners.push({x:box.minX, y:box.maxY});
        corners.push({x:box.maxX, y:box.minY});
        corners.push({x:box.maxX, y:box.maxY});
        return corners;
    };

    /**
     * Tests and handles moving into a new tile
     * @param futureCoords The characters co-ordinates after velocity has been applied in world space
     */
    this.handleTileTransition = function(futureCoords)
    {
        var displace = wade.vec2.sub(futureCoords, this.owner.getPosition());
        var legal = true;
        var tiles = this.overlappingTerrainTiles(displace);
        var worldBoundingBox = wade.cloneObject(this.collisionBox);

        worldBoundingBox.minX += displace.x;
        worldBoundingBox.maxX += displace.x;
        worldBoundingBox.minY += displace.y;
        worldBoundingBox.maxY += displace.y;

        for(var i=0; i<tiles.length; i++)
        {
            var collision = wade.tilemap.checkCollisionsAtTile(tiles[i].x, tiles[i].y, this.owner);
            if(collision)
            {
                legal = false;
                break;
            }
        }

        return (legal && this.boxInGrid(worldBoundingBox));
    };

    this.setRotation = function(newAngle)
    {
        var theta = newAngle - this.owner.getRotation();
        if(Math.abs(theta) < wade.c_epsilon)
        {
            return;
        }
        this.owner.setRotation(newAngle);
        this.collisionBox = this.generateCollisionBox();
        rotation = newAngle;
        this.resolveRotation(newAngle, theta);
    };

    this.resolveRotation = function(newAngle, theta)
    {
        if(theta == 0)
        {
            return;
        }
        var allowed = this.handleTileTransition(this.owner.getPosition());

        if(allowed == false) // Undo rotation, it's illegal
        {
            this.owner.setRotation(newAngle-theta);
            this.collisionBox = this.generateCollisionBox();
            rotation = newAngle-theta;
        }
    };

    /**
     * Update character state based on user input
     */
    this.onUpdate = function()
    {
        this._tileCoordinates = this.tileCoordinates();

        // Update collision box to account for potential rotations
        this.collisionBox = this.generateCollisionBox();

        // Update gamepad state
        this.updateGamepadState();

        // Update movement and get movement direction
        var movementData = this.updateVelocity();
        var direction    = movementData.direction;
        var noMove       = movementData.noMove;
        var vel          = movementData.vel;
        var velX         = {x:vel.x, y:0};
        var velY         = {x:0    , y:vel.y};

        // Our position
        var pos = this.owner.getPosition();
        var tileCoords = wade.tilemap.getTileCoordinates(pos.x, pos.y);

        if(this.drawCollisionBox)
        {
            if(this._debugDrawCollision)
            {
                // debug collision box
                var debugPos = {x:(this.collisionBox.minX+this.collisionBox.maxX)/2,
                                y:(this.collisionBox.minY+this.collisionBox.maxY)/2};
                this._debugDrawCollision.setPosition(debugPos);
                this._debugDrawCollision.getSprite().setSize(this.collisionBox.maxX - this.collisionBox.minX, this.collisionBox.maxY - this.collisionBox.minY);
            }
        }


        // Will this movement result in us moving to a new tile
        var futureCoords  = this.calcFutureCoords(pos, vel);
        var futureCoordsX = this.calcFutureCoords(pos, velX);
        var futureCoordsY = this.calcFutureCoords(pos, velY);

        // Moving to a different tile
        // Need to test this with components if it fails
        if(!this.handleTileTransition(futureCoords))
        {
            if(!this.handleTileTransition(futureCoordsX))
            {
                if(!this.handleTileTransition(futureCoordsY))
                {
                    this.owner.setVelocity(this.velocity = {x:0, y:0}); // No valid movement possible
                }
                else
                {
                    this.owner.setVelocity(this.velocity = velY);
                }
            }
            else
            {
                this.owner.setVelocity(this.velocity = velX);
            }
        }

        // Play the correct animation
        this.updateAnimation(direction, noMove);
    };

    this._goToNextDestination = function()
    {
        // reset collision info for our tile
        var currentGridCoords = this._tileCoordinates = this.tileCoordinates();
        var gridCoords = destinations[0];
        this._nextDestination = destinations[0];
        targetObject = destinations[0].object;
        wade.removeObjectFromArrayByIndex(0, destinations);
        wade.tilemap.moveObjectToTile(this.owner, gridCoords.x, gridCoords.y, this.movementSpeed);

        // find direction suffix (for the animation)
        var dirX = (gridCoords.x - currentGridCoords.x);
        var dirY = (gridCoords.y - currentGridCoords.y);
        dirX && (dirX /= Math.abs(dirX));
        dirY && (dirY /= Math.abs(dirY));
        var direction;
        switch (dirX.toString() + dirY)
        {
            case '-11':
                direction = 'sw';
                break;
            case '-10':
                direction = 'w';
                break;
            case '-1-1':
                direction = 'nw';
                break;
            case '0-1':
                direction = 'n';
                break;
            case '01':
                direction = 's';
                break;
            case '1-1':
                direction = 'ne';
                break;
            case '10':
                direction = 'e';
                break;
            case '11':
                direction = 'se';
                break;
        }

        if (direction != this.lastDirection)
        {
            this.lastDirection = direction;
            //this.owner.playAnimation('walk_' + this.lastDirection);
        }
    };

    /**
     * Remove any destinations that were added with setDestination()
     */
    this.clearDestinations = function()
    {
        destinations.length = 0;
    };

    /**
     * Get the next destination
     * @returns {Object} An object with x and y fields representing the next destination, or null if there are no destinations in the queue
     */
    this.getNextDestination = function()
    {
        return this._nextDestination;
    };

    this.tileCoordinates = function()
    {
        var pos = this.owner.getPosition();
        return wade.tilemap.getTileCoordinates(pos.x, pos.y);
    };

    /**
     * Set a destination (a tile to move to) for the character.
     * @param {{x: number, y: number}} gridCoords The tilemap coordinates to move to
     * @returns {boolean} Whether it was possible to add the destination (i.e. it isn't blocked by objects with collisions)
     */
    this.setDestination = function(gridCoords)
    {
        var currentPosition = this.owner.getPosition();
        var gridStart = wade.tilemap.getTileCoordinates(currentPosition.x, currentPosition.y);

        var destination = this.getNextDestination();

        // if we already had a destination
        if (destination)
        {
            // start from the next grid tile
            var deltaX = destination.x - gridStart.x;
            if (deltaX)
            {
                deltaX /= Math.abs(deltaX);
            }
            var deltaY = destination.y - gridStart.y;
            if (deltaY)
            {
                deltaY /= Math.abs(deltaY);
            }
            gridStart.x += deltaX;
            gridStart.y += deltaY;
        }

        // calculate path to destination
        var path = wade.tilemap.findPath(gridStart, gridCoords, "top-down straight", this.maxPathLength);

        // if there is a path
        if (path.length)
        {
            followingPath = true;
            // add the first node

            var worldStart = wade.tilemap.getWorldCoordinates(gridStart.x, gridStart.y);
            this.clearDestinations();
            if (Math.abs(currentPosition.x - worldStart.x) > wade.c_epsilon || Math.abs(currentPosition.y - worldStart.y) > wade.c_epsilon)
            {
                if (destination && destination.x == gridCoords.x && destination.y == gridCoords.y)
                {
                    followingPath = false;
                    return false;
                }

                // Override first moveTo using this
                var pos = this.owner.getPosition();
                var tileCoords = wade.tilemap.getTileCoordinates(pos.x, pos.y);

                var closeTiles = this.overlappingTerrainTiles();
                var bestTile = null; // compares against tiles in destinations array
                for(var i=0; i<closeTiles.length; i++)
                {
                    for(var j=0; j<path.length; j++)
                    {
                        if( closeTiles[i].x == path[j].x &&
                            closeTiles[i].y == path[j].y)
                        {
                            if(!bestTile || j > bestTile.index)
                            {
                                bestTile = {index:j, position:closeTiles[i]};
                            }
                        }
                    }
                }
                if(!bestTile)
                {
                    path[0].x = gridStart.x;
                    path[0].y = gridStart.y;
                    addDirectDestination(gridStart);
                }
                else
                {
                    // Need to remove elements from destinations array
                    path[bestTile.index].x = bestTile.position.x;
                    path[bestTile.index].y = bestTile.position.y;
                    path.splice(0, bestTile.index);
                    addDirectDestination(bestTile.position);
                }
            }

            if (gridStart.x == gridCoords.x && gridStart.y == gridCoords.y)
            {
                followingPath = false;
                return false;
            }
            // iterate over the rest of the path
            for (i=1; i<path.length-1; i++)
            {
                var previousX = path[i].x - path[i-1].x;
                var nextX = path[i+1].x - path[i].x;
                var previousY = path[i].y - path[i-1].y;
                var nextY = path[i+1].y - path[i].y;
                if (previousX != nextX || previousY != nextY)
                {
                    addDirectDestination(path[i]);
                }
            }
            // add last node
            addDirectDestination(gridCoords);


            return true;
        }
        followingPath = false;
        return false;
    };

    this.onMoveComplete = function()
    {
        // if there are more destination in the queue, proceed to the next one
        if (destinations.length)
        {
            this._goToNextDestination();
        }
        else
        {
            followingPath = false;
            // enter an idle state
            // this.owner.playAnimation('idle_iso_' + this.lastDirection);
            this.lastDirection = '';

            // fire an onDestinationReached event
            var dest = this._nextDestination;
            this._nextDestination = null;
            this.owner.processEvent('onDestinationReached', {destination: dest});

            // see if we've reached any objects
            if (targetObject)
            {
                var offsets = [{x:0, y:0}];
                targetObject.interactionOffset && offsets.push({x:-targetObject.interactionOffset.x, y:-targetObject.interactionOffset.y});
                offsets = offsets.concat(wade.tilemap.getValidMovementDirections());
                var gridCoords = this._tileCoordinates;
                for (var j=0; j<offsets.length; j++)
                {
                    var objects = wade.tilemap.getObjectsInTile(gridCoords.x + offsets[j].x, tilemap.gridCoords.y + offsets[j].y);
                    for (var i=0; i<objects.length; i++)
                    {
                        if (objects[i] == targetObject)
                        {
                            var directions = {'11': 'se', '01': 's', '-11': 'sw', '-10': 'w', '-1-1': 'nw', '0-1':'n', '1-1': 'ne', '10': 'e'};
                            var diff = {x: gridCoords.x - targetObject.tilemap._tileCoordinates.x, y: gridCoords.y - targetObject._tileCoordinates.y};
                            var dir = directions[diff.x.toString() + diff.y.toString()];
                            dir && this.setDirection(dir);
                            this.owner.processEvent('onObjectReached', {object: objects[i]});
                        }
                    }
                }
            }
        }
    };

    var addDirectDestination = function(gridCoords)
    {
        destinations.push(gridCoords);
        if (!self.owner.isMoving())
        {
            self._goToNextDestination();
        }
    };
};