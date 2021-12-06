/**
 * A Scene Object is an entity that can be added to the scene in WADE. It may contain sprites and may have behaviors associated with it.
 * @param {Sprite|Array|object} [sprites] A sprite object, or an array of sprites. You can also use this constructor by passing in a single object (so just the first parameter) that contains all the SceneObject properties that you want to set (see remarks below for more details).
 * @param {Function|Array} [behaviors] A behavior function, or an array of behavior functions
 * @param {number} [posX=0] The X coordinate of the initial world space position
 * @param {number} [posY=0] The Y coordinate of the initial world space position
 * @param {string} [name] The name of the scene object (so you can obtain a reference to this object via wade.getSceneObject)
 * <br/><br/><b>Remarks:</b><br/> You can also use this constructor by passing in a single object (so just the first parameter) that contains all the SceneObject properties that you want to set. In this case, the object structure is as follows (all fields are optional): <br/><pre>
 {
    type: 'SceneObject',
    position: {x: number, y: number},
    rotation: number,
    behaviors: Array,
    sprites: Array,
    spriteOffsets: Array,
    alignment: {x: string, y: string},
    name: string,
    visible: boolean,
    isTemplate: boolean,
    path: string,
    grid: {type: string, gridMap: Array, collisionMap: Array},
    addToScene: {autoListen: boolean, params: {}},
    flowChart: {},
    functions: {},
    properties: {}
 }
 </pre>
 Where <i>properties</i> is a set of properties to copy into the new scene object. Note that properties are deep-copied, and cannot contain functions or cyclical references.<br/>
 The <i>sprites</i> array can contain any number of sprites. See the Sprite documentation for more details about the format used to describe each sprite.<br/>
 The <i>path</i> parameter can be used to specify the name of a Path that the object should follow when it's added to the scene. Note that the path must already be in the scene when the SceneObject is created.
 The <i>grid</i> parameter is used to restrict movement, positioning and collisions to the isometric or tilemap terrain.
 The <i>flowChart</i> object may contain flow chart data as described in the documentation for wade.runFlowChart(). This flow chart would then be executed every time the object is added to the scene.
 The <i>addToScene</i> object can be used if you want the object to be added to the scene immediately. In this case, you can specify which set of parameters should be passed to the onAddToScene event (params), and whether you want the object to automatically listen for handled input events (autoListen).<br/>
 The <i>functions</i> object can contain any number of strings that will be interpreted as member functions of the SceneObject.
 * @constructor
 */
function SceneObject(sprites, behaviors, posX, posY, name)
{
    this._behaviors = [];
	this._spriteOffsets = [];
    this._moving = false;
    this._linearVelocity = {x: 0, y: 0};
    this._targetPosition = 0;
    this._animationsPlaying = 0;
    this._inScene = false;
    this._renderer = 0;
    this._angularVelocity = 0;
    this._pathTime = 0;
    this._pathSpeed = 1;
    this._pathNodeIndex = -1;
    this._isTemplate = false;
    this._rotationTarget = {valid: false, value: 0};
    this._timeouts = [];
    this._grid = null;
    this._flowChart = null;
    this.addToSceneParams = null;
    this.autoListen = false;

    // if the first parameter that was passed to this constructor is an object (and not a sprite or an array of sprites), use the properties of that object to set up the SceneObject
    var objectStyleConstructor = typeof(sprites) == 'object' && !wade.isArray(sprites) && !(sprites instanceof Sprite) && !(sprites instanceof TextSprite) && sprites;
    if (objectStyleConstructor)
    {
        // use an object-style constructor
        var c = sprites;
        this._position = {x: (c.position && c.position.x) || 0, y: (c.position && c.position.y) || 0};
        this._rotation = c.rotation || 0;
        this._alignment = {x: (c.alignment && c.alignment.x) || 0, y: (c.alignment && c.alignment.y) || 0};
        this._name = c.name;
        this._isTemplate = c.isTemplate;
        this._behaviorClasses = [];
        this._sprites = [];
        this._flowChart = c.flowChart || null;
        this._grid = c.grid || null;
		this._path = c.path;
		if (this._path)
		{
			this._path = wade.getPath(this._path);
		}

        // if we are in debug mode, make sure we have a name
        var debugMode = wade.isDebugMode();
        if (debugMode && !this._name)
        {
            wade.unnamedSceneObjectsCount = (wade.unnamedSceneObjectsCount || 0) + 1;
            this._name = 'Unnamed_Scene_Object_' + wade.unnamedSceneObjectsCount;
        }

        var k;
        if (c.behaviors)
        {
            for (k=0; k < c.behaviors.length; k++)
            {
                c.behaviors[k].name && this._behaviorClasses.push(window[c.behaviors[k].name]);
            }
        }
        if (c.sprites)
        {
            for (k=0; k < c.sprites.length; k++)
            {
                var sprite;
                if (c.sprites[k].type == 'TextSprite')
                {
                    sprite = new TextSprite(c.sprites[k]);
                }
                else
                {
                    sprite = new Sprite(c.sprites[k]);
                }
                this.addSprite(sprite, c.spriteOffsets && c.spriteOffsets[k]);
            }
        }
        // functions
        if (c.functions)
        {
            this.importFunctions(c.functions);
        }

        // extra properties
        if (c.properties)
        {
            for (var key in c.properties)
            {
                if (c.properties.hasOwnProperty(key))
                {
                    try
                    {
                        this[key] = JSON.parse(JSON.stringify(c.properties[key]));
                    }
                    catch (e) {}
                }
            }
        }
    }
    else
    {
        // use a normal function-style constructor
        this._position = {x: (posX? posX : 0), y: (posY? posY : 0)};
        this._behaviorClasses = behaviors;
        this._sprites = sprites;
        this._alignment = {x: 0, y: 0};
        this._rotation = 0;
        this._name = name || '';
		this._path = null;
    }

    // if it contains any sprites, add them to the renderer
    if (this._sprites)
    {
        // if it's got a single sprite, make it an array of 1 element
        if (!wade.isArray(this._sprites))
        {
            this._sprites = [this._sprites];
        }
        // iterate over the array of sprites
        for (var j=0; j < this._sprites.length; j++)
        {
            this._sprites[j].setSceneObject(this);
            var spriteOffset = this._spriteOffsets[j];
            if (spriteOffset)
            {
                spriteOffset.x = spriteOffset.x || 0;
                spriteOffset.y = spriteOffset.y || 0;
                spriteOffset.angle = spriteOffset.angle || 0;
                var originalOffsetSet = (typeof(spriteOffset.originalX) == 'number');
                if (!originalOffsetSet)
                {
                    spriteOffset.originalX = spriteOffset.x;
                    spriteOffset.originalY = spriteOffset.y;
                    this._rotation && wade.vec2.rotateInPlace(spriteOffset, this._rotation);
                }
                this._sprites[j].setPosition(this._position.x + spriteOffset.x, this._position.y + spriteOffset.y);
                this._sprites[j].setRotation(this._rotation + spriteOffset.angle);
            }
            else
            {
                this._sprites[j].setPosition(this._position);
                this._spriteOffsets.push({x: 0, y: 0, originalX: 0, originalY: 0, angle: 0});
                this._sprites[j].setRotation(this._rotation);
            }

            // keep track of playing animations
            (this._sprites[j].getAnimation && this._sprites[j].getAnimation().isPlaying()) && this._animationsPlaying++;
        }
    }
    else
    {
        this._sprites = [];
    }

    // if it contains any behaviors...
    if (this._behaviorClasses)
    {
        // if it contains a single behavior, make it an array of 1 element
        if (!wade.isArray(this._behaviorClasses))
        {
            this._behaviorClasses = [this._behaviorClasses];
        }

        // instantiate the behaviors
        for (var i=0; i<this._behaviorClasses.length; i++)
        {
            this._behaviors[i] = new(this._behaviorClasses[i]);
            this._behaviors[i].owner = this;
        }
    }

    if (objectStyleConstructor)
    {
        // if it's used as an object-style constructor (where you pass in a single object), "sprites" is the object that contains all parameters
        if (typeof(sprites.visible) != 'undefined')
        {
            this.setVisible(sprites.visible);
        }

        // set initial behavior properties
        if (sprites.behaviors)
        {
            for (i=0; i<sprites.behaviors.length; i++)
            {
                if (sprites.behaviors[i].properties)
                {
                    for (key in sprites.behaviors[i].properties)
                    {
                        if (sprites.behaviors[i].properties.hasOwnProperty(key))
                        {
                            var p = sprites.behaviors[i].properties[key];
                            this._behaviors[i][key] = (p && (typeof(p) == 'object'))? (wade.isArray(p)? wade.cloneArray(p) : wade.cloneObject(p)) : p;
                        }
                    }
                }
            }
        }
        // if using an object-style constructor with and addToScene property, add the object to the scene
        if (sprites.addToScene)
        {
            var addToScene = sprites.addToScene;
            wade.addSceneObject(this, addToScene.autoListen, addToScene.params);
        }
    }

    if (this._path)
    {
        this.step();
    }
}

/**
 * Set the world space position of the scene object. The position of all its sprites will be updated accordingly.
 * @param {number|Object} positionX A coordinate for the horizontal axis, or an object with 'x' and 'y' fields representing world space coordinates
 * @param {number} [positionY] A coordinate for the vertical axis
 */
SceneObject.prototype.setPosition = function(positionX, positionY)
{
    // it may be easier sometimes to pass in a single parameter (as a vector that contains x and y)
    var posX;
    var posY;
    if (typeof(positionX) == 'object')
    {
        posX = positionX.x;
        posY = positionX.y;
    }
    else
    {
        posX = positionX;
        posY = positionY;
    }

    // store the new position
    this._position.x = posX;
    this._position.y = posY;

    // update the position of all our child sprites
    for (var j=0; j < this._sprites.length; j++)
    {
        this._sprites[j].setPosition(this._position.x + this._spriteOffsets[j].x, this._position.y + this._spriteOffsets[j].y);
    }
};

/**
 * Get the world space position of the scene object
 * @returns {Object} An object with 'x' and 'y' field representing world space coordinates
 */
SceneObject.prototype.getPosition = function()
{
    return {x: this._position.x, y: this._position.y};
};

/**
 * Set a rotation angle for the scene object
 * @param {number} rotation The rotation angle in radians. A positive value indicates a clockwise rotation
 */
SceneObject.prototype.setRotation = function(rotation)
{
    this._rotation = rotation;
    for (var i=0; i<this._sprites.length; i++)
    {
        var spriteOffset = this._spriteOffsets[i];
        this._sprites[i].setRotation(rotation + spriteOffset.angle);
        if (spriteOffset.originalX || spriteOffset.originalY)
        {
            var rot = wade.vec2.rotate({x: spriteOffset.originalX, y: spriteOffset.originalY}, rotation);
            spriteOffset.x = rot.x;
            spriteOffset.y = rot.y;
            this._sprites[i].setPosition(this._position.x + spriteOffset.x, this._position.y + spriteOffset.y);
        }
    }
};

/**
 * Get the current rotation angle of the scene object
 * @returns {number} The current rotation angle in radians. A positive value indicates a clockwise rotation
 */
SceneObject.prototype.getRotation = function()
{
    return this._rotation;
};

/**
 * Move a scene object to the specified world space position, with a given speed
 * @param {number} posX The X coordinate of the target position
 * @param {number} posY The Y coordinate of the target position
 * @param {number} speed The movement speed, in world space units per second
 */
SceneObject.prototype.moveTo = function(posX, posY, speed)
{
    this._targetPosition = {x: posX, y: posY};
    var direction = {x: posX - this._position.x, y: posY - this._position.y};
    var lengthSquared = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (lengthSquared > speed * wade.c_timeStep)
    {
        this._linearVelocity = {x: direction.x * speed / lengthSquared, y: direction.y * speed / lengthSquared};
        // if this object was not being simulated, it will have to be now
        if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
        {
            wade.simulateSceneObject(this, true);
        }
        this._moving = true;
    }
    else
    {
        this.setPosition(posX, posY);
        this.stopMoving();
    }
};

/**
 * Gradually rotate an object towards a target angle
 * @param {number} angle The target angle (in radians)
 * @param {number} angularVelocity The angular velocity (in radians per second)
 */
SceneObject.prototype.rotateTo = function(angle, angularVelocity)
{
    var twoPi = 6.28318530718;
    this._rotation %= twoPi;
    angle %= twoPi;
    if (angle < 0)
    {
        angle += twoPi;
    }
    var diff = (angle - this._rotation) % twoPi;
    if (diff < 0)
    {
        diff += twoPi;
    }
    if (diff > angularVelocity * wade.c_timeStep)
    {
        this.setAngularVelocity(angularVelocity);
        this._rotationTarget.value = angle;
        this._rotationTarget.valid = true;
    }
    else
    {
        this.setRotation(angle);
        this.setAngularVelocity(0);
    }
};

/**
 * Stop a scene object that is currently moving. An 'onMoveComplete' event will be triggered.
 */
SceneObject.prototype.stopMoving = function()
{
    // if this object was being simulated and it's not playing any animations and it isn't rotating, we can suspend its simulation
    if (!this._animationsPlaying && !this._angularVelocity && !this._path &&  !this._timeouts.length && this._moving)
    {
        wade.simulateSceneObject(this, false);
    }
    var wasMoving = this._moving;
    this._moving = false;
    this._targetPosition = 0;
    this._linearVelocity.x = this._linearVelocity.y = 0;

    // fire onMoveComplete event
    wasMoving && this.processEvent('onMoveComplete');
};

/**
 * Perform a simulation step for the scene object.<br/>
 * This function is called automatically by WADE, that aims to maintain a constant calling rate where possible (60Hz by default).
 */
SceneObject.prototype.step = function()
{
    // step movement
    if (this._moving)
    {
        if (this._targetPosition)
        {
            // see if we're still far away from the target position
            var direction = {x: this._position.x - this._targetPosition.x, y: this._position.y - this._targetPosition.y};
            var distanceSquared = direction.x * direction.x + direction.y * direction.y;
            var velocitySquared = this._linearVelocity.x * this._linearVelocity.x + this._linearVelocity.y * this._linearVelocity.y;
            if (velocitySquared * wade.c_timeStep * wade.c_timeStep < distanceSquared)
            {
                // we are still quite far away, let's just move towards it
                var posX = this._position.x + this._linearVelocity.x * wade.c_timeStep;
                var posY = this._position.y + this._linearVelocity.y * wade.c_timeStep;
                this.setPosition(posX, posY);
            }
            else
            {
                // we're going to reach our target in less than one step, go there directly
                this.setPosition(this._targetPosition.x, this._targetPosition.y);
                this.stopMoving();
            }
        }
        else
        {
            this.setPosition(this._position.x + this._linearVelocity.x * wade.c_timeStep, this._position.y + this._linearVelocity.y * wade.c_timeStep);
        }
    }

    var v = this._angularVelocity;
    if (v)
    {
        // step rotation
        var twoPi = 6.28318530718;
        var delta = v * wade.c_timeStep;
        var r = this._rotation;
        var n = (r + delta);
        if (this._rotationTarget.valid)
        {

            var t = this._rotationTarget.value;
            var diff = t - r;
            if (diff < 0)
            {
                diff += twoPi;
            }
            if (Math.abs(diff) < Math.abs(delta))
            {
                this.setRotation(t);
                this.setAngularVelocity(0);
                this.processEvent('onRotationComplete');
            }
            else
            {
                n %= twoPi;
                (n < 0) && (n += twoPi);
                this.setRotation(n);
            }
        }
        else
        {
            n %= twoPi;
            (n < 0) && (n += twoPi);
            this.setRotation(n);
        }
    }

    // step animation
    if (this._animationsPlaying)
    {
        for (var i=0; i<this._sprites.length; i++)
        {
            this._sprites[i].step();
        }
    }

	// step path
	if (this._path)
	{
		var nodeIndex = this._path.evaluate(this, this._pathTime);
        for (var j=this._pathNodeIndex+1; j<=nodeIndex; j++)
        {
            this.process('onPathNode', {path: this._path, nodeIndex: j});
            if (j == this._path.getNodeCount() -1)
            {
                this.process('onPathEnd', {path: this._path});
            }
        }
        this._pathNodeIndex = nodeIndex;
		this._pathTime += wade.c_timeStep * this._pathSpeed;
	}

    // step scheduled events
    for (var k=this._timeouts.length-1; k>=0; k--)
    {
        var timeout = this._timeouts[k];
        if ((timeout.time -= wade.c_timeStep * 1000) < 0)
        {
            wade.removeObjectFromArrayByIndex(k, this._timeouts);
            // if scheduled events were the only reason for simulating this object, suspend its simulation when there are no more events
            if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
            {
                wade.simulateSceneObject(this, false);
            }
            timeout.callback && timeout.callback();
        }
    }
};

/**
 * Play an animation on all the sprites of the scene object that have an animation with a matching name
 * @param {string} name The animation name
 * @param {string} [direction] The direction of the animation. It can be 'forward', 'reverse' or 'ping-pong' (which means forward and then reverse). Default is 'forward'
 */
SceneObject.prototype.playAnimation = function(name, direction)
{
    for (var i=0; i<this._sprites.length; i++)
    {
        this._sprites[i].playAnimation(name, direction);
    }
};

/**
 * Stop any animations that are currently playing
 */
SceneObject.prototype.stopAnimation = function()
{
    for (var i=0; i<this._sprites.length; i++)
    {
        this._sprites[i].stopAnimation();
    }
};

/**
 * Resume playing any animations that had been stopped
 */
SceneObject.prototype.resumeAnimation = function()
{
    for (var i=0; i<this._sprites.length; i++)
    {
        this._sprites[i].resumeAnimation();
    }
};

/**
 * Get a behavior of the scene object
 * @param {string} [name] The name of the behavior to get.
 * @returns {Object} The requested behavior. If the 'name' parameter is omitted or falsy, the first behavior that was registered with the scene object.
 */
SceneObject.prototype.getBehavior = function(name)
{
    if (name)
    {
        for (var i=0; i<this._behaviors.length; i++)
        {
            if (this._behaviors[i].name == name)
            {
                return this._behaviors[i];
            }
        }
        return null;
    }
    else
    {
        return this._behaviors[0];
    }
};

/**
 * Get a behavior of the scene object, give its index in the array of behaviors
 * @param {number} [index] The index of the sprite to retrieve
 * @returns {Object} The requested behavior. Note that this is an instance of the behavior, not the behavior class that was passed to the SceneObject's  constructor.
 */
SceneObject.prototype.getBehaviorByIndex = function(index)
{
    return this._behaviors[index || 0];
};

/**
 * Get an array containing all the behaviors of this object
 * @returns {Array} An array containing all the behaviors of this object.
 */
SceneObject.prototype.getBehaviors = function()
{
    return wade.cloneArray(this._behaviors);
};

/**
 * Get the screen alignment of a scene object. This determines where the object is positioned following a resize event
 * @returns {Object} An object whose 'x' and 'y' fields represent the alignment of the scene object. If the alignment is set, valid values are 'left' and 'right' for the 'x' field, and 'top' and 'bottom' for the 'y' field
 */
SceneObject.prototype.getAlignment = function()
{
    return {x: this._alignment.x, y: this._alignment.y};
};

/**
 * Set the screen alignment of a scene object. This determines where the object is positioned following a resize event
 * @param {string} [leftRight] If this is 'left' or 'right', the distance between the object and one edge of the screen will be kept constant after a resize event
 * @param {string} [topBottom] If this is 'top' or 'bottom', the distance between the object and one edge of the screen will be kept constant after a resize event
 */
SceneObject.prototype.setAlignment = function(leftRight, topBottom)
{
    this._alignment.x = leftRight;
    this._alignment.y = topBottom;
};

/**
 * Process an event for the scene object and all its behaviors. If the scene object or any of its behaviors have member functions matching the eventName parameter, those functions will be called, passing the eventData parameter
 * @param {string} eventName The name of the event to process
 * @param {Object} [eventData] The data to pass to the functions that will be called
 * @returns {Boolean} Whether any of the functions called return a truthy value.
 */
SceneObject.prototype.processEvent = function(eventName, eventData)
{
    // don't process event for template objects
    if (this._isTemplate)
    {
        return false;
    }
    switch(eventName)
    {
        case 'onAnimationStart':
            // if this object wasn't being simulated, it will have to be now
            if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
            {
                wade.simulateSceneObject(this, true);
            }
            if (!eventData.restarting)
            {
                this._animationsPlaying++;
            }
            break;
        case 'onAnimationEnd':
            // if this object was being simulated and it's not moving and it's not rotating, we can suspend its simulation
            if (this._animationsPlaying == 1 && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
            {
                wade.simulateSceneObject(this, false);
            }
            this._animationsPlaying--;
            break;
    }

    return this.process(eventName, eventData);
};

/**
 * Execute a function of this object and its behaviors. If the scene object or any of its behaviors have member functions matching the functionName parameter, those functions will be called and will be passed the data parameter
 * @param {string} functionName The name of the function(s) to execute
 * @param [data] The data to pass to the functions. This can be any type and is optional.
 * @returns {boolean} Whether any of the functions called returned a truthy value.
 */
SceneObject.prototype.process = function(functionName, data)
{
    var processed = false;
    if (this[functionName])
    {
        processed = this[functionName](data);
    }
    for (var j=0; j<this._behaviors.length; j++)
    {
        if (this._behaviors[j][functionName])
        {
            processed = processed || this._behaviors[j][functionName](data);
        }
    }
    return processed;
};

/**
 * Get a sprite of the scene object at a given screen position (if there is one).<br/>
 * Note that at most one sprite will be returned. If more sprites are present at the same screen position, the one at the front will be returned.<br/>
 * @param {Object} screenPosition A position object, with 'x' and 'y' coordinates
 * @returns {Object} An object with the following fields:<br/>
 * isPresent - A boolean that describes whether any sprite was found<br/>
 * topLayer - The id of the top layer where a sprite was found<br/>
 * spriteIndex - The index of the sprite that was found. You can use this to get the sprite object with a call to getSprite
 */
SceneObject.prototype.getSpriteAtPosition = function(screenPosition)
{
    var result = {isPresent: false, topLayer: 9999, spriteIndex: 0};
    for (var j=0; j<this._sprites.length; j++)
    {
        var sprite = this._sprites[j];
        if (sprite.containsScreenPoint(screenPosition) && sprite.isVisible())
        {
            var layer = sprite.getLayer();
            var inFront = !result.isPresent || layer.id < result.topLayer;
            if (layer.id == result.topLayer && result.isPresent)
            {
                inFront = layer.compareSprites(sprite, this._sprites[result.spriteIndex]) > 0;
            }
            if (inFront)
            {
                result = {isPresent: true, topLayer: layer.id, spriteIndex: j};
                var pos = sprite.getWorldOffset(screenPosition);
                var offset = this._spriteOffsets[j];
                pos.x += offset.x;
                pos.y += offset.y;
                result.relativeWorldPosition = pos;
            }
        }
    }
    return result;
};

/**
 * Set the world space position offsets for the sprites of the scene object (i.e. the sprite positions relative to the scene object's position)
 * @param {Object} spriteOffsets An object, or an array of objects, with optional 'x' and 'y' fields representing the position offsets and an 'angle' field representing the angular offsets
 */
SceneObject.prototype.setSpriteOffsets = function(spriteOffsets)
{
    var i;
    // even if spriteOffsets is not an array, make it an array
    if (!wade.isArray(spriteOffsets))
    {
        spriteOffsets.x = spriteOffsets.originalX = spriteOffsets.x || 0;
        spriteOffsets.y = spriteOffsets.originalY = spriteOffsets.y || 0;
        spriteOffsets.angle = spriteOffsets.angle || 0;
        this._spriteOffsets = [spriteOffsets];
        this._rotation && wade.vec2.rotateInPlace(spriteOffsets, this._rotation);
    }
    else
    {
        this._spriteOffsets.length = 0;
        for (i=0; i<spriteOffsets.length; i++)
        {
            var offset = this._spriteOffsets[i] = spriteOffsets[i];
            offset.x = offset.originalX = offset.x || 0;
            offset.y = offset.originalY = offset.y || 0;
            offset.angle = offset.angle || 0;
            this._rotation && wade.vec2.rotateInPlace(offset, this._rotation);
        }
    }

    // update sprite positions and rotations
    for (i=0; i<this._spriteOffsets.length; i++)
    {
        if (this._sprites[i])
        {
            this._sprites[i].setPosition(this._position.x + this._spriteOffsets[i].x, this._position.y + this._spriteOffsets[i].y);
            this._sprites[i].setRotation(this._rotation + this._spriteOffsets[i].angle);
        }
    }
};

/**
 * Get the position of a sprite relative to the position of its parent scene object
 * @param {number} [indexOrName] The sprite index or a string representing the sprite name. If omitted or falsy, the first sprite offset is returned.
 * @returns {Object} An object with 'x' and 'y' fields representing the position offset and an 'angle' field representing the angular offset
 */
SceneObject.prototype.getSpriteOffset = function(indexOrName)
{
    indexOrName = indexOrName || 0;
    if (typeof(indexOrName) == 'string' && !parseInt(indexOrName))
    {
        for (var i=0; i<this._sprites.length; i++)
        {
            if (this._sprites[i].getName() == indexOrName)
            {
                indexOrName = i;
                break;
            }
        }
    }
    var offset = this._spriteOffsets[indexOrName];
    return {x: offset.x, y: offset.y, angle: offset.angle};
};

/**
 * Set the position of a sprite relative to the position of the scene object
 * @param {number} indexOrName The sprite index or the name of the sprite
 * @param {Object} [offset] An object with optional 'x' and 'y' fields representing the sprite offset and an 'angle' field representing the angular offset
 */
SceneObject.prototype.setSpriteOffset = function(indexOrName, offset)
{
	indexOrName = indexOrName || 0;
	offset = offset || {};
	if (typeof(indexOrName) == 'string' && !parseInt(indexOrName))
	{
		for (var i=0; i<this._sprites.length; i++)
		{
			if (this._sprites[i].getName() == indexOrName)
			{
				indexOrName = i;
				break;
			}
		}
	}
    var o = this._spriteOffsets[indexOrName];
    o.x = o.originalX = offset.x || 0;
    o.y = o.originalY = offset.y || 0;
    o.angle = offset.angle || 0;
    this._rotation && wade.vec2.rotateInPlace(o, this._rotation);
    if (this._sprites[indexOrName])
    {
        this._sprites[indexOrName].setPosition(this._position.x + o.x, this._position.y + o.y);
        this._sprites[indexOrName].setRotation(this._rotation + o.angle);
    }
};

/**
 * Check whether the scene object is currently moving
 * @returns {boolean} Whether the scene object is currently moving
 */
SceneObject.prototype.isMoving = function()
{
    return this._moving;
};

/**
 * Show or hide a scene object
 * @param {boolean} toggle Whether to show the scene object
 */
SceneObject.prototype.setVisible = function(toggle)
{
    for (var i=0; i<this._sprites.length; i++)
    {
        this._sprites[i].setVisible(toggle);
    }
};

/**
 * Check if a scene object is visible. This returns true if at least one of the child sprites is visible, unless you set checkAllSprites to true, in which case this function only returns true if all sprites are visible.
 * @param {boolean} [checkAllSprites=false] Whether to check all sprites
 * @returns {boolean} Whether the SceneObject is currently visible
 */
SceneObject.prototype.isVisible = function(checkAllSprites)
{
    if (checkAllSprites)
    {
        for (var i=0; i<this._sprites.length; i++)
        {
            if (!this._sprites[i].isVisible())
            {
                return false;
            }
        }
        return true;
    }
    else
    {
        for (i=0; i<this._sprites.length; i++)
        {
            if (this._sprites[i].isVisible())
            {
                return true;
            }
        }
        return false;
    }
};

/**
 * Add a sprite to the scene object
 * @param {Sprite} sprite The sprite to add
 * @param {object} [offset] An object with 'x' and 'y' fields representing the position offset and an 'angle' field representing the angular offset. If omitted or falsy, the offset will be (0, 0, 0). If any of the fields is omitted, its value will be 0.
 * @param {number} [index] Where to add the sprite. If omitted, the sprite will be added after any sprites already present in this scene object. If 'index' is greater than the number of sprites currently present in the scene object, the sprite will be added at the end. Check the returned value to determine the actual index that was used.
 * @returns {number} The index of the sprite that was just added
 */
SceneObject.prototype.addSprite = function(sprite, offset, index)
{
    if (typeof(index) == 'undefined')
    {
        index = this._sprites.length;
    }
    else if (index > this._sprites.length)
    {
        index = this._sprites.length;
    }
    sprite.setSceneObject(this);
    this._sprites.splice(index, 0, sprite);
    var o = offset? {x: offset.x || 0, y: offset.y || 0, angle: offset.angle || 0, originalX: offset.x || 0, originalY: offset.y || 0} : {x: 0, y: 0, angle: 0, originalX: 0, originalY: 0};
    this._rotation && wade.vec2.rotateInPlace(o, this._rotation);
    this._spriteOffsets.splice(index, 0, o);
    sprite.setPosition(this._position.x + o.x, this._position.y + o.y);
    sprite.setRotation(this._rotation + o.angle);
    if (this._inScene)
    {
        this._renderer.addSprite(sprite);
    }
    return index;
};

/**
 * Remove a sprite from the scene object, given a sprite index
 * @param {number} index The sprite to remove
 */
SceneObject.prototype.removeSpriteByIndex = function(index)
{
    this._renderer.removeSprite(this._sprites[index]);
    wade.removeObjectFromArrayByIndex(index, this._sprites);
    wade.removeObjectFromArrayByIndex(index, this._spriteOffsets);
};

/**
 * Remove a sprite from the scene object
 * @param {Sprite} sprite The sprite to remove
 */
SceneObject.prototype.removeSprite = function(sprite)
{
    for (var i=0; i<this._sprites.length; i++)
    {
        if (this._sprites[i] == sprite)
        {
            this.removeSpriteByIndex(i);
            return;
        }
    }
};

/**
 * Remove all the sprites from the scene object.
 */
SceneObject.prototype.removeAllSprites = function()
{
    for (var i=this._sprites.length-1; i>=0; i--)
    {
        this._renderer.removeSprite(this._sprites[i]);
    }
    this._spriteOffsets.length = 0;
    this._sprites.length = 0;
};

/**
 * Get the sprite object corresponding to a given sprite index
 * @param {number|string} [index] The sprite index or the sprite name. If omitted or falsy, the first sprite is returned.
 * @returns {Sprite|undefined} The sprite object
 */
SceneObject.prototype.getSprite = function(index)
{
    return this._sprites[index || 0] || this.getSpriteByName(index);
};

/**
 * Get a sprite object given its name
 * @param {string} name The name of the sprite
 * @returns {Sprite} The sprite object corresponding to the given name
 */
SceneObject.prototype.getSpriteByName = function(name)
{
    for (var i=0; i<this._sprites.length; i++)
    {
        if (this._sprites[i].getName() == name)
        {
            return this._sprites[i];
        }
    }
    return null;
};

/**
 * Get the current index of a sprite
 * @param {Sprite} sprite The sprite to look for
 * @returns {number} The index of the sprite
 */
SceneObject.prototype.getSpriteIndex = function(sprite)
{
    return this._sprites.indexOf(sprite);
};

/**
 * Check whether the scene object is in the scene
 * @returns {boolean} Whether the scene object is in the scene
 */
SceneObject.prototype.isInScene = function()
{
    return this._inScene;
};

/**
 * Get the number of sprites in the scene object
 * @returns {number} The number of sprites
 */
SceneObject.prototype.getSpriteCount = function()
{
    return this._sprites.length;
};

/**
 * Add a behavior to the scene object
 * @param behaviorClass The definition of a behavior function. Note that this is not the same as an instance of a behavior function.
 * @returns {Object} The instance of the behavior function that was just added to the object.
 */
SceneObject.prototype.addBehavior = function(behaviorClass)
{
    if (this._behaviorClasses)
    {
        this._behaviorClasses.push(behaviorClass);
    }
    else
    {
        this._behaviorClasses = [behaviorClass];
    }
    var behavior = (new(behaviorClass));
    behavior.owner = this;
    this._behaviors.push(behavior);
    return behavior;
};

/**
 * Remove a behavior from a scene object
 * @param {string} name The name of the behavior to remove
 * @returns {boolean} Whether any behavior with the specified name was found and removed
 */
SceneObject.prototype.removeBehavior = function(name)
{
    for (var i=0; i<this._behaviors.length; i++)
    {
        if (name == this._behaviors[i].name)
        {
            wade.removeObjectFromArrayByIndex(i, this._behaviors);
            wade.removeObjectFromArrayByIndex(i, this._behaviorClasses);
            return true;
        }
    }
    return false;
};

/**
 * Remove a behavior from a scene object, using the behavior index
 * @param {number} index The index of the behavior to remove
 */
SceneObject.prototype.removeBehaviorByIndex = function(index)
{
    wade.removeObjectFromArrayByIndex(index, this._behaviors);
};

/**
 * Check whether any sprite in the scene object is playing any animation
 * @returns {Boolean} Whether any sprite in the scene object is playing any animation
 */
SceneObject.prototype.isAnimating = function()
{
    return (this._animationsPlaying? true : false);
};

/**
 * Get the position where the scene object is moving to
 * @returns {Object} An object with 'x' and 'y' fields representing a world space position, or null if no target position is set
 */
SceneObject.prototype.getTargetPosition = function()
{
    return this._targetPosition? {x: this._targetPosition.x, y: this._targetPosition.y} : null;
};

/**
 * Get the rotation angle the scene object is rotating to. Note that if there is no target rotation angle, this will simply return the current rotation angle of the object.
 * @returns {number} The target rotation angle
 */
SceneObject.prototype.getTargetRotation = function()
{
    return (this._rotationTarget.valid? this._rotationTarget.value : this._rotation);
};

/**
 * Get the scene object's movement speed
 * @returns {number} The current movement speed
 */
SceneObject.prototype.getMovementSpeed = function()
{
    return Math.sqrt(this._linearVelocity.x * this._linearVelocity.x + this._linearVelocity.y * this._linearVelocity.y);
};

/**
 * Check whether this scene object overlaps a sprite
 * @param {Sprite} sprite The sprite to test
 * @param {string} [precision] How accurate the test should be. This could be 'axis-aligned' (the default value when this parameter is omitted), which only considers the axis-aligned bounding boxes of both Sprites; 'oriented' which takes into account the rotations of both Sprites; or 'pixel' that does a (much slower) per-pixel test, discarding transparent pixels.*
 * @returns {boolean} Whether the scene object and the sprite overlap each other
 */
SceneObject.prototype.overlapsSprite = function(sprite, precision)
{
    for (var i=0; i<this._sprites.length; i++)
    {
        if (this._sprites[i].overlapsSprite(sprite, precision))
        {
            return true;
        }
    }
    return false;
};

/**
 * Check whether this scene object overlaps another scene object
 * @param {SceneObject} object The other scene object to test
 * @param {string} [precision] How accurate the test should be. This could be 'axis-aligned' (the default value when this parameter is omitted), which only considers the axis-aligned bounding boxes of both Sprites; 'oriented' which takes into account the rotations of both Sprites; or 'pixel' that does a (much slower) per-pixel test, discarding transparent pixels.
 * @returns {boolean} Whether the two scene objects overlap each other
 */
SceneObject.prototype.overlapsObject = function(object, precision)
{
    var count = object.getSpriteCount();
    for (var i=0; i<count; i++)
    {
        if (this.overlapsSprite(object.getSprite(i), precision))
        {
            return true;
        }
    }
    return false;
};

/**
 * Clone the scene object
 * @param {number} [positionX] The new X coordinate for the clone's position. If omitted the X coordinate of the original object is used
 * @param {number} [positionY] The new Y coordinate for the clone's position. If omitted the Y coordinate of the original object is used
 * @returns {object} A copy of the scene object. Note that the new object won't be automatically added to the scene, even if the object you are cloning was in the scene.
 */
SceneObject.prototype.clone = function(positionX, positionY)
{
    var newObject = new SceneObject();
    wade.extend(newObject, this);
    newObject._inScene = false;
    newObject._isTemplate = false;
    newObject._name = '';

    // clone sprites
    newObject._sprites = [];
    for (var i=0; i<this._sprites.length; i++)
    {
        var clone = this._sprites[i].clone();
        clone._sceneObject = newObject;
        this._isTemplate && clone.setVisible(true);
        newObject._sprites.push(clone);
    }

    // clone object properties
    newObject._position = {x: this._position.x, y: this._position.y};
    newObject._linearVelocity = {x: this._linearVelocity.x, y: this._linearVelocity.y};
    newObject._targetPosition = this._targetPosition? {x: this._targetPosition.x, y: this._targetPosition.y} : 0;
    newObject._alignment = {x: this._alignment.x, y: this._alignment.y};
    newObject._spriteOffsets = wade.extend(true, [], this._spriteOffsets);
	newObject._timeouts = [];
    for (i=0; i<this._timeouts.length; i++)
    {
        var time = this._timeouts[i].time - ((new Date()).getTime() - this._timeouts[i].startTime);
        if (time >= 0)
        {
            if (this._timeouts[i].interval)
            {
                newObject.interval(time, this._timeouts[i].name, this._timeouts[i].data, this._timeouts[i].variance);
            }
            else
            {
                newObject.schedule(time, this._timeouts[i].name, this._timeouts[i].data, this._timeouts[i].variance);
            }
        }
    }
    newObject._flowChart = this._flowChart && wade.cloneObject(this._flowChart) || null;
    newObject._grid = this._grid && wade.cloneObject(this._grid) || null;

    // instantiate new behaviors
    newObject._behaviorClasses = wade.cloneArray(this._behaviorClasses);
    newObject._behaviors = [];
    if (newObject._behaviorClasses)
    {
        for (i=0; i<newObject._behaviorClasses.length; i++)
        {
			if (typeof(this._behaviors[i].clone) == 'function')
			{
				newObject._behaviors[i] = this._behaviors[i].clone(newObject);
			}
			else
			{
				newObject._behaviors[i] = new(this._behaviorClasses[i]);
				for (var behaviorProperty in this._behaviors[i])
				{
					if (this._behaviors[i].hasOwnProperty(behaviorProperty))
					{
						var t = typeof(this._behaviors[i][behaviorProperty]);
						if (this._behaviors[i][behaviorProperty] && t == 'object')
						{
							newObject._behaviors[i][behaviorProperty] = wade.isArray(this._behaviors[i][behaviorProperty])? wade.cloneArray(this._behaviors[i][behaviorProperty]) : wade.cloneObject(this._behaviors[i][behaviorProperty]);
						}
						else if (t != 'function' || !newObject._behaviors[i][behaviorProperty])
						{
							newObject._behaviors[i][behaviorProperty] = this._behaviors[i][behaviorProperty];
						}
					}
				}
			}
            newObject._behaviors[i].owner = newObject;
        }
    }

	if (typeof(positionX) != 'undefined' ||typeof(positionY) != 'undefined')
	{
		if (typeof(positionX) == 'undefined')
		{
			positionX = this._position.x;
		}
		if (typeof(positionY) == 'undefined')
		{
			positionY = this._position.y;
		}
		newObject.setPosition(positionX, positionY);
	}

	newObject.instanceOf = this.instanceOf || this._name || '';

    // simulate the new object if this one was simulated
    if (this.simulated)
    {
        newObject.simulated = false;
        wade.simulateSceneObject(newObject, true);
    }
    return newObject;
};

/**
 * Create a grid of clones of this SceneObject. This SceneObject becomes the top-left element of the grid
 * @param {number} numColumns The number of columns in the grid
 * @param {number} numRows The number of rows in the grid
 * @param {number} [marginX] The horizontal spacing between columns (in world units). This is 0 by default
 * @param {number} [marginY] The vertical spacing between rows (in world units). This is 0 by default
 * @returns {Array} A bi-dimensional array containing all grid elements. The element at column X and row Y can be accessed via returnValue[x][y]. Column and row indices start at 0
 */
SceneObject.prototype.toGrid = function(numColumns, numRows, marginX, marginY)
{
    var i, j;
    marginX = marginX || 0;
    marginY = marginY || 0;
    var pos = this._position;

    // calculate a bounding box to determine the actual size
    var boundingBox = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
    for (i=0; i<this.getSpriteCount(); i++)
    {
        var sprite = this.getSprite(i);
		var offset = this.getSpriteOffset(i);
        var spriteSize = sprite.getSize();
		boundingBox.minX = Math.min(boundingBox.minX, offset.x - spriteSize.x/2);
		boundingBox.minY = Math.min(boundingBox.minY, offset.y - spriteSize.y/2);
		boundingBox.maxX = Math.max(boundingBox.maxX, offset.x + spriteSize.x/2);
		boundingBox.maxY = Math.max(boundingBox.maxY, offset.y + spriteSize.y/2);
    }
	var sizeX = boundingBox.maxX - boundingBox.minX;
	var sizeY = boundingBox.maxY - boundingBox.minY;
	var gridElements = [[this]];
    for (i=1; i<=numColumns; i++)
    {
		gridElements[i-1] = gridElements[i-1] || [];
        for (j=1; j<=numRows; j++)
        {
			if (i==1 && j==1)
			{
				continue;
			}
            var posX = pos.x + (i-1) * (sizeX + marginX);
			var posY = pos.y + (j-1) * (sizeY + marginY);
            var clone = this.clone(posX, posY);
			wade.addSceneObject(clone);
			gridElements[i-1].push(clone);
        }
    }
	return gridElements;
};

/**
 * Export this SceneObject to an object that can then be used to create a new SceneObject like this one (by passing the resulting object to the SceneObject constructor).
 * @param {boolean} [stringify] Whether the resulting object should be serialized to JSON. If this is set to true, this function returns a string representation of the scene object.
 * @param {Array} [propertiesToExclude] An array of strings that contains the name of the properties of this SceneObject that you do NOT want to export.
 * @param {boolean} [serializeFunctions] Whether to serialize functions (such as onMouseDown, etc). False by default
 * @returns {object|string} An object that represents the current scene object
 */
SceneObject.prototype.serialize = function(stringify, propertiesToExclude, serializeFunctions)
{
    for (var i=0; i<this._behaviors.length; i++)
    {
        this._behaviors[i].preSerialize && this._behaviors[i].preSerialize();
    }
    var result =
    {
        type: 'SceneObject',
        position: {x: this._position.x, y: this._position.y},
        rotation: this._rotation,
        behaviors: [],
        sprites: [],
        spriteOffsets: [],
        flowChart: this._flowChart && wade.cloneObject(this._flowChart),
        grid: this._grid && wade.cloneObject(this._grid),
        alignment: {x: this._alignment.x || 'center', y: this._alignment.y || 'center'},
        name: this._name,
        isTemplate: this._isTemplate,
		path: this._path? this._path.getName() : '',
        addToScene: this._inScene? {autoListen: this.autoListen, params: this.addToSceneParams} : null,
        properties: {}
    };
    if (this._behaviorClasses)
    {
        for (i=0; i<this._behaviorClasses.length; i++)
        {
            var name = (this._behaviors[i].name || this._behaviorClasses[i].name);
            if (!name)
            {
                // try to find a name for the behavior by looking through the global functions
                for (var globalKey in window)
                {
                    try
                    {
                        if (window.hasOwnProperty(globalKey) && typeof(window[globalKey]) == 'function' && window[globalKey] == this._behaviorClasses[i])
                        {
                            name = globalKey;
                            break;
                        }
                    }
                    catch (e) {}
                }
                if (!name)
                {
                    wade.warn("Warning - Trying to export a scene object with an unnamed behavior, which will be skipped. Add a 'name' property to your behaviors to correct this.");
                }
            }
            if (name)
            {
                var properties;
                if (this._behaviors[i].serialize)
                {
                    properties = this._behaviors[i].serialize();
                }
                else
                {
                    properties = {};
                    for (var behaviorKey in this._behaviors[i])
                    {
                        if (this._behaviors[i].hasOwnProperty(behaviorKey))
                        {
                            if (behaviorKey[0] != '_' && behaviorKey != 'name')
                            {
                                try
                                {
                                    var s = JSON.stringify(this._behaviors[i][behaviorKey]);
                                    properties[behaviorKey] = JSON.parse(s);
                                }
                                catch (e) {}
                            }
                        }
                    }
                }
                var obj = {name: name};
                if (properties)
                {
                    obj.properties = properties;
                }
                result.behaviors.push(obj);
            }
        }
    }
    for (i=0; i<this._spriteOffsets.length; i++)
    {
        var spriteOffset;
        if (this._sprites[i].baseOffset)
        {
            spriteOffset = {x: this._sprites[i].baseOffset.x, y: this._sprites[i].baseOffset.y};
        }
        else
        {
            var ox = typeof(this._spriteOffsets[i].originalX) == 'number'? this._spriteOffsets[i].originalX : this._spriteOffsets[i].x;
            var oy = typeof(this._spriteOffsets[i].originalY) == 'number'? this._spriteOffsets[i].originalY : this._spriteOffsets[i].y;
            spriteOffset = {x: ox, y: oy};
        }
        spriteOffset.angle = this._spriteOffsets[i].angle;
        result.spriteOffsets.push(spriteOffset);
    }
    for (i=0; i<this._sprites.length; i++)
    {
        result.sprites.push(this._sprites[i].serialize());
    }
    var exclude = ['autoListen', 'addToSceneParams', 'simulated', 'eventResponse', 'flowChartStatus', 'iso'];
    propertiesToExclude && (exclude = exclude.concat(propertiesToExclude));
    for (var key in this)
    {
        if (this.hasOwnProperty(key))
        {
            if (key[0] != '_' && exclude.indexOf(key) == -1)
            {
                if (serializeFunctions && typeof(this[key]) == 'function')
                {
                    result.functions = result.functions || {};
                    result.functions[key] = this[key].toString();
                }
                else
                {
                    try
                    {
                        var j = JSON.stringify(this[key]);
                        result.properties[key] = JSON.parse(j);
                    }
                    catch (e) {}
                }
            }
        }
    }
    for (i=this._behaviors.length-1; i>=0; i--)
    {
        this._behaviors[i].postSerialize && this._behaviors[i].postSerialize();
    }

    return (stringify? JSON.stringify(result, null, '\t') : result);
};

/**
 * Get an array of objects overlapping this object
 * @param {boolean} [searchAllLayers] Whether to extend the search to all layers. This is false by default, meaning that only overlapping sprites on the same layer will be considered.
 * @param {string} [precision] How accurately to search for overlaps. This can be either 'axis-aligned' (which would consider the axis-aligned bounding box of the sprites), or 'oriented', which takes into account the rotation of each sprite. Default is 'axis-aligned'.
 * @returns {SceneObjectGroup} A SceneObjectGroup containing all the objects that are overlapping this object
 */
SceneObject.prototype.getOverlappingObjects = function(searchAllLayers, precision)
{
    var result = [];
    for (var i=0; i<this._sprites.length; i++)
    {
        var objs = this._sprites[i].getOverlappingObjects(searchAllLayers, precision);
        for (var j=0; j<objs.length; j++)
        {
            (i == 0 || result.indexOf(objs[j]) == -1) && result.push(objs[j]);
        }
    }
    return new SceneObjectGroup(result);
};

/**
 * Set the angular velocity of the object.
 * @param {number} velocity The angular velocity of the object, in radians per second
 */
SceneObject.prototype.setAngularVelocity = function(velocity)
{
    if (velocity)
    {
        // if this object was not being simulated, it will have to be now
        if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
        {
            wade.simulateSceneObject(this, true);
        }
    }
    else
    {
        // if this object was simulated and it isn't moving and it isn't animating, we can stop simulating it now
        if (this._angularVelocity && !this._animationsPlaying && !this._moving && !this._path && !this._timeouts.length)
        {
            wade.simulateSceneObject(this, false);
        }
        this._rotationTarget.valid = false;
    }
    this._angularVelocity = velocity;
};

/**
 * Get the current angular velocity of the object
 * @returns {number} The angular velocity of the object, in radians per second
 */
SceneObject.prototype.getAngularVelocity = function()
{
    return this._angularVelocity;
};

/**
 * Set the current linear velocity of the object. Note that calling this function on an object that is moving towards a specific target (that had been set with a call to <i>moveTo</i>) will cancel the current movement towards the target.
 * @param {number|{x: number, y: number}} velocityX The x component of the velocity (a number), or an object with <i>x</i> and <i>y</i> fields representing the linear velocity of the object
 * @param {number} velocityY The y component of the velocity
 */
SceneObject.prototype.setVelocity = function(velocityX, velocityY)
{
    var velocity = typeof(velocityX) == 'object'? velocityX : {x: velocityX, y: velocityY};
    if (velocity.x || velocity.y)
    {
        this._linearVelocity.x = velocity.x;
        this._linearVelocity.y = velocity.y;
        this._targetPosition = 0;
        // if this object was not being simulated, it will have to be now
        if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
        {
            wade.simulateSceneObject(this, true);
        }
        this._moving = true;
    }
    else
    {
        if (this._linearVelocity.x || this._linearVelocity.y)
        {
            this.stopMoving();
        }
    }
};

/**
 * Get the current linear velocity of the object
 * @returns {{x: number, y: number}} An object with <i>x</i> and <i>y</i> fields representing the linear velocity of the object
 */
SceneObject.prototype.getVelocity = function()
{
    return {x: this._linearVelocity.x, y: this._linearVelocity.y};
};

/**
 * Schedule the execution and processing of a function for this object. The scheduled function will be cancelled when the object is removed from the scene, or when SceneObject.unschedule is called
 * @param {number} time How many milliseconds to wait before firing the event
 * @param {string} functionName The name of the function to execute for this object. If the object <b>or any of its behaviors</b> have a function with this name, it will be executed
 * @param {object} [data] The data to pass to the event function
 */
SceneObject.prototype.schedule = function(time, functionName, data)
{
    if (this.isInScene())
    {
        var that = this;
        this._timeouts.push({name: functionName, time: time,  data: data, callback: function()
        {
            that.process(functionName, data);
        }});
        if (!this.simulated)
        {
            wade.simulateSceneObject(this, true);
        }
    }
    else
    {
        wade.warn('Warning - Trying to schedule an event for an object that is not in the scene.');
    }
};

/**
 * Schedule the execution and processing of a function for this object, repeating it periodically. The scheduled function will be cancelled when the object is removed from the scene, or when SceneObject.unschedule is called
 * @param {number} time How many milliseconds to wait between function calls
 * @param {string} functionName The name of the function to execute for this object. If the object <b>or any of its behaviors</b> have a function with this name, it will be executed
 * @param {object} [data] The data to pass to the event function
 * @param {number} [variance] A maximum amount of milliseconds to randomly add or subtract to the <i>time</i> parameter
 */
SceneObject.prototype.interval = function(time, functionName, data, variance)
{
    if (this.isInScene())
    {
        var that = this;
        var t = time;
        if (variance)
        {
            t += Math.random() * variance * 2 - variance;
        }
        this._timeouts.push({interval: true, name: functionName, time: t, data: data, variance: variance, callback: function()
        {
            that.process(functionName, data);
            that.interval(time, functionName, data, variance);
        }});
        if (!this.simulated)
        {
            wade.simulateSceneObject(this, true);
        }
    }
    else
    {
        wade.warn('Warning - Trying to schedule an event for an object that is not in the scene.');
    }
};

/**
 * Cancel any scheduled events with the given name for this object
 * @param {string} eventName The name of the scheduled event to cancel
 */
SceneObject.prototype.unschedule = function(eventName)
{
    if (eventName)
    {
        for (var i=this._timeouts.length-1; i>=0; i--)
        {
            if (this._timeouts[i].name == eventName)
            {
                wade.removeObjectFromArrayByIndex(i, this._timeouts);
            }
        }
    }
    else
    {
        this._timeouts.length = 0;
    }

    // if scheduled events were the only reason for simulating this object, suspend its simulation when there are no more events
    if (!this._animationsPlaying && !this._moving && !this._angularVelocity && !this._path && !this._timeouts.length)
    {
        wade.simulateSceneObject(this, false);
    }
};

/**
 * Set a name for the scene object, so it can be retrieved via wade.getSceneObject(). Note that you can't have more objects with the same name in the scene at the same time.
 * @param {string} [name] The name to set
 */
SceneObject.prototype.setName = function(name)
{
    name = name || '';
    if (!this._name || this._name != name)
    {
        var oldName = this._name;
        this._name = name;
        wade.onObjectNameChange(this, oldName, this._name);
    }
};

/**
 * Get the current name of this object, if it was set when the object was created or with SceneObject.setName()
 * @returns {string} The name of this object
 */
SceneObject.prototype.getName = function()
{
    return this._name;
};

/**
 * Start listening for an event. This is the same as calling <i>wade.addEventListener(SceneObject, eventName)</i>
 * @param {string} eventName The name of the event
 */
SceneObject.prototype.listenFor = function(eventName)
{
    wade.addEventListener(this, eventName);
};

/**
 * Stop listening for an event. This is the same as calling <i>wade.removeEventListener(SceneObject, eventName)</i>
 * @param {string} eventName The name of the event
 */
SceneObject.prototype.stopListeningFor = function (eventName)
{
    wade.removeEventListener(this, eventName);
};

/**
 * Check if the object is currently listening for a specific type of event. This is the same as calling <i>wade.isEventListener(SceneObject, eventName)</i>
 * @param {string} eventName The name of the event
 * @returns {boolean} Whether the object is currently listening for the event
 */
SceneObject.prototype.isListeningFor = function(eventName)
{
    return wade.isEventListener(this, eventName);
};

/**
 * Check whether this object is a template. A template is a scene object that never receives any events, and is set to be invisible as soon as it's added to the scene
 * @returns {boolean} whether this object is a template
 */
SceneObject.prototype.isTemplate = function()
{
    return this._isTemplate;
};

/**
 * Set a scene object to be a template. A template is a scene object that never receives any events, and is set to be invisible as soon as it's added to the scene. By default, scene objects are note templates.
 * @param {boolean} [toggle] Whether this scene object should be a template or not. If omitted, this parameter is assumed to be true.
 */
SceneObject.prototype.setAsTemplate = function(toggle)
{
    if (typeof(toggle) == 'undefined')
    {
        toggle = true;
    }
    this._isTemplate = toggle;
};

/**
 * Fade in effect, gradually changing the opacity (alpha) of the all the sprites of this object from 0 to 1. If any sprite is invisible, it is set to visible before fading in.
 * @param {number} time How many seconds the transition should last. Note that this won't be extremely accurate - to make the effect smooth, it must ultimately depend on the actual frame rate of the app.
 * @param {function} [callback] A function to execute when the transition is over
 */
SceneObject.prototype.fadeIn = function(time, callback)
{
    var numSprites = this._sprites.length;
    if (!numSprites)
    {
        setTimeout(function()
        {
            callback && callback();
        }, 0);
        return;
    }
    for (var i=0; i<numSprites-1; i++)
    {
        this.getSprite(i).fadeIn(time);
    }
    this.getSprite(numSprites-1).fadeIn(time, callback);
};

/**
 * Fade out effect, gradually changing the opacity (alpha) of the all the sprites of this object from 1 to 0. After fading out, all sprites are set to invisible.
 * @param {number} time How many seconds the transition should last. Note that this won't be extremely accurate - to make the effect smooth, it must ultimately depend on the actual frame rate of the app.
 * @param {function} [callback] A function to execute when the transition is over
 */
SceneObject.prototype.fadeOut = function(time, callback)
{
    var numSprites = this._sprites.length;
    if (!numSprites)
    {
        setTimeout(function()
        {
            callback && callback();
        }, 0);
        return;
    }
    for (var i=0; i<numSprites-1; i++)
    {
        this.getSprite(i).fadeOut(time);
    }
    this.getSprite(numSprites-1).fadeOut(time, callback);
};

/**
 * Import functions from an object that contains their string representations
 * @param {Object} functionObject An object in the format {functionName1: functionCode1, functionName2: functionCode2, ...} where functionCode is always a string.
 */
SceneObject.prototype.importFunctions = function(functionObject)
{
    var debugMode = wade.isDebugMode();
    var functionsScript = '';
    for (var functionName in functionObject)
    {
        if (functionObject.hasOwnProperty(functionName))
        {
            if (!debugMode)
            {
                try
                {
                    eval('this.' + functionName + ' = ' + functionObject[functionName]);
                }
                catch (e)
                {
                    wade.error('Script error in ' + this._name + '.' + functionName + ': ' + e.message);
                }
            }
            else
            {
                functionsScript += '\nthis.' + functionName + ' = ' + functionObject[functionName];
            }
        }
    }
    if (debugMode)
    {
        functionsScript += '\n//# sourceURL=wade://wade.app/SceneObjects/_.' + this._name.replace(/ /g, '_');
        try
        {
            eval(functionsScript);
            this._functionsScript = functionsScript;
        }
        catch (e)
        {
            for (functionName in functionObject)
            {
                if (functionObject.hasOwnProperty(functionName))
                {
                    try
                    {
                        eval('this.' + functionName + ' = ' + functionObject[functionName]);
                    }
                    catch (e)
                    {
                        wade.error('Script error in ' + this._name + '.' + functionName + ': ' + e.message);
                    }
                }
            }
        }
    }
};

/**
 * Get the currently active Path for this SceneObject
 * @returns {Path} The currently active path.
 */
SceneObject.prototype.getPath = function()
{
	return this._path;
};

/**
 * Set the currently active Path for this SceneObject. The SceneObject will start following the path immediately.
 * @param {Path|string} path A Path object, or the name of a path that is currently in the scene.
 * @param {boolean} [setInitialValues] Whether the object and its sprite should be scanned to set the initial values of all properties that are used on Node 0 (the first node) of the path. Note that this effectively creates a copy of the path, it doesn't modify the original one.
 * @param {number} [speedMultiplier=1] A factor to multiply the base speed defined in the path data
 */
SceneObject.prototype.setPath = function(path, setInitialValues, speedMultiplier)
{
    this._pathTime = 0;
    this._pathSpeed = typeof(speedMultiplier) == 'undefined'? 1 : speedMultiplier;
    this._pathNodeIndex = -1;
	if (path && (typeof(path) == 'string'))
	{
		path = wade.getPath(path);
	}
	if (!path)
	{
		this._path = null;
        if (!this._animationsPlaying && !this._moving && !this._angularVelocity)
        {
            wade.simulateSceneObject(this, false);
        }
	}
    else
    {
        if (setInitialValues)
        {
            this._path = path.clone();
            this._path.setFromSceneObject(this, 0);
        }
        else
        {
            this._path = path;
        }
        if (!this._animationsPlaying && !this._moving && !this._angularVelocity)
        {
            wade.simulateSceneObject(this, true);
        }

        // do an initial simulation step immediately
        var nodeIndex = this._path.evaluate(this, this._pathTime);
        for (var j=this._pathNodeIndex+1; j<=nodeIndex; j++)
        {
            this.process('onPathNode', {path: this._path, nodeIndex: j});
        }
        this._pathNodeIndex = nodeIndex;
    }
};

/**
 * Get the script (as a string) that defines the functions associated with this object when it was constructed or the last time importFunctions was called
 * @returns {string} The source of the functions script
 */
SceneObject.prototype.getFunctionsScript = function()
{
    return this._functionsScript || '';
};

/**
 * Draw a SceneObject to an image in CPU memory.
 * @param {string} imageName The target image name
 * @param {boolean} [replace] Whether to replace any existing image with that name. Set this to false to draw on top of an existing image.
 */
SceneObject.prototype.drawToImage = function(imageName, replace)
{
    if (!this._sprites.length)
    {
        if (replace)
        {
            wade.setImage(imageName, wade.getImage(), true);
        }
        return;
    }
    if (this._sprites.length == 1)
    {
        this._sprites[0].drawToImage(imageName, replace);
        return;
    }
    var bb = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
    for (var i=0; i<this._sprites.length; i++)
    {
        var s = this._sprites[i].getSize();
        bb.minX = Math.min(bb.minX, this._spriteOffsets[i].x - s.x / 2);
        bb.minY = Math.min(bb.minY, this._spriteOffsets[i].y - s.y / 2);
        bb.maxX = Math.max(bb.maxX, this._spriteOffsets[i].x + s.x / 2);
        bb.maxY = Math.max(bb.maxY, this._spriteOffsets[i].y + s.y / 2);
    }
    var empty = new Sprite();
    empty.setDrawFunction(wade.doNothing);
    empty.setSize(bb.maxX - bb.minX, bb.maxY - bb.minY);
    empty.drawToImage(imageName, replace);
    var center = {x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2};
    for (i=0; i<this._sprites.length; i++)
    {
        this._sprites[i].drawToImage(imageName, false, wade.vec2.sub(this._spriteOffsets[i], center));
    }
};

/**
 * Assigns a flow chart to this SceneObject. If the object is already in the scene, the flow chart is executed immediately. If the object is not in the scene, the flow chart is executed the next time (and every time) the object is added to the scene.
 * In any case, the flow chart is cancelled when the object is removed from the scene. This means that any node in the chart that is supposed to be executed when the object is not in the scene will not be executed. However the active node (even those that include asynchrnous operations) will always be fully executed.
 * @param {object} flowChartData A data structure describing the flow chart. See the documentation of wade.runFlowChart() for details.
 */
SceneObject.prototype.setFlowChart = function(flowChartData)
{
    this._flowChart = wade.cloneObject(flowChartData);
};

/**
 * Get a reference to the current flow chart data structure associated with this SceneObject. This will be null unless it was set via setFlowChart, or via the SceneObject constructor.
 * @returns {Object} The flow chart data. See the documentation of wade.runFlowChart() for details.
 */
SceneObject.prototype.getFlowChart = function()
{
    return this._flowChart;
};

/**
 * Change the grid properties of the SceneObject
 * @param {{type: string, collisionMap: Array, gridMap: Array, gridCoords: Object}} gridData The grid properties of the object.
 */
SceneObject.prototype.setGrid = function(gridData)
{
    this._grid = wade.cloneObject(gridData);
};

/**
 * Get a copy of the grid properties of the SceneObject
 * @returns {Object} The grid properties of the SceneObject
 */
SceneObject.prototype.getGrid = function()
{
    return this._grid && wade.cloneObject(this._grid);
};

/**
 * Get a reference to the grid properties of the SceneObject
 * @returns {Object} The grid properties of the SceneObject
 */
SceneObject.prototype.getGridRef = function()
{
    return this._grid;
};

/**
 * Check whether the SceneObject is currently visible on the screen
 * @returns {boolean} Whether the SceneObject is currently visible on the screen
 */
SceneObject.prototype.isOnScreen = function()
{
    for (var i=0; i<this._sprites.length; i++)
    {
        if (this._sprites[i].isOnScreen())
        {
            return true;
        }
    }
    return false;
};

/**
 * Get the axis-aligned bounding box that contains all the sprites of this SceneObject
 * @returns {object} An object with minX, minY, maxY and maxY properties describing the bounding box in world space. If the scene object has no sprites, an object where all properties are set to 0 is returned.
 */
SceneObject.prototype.getBoundingBox = function()
{
    if (!this._sprites.length)
    {
        return {minX: 0, minY: 0, maxX: 0, maxY: 0};
    }
    var bb = wade.cloneObject(this._sprites[0].boundingBox);
    for (var i=1; i<this._sprites.length; i++)
    {
        wade.expandBox(bb, this._sprites[i].boundingBox);
    }
    return bb;
};

/**
 * Get the axis-aligned bounding box that contains all the sprites of this SceneObject in screen space
 * @returns {object} An object with minX, minY, maxY and maxY properties describing the bounding box in screen space. If the scene object has no sprites, an object where all properties are set to 0 is returned.
 */
SceneObject.prototype.getScreenBoundingBox = function()
{
    if (!this._sprites.length)
    {
        return {minX: 0, minY: 0, maxX: 0, maxY: 0};
    }
    var bb = this._sprites[0].getScreenBoundingBox();
    for (var i=1; i<this._sprites.length; i++)
    {
        wade.expandBox(bb, this._sprites[i].getScreenBoundingBox());
    }
    return bb;
};

// Undocumented (i.e. non-exposed) functions:

SceneObject.prototype.addSpritesToRenderer = function(renderer)
{
    this._inScene = true;
    this._renderer = renderer;
    for (var i=0; i<this._sprites.length; i++)
    {
        renderer.addSprite(this._sprites[i]);
    }
};

SceneObject.prototype.removeSpritesFromRenderer = function()
{
    if (this._inScene)
    {
        this._inScene = false;
        for (var i=0; i<this._sprites.length; i++)
        {
            if (this._sprites[i].isVisible())
            {
                this._sprites[i].setDirtyArea();
            }
            this._renderer.removeSprite(this._sprites[i]);
        }
    }
};

SceneObject.prototype.needsSimulation = function()
{
    return (this._animationsPlaying || this._moving || this._angularVelocity || this._path || this._timeouts.length);
};

// Deprecated functions

SceneObject.prototype.unscheduleAll = function()
{
    wade.warn('Warning - SceneObject.unscheduleAll() is now deprecated and will be removed in future versions of WADE. Use unschedule with no parameters instead');
    this._timeouts.length = 0;
};
